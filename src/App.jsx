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

  // ─── Mark initial loading done (only once) ───
  const resolve = (sess, prof, err) => {
    if (resolved.current) return;
    resolved.current = true;
    setSession(sess ?? null);
    setProfile(prof ?? null);
    setError(err ?? null);
    setLoading(false);
  };

  // ─── Fetch profile using raw fetch (never hangs) ───
  const fetchProfile = async (userId) => {
    const prof = await supabaseFetch(`profiles?id=eq.${userId}`, { single: true });
    if (!prof) {
      // Retry once — trigger may not have fired yet
      await new Promise((r) => setTimeout(r, 1500));
      const retry = await supabaseFetch(`profiles?id=eq.${userId}`, { single: true });
      if (!retry) throw new Error('פרופיל לא נמצא');
      return retry;
    }
    return prof;
  };

  // ─── Fallback: re-check session after explicit login ───
  // Called by Auth component if the onAuthStateChange listener doesn't fire
  const recheckSession = async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) {
        const prof = await fetchProfile(s.user.id);
        setSession(s);
        setProfile(prof);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      console.error('Session recheck failed:', err);
    }
  };

  useEffect(() => {
    // Version counter to discard stale profile fetches when events overlap
    let fetchVersion = 0;

    // ═══ SAFETY NET: Force-resolve after 8 seconds ═══
    const safetyTimer = setTimeout(() => {
      if (!resolved.current) {
        console.warn('Safety timeout: forcing load resolution');
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        resolve(null, null, null);
      }
    }, 8000);

    // ═══ LISTENER: Handle ALL auth state changes ═══
    // Set up BEFORE any getSession call (Supabase v2 best practice).
    // Supabase v2 fires INITIAL_SESSION immediately, which replaces
    // the old init() + getSession() pattern and eliminates the race
    // condition between init and the listener.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth event:', event);
        const myVersion = ++fetchVersion;

        // ── Initial session (persisted from localStorage after refresh) ──
        if (event === 'INITIAL_SESSION') {
          if (newSession?.user) {
            try {
              const prof = await fetchProfile(newSession.user.id);
              if (myVersion !== fetchVersion) return;
              resolve(newSession, prof, null);
            } catch (err) {
              if (myVersion !== fetchVersion) return;
              console.error('Profile fetch failed (initial):', err);
              resolve(newSession, null, 'שגיאה בטעינת פרופיל המשתמש.');
            }
          } else {
            resolve(null, null, null);
          }
          return;
        }

        // ── User signed in ──
        if (event === 'SIGNED_IN' && newSession?.user) {
          try {
            const prof = await fetchProfile(newSession.user.id);
            if (myVersion !== fetchVersion) return;
            setSession(newSession);
            setProfile(prof);
            setError(null);
          } catch (err) {
            if (myVersion !== fetchVersion) return;
            setSession(newSession);
            setProfile(null);
            setError('שגיאה בטעינת פרופיל המשתמש.');
          }
          setLoading(false);
          return;
        }

        // ── User signed out ──
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        // ── Token refreshed (just update session, don't re-fetch profile) ──
        if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
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
    return <Auth onAuthSuccess={recheckSession} />;
  }

  // ─── Route by role ───
  if (profile.role === 'admin') {
    return <AdminPanel profile={profile} onLogout={handleLogout} />;
  }
  return <Dashboard profile={profile} onLogout={handleLogout} />;
}