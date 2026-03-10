import { useState, useEffect, useCallback } from 'react';
import { ShiftLogic } from '../lib/ShiftLogic';
import {
  Clock, LogIn, LogOut, Plus, Timer, FileText,
  TrendingUp, Award, ClipboardList, AlertCircle,
  Check, X, Loader2, MapPin, CalendarDays
} from 'lucide-react';

// ─── Helpers ───
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const fmtDur = (m) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (h > 0 && r > 0) return `${h} שעות ו-${r} דק'`;
  if (h > 0) return `${h} שעות`;
  return `${r} דקות`;
};

const CATEGORIES = {
  tutoring:          { label: 'חונכות',           icon: '📚' },
  mentoring:         { label: 'הדרכה',            icon: '🎓' },
  community_service: { label: 'שירות קהילתי',     icon: '🤝' },
  office_work:       { label: 'עבודה משרדית',     icon: '💼' },
  event_support:     { label: 'תמיכה באירועים',   icon: '🎪' },
  other:             { label: 'אחר',              icon: '📋' },
};

const pColor = (p) =>
  p >= 100 ? '#10b981' : p >= 60 ? '#06b6d4' : p >= 30 ? '#3b82f6' : '#8b5cf6';

// ─── Progress Ring ───
function ProgressRing({ progress, size = 210, sw = 15, children }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(progress, 100) / 100) * c;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`התקדמות: ${Math.round(progress)}%`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={pColor(progress)} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke .4s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ─── Live Timer ───
function LiveTimer({ startTime }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const st = new Date(startTime).getTime();
    const tick = () => setSecs(Math.floor((Date.now() - st) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <span
      className="font-mono text-5xl font-bold text-cyan-300 tracking-wider"
      dir="ltr"
      role="timer"
      aria-label={`זמן משמרת: ${hh} שעות ${mm} דקות ${ss} שניות`}
    >
      {hh}:{mm}:{ss}
    </span>
  );
}

// ─── Toast ───
function Toast({ msg, type = 'success', onClose }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (exiting) {
      const t = setTimeout(onClose, 250);
      return () => clearTimeout(t);
    }
  }, [exiting, onClose]);

  const bg =
    type === 'success' ? 'bg-emerald-500/90' :
    type === 'error' ? 'bg-red-500/90' : 'bg-cyan-500/90';
  const Icon = type === 'success' ? Check : type === 'error' ? X : AlertCircle;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-5 left-1/2 z-50 ${bg} text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] ${exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
      style={{ backdropFilter: 'blur(12px)' }}
    >
      <Icon size={17} aria-hidden="true" />
      <span className="text-sm font-medium">{msg}</span>
    </div>
  );
}

// ─── Skeleton Loading ───
function LoadingSkeleton() {
  return (
    <div className="min-h-screen min-h-dvh page-bg safe-top" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-xl skeleton" />
          <div className="space-y-1.5">
            <div className="w-28 h-3.5 skeleton" />
            <div className="w-20 h-2.5 skeleton" />
          </div>
        </div>
        {/* Progress ring skeleton */}
        <div className="glass p-5 flex justify-center py-10">
          <div className="w-52 h-52 rounded-full skeleton" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass p-4 space-y-3">
              <div className="w-20 h-2.5 skeleton" />
              <div className="w-12 h-6 skeleton" />
            </div>
          ))}
        </div>
        {/* Tabs skeleton */}
        <div className="h-12 rounded-xl skeleton" />
        {/* Content skeleton */}
        <div className="glass p-5 space-y-4">
          <div className="w-40 h-5 skeleton mx-auto" />
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl skeleton" />
            ))}
          </div>
          <div className="h-11 rounded-xl skeleton" />
          <div className="h-14 rounded-2xl skeleton" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════
export default function Dashboard({ profile, onLogout }) {
  const [activeShift, setActiveShift] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [manualLogs, setManualLogs] = useState([]);
  const [progress, setProgress] = useState({
    shiftHours: 0, approvedManualHours: 0, totalHours: 0,
    progressPercent: 0, pendingLogs: 0,
  });
  const [tab, setTab] = useState('clock');
  const [category, setCategory] = useState('tutoring');
  const [desc, setDesc] = useState('');
  const [placement, setPlacement] = useState(null);
  const [events, setEvents] = useState([]);
  const [logType, setLogType] = useState('site'); // 'site' or 'event'
  const [manualForm, setManualForm] = useState({
    date: '', hours: '', minutes: '', description: '', category: 'other', eventId: '',
  });
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const goal = profile.total_goal || 150;

  // ─── Load all data ───
  const loadData = useCallback(async () => {
    try {
      const [active, shiftsData, logsData, prog, placementData, eventsData] = await Promise.all([
        ShiftLogic.getActiveShift(profile.id),
        ShiftLogic.getShifts(profile.id),
        ShiftLogic.getManualLogs(profile.id),
        ShiftLogic.calculateProgress(profile.id, goal),
        ShiftLogic.getStudentPlacement(profile.id),
        ShiftLogic.getActiveEvents(),
      ]);
      setActiveShift(active);
      setShifts(shiftsData);
      setManualLogs(logsData);
      setProgress(prog);
      setPlacement(placementData);
      setEvents(eventsData || []);
    } catch (err) {
      console.error('Load error:', err);
      setToast({ m: 'שגיאה בטעינת נתונים', t: 'error' });
    } finally {
      setInitialLoad(false);
    }
  }, [profile.id, goal]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Check In ───
  const handleCheckIn = async () => {
    if (!desc.trim()) {
      setToast({ m: 'נא להזין תיאור משימה', t: 'error' });
      return;
    }
    setBusy(true);
    try {
      const shift = await ShiftLogic.checkIn(profile.id, category, desc.trim(), placement?.site_id || null);
      setActiveShift(shift);
      setDesc('');
      setToast({ m: 'נכנסת למשמרת בהצלחה! ⏱️', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Check Out ───
  const handleCheckOut = async () => {
    if (!activeShift) return;
    setBusy(true);
    try {
      const completed = await ShiftLogic.checkOut(activeShift.id);
      setActiveShift(null);
      await loadData();
      const mins = parseFloat(completed.duration_minutes || 0);
      setToast({ m: `יציאה ממשמרת! ${fmtDur(mins)} נרשמו ✅`, t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Submit Manual Log ───
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const totalMins =
      (parseInt(manualForm.hours || '0', 10) * 60) +
      parseInt(manualForm.minutes || '0', 10);
    if (totalMins <= 0) {
      setToast({ m: 'נא להזין משך זמן תקין', t: 'error' });
      return;
    }
    if (!manualForm.description.trim()) {
      setToast({ m: 'נא להזין תיאור', t: 'error' });
      return;
    }
    if (logType === 'event' && !manualForm.eventId) {
      setToast({ m: 'נא לבחור אירוע', t: 'error' });
      return;
    }
    setBusy(true);
    try {
      const siteId = logType === 'site' ? (placement?.site_id || null) : null;
      const generalEventId = logType === 'event' ? manualForm.eventId : null;

      const log = await ShiftLogic.submitManualLog(profile.id, {
        date: manualForm.date,
        durationMinutes: totalMins,
        description: manualForm.description.trim(),
        category: manualForm.category,
        siteId,
        generalEventId,
      });

      // Fire-and-forget: notify supervisor for site-linked logs
      if (siteId && log?.id) {
        ShiftLogic.notifySupervisor({
          logId: log.id,
          studentName: profile.full_name,
          siteName: placement?.sites?.name || '',
          description: manualForm.description.trim(),
          durationMinutes: totalMins,
          date: manualForm.date,
        });
      }

      setManualForm({ date: '', hours: '', minutes: '', description: '', category: 'other', eventId: '' });
      await loadData();
      setToast({ m: siteId ? 'הדיווח נשלח לאישור מפקח האתר' : 'הדיווח נשלח לאישור מנהל', t: 'info' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Stat cards ───
  const stats = [
    { l: 'שעות משמרת',  v: progress.shiftHours.toFixed(1),         I: Timer,      c: '#06b6d4' },
    { l: 'שעות ידניות',  v: progress.approvedManualHours.toFixed(1), I: FileText,   c: '#8b5cf6' },
    { l: 'סה"כ שעות',   v: progress.totalHours.toFixed(1),          I: TrendingUp, c: '#3b82f6' },
    { l: 'ממתינים',      v: progress.pendingLogs,                    I: Clock,      c: '#f59e0b' },
  ];

  const TABS = [
    { id: 'clock',   l: 'שעון נוכחות', I: Timer },
    { id: 'history', l: 'היסטוריה',    I: ClipboardList },
    { id: 'manual',  l: 'דיווח ידני',  I: FileText },
  ];

  // ─── Loading state ───
  if (initialLoad) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen min-h-dvh page-bg safe-bottom" dir="rtl">
      {toast && <Toast msg={toast.m} type={toast.t} onClose={() => setToast(null)} />}

      {/* ─── Header ─── */}
      <header
        className="sticky top-0 z-40 border-b border-white/[0.04] safe-top"
        style={{ background: 'rgba(7,11,32,0.82)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center gradient-primary" aria-hidden="true">
              <Clock size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">דיווחי שעות מלגאים</h1>
              <p className="text-blue-200/35 text-xs">שלום, {profile.full_name}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-blue-200/35 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors touch-target"
            title="יציאה"
            aria-label="יציאה מהמערכת"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ─── Progress Ring ─── */}
        <div className="glass p-5 flex flex-col items-center py-8">
          <ProgressRing progress={progress.progressPercent}>
            <span className="text-5xl font-bold text-white" aria-hidden="true">
              {Math.round(progress.progressPercent)}%
            </span>
            <span className="text-blue-200/40 text-sm mt-1" aria-hidden="true">
              {progress.totalHours.toFixed(1)} / {goal} שעות
            </span>
          </ProgressRing>
          {progress.progressPercent >= 100 && (
            <div className="mt-4 flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full">
              <Award size={17} aria-hidden="true" />
              <span className="text-sm font-medium">כל הכבוד! השלמת את היעד!</span>
            </div>
          )}
          {/* Site Assignment */}
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <MapPin size={14} className={placement ? 'text-cyan-400' : 'text-blue-200/30'} />
            {placement ? (
              <span className="text-blue-200/60">
                אתר שיבוץ: <span className="text-cyan-300 font-medium">{placement.sites?.name || '—'}</span>
              </span>
            ) : (
              <span className="text-blue-200/30">לא שובצת לאתר. פנה למנהל המערכת</span>
            )}
          </div>
        </div>

        {/* ─── Stats Grid ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="glass p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.I size={15} style={{ color: s.c }} aria-hidden="true" />
                <span className="text-blue-200/40 text-xs">{s.l}</span>
              </div>
              <span className="text-2xl font-bold text-white">{s.v}</span>
            </div>
          ))}
        </div>

        {/* ─── Tabs ─── */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)' }}
          role="tablist"
          aria-label="תפריט ניווט"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              id={`tab-${t.id}`}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                tab === t.id
                  ? 'bg-cyan-500/12 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-blue-200/35 hover:text-blue-200/60'
              }`}
            >
              <t.I size={15} aria-hidden="true" /> {t.l}
            </button>
          ))}
        </div>

        {/* ═══ PUNCH CLOCK TAB ═══ */}
        {tab === 'clock' && (
          <div
            className="glass p-5 animate-tab-enter"
            role="tabpanel"
            id="tabpanel-clock"
            aria-labelledby="tab-clock"
          >
            {activeShift ? (
              /* ── Active Shift ── */
              <div className="text-center space-y-6 py-4">
                <div className="inline-flex items-center gap-2 bg-emerald-400/10 text-emerald-400 px-4 py-1.5 rounded-full text-sm animate-pulse-glow">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" aria-hidden="true" />
                  משמרת פעילה
                </div>
                <div>
                  <LiveTimer startTime={activeShift.start_time} />
                  <p className="text-blue-200/35 text-sm mt-3">
                    התחלה: {fmtTime(activeShift.start_time)}
                    {' · '}
                    {CATEGORIES[activeShift.category]?.icon}{' '}
                    {activeShift.task_description}
                  </p>
                </div>
                <button
                  onClick={handleCheckOut}
                  disabled={busy}
                  className="w-full max-w-xs mx-auto py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 transition-all hover:shadow-lg hover:shadow-red-500/20 disabled:opacity-50 gradient-danger"
                >
                  {busy ? (
                    <Loader2 size={21} className="animate-spin" />
                  ) : (
                    <LogOut size={21} />
                  )}
                  יציאה ממשמרת
                </button>
              </div>
            ) : (
              /* ── Check In Form ── */
              <div className="space-y-5 py-2">
                <div className="text-center">
                  <h3 className="text-white font-bold text-lg mb-1">התחלת משמרת חדשה</h3>
                  <p className="text-blue-200/35 text-sm">
                    בחר קטגוריה, תאר את המשימה ולחץ כניסה
                  </p>
                </div>

                {/* Category Grid */}
                <fieldset>
                  <legend className="sr-only">בחר קטגוריה</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(CATEGORIES).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key)}
                        aria-pressed={category === key}
                        className={`py-3 px-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                          category === key
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/25'
                            : 'text-blue-200/40 border border-white/[0.05] hover:border-white/[0.12]'
                        }`}
                      >
                        <span className="text-lg" aria-hidden="true">{val.icon}</span>
                        {val.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Task Description */}
                <div>
                  <label htmlFor="task-desc" className="sr-only">תיאור המשימה</label>
                  <input
                    id="task-desc"
                    type="text"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="תיאור המשימה..."
                    className="glass-input w-full"
                    dir="rtl"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCheckIn(); }}
                  />
                </div>

                {/* Check In Button */}
                <button
                  onClick={handleCheckIn}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 transition-all hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 gradient-primary"
                >
                  {busy ? (
                    <Loader2 size={21} className="animate-spin" />
                  ) : (
                    <LogIn size={21} />
                  )}
                  כניסה למשמרת
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {tab === 'history' && (
          <div
            className="space-y-3 animate-tab-enter"
            role="tabpanel"
            id="tabpanel-history"
            aria-labelledby="tab-history"
          >
            {/* Completed Shifts */}
            <h3 className="text-white font-bold mb-1">משמרות אחרונות</h3>
            {shifts.filter((s) => s.status === 'completed').length === 0 ? (
              <div className="glass p-8 text-center">
                <Timer size={32} className="text-blue-200/20 mx-auto mb-2" aria-hidden="true" />
                <p className="text-blue-200/40 text-sm">עדיין אין משמרות שהושלמו</p>
              </div>
            ) : (
              shifts
                .filter((s) => s.status === 'completed')
                .map((sh) => (
                  <div key={sh.id} className="glass p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                          style={{ background: 'rgba(6,182,212,0.08)' }}
                          aria-hidden="true"
                        >
                          {CATEGORIES[sh.category]?.icon || '📋'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {sh.task_description || 'ללא תיאור'}
                          </p>
                          <p className="text-blue-200/35 text-xs mt-0.5">
                            {fmtDate(sh.start_time)} · {fmtTime(sh.start_time)} –{' '}
                            {sh.end_time ? fmtTime(sh.end_time) : '—'}
                          </p>
                        </div>
                      </div>
                      <span className="text-cyan-300 font-bold text-sm shrink-0">
                        {sh.duration_minutes ? fmtDur(parseFloat(sh.duration_minutes)) : '—'}
                      </span>
                    </div>
                  </div>
                ))
            )}

            {/* Manual Logs */}
            <h3 className="text-white font-bold mt-5 mb-1">דיווחים ידניים</h3>
            {manualLogs.length === 0 ? (
              <div className="glass p-8 text-center">
                <FileText size={32} className="text-blue-200/20 mx-auto mb-2" aria-hidden="true" />
                <p className="text-blue-200/40 text-sm">עדיין אין דיווחים ידניים</p>
              </div>
            ) : (
              manualLogs.map((l) => (
                <div key={l.id} className="glass p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: 'rgba(139,92,246,0.08)' }}
                        aria-hidden="true"
                      >
                        {CATEGORIES[l.category]?.icon || '📋'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{l.description}</p>
                        <p className="text-blue-200/35 text-xs mt-0.5">
                          {fmtDate(l.date)} · {fmtDur(l.duration_minutes)}
                          {l.site_name && (
                            <span className="text-cyan-400/40"> · {l.site_name}</span>
                          )}
                          {l.event_name && (
                            <span className="text-violet-400/40"> · {l.event_name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-xs font-medium px-3 py-1 rounded-full ${
                          l.status === 'approved'
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : l.status === 'pending'
                            ? 'bg-amber-400/10 text-amber-400'
                            : 'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {l.status === 'approved' ? 'אושר' : l.status === 'pending' ? 'ממתין...' : 'נדחה'}
                      </span>
                      {l.supervisor_status && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          l.supervisor_status === 'supervisor_approved'
                            ? 'bg-emerald-400/5 text-emerald-400/60'
                            : l.supervisor_status === 'pending_supervisor'
                            ? 'bg-amber-400/5 text-amber-400/60'
                            : 'bg-red-400/5 text-red-400/60'
                        }`}>
                          {l.supervisor_status === 'supervisor_approved' ? 'מפקח אישר' :
                           l.supervisor_status === 'pending_supervisor' ? 'ממתין למפקח' : 'מפקח דחה'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ MANUAL LOG TAB ═══ */}
        {tab === 'manual' && (
          <div
            className="glass p-5 animate-tab-enter"
            role="tabpanel"
            id="tabpanel-manual"
            aria-labelledby="tab-manual"
          >
            <h3 className="text-white font-bold text-lg mb-1">דיווח שעות ידני</h3>
            <p className="text-blue-200/35 text-sm mb-5">
              {logType === 'site'
                ? 'דווח שעות באתר השיבוץ שלך. הדיווח יועבר לאישור מפקח האתר.'
                : 'דווח שעות באירוע כללי. הדיווח יועבר ישירות לאישור מנהל.'}
            </p>

            {/* Log Type Toggle */}
            <div
              className="flex rounded-xl overflow-hidden mb-5"
              style={{ background: 'rgba(255,255,255,0.04)' }}
              role="tablist"
              aria-label="סוג דיווח"
            >
              <button
                type="button"
                role="tab"
                aria-selected={logType === 'site'}
                onClick={() => setLogType('site')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  logType === 'site'
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-blue-200/40 hover:text-blue-200/70'
                }`}
              >
                <MapPin size={13} /> שעות באתר
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={logType === 'event'}
                onClick={() => setLogType('event')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  logType === 'event'
                    ? 'bg-violet-500/15 text-violet-300'
                    : 'text-blue-200/40 hover:text-blue-200/70'
                }`}
              >
                <CalendarDays size={13} /> אירוע כללי
              </button>
            </div>

            {/* Event Selector (only when logType='event') */}
            {logType === 'event' && (
              <div className="mb-4">
                <label htmlFor="manual-event" className="block text-blue-200/45 text-xs mb-1.5 font-medium">בחר אירוע</label>
                <select
                  id="manual-event"
                  value={manualForm.eventId}
                  onChange={(e) => setManualForm((p) => ({ ...p, eventId: e.target.value }))}
                  className="glass-input w-full appearance-none"
                  required
                >
                  <option value="" style={{ background: '#111' }}>— בחר אירוע —</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id} style={{ background: '#111' }}>
                      {ev.name}{ev.event_date ? ` (${fmtDate(ev.event_date)})` : ''}
                    </option>
                  ))}
                </select>
                {events.length === 0 && (
                  <p className="text-amber-400/50 text-xs mt-1">אין אירועים פעילים כרגע</p>
                )}
              </div>
            )}

            {/* Site info (only when logType='site') */}
            {logType === 'site' && placement && (
              <div className="mb-4 flex items-center gap-2 text-xs text-cyan-300/60">
                <MapPin size={12} />
                שעות ידווחו תחת: <span className="font-medium text-cyan-300">{placement.sites?.name}</span>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="manual-date" className="block text-blue-200/45 text-xs mb-1.5 font-medium">תאריך</label>
                  <input
                    id="manual-date"
                    type="date"
                    required
                    value={manualForm.date}
                    onChange={(e) => setManualForm((p) => ({ ...p, date: e.target.value }))}
                    className="glass-input w-full"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label htmlFor="manual-category" className="block text-blue-200/45 text-xs mb-1.5 font-medium">קטגוריה</label>
                  <select
                    id="manual-category"
                    value={manualForm.category}
                    onChange={(e) => setManualForm((p) => ({ ...p, category: e.target.value }))}
                    className="glass-input w-full appearance-none"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k} style={{ background: '#111' }}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="manual-hours" className="block text-blue-200/45 text-xs mb-1.5 font-medium">שעות</label>
                  <input
                    id="manual-hours"
                    type="number"
                    min="0"
                    max="24"
                    value={manualForm.hours}
                    onChange={(e) => setManualForm((p) => ({ ...p, hours: e.target.value }))}
                    placeholder="0"
                    className="glass-input w-full"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label htmlFor="manual-minutes" className="block text-blue-200/45 text-xs mb-1.5 font-medium">דקות</label>
                  <input
                    id="manual-minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={manualForm.minutes}
                    onChange={(e) => setManualForm((p) => ({ ...p, minutes: e.target.value }))}
                    placeholder="0"
                    className="glass-input w-full"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="manual-desc" className="block text-blue-200/45 text-xs mb-1.5 font-medium">תיאור</label>
                <textarea
                  id="manual-desc"
                  required
                  rows={3}
                  value={manualForm.description}
                  onChange={(e) =>
                    setManualForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="תאר את העבודה שביצעת..."
                  className="glass-input w-full resize-none"
                  dir="rtl"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-violet-500/20 disabled:opacity-50 gradient-purple flex items-center justify-center gap-2"
              >
                {busy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                שלח לאישור
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}