import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
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

  // ─── Mark loading as done (only once) ───
  const resolve = (sess, prof, err) => {
    if (resolved.current) return;
    resolved.current = true;
    if (sess) setSession(sess);
    if (prof) setProfile(prof);
    if (err) setError(err);
    setLoading(false);
  };

  // ─── Fetch profile with timeout ───
  const fetchProfileSafe = async (userId) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      if (fetchErr) {
        // Profile might not exist yet — retry once after 1.5s
        if (fetchErr.code === 'PGRST116') {
          await new Promise((r) => setTimeout(r, 1500));

          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), 5000);

          const { data: retry, error: retryErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
            .abortSignal(controller2.signal);

          clearTimeout(timeout2);
          if (retryErr) throw retryErr;
          return retry;
        }
        throw fetchErr;
      }
      return data;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  useEffect(() => {
    // ═══ SAFETY NET: Force-resolve loading after 8 seconds no matter what ═══
    const safetyTimer = setTimeout(() => {
      if (!resolved.current) {
        console.warn('Safety timeout: forcing load resolution');
        resolve(null, null, null);
      }
    }, 8000);

    // ═══ PRIMARY: Try getSession first (synchronous-ish, fast) ═══
    const init = async () => {
      try {
        const { data: { session: initialSession }, error: sessErr } = await supabase.auth.getSession();

        if (sessErr) {
          console.error('getSession error:', sessErr);
          resolve(null, null, null);
          return;
        }

        if (!initialSession) {
          // No session → show login
          resolve(null, null, null);
          return;
        }

        // Session exists → fetch profile
        try {
          const prof = await fetchProfileSafe(initialSession.user.id);
          resolve(initialSession, prof, null);
        } catch (profErr) {
          console.error('Profile fetch failed:', profErr);
          // Session exists but profile failed — still let them through
          // so they see an error screen with a retry button, not infinite loading
          resolve(initialSession, null, 'שגיאה בטעינת פרופיל המשתמש.');
        }
      } catch (err) {
        console.error('Init error:', err);
        resolve(null, null, null);
      }
    };

    init();

    // ═══ LISTENER: Handle future auth events (login, logout, etc.) ═══
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth event:', event);

        if (event === 'SIGNED_IN' && newSession?.user) {
          try {
            const prof = await fetchProfileSafe(newSession.user.id);
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
        // Ignore INITIAL_SESSION and TOKEN_REFRESHED — getSession handles initial load
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

  // ─── Loading (guaranteed to resolve within 8s) ───
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 page-bg" dir="rtl">
        <Loader2 size={36} className="text-cyan-400 animate-spin" />
        <p className="text-blue-200/40 text-sm">טוען...</p>
      </div>
    );
  }

  // ─── Error with retry ───
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