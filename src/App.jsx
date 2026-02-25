import { useState, useEffect, useRef } from 'react';
import { supabase, supabaseFetch } from './lib/supabase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const resolved = useRef(false);

  // ─── Mark loading done (only once) ───
  const resolve = (sess, prof, err) => {
    if (resolved.current) return;
    resolved.current = true;
    if (sess) setSession(sess);
    if (prof) setProfile(prof);
    if (err) setError(err);
    setLoading(false);
  };

  // ─── Fetch profile using raw fetch (never hangs) ───
  const fetchProfile = async (userId) => {
    try {
      const prof = await supabaseFetch(`profiles?id=eq.${userId}`, { single: true });
      if (!prof) {
        // Retry once — trigger may not have fired yet
        await new Promise((r) => setTimeout(r, 1500));
        const retry = await supabaseFetch(`profiles?id=eq.${userId}`, { single: true });
        if (!retry) throw new Error('פרופיל לא נמצא');
        return retry;
      }
      return prof;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    // ═══ SAFETY NET: Force-resolve after 8 seconds ═══
    const safetyTimer = setTimeout(() => {
      if (!resolved.current) {
        console.warn('Safety timeout: forcing load resolution');
        // Clear stale session so the Supabase client isn't locked
        // when the user tries to log in from the Auth screen
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        resolve(null, null, null);
      }
    }, 8000);

    // ═══ PRIMARY: getSession → fetch profile ═══
    const init = async () => {
      try {
        const { data: { session: initialSession }, error: sessErr } =
          await supabase.auth.getSession();

        if (sessErr || !initialSession) {
          resolve(null, null, null);
          return;
        }

        try {
          const prof = await fetchProfile(initialSession.user.id);
          resolve(initialSession, prof, null);
        } catch (profErr) {
          console.error('Profile fetch failed:', profErr);
          resolve(initialSession, null, 'שגיאה בטעינת פרופיל המשתמש.');
        }
      } catch (err) {
        console.error('Init error:', err);
        resolve(null, null, null);
      }
    };

    init();

    // ═══ LISTENER: login / logout events ═══
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth event:', event);

        if (event === 'SIGNED_IN' && newSession?.user) {
          try {
            const prof = await fetchProfile(newSession.user.id);
            setSession(newSession);
            setProfile(prof);
            setError(null);
            setLoading(false);
          } catch (err) {
            setSession(newSession);
            setProfile(null);
            setError('שגיאה בטעינת פרופיל המשתמש.');
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setError(null);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // ─── Logout ───
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setSession(null);
    setProfile(null);
    setError(null);
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 page-bg" dir="rtl">
        <Loader2 size={36} className="text-cyan-400 animate-spin" />
        <p className="text-blue-200/40 text-sm">טוען...</p>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 page-bg" dir="rtl">
        <div className="glass p-8 text-center max-w-sm">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium"
            >
              נסה שוב
            </button>
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-blue-200/60 text-sm font-medium hover:bg-white/5 transition-colors"
            >
              התנתק
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Not logged in ───
  if (!session || !profile) {
    return <Auth />;
  }

  // ─── Route by role ───
  if (profile.role === 'admin') {
    return <AdminPanel profile={profile} onLogout={handleLogout} />;
  }
  return <Dashboard profile={profile} onLogout={handleLogout} />;
}