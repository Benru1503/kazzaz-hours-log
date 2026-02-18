import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        // ─── LOGIN ───
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // onAuthStateChange in App.jsx will handle the redirect
      } else {
        // ─── REGISTER ───
        if (!fullName.trim()) {
          throw new Error('נא להזין שם מלא');
        }
        if (password.length < 6) {
          throw new Error('הסיסמה חייבת להכיל לפחות 6 תווים');
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: 'student', // default — admin is set via SQL
            },
          },
        });
        if (signUpError) throw signUpError;

        setSuccess('החשבון נוצר בהצלחה! מתחבר...');
        // With email confirmation disabled, onAuthStateChange fires automatically
      }
    } catch (err) {
      // Translate common Supabase errors to Hebrew
      const msg = err.message || 'שגיאה לא ידועה';
      if (msg.includes('Invalid login credentials')) {
        setError('אימייל או סיסמה שגויים');
      } else if (msg.includes('User already registered')) {
        setError('משתמש עם אימייל זה כבר קיים');
      } else if (msg.includes('Password should be')) {
        setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      } else if (msg.includes('Unable to validate email')) {
        setError('כתובת אימייל לא תקינה');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 page-bg"
      dir="rtl"
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 right-20 w-72 h-72 bg-cyan-500/10 rounded-full"
          style={{ filter: 'blur(80px)' }}
        />
        <div
          className="absolute bottom-32 left-16 w-64 h-64 bg-blue-600/10 rounded-full"
          style={{ filter: 'blur(80px)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500/5 rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ filter: 'blur(120px)' }}
        />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 shadow-lg shadow-cyan-500/20 gradient-primary"
          >
            <Clock size={38} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">שעון נוכחות קזז</h1>
          <p className="text-blue-300/50 text-sm">מערכת מעקב שעות למלגאים · אור יהודה</p>
        </div>

        {/* Card */}
        <div className="glass p-6">
          {/* Toggle */}
          <div
            className="flex rounded-xl overflow-hidden mb-6"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {['כניסה', 'הרשמה'].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setIsLogin(i === 0);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-3 text-sm font-medium transition-all ${
                  (i === 0 ? isLogin : !isLogin)
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-blue-200/40 hover:text-blue-200/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (register only) */}
            {!isLogin && (
              <div>
                <label className="block text-blue-200/50 text-xs mb-1.5 font-medium">
                  שם מלא
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="glass-input w-full"
                  placeholder="ישראל ישראלי"
                  autoComplete="name"
                  dir="rtl"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-blue-200/50 text-xs mb-1.5 font-medium">
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full"
                placeholder="email@example.com"
                autoComplete="email"
                dir="ltr"
                style={{ textAlign: 'left' }}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-blue-200/50 text-xs mb-1.5 font-medium">
                סיסמה
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full pl-10"
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200/30 hover:text-blue-200/60 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed gradient-primary"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                'כניסה למערכת'
              ) : (
                'יצירת חשבון'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
