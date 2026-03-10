import { useState, useEffect, useCallback } from 'react';
import { ShiftLogic } from '../lib/ShiftLogic';
import {
  LogOut, Shield, Check, X, Users, BarChart3,
  Award, AlertCircle, ClipboardList, Calendar,
  Timer, ChevronLeft, Loader2, RefreshCw,
  MapPin, Plus, CalendarDays, UserPlus, Eye, EyeOff, Settings,
  Mail, Upload
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

const currentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Academic year starts in September
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

// ─── Progress Ring (smaller for detail view) ───
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
// ADMIN PANEL
// ═══════════════════════════════════════════
export default function AdminPanel({ profile, onLogout }) {
  const [students, setStudents] = useState([]);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [sites, setSites] = useState([]);
  const [events, setEvents] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [tab, setTab] = useState('overview');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [toast, setToast] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());

  // ── Forms ──
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: '', address: '', description: '' });
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ name: '', description: '', eventDate: '' });
  const [showSupervisorForm, setShowSupervisorForm] = useState(false);
  const [supervisorForm, setSupervisorForm] = useState({ email: '', password: '', fullName: '', siteId: '' });
  const [showPw, setShowPw] = useState(false);
  const [showPlacementForm, setShowPlacementForm] = useState(false);
  const [placementForm, setPlacementForm] = useState({ studentId: '', siteId: '' });

  // Approved scholars
  const [approvedScholars, setApprovedScholars] = useState([]);
  const [showScholarForm, setShowScholarForm] = useState(false);
  const [scholarEmail, setScholarEmail] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);

  // ─── Load data ───
  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [studentsData, pending, sitesData, eventsData, supervisorsData, scholarsData] = await Promise.all([
        ShiftLogic.getAllStudentsSummary(),
        ShiftLogic.getAllPendingLogs(),
        ShiftLogic.getAllSites(),
        ShiftLogic.getAllEvents(),
        ShiftLogic.getAllSupervisors(),
        ShiftLogic.getApprovedScholars(),
      ]);
      setStudents(studentsData || []);
      setPendingLogs(pending || []);
      setSites(sitesData || []);
      setEvents(eventsData || []);
      setSupervisors(supervisorsData || []);
      setApprovedScholars(scholarsData || []);
    } catch (err) {
      console.error('Admin load error:', err);
      setToast({ m: 'שגיאה בטעינת נתונים: ' + err.message, t: 'error' });
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, []);

  // ─── Load placements when year changes ───
  const loadPlacements = useCallback(async () => {
    try {
      const data = await ShiftLogic.getAllPlacements(academicYear);
      setPlacements(data || []);
    } catch (err) {
      console.error('Placements load error:', err);
    }
  }, [academicYear]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'placements') loadPlacements(); }, [tab, loadPlacements]);

  // ─── Approve / Reject ───
  const handleApprove = async (logId) => {
    try {
      await ShiftLogic.approveLog(logId, profile.id);
      setPendingLogs((prev) => prev.filter((l) => l.id !== logId));
      const updated = await ShiftLogic.getAllStudentsSummary();
      setStudents(updated);
      setToast({ m: 'הדיווח אושר בהצלחה', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    }
  };

  const handleReject = async (logId) => {
    try {
      await ShiftLogic.rejectLog(logId, profile.id);
      setPendingLogs((prev) => prev.filter((l) => l.id !== logId));
      setToast({ m: 'הדיווח נדחה', t: 'error' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    }
  };

  // ─── Create Site ───
  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!siteForm.name.trim()) return;
    setBusy(true);
    try {
      await ShiftLogic.createSite({
        name: siteForm.name.trim(),
        address: siteForm.address.trim() || null,
        description: siteForm.description.trim() || null,
      });
      setSiteForm({ name: '', address: '', description: '' });
      setShowSiteForm(false);
      await loadData();
      setToast({ m: 'אתר נוצר בהצלחה', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Deactivate Site ───
  const handleDeactivateSite = async (siteId) => {
    setBusy(true);
    try {
      await ShiftLogic.deactivateSite(siteId);
      await loadData();
      setToast({ m: 'אתר הושבת', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Create Event ───
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.name.trim()) return;
    setBusy(true);
    try {
      await ShiftLogic.createEvent(profile.id, {
        name: eventForm.name.trim(),
        description: eventForm.description.trim() || null,
        eventDate: eventForm.eventDate || null,
      });
      setEventForm({ name: '', description: '', eventDate: '' });
      setShowEventForm(false);
      await loadData();
      setToast({ m: 'אירוע נוצר בהצלחה', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Deactivate Event ───
  const handleDeactivateEvent = async (eventId) => {
    setBusy(true);
    try {
      await ShiftLogic.deactivateEvent(eventId);
      await loadData();
      setToast({ m: 'אירוע הושבת', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Create Supervisor ───
  const handleCreateSupervisor = async (e) => {
    e.preventDefault();
    if (!supervisorForm.email.trim() || !supervisorForm.fullName.trim() || !supervisorForm.password) return;
    setBusy(true);
    try {
      await ShiftLogic.createSupervisorAccount({
        email: supervisorForm.email.trim(),
        password: supervisorForm.password,
        fullName: supervisorForm.fullName.trim(),
        siteIds: supervisorForm.siteId ? [supervisorForm.siteId] : [],
      });
      setSupervisorForm({ email: '', password: '', fullName: '', siteId: '' });
      setShowSupervisorForm(false);
      await loadData();
      setToast({ m: 'מפקח נוצר בהצלחה', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Create Placement ───
  const handleCreatePlacement = async (e) => {
    e.preventDefault();
    if (!placementForm.studentId || !placementForm.siteId) return;
    setBusy(true);
    try {
      await ShiftLogic.createPlacement(placementForm.studentId, placementForm.siteId, academicYear);
      setPlacementForm({ studentId: '', siteId: '' });
      setShowPlacementForm(false);
      await loadPlacements();
      setToast({ m: 'סטודנט שובץ בהצלחה', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Add Approved Scholar ───
  const handleAddScholar = async (e) => {
    e.preventDefault();
    if (!scholarEmail.trim()) return;
    setBusy(true);
    try {
      await ShiftLogic.addApprovedScholar(scholarEmail.trim(), profile.id);
      setScholarEmail('');
      setShowScholarForm(false);
      await loadData();
      setToast({ m: 'אימייל נוסף לרשימת מלגאים מאושרים', t: 'success' });
    } catch (err) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        setToast({ m: 'אימייל זה כבר קיים ברשימה', t: 'error' });
      } else {
        setToast({ m: err.message, t: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  // ─── CSV Import ───
  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    try {
      const text = await file.text();
      const emails = text
        .split(/[\r\n,;]+/)
        .map(line => line.trim())
        .filter(line => line && line.includes('@'));

      if (emails.length === 0) {
        throw new Error('לא נמצאו כתובות אימייל בקובץ');
      }

      const result = await ShiftLogic.addApprovedScholarsBulk(emails, profile.id);
      await loadData();
      const added = Array.isArray(result) ? result.length : 0;
      setToast({
        m: `${added} כתובות נוספו בהצלחה (${emails.length - added} כפילויות דולגו)`,
        t: 'success',
      });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setCsvImporting(false);
      e.target.value = '';
    }
  };

  // ─── Remove Approved Scholar ───
  const handleRemoveScholar = async (id) => {
    setBusy(true);
    try {
      await ShiftLogic.removeApprovedScholar(id);
      await loadData();
      setToast({ m: 'אימייל הוסר מהרשימה', t: 'success' });
    } catch (err) {
      setToast({ m: err.message, t: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Aggregate stats ───
  const totalStudents = students.length;
  const avgProgress =
    totalStudents > 0
      ? students.reduce((a, s) => a + parseFloat(s.progress_percent || 0), 0) / totalStudents
      : 0;
  const completed = students.filter((s) => parseFloat(s.progress_percent) >= 100).length;

  const activeSites = sites.filter(s => s.is_active);

  // Unplaced students for placement form
  const placedStudentIds = new Set(placements.filter(p => p.status === 'active').map(p => p.student_id));
  const unplacedStudents = students.filter(s => !placedStudentIds.has(s.student_id));

  const ADMIN_TABS = [
    { id: 'overview',    l: 'סטודנטים',                              I: Users },
    { id: 'pending',     l: `אישורים (${pendingLogs.length})`,       I: ClipboardList },
    { id: 'manage',      l: 'ניהול',                                  I: Settings },
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center gradient-admin" aria-hidden="true">
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">לוח בקרה · מנהל</h1>
              <p className="text-blue-200/35 text-xs">{profile.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="text-blue-200/35 hover:text-cyan-300 p-2 rounded-lg hover:bg-white/5 transition-colors touch-target"
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
            { l: 'סטודנטים',       v: totalStudents,          I: Users,       c: '#06b6d4' },
            { l: 'ממוצע התקדמות',  v: `${avgProgress.toFixed(0)}%`, I: BarChart3, c: '#3b82f6' },
            { l: 'השלימו יעד',     v: completed,              I: Award,       c: '#10b981' },
            { l: 'ממתינים לאישור', v: pendingLogs.length,     I: AlertCircle, c: '#f59e0b' },
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
          aria-label="תפריט ניהול"
        >
          {ADMIN_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedStudent(null); }}
              role="tab"
              aria-selected={tab === t.id}
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

        {/* ═══ STUDENTS TABLE ═══ */}
        {tab === 'overview' && !selectedStudent && (
          <div className="space-y-3 animate-tab-enter">
            {students.length === 0 ? (
              <div className="glass p-12 text-center">
                <Users size={40} className="text-blue-200/20 mx-auto mb-3" aria-hidden="true" />
                <p className="text-white font-medium">אין סטודנטים רשומים עדיין</p>
                <p className="text-blue-200/35 text-sm mt-1">סטודנטים יופיעו כאן לאחר ההרשמה</p>
              </div>
            ) : (
              <>
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-5 text-blue-200/30 text-xs font-medium">
                  <span className="col-span-3">שם</span>
                  <span className="col-span-2">אתר</span>
                  <span className="col-span-2">שעות ידניות</span>
                  <span className="col-span-2">סה"כ</span>
                  <span className="col-span-3">התקדמות</span>
                </div>

                {students.map((s) => {
                  const prog = parseFloat(s.progress_percent || 0);
                  const manualH = parseFloat(s.approved_manual_hours || 0);
                  const totalH = parseFloat(s.total_hours || 0);
                  const pending = parseInt(s.pending_logs || 0, 10);

                  return (
                    <div
                      key={s.student_id}
                      onClick={() => setSelectedStudent(s)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStudent(s); }}}
                      role="button"
                      tabIndex={0}
                      aria-label={`${s.full_name}, התקדמות ${prog.toFixed(0)}%`}
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
                            aria-hidden="true"
                          >
                            {s.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{s.full_name}</p>
                            {pending > 0 && (
                              <span className="text-amber-400/70 text-xs">{pending} ממתינים</span>
                            )}
                          </div>
                        </div>
                        <span className="col-span-2 text-blue-200/60 text-sm flex items-center gap-1">
                          <MapPin size={12} className="text-cyan-400/50" />
                          {s.site_name || '—'}
                        </span>
                        <span className="col-span-2 text-blue-200/60 text-sm">
                          {manualH.toFixed(1)} שעות
                        </span>
                        <span className="col-span-2 text-white font-bold text-sm">
                          {totalH.toFixed(1)} / {s.total_goal}
                        </span>
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="flex-1"><PBar progress={prog} /></div>
                          <span className="text-cyan-300 text-sm font-bold w-12 text-left">{prog.toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                              style={{ background: `linear-gradient(135deg, ${pColor(prog)}, #8b5cf6)` }}
                              aria-hidden="true"
                            >
                              {s.full_name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">{s.full_name}</p>
                              {s.site_name && (
                                <p className="text-cyan-400/40 text-xs flex items-center gap-1">
                                  <MapPin size={10} /> {s.site_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-cyan-300 font-bold shrink-0">{prog.toFixed(0)}%</span>
                        </div>
                        <PBar progress={prog} h={6} />
                        <div className="flex justify-between mt-2 text-xs text-blue-200/35">
                          <span>{totalH.toFixed(1)} / {s.total_goal} שעות</span>
                          {pending > 0 && <span className="text-amber-400/70">{pending} ממתינים</span>}
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
                className="flex items-center gap-2 text-blue-200/40 hover:text-cyan-300 text-sm transition-colors touch-target"
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
                  {s.site_name && (
                    <p className="text-cyan-400/50 text-sm mb-4 flex items-center gap-1 justify-center md:justify-start">
                      <MapPin size={13} /> {s.site_name}
                    </p>
                  )}
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
          <div className="space-y-3 animate-tab-enter">
            {pendingLogs.length === 0 ? (
              <div className="glass p-12 text-center">
                <Check size={44} className="text-emerald-400 mx-auto mb-3 opacity-40" aria-hidden="true" />
                <p className="text-white font-medium">אין דיווחים ממתינים</p>
                <p className="text-blue-200/35 text-sm mt-1">כל הדיווחים טופלו</p>
              </div>
            ) : (
              pendingLogs.map((l) => (
                <div key={l.id} className="glass p-5">
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
                          <p className="text-white text-sm font-bold">{l.user_name}</p>
                          <span className="text-blue-200/20 text-xs" aria-hidden="true">·</span>
                          <span className="text-blue-200/40 text-xs">
                            {CATEGORIES[l.category]?.label || 'אחר'}
                          </span>
                        </div>
                        <p className="text-blue-200/60 text-sm mt-1 truncate">{l.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-blue-200/35 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} aria-hidden="true" /> {fmtDate(l.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer size={11} aria-hidden="true" /> {fmtDur(l.duration_minutes)}
                          </span>
                          {l.site_name && (
                            <span className="flex items-center gap-1 text-cyan-400/50">
                              <MapPin size={11} /> {l.site_name}
                            </span>
                          )}
                          {l.event_name && (
                            <span className="flex items-center gap-1 text-violet-400/50">
                              <CalendarDays size={11} /> {l.event_name}
                            </span>
                          )}
                          {l.supervisor_status === 'supervisor_approved' && (
                            <span className="text-emerald-400/60">מפקח אישר</span>
                          )}
                          {l.supervisor_status === 'pending_supervisor' && (
                            <span className="text-amber-400/60">ממתין למפקח</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mr-auto md:mr-0">
                      <button
                        onClick={() => handleReject(l.id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-red-400 text-sm font-medium border border-red-400/20 hover:bg-red-400/10 transition-all touch-target"
                        aria-label={`דחה דיווח של ${l.user_name}`}
                      >
                        <X size={15} aria-hidden="true" /> דחה
                      </button>
                      <button
                        onClick={() => handleApprove(l.id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/20 gradient-success touch-target"
                        aria-label={`אשר דיווח של ${l.user_name}`}
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

        {/* ═══ MANAGEMENT TAB ═══ */}
        {tab === 'manage' && (
          <div className="space-y-6 animate-tab-enter">

            {/* ── Sites Section ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <MapPin size={16} className="text-cyan-400" /> אתרי התנדבות ({activeSites.length})
                </h3>
                <button
                  onClick={() => setShowSiteForm(!showSiteForm)}
                  className="flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <Plus size={14} /> הוסף אתר
                </button>
              </div>

              {showSiteForm && (
                <form onSubmit={handleCreateSite} className="glass p-4 mb-3 space-y-3">
                  <input
                    type="text"
                    value={siteForm.name}
                    onChange={(e) => setSiteForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="שם האתר *"
                    className="glass-input w-full"
                    dir="rtl"
                    required
                  />
                  <input
                    type="text"
                    value={siteForm.address}
                    onChange={(e) => setSiteForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="כתובת"
                    className="glass-input w-full"
                    dir="rtl"
                  />
                  <input
                    type="text"
                    value={siteForm.description}
                    onChange={(e) => setSiteForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="תיאור"
                    className="glass-input w-full"
                    dir="rtl"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-white text-sm font-medium gradient-primary disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : 'צור אתר'}
                    </button>
                    <button type="button" onClick={() => setShowSiteForm(false)} className="px-4 py-2 rounded-xl text-blue-200/40 text-sm border border-white/10 hover:bg-white/5">
                      ביטול
                    </button>
                  </div>
                </form>
              )}

              {activeSites.length === 0 ? (
                <div className="glass p-6 text-center">
                  <MapPin size={28} className="text-blue-200/20 mx-auto mb-2" />
                  <p className="text-blue-200/40 text-sm">אין אתרים פעילים</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeSites.map(site => (
                    <div key={site.id} className="glass p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{site.name}</p>
                        {site.address && <p className="text-blue-200/35 text-xs">{site.address}</p>}
                      </div>
                      <button
                        onClick={() => handleDeactivateSite(site.id)}
                        disabled={busy}
                        className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                      >
                        השבת
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Supervisors Section ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <UserPlus size={16} className="text-amber-400" /> מפקחי אתרים ({supervisors.length})
                </h3>
                <button
                  onClick={() => setShowSupervisorForm(!showSupervisorForm)}
                  className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition-colors"
                >
                  <Plus size={14} /> צור מפקח
                </button>
              </div>

              {showSupervisorForm && (
                <form onSubmit={handleCreateSupervisor} className="glass p-4 mb-3 space-y-3">
                  <input
                    type="text"
                    value={supervisorForm.fullName}
                    onChange={(e) => setSupervisorForm(p => ({ ...p, fullName: e.target.value }))}
                    placeholder="שם מלא *"
                    className="glass-input w-full"
                    dir="rtl"
                    required
                  />
                  <input
                    type="email"
                    value={supervisorForm.email}
                    onChange={(e) => setSupervisorForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="אימייל *"
                    className="glass-input w-full"
                    dir="ltr"
                    style={{ textAlign: 'left' }}
                    required
                  />
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={supervisorForm.password}
                      onChange={(e) => setSupervisorForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="סיסמה *"
                      className="glass-input w-full pl-10"
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
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <select
                    value={supervisorForm.siteId}
                    onChange={(e) => setSupervisorForm(p => ({ ...p, siteId: e.target.value }))}
                    className="glass-input w-full appearance-none"
                  >
                    <option value="" style={{ background: '#111' }}>— שיוך לאתר (אופציונלי) —</option>
                    {activeSites.map(s => (
                      <option key={s.id} value={s.id} style={{ background: '#111' }}>{s.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-white text-sm font-medium gradient-supervisor disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : 'צור מפקח'}
                    </button>
                    <button type="button" onClick={() => setShowSupervisorForm(false)} className="px-4 py-2 rounded-xl text-blue-200/40 text-sm border border-white/10 hover:bg-white/5">
                      ביטול
                    </button>
                  </div>
                </form>
              )}

              {supervisors.length === 0 ? (
                <div className="glass p-6 text-center">
                  <UserPlus size={28} className="text-blue-200/20 mx-auto mb-2" />
                  <p className="text-blue-200/40 text-sm">אין מפקחים במערכת</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supervisors.map(sup => (
                    <div key={sup.id} className="glass p-4">
                      <p className="text-white text-sm font-medium">{sup.full_name}</p>
                      <p className="text-blue-200/35 text-xs">{sup.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Events Section ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <CalendarDays size={16} className="text-violet-400" /> אירועים כלליים ({events.filter(e => e.is_active).length})
                </h3>
                <button
                  onClick={() => setShowEventForm(!showEventForm)}
                  className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition-colors"
                >
                  <Plus size={14} /> הוסף אירוע
                </button>
              </div>

              {showEventForm && (
                <form onSubmit={handleCreateEvent} className="glass p-4 mb-3 space-y-3">
                  <input
                    type="text"
                    value={eventForm.name}
                    onChange={(e) => setEventForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="שם האירוע *"
                    className="glass-input w-full"
                    dir="rtl"
                    required
                  />
                  <input
                    type="text"
                    value={eventForm.description}
                    onChange={(e) => setEventForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="תיאור"
                    className="glass-input w-full"
                    dir="rtl"
                  />
                  <input
                    type="date"
                    value={eventForm.eventDate}
                    onChange={(e) => setEventForm(p => ({ ...p, eventDate: e.target.value }))}
                    className="glass-input w-full"
                    dir="ltr"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-white text-sm font-medium gradient-purple disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : 'צור אירוע'}
                    </button>
                    <button type="button" onClick={() => setShowEventForm(false)} className="px-4 py-2 rounded-xl text-blue-200/40 text-sm border border-white/10 hover:bg-white/5">
                      ביטול
                    </button>
                  </div>
                </form>
              )}

              {events.filter(e => e.is_active).length === 0 ? (
                <div className="glass p-6 text-center">
                  <CalendarDays size={28} className="text-blue-200/20 mx-auto mb-2" />
                  <p className="text-blue-200/40 text-sm">אין אירועים פעילים</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.filter(e => e.is_active).map(ev => (
                    <div key={ev.id} className="glass p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{ev.name}</p>
                        <p className="text-blue-200/35 text-xs">
                          {ev.event_date ? fmtDate(ev.event_date) : 'ללא תאריך'}
                          {ev.description && ` · ${ev.description}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeactivateEvent(ev.id)}
                        disabled={busy}
                        className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                      >
                        השבת
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Placements Section ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Users size={16} className="text-blue-400" /> שיבוצים · {academicYear}
                </h3>
                <button
                  onClick={() => { setShowPlacementForm(!showPlacementForm); if (tab === 'manage') loadPlacements(); }}
                  className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 transition-colors"
                >
                  <Plus size={14} /> שבץ סטודנט
                </button>
              </div>

              {showPlacementForm && (
                <form onSubmit={handleCreatePlacement} className="glass p-4 mb-3 space-y-3">
                  <select
                    value={placementForm.studentId}
                    onChange={(e) => setPlacementForm(p => ({ ...p, studentId: e.target.value }))}
                    className="glass-input w-full appearance-none"
                    required
                  >
                    <option value="" style={{ background: '#111' }}>— בחר סטודנט —</option>
                    {unplacedStudents.map(s => (
                      <option key={s.student_id} value={s.student_id} style={{ background: '#111' }}>{s.full_name}</option>
                    ))}
                  </select>
                  <select
                    value={placementForm.siteId}
                    onChange={(e) => setPlacementForm(p => ({ ...p, siteId: e.target.value }))}
                    className="glass-input w-full appearance-none"
                    required
                  >
                    <option value="" style={{ background: '#111' }}>— בחר אתר —</option>
                    {activeSites.map(s => (
                      <option key={s.id} value={s.id} style={{ background: '#111' }}>{s.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-white text-sm font-medium gradient-primary disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : 'שבץ'}
                    </button>
                    <button type="button" onClick={() => setShowPlacementForm(false)} className="px-4 py-2 rounded-xl text-blue-200/40 text-sm border border-white/10 hover:bg-white/5">
                      ביטול
                    </button>
                  </div>
                </form>
              )}

              {placements.length === 0 ? (
                <div className="glass p-6 text-center">
                  <Users size={28} className="text-blue-200/20 mx-auto mb-2" />
                  <p className="text-blue-200/40 text-sm">אין שיבוצים לשנה {academicYear}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {placements.map(p => (
                    <div key={p.id} className="glass p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
                        >
                          {p.student_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{p.student_name}</p>
                          <p className="text-cyan-400/50 text-xs flex items-center gap-1">
                            <MapPin size={10} /> {p.site_name}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.status === 'active' ? 'bg-emerald-400/10 text-emerald-400' :
                        p.status === 'completed' ? 'bg-blue-400/10 text-blue-400' :
                        'bg-red-400/10 text-red-400'
                      }`}>
                        {p.status === 'active' ? 'פעיל' : p.status === 'completed' ? 'הושלם' : 'בוטל'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Approved Scholars Section ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Mail size={16} className="text-emerald-400" />
                  מלגאים מאושרים ({approvedScholars.filter(s => s.status === 'pending').length} טרם נרשמו)
                </h3>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer">
                    <Upload size={14} />
                    {csvImporting ? 'מייבא...' : 'ייבוא CSV'}
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleCsvImport}
                      className="hidden"
                      disabled={csvImporting}
                    />
                  </label>
                  <button
                    onClick={() => setShowScholarForm(!showScholarForm)}
                    className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                  >
                    <Plus size={14} /> הוסף אימייל
                  </button>
                </div>
              </div>

              {showScholarForm && (
                <form onSubmit={handleAddScholar} className="glass p-4 mb-3 space-y-3">
                  <input
                    type="email"
                    value={scholarEmail}
                    onChange={(e) => setScholarEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="glass-input w-full"
                    dir="ltr"
                    style={{ textAlign: 'left' }}
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy}
                      className="px-4 py-2 rounded-xl text-white text-sm font-medium gradient-primary disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : 'הוסף'}
                    </button>
                    <button type="button" onClick={() => setShowScholarForm(false)}
                      className="px-4 py-2 rounded-xl text-blue-200/40 text-sm border border-white/10 hover:bg-white/5">
                      ביטול
                    </button>
                  </div>
                </form>
              )}

              {approvedScholars.length === 0 ? (
                <div className="glass p-6 text-center">
                  <Mail size={28} className="text-blue-200/20 mx-auto mb-2" />
                  <p className="text-blue-200/40 text-sm">אין מלגאים מאושרים ברשימה</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedScholars.map(s => (
                    <div key={s.id} className="glass p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium" dir="ltr">{s.email}</p>
                        <p className="text-blue-200/35 text-xs">
                          {fmtDate(s.created_at)}
                          {s.used_at && ` · נרשם ${fmtDate(s.used_at)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === 'pending'
                            ? 'bg-amber-400/10 text-amber-400'
                            : 'bg-emerald-400/10 text-emerald-400'
                        }`}>
                          {s.status === 'pending' ? 'טרם נרשם' : 'נרשם'}
                        </span>
                        {s.status === 'pending' && (
                          <button
                            onClick={() => handleRemoveScholar(s.id)}
                            disabled={busy}
                            className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                          >
                            הסר
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
