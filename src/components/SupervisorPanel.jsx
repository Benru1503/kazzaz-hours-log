import { useState, useEffect, useCallback } from 'react';
import { ShiftLogic } from '../lib/ShiftLogic';
import {
  LogOut, Shield, Check, X, Users, BarChart3,
  Award, AlertCircle, ClipboardList, Calendar,
  Timer, ChevronLeft, Loader2, RefreshCw, MapPin
} from 'lucide-react';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
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

// ─── Progress Bar ───
function PBar({ progress, h = 8 }) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: h, background: 'rgba(255,255,255,0.07)' }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(progress, 100)}%`,
          background: pColor(progress),
          transition: 'width .7s ease',
        }}
      />
    </div>
  );
}

// ─── Progress Ring ───
function ProgressRing({ progress, size = 150, sw = 11, children }) {
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

  const bg = type === 'success' ? 'bg-emerald-500/90' : type === 'error' ? 'bg-red-500/90' : 'bg-cyan-500/90';
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
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-xl skeleton" />
          <div className="space-y-1.5">
            <div className="w-32 h-3.5 skeleton" />
            <div className="w-20 h-2.5 skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass p-4 space-y-3">
              <div className="w-20 h-2.5 skeleton" />
              <div className="w-12 h-6 skeleton" />
            </div>
          ))}
        </div>
        <div className="h-12 rounded-xl skeleton" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full skeleton" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-24 h-3.5 skeleton" />
                  <div className="w-16 h-2.5 skeleton" />
                </div>
              </div>
              <div className="h-2 rounded-full skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SUPERVISOR PANEL
// ═══════════════════════════════════════════
export default function SupervisorPanel({ profile, onLogout }) {
  const [students, setStudents] = useState([]);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [sites, setSites] = useState([]);
  const [tab, setTab] = useState('overview');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [toast, setToast] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Load data ───
  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [studentsData, pending, sitesData] = await Promise.all([
        ShiftLogic.getSupervisorStudents(profile.id),
        ShiftLogic.getSupervisorPendingLogs(profile.id),
        ShiftLogic.getSupervisorSites(profile.id),
      ]);
      setStudents(studentsData || []);
      setPendingLogs(pending || []);
      setSites(sitesData || []);
    } catch (err) {
      console.error('Supervisor load error:', err);
      setToast({ m: 'שגיאה בטעינת נתונים: ' + err.message, t: 'error' });
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, [profile.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Approve ───
  const handleApprove = async (logId) => {
    try {
      await ShiftLogic.supervisorApproveLog(logId);
      setPendingLogs((prev) => prev.filter((l) => l.log_id !== logId));
      const updated = await ShiftLogic.getSupervisorStudents(profile.id);
      setStudents(updated || []);
      setToast({ m: 'השעות אושרו בהצלחה', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    }
  };

  // ─── Reject ───
  const handleReject = async (logId) => {
    try {
      await ShiftLogic.supervisorRejectLog(logId);
      setPendingLogs((prev) => prev.filter((l) => l.log_id !== logId));
      setToast({ m: 'הדיווח נדחה', t: 'error' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    }
  };

  // ─── Aggregate stats ───
  const totalStudents = students.length;
  const avgProgress =
    totalStudents > 0
      ? students.reduce((a, s) => a + parseFloat(s.progress_percent || 0), 0) / totalStudents
      : 0;
  const completed = students.filter((s) => parseFloat(s.progress_percent) >= 100).length;

  const siteNames = sites.map(s => s.name).join(', ');

  const TABS = [
    { id: 'overview', l: 'הסטודנטים שלי',                         I: Users },
    { id: 'pending',  l: `אישור שעות (${pendingLogs.length})`,    I: ClipboardList },
  ];

  if (initialLoad) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen min-h-dvh page-bg safe-bottom" dir="rtl">
      {toast && <Toast msg={toast.m} type={toast.t} onClose={() => setToast(null)} />}

      {/* ─── Header ─── */}
      <header
        className="sticky top-0 z-40 border-b border-white/[0.04] safe-top"
        style={{ background: 'rgba(7,11,32,0.82)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center gradient-supervisor" aria-hidden="true">
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">לוח בקרה · מפקח אתר</h1>
              <p className="text-blue-200/35 text-xs">
                {profile.full_name}
                {siteNames && (
                  <span className="text-amber-400/50"> · {siteNames}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="text-blue-200/35 hover:text-amber-300 p-2 rounded-lg hover:bg-white/5 transition-colors touch-target"
              title="רענון נתונים"
              aria-label="רענון נתונים"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onLogout}
              className="text-blue-200/35 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors touch-target"
              title="יציאה"
              aria-label="יציאה מהמערכת"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* ─── Stats Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'סטודנטים',       v: totalStudents,          I: Users,       c: '#f59e0b' },
            { l: 'ממוצע התקדמות',  v: `${avgProgress.toFixed(0)}%`, I: BarChart3, c: '#3b82f6' },
            { l: 'השלימו יעד',     v: completed,              I: Award,       c: '#10b981' },
            { l: 'ממתינים לאישור', v: pendingLogs.length,     I: AlertCircle, c: '#ef4444' },
          ].map((s, i) => (
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
          aria-label="תפריט מפקח"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedStudent(null); }}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              id={`tab-${t.id}`}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                tab === t.id
                  ? 'bg-amber-500/12 text-amber-300 border-b-2 border-amber-400'
                  : 'text-blue-200/35 hover:text-blue-200/60'
              }`}
            >
              <t.I size={15} aria-hidden="true" /> {t.l}
            </button>
          ))}
        </div>

        {/* ═══ STUDENTS TABLE ═══ */}
        {tab === 'overview' && !selectedStudent && (
          <div
            className="space-y-3 animate-tab-enter"
            role="tabpanel"
            id="tabpanel-overview"
            aria-labelledby="tab-overview"
          >
            {students.length === 0 ? (
              <div className="glass p-12 text-center">
                <Users size={40} className="text-blue-200/20 mx-auto mb-3" aria-hidden="true" />
                <p className="text-white font-medium">אין סטודנטים משובצים באתרים שלך</p>
                <p className="text-blue-200/35 text-sm mt-1">סטודנטים יופיעו כאן לאחר שיבוצם על ידי מנהל המערכת</p>
              </div>
            ) : (
              <>
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-5 text-blue-200/30 text-xs font-medium">
                  <span className="col-span-3">שם</span>
                  <span className="col-span-2">אתר</span>
                  <span className="col-span-2">שעות משמרת</span>
                  <span className="col-span-2">סה"כ</span>
                  <span className="col-span-3">התקדמות</span>
                </div>

                {students.map((s) => {
                  const prog = parseFloat(s.progress_percent || 0);
                  const shiftH = parseFloat(s.shift_hours || 0);
                  const totalH = parseFloat(s.total_hours || 0);
                  const pending = parseInt(s.pending_supervisor_logs || 0, 10);

                  return (
                    <div
                      key={s.student_id}
                      onClick={() => setSelectedStudent(s)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStudent(s); }}}
                      role="button"
                      tabIndex={0}
                      aria-label={`${s.full_name}, התקדמות ${prog.toFixed(0)}%`}
                      className="glass p-5 cursor-pointer hover:border-amber-400/25 hover:bg-white/[0.06] transition-all"
                    >
                      {/* Desktop Row */}
                      <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-3 flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${pColor(prog)}, ${
                                prog >= 100 ? '#06b6d4' : '#8b5cf6'
                              })`,
                            }}
                            aria-hidden="true"
                          >
                            {s.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{s.full_name}</p>
                            {pending > 0 && (
                              <span className="text-amber-400/70 text-xs">
                                {pending} ממתינים
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="col-span-2 text-blue-200/60 text-sm flex items-center gap-1">
                          <MapPin size={12} className="text-amber-400/50" />
                          {s.site_name || '—'}
                        </span>
                        <span className="col-span-2 text-blue-200/60 text-sm">
                          {shiftH.toFixed(1)} שעות
                        </span>
                        <span className="col-span-2 text-white font-bold text-sm">
                          {totalH.toFixed(1)} / {s.total_goal}
                        </span>
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="flex-1">
                            <PBar progress={prog} />
                          </div>
                          <span className="text-amber-300 text-sm font-bold w-12 text-left">
                            {prog.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${pColor(prog)}, #8b5cf6)`,
                              }}
                              aria-hidden="true"
                            >
                              {s.full_name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">{s.full_name}</p>
                              <p className="text-amber-400/50 text-xs flex items-center gap-1">
                                <MapPin size={10} /> {s.site_name || '—'}
                              </p>
                            </div>
                          </div>
                          <span className="text-amber-300 font-bold shrink-0">{prog.toFixed(0)}%</span>
                        </div>
                        <PBar progress={prog} h={6} />
                        <div className="flex justify-between mt-2 text-xs text-blue-200/35">
                          <span>{totalH.toFixed(1)} / {s.total_goal} שעות</span>
                          {pending > 0 && (
                            <span className="text-amber-400/70">{pending} ממתינים</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ═══ STUDENT DETAIL ═══ */}
        {tab === 'overview' && selectedStudent && (() => {
          const s = selectedStudent;
          const prog = parseFloat(s.progress_percent || 0);
          const shiftH = parseFloat(s.shift_hours || 0);
          const manualH = parseFloat(s.approved_manual_hours || 0);
          const totalH = parseFloat(s.total_hours || 0);

          return (
            <div className="space-y-4 animate-tab-enter">
              <button
                onClick={() => setSelectedStudent(null)}
                className="flex items-center gap-2 text-blue-200/40 hover:text-amber-300 text-sm transition-colors touch-target"
              >
                <ChevronLeft size={15} /> חזרה לרשימה
              </button>
              <div className="glass p-5 flex flex-col md:flex-row items-center gap-6 py-6">
                <ProgressRing progress={prog}>
                  <span className="text-3xl font-bold text-white" aria-hidden="true">{prog.toFixed(0)}%</span>
                </ProgressRing>
                <div className="text-center md:text-right flex-1">
                  <h2 className="text-white text-2xl font-bold mb-1">{s.full_name}</h2>
                  <p className="text-blue-200/35 text-sm mb-1">יעד: {s.total_goal} שעות</p>
                  <p className="text-amber-400/50 text-sm mb-4 flex items-center gap-1 justify-center md:justify-start">
                    <MapPin size={13} /> {s.site_name || '—'}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { v: shiftH.toFixed(1),  l: 'שעות משמרת', bg: 'rgba(6,182,212,0.08)',  tc: 'text-cyan-300' },
                      { v: manualH.toFixed(1), l: 'שעות ידניות', bg: 'rgba(139,92,246,0.08)', tc: 'text-violet-300' },
                      { v: totalH.toFixed(1),  l: 'סה"כ',       bg: 'rgba(59,130,246,0.08)',  tc: 'text-blue-300' },
                    ].map((d, i) => (
                      <div key={i} className="p-3 rounded-xl" style={{ background: d.bg }}>
                        <p className={`${d.tc} text-xl font-bold`}>{d.v}</p>
                        <p className="text-blue-200/35 text-xs">{d.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ PENDING APPROVALS ═══ */}
        {tab === 'pending' && (
          <div
            className="space-y-3 animate-tab-enter"
            role="tabpanel"
            id="tabpanel-pending"
            aria-labelledby="tab-pending"
          >
            {pendingLogs.length === 0 ? (
              <div className="glass p-12 text-center">
                <Check size={44} className="text-emerald-400 mx-auto mb-3 opacity-40" aria-hidden="true" />
                <p className="text-white font-medium">אין דיווחים ממתינים לאישור</p>
                <p className="text-blue-200/35 text-sm mt-1">כל הדיווחים טופלו</p>
              </div>
            ) : (
              pendingLogs.map((l) => (
                <div key={l.log_id} className="glass p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: 'rgba(245,158,11,0.08)' }}
                        aria-hidden="true"
                      >
                        {CATEGORIES[l.category]?.icon || '📋'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-bold">{l.student_name}</p>
                          <span className="text-blue-200/20 text-xs" aria-hidden="true">·</span>
                          <span className="text-blue-200/40 text-xs">
                            {CATEGORIES[l.category]?.label || 'אחר'}
                          </span>
                        </div>
                        <p className="text-blue-200/60 text-sm mt-1 truncate">{l.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-blue-200/35">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} aria-hidden="true" /> {fmtDate(l.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer size={11} aria-hidden="true" /> {fmtDur(l.duration_minutes)}
                          </span>
                          <span className="flex items-center gap-1 text-amber-400/50">
                            <MapPin size={11} aria-hidden="true" /> {l.site_name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mr-auto md:mr-0">
                      <button
                        onClick={() => handleReject(l.log_id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-red-400 text-sm font-medium border border-red-400/20 hover:bg-red-400/10 transition-all touch-target"
                        aria-label={`דחה דיווח של ${l.student_name}`}
                      >
                        <X size={15} aria-hidden="true" /> דחה
                      </button>
                      <button
                        onClick={() => handleApprove(l.log_id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/20 gradient-success touch-target"
                        aria-label={`אשר דיווח של ${l.student_name}`}
                      >
                        <Check size={15} aria-hidden="true" /> אשר
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
