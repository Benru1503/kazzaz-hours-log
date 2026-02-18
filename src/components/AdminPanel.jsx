import { useState, useEffect, useCallback } from 'react';
import { ShiftLogic } from '../lib/ShiftLogic';
import {
  LogOut, Shield, Check, X, Users, BarChart3,
  Award, AlertCircle, ClipboardList, Calendar,
  Timer, ChevronLeft, Loader2, RefreshCw
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

// ─── Progress Ring (smaller for detail view) ───
function ProgressRing({ progress, size = 150, sw = 11, children }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(progress, 100) / 100) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
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

// ─── Progress Bar ───
function PBar({ progress, h = 8 }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: h, background: 'rgba(255,255,255,0.07)' }}>
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

// ─── Toast ───
function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg = type === 'success' ? 'bg-emerald-500/90' : type === 'error' ? 'bg-red-500/90' : 'bg-cyan-500/90';
  const Icon = type === 'success' ? Check : type === 'error' ? X : AlertCircle;
  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 ${bg} text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-down`}
      style={{ backdropFilter: 'blur(12px)' }}
    >
      <Icon size={17} />
      <span className="text-sm font-medium">{msg}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════
export default function AdminPanel({ profile, onLogout }) {
  const [students, setStudents] = useState([]);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [tab, setTab] = useState('overview');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [toast, setToast] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Load data ───
  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [studentsData, pending] = await Promise.all([
        ShiftLogic.getAllStudentsSummary(),
        ShiftLogic.getAllPendingLogs(),
      ]);
      setStudents(studentsData);
      setPendingLogs(pending);
    } catch (err) {
      console.error('Admin load error:', err);
      setToast({ m: 'שגיאה בטעינת נתונים: ' + err.message, t: 'error' });
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Approve ───
  const handleApprove = async (logId) => {
    try {
      await ShiftLogic.approveLog(logId, profile.id);
      setPendingLogs((prev) => prev.filter((l) => l.id !== logId));
      // Refresh student summaries to update their hours
      const updated = await ShiftLogic.getAllStudentsSummary();
      setStudents(updated);
      setToast({ m: 'הדיווח אושר בהצלחה ✅', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    }
  };

  // ─── Reject ───
  const handleReject = async (logId) => {
    try {
      await ShiftLogic.rejectLog(logId, profile.id);
      setPendingLogs((prev) => prev.filter((l) => l.id !== logId));
      setToast({ m: 'הדיווח נדחה ❌', t: 'error' });
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

  if (initialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg" dir="rtl">
      {toast && <Toast msg={toast.m} type={toast.t} onClose={() => setToast(null)} />}

      {/* ─── Header ─── */}
      <header
        className="sticky top-0 z-40 border-b border-white/[0.04]"
        style={{ background: 'rgba(7,11,32,0.82)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center gradient-admin">
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">לוח בקרה · מנהל</h1>
              <p className="text-blue-200/35 text-xs">{profile.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="text-blue-200/35 hover:text-cyan-300 p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="רענון נתונים"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onLogout}
              className="text-blue-200/35 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="יציאה"
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
            { l: 'סטודנטים',       v: totalStudents,          I: Users,       c: '#06b6d4' },
            { l: 'ממוצע התקדמות',  v: `${avgProgress.toFixed(0)}%`, I: BarChart3, c: '#3b82f6' },
            { l: 'השלימו יעד',     v: completed,              I: Award,       c: '#10b981' },
            { l: 'ממתינים לאישור', v: pendingLogs.length,     I: AlertCircle, c: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} className="glass p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.I size={15} style={{ color: s.c }} />
                <span className="text-blue-200/40 text-xs">{s.l}</span>
              </div>
              <span className="text-2xl font-bold text-white">{s.v}</span>
            </div>
          ))}
        </div>

        {/* ─── Tabs ─── */}
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {[
            { id: 'overview', l: 'סקירת סטודנטים',                        I: Users },
            { id: 'pending',  l: `אישור דיווחים (${pendingLogs.length})`, I: ClipboardList },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedStudent(null); }}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                tab === t.id
                  ? 'bg-cyan-500/12 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-blue-200/35 hover:text-blue-200/60'
              }`}
            >
              <t.I size={15} /> {t.l}
            </button>
          ))}
        </div>

        {/* ═══ STUDENTS TABLE ═══ */}
        {tab === 'overview' && !selectedStudent && (
          <div className="space-y-3">
            {students.length === 0 ? (
              <div className="glass p-12 text-center">
                <Users size={40} className="text-blue-200/20 mx-auto mb-3" />
                <p className="text-white font-medium">אין סטודנטים רשומים עדיין</p>
                <p className="text-blue-200/35 text-sm mt-1">סטודנטים יופיעו כאן לאחר ההרשמה</p>
              </div>
            ) : (
              <>
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-5 text-blue-200/30 text-xs font-medium">
                  <span className="col-span-3">שם</span>
                  <span className="col-span-2">שעות משמרת</span>
                  <span className="col-span-2">שעות ידניות</span>
                  <span className="col-span-2">סה"כ</span>
                  <span className="col-span-3">התקדמות</span>
                </div>

                {students.map((s) => {
                  const prog = parseFloat(s.progress_percent || 0);
                  const shiftH = parseFloat(s.shift_hours || 0);
                  const manualH = parseFloat(s.approved_manual_hours || 0);
                  const totalH = parseFloat(s.total_hours || 0);
                  const pending = parseInt(s.pending_logs || 0, 10);

                  return (
                    <div
                      key={s.student_id}
                      onClick={() => setSelectedStudent(s)}
                      className="glass p-5 cursor-pointer hover:border-cyan-400/25 hover:bg-white/[0.06] transition-all"
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
                          >
                            {s.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{s.full_name}</p>
                            {pending > 0 && (
                              <span className="text-amber-400/70 text-xs">
                                {pending} ממתינים
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="col-span-2 text-blue-200/60 text-sm">
                          {shiftH.toFixed(1)} שעות
                        </span>
                        <span className="col-span-2 text-blue-200/60 text-sm">
                          {manualH.toFixed(1)} שעות
                        </span>
                        <span className="col-span-2 text-white font-bold text-sm">
                          {totalH.toFixed(1)} / {s.total_goal}
                        </span>
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="flex-1">
                            <PBar progress={prog} />
                          </div>
                          <span className="text-cyan-300 text-sm font-bold w-12 text-left">
                            {prog.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                              style={{
                                background: `linear-gradient(135deg, ${pColor(prog)}, #8b5cf6)`,
                              }}
                            >
                              {s.full_name?.charAt(0) || '?'}
                            </div>
                            <p className="text-white text-sm font-medium">{s.full_name}</p>
                          </div>
                          <span className="text-cyan-300 font-bold">{prog.toFixed(0)}%</span>
                        </div>
                        <PBar progress={prog} h={6} />
                        <div className="flex justify-between mt-2 text-xs text-blue-200/35">
                          <span>
                            {totalH.toFixed(1)} / {s.total_goal} שעות
                          </span>
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
            <div className="space-y-4">
              <button
                onClick={() => setSelectedStudent(null)}
                className="flex items-center gap-2 text-blue-200/40 hover:text-cyan-300 text-sm transition-colors"
              >
                <ChevronLeft size={15} /> חזרה לרשימה
              </button>
              <div className="glass p-5 flex flex-col md:flex-row items-center gap-6 py-6">
                <ProgressRing progress={prog}>
                  <span className="text-3xl font-bold text-white">{prog.toFixed(0)}%</span>
                </ProgressRing>
                <div className="text-center md:text-right flex-1">
                  <h2 className="text-white text-2xl font-bold mb-1">{s.full_name}</h2>
                  <p className="text-blue-200/35 text-sm mb-4">יעד: {s.total_goal} שעות</p>
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
          <div className="space-y-3">
            {pendingLogs.length === 0 ? (
              <div className="glass p-12 text-center">
                <Check size={44} className="text-emerald-400 mx-auto mb-3 opacity-40" />
                <p className="text-white font-medium">אין דיווחים ממתינים</p>
                <p className="text-blue-200/35 text-sm mt-1">כל הדיווחים טופלו</p>
              </div>
            ) : (
              pendingLogs.map((l) => (
                <div key={l.id} className="glass p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: 'rgba(245,158,11,0.08)' }}
                      >
                        {CATEGORIES[l.category]?.icon || '📋'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-bold">{l.user_name}</p>
                          <span className="text-blue-200/20 text-xs">·</span>
                          <span className="text-blue-200/40 text-xs">
                            {CATEGORIES[l.category]?.label || 'אחר'}
                          </span>
                        </div>
                        <p className="text-blue-200/60 text-sm mt-1">{l.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-blue-200/35">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} /> {fmtDate(l.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer size={11} /> {fmtDur(l.duration_minutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mr-auto md:mr-0">
                      <button
                        onClick={() => handleReject(l.id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-red-400 text-sm font-medium border border-red-400/20 hover:bg-red-400/10 transition-all"
                      >
                        <X size={15} /> דחה
                      </button>
                      <button
                        onClick={() => handleApprove(l.id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/20 gradient-success"
                      >
                        <Check size={15} /> אשר
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
