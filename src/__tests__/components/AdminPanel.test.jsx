import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));
vi.mock('../../lib/ShiftLogic', () => ({
  ShiftLogic: {
    getAllStudentsSummary: vi.fn(),
    getAllPendingLogs: vi.fn(),
    approveLog: vi.fn(),
    rejectLog: vi.fn(),
    getAllSites: vi.fn(),
    getAllEvents: vi.fn(),
    getAllSupervisors: vi.fn(),
    getActiveSites: vi.fn(),
    getAllPlacements: vi.fn(),
    createSite: vi.fn(),
    createEvent: vi.fn(),
    createSupervisorAccount: vi.fn(),
    createPlacement: vi.fn(),
    deactivateSite: vi.fn(),
    deactivateEvent: vi.fn(),
    assignSupervisorToSite: vi.fn(),
    removeSupervisorFromSite: vi.fn(),
    getSiteSupervisors: vi.fn(),
    getApprovedScholars: vi.fn(),
    addApprovedScholar: vi.fn(),
    addApprovedScholarsBulk: vi.fn(),
    removeApprovedScholar: vi.fn(),
    toggleStudentActive: vi.fn(),
  },
}));

import AdminPanel from '../../components/AdminPanel';
import { ShiftLogic } from '../../lib/ShiftLogic';
import { factory } from '../../__mocks__/supabase';

const adminProfile = factory.adminProfile();

function setupMocks(overrides = {}) {
  ShiftLogic.getAllStudentsSummary.mockResolvedValue(overrides.students ?? []);
  ShiftLogic.getAllPendingLogs.mockResolvedValue(overrides.pending ?? []);
  ShiftLogic.getAllSites.mockResolvedValue(overrides.sites ?? []);
  ShiftLogic.getAllEvents.mockResolvedValue(overrides.events ?? []);
  ShiftLogic.getAllSupervisors.mockResolvedValue(overrides.supervisors ?? []);
  ShiftLogic.getActiveSites.mockResolvedValue(overrides.activeSites ?? []);
  ShiftLogic.getAllPlacements.mockResolvedValue(overrides.placements ?? []);
  ShiftLogic.getApprovedScholars.mockResolvedValue(overrides.scholars ?? []);
}

describe('AdminPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════
  describe('rendering', () => {
    it('shows admin header with shield icon text', async () => {
      setupMocks();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/לוח בקרה · מנהל/)).toBeInTheDocument();
      });
    });

    it('shows admin name', async () => {
      setupMocks();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('מנהל מערכת')).toBeInTheDocument();
      });
    });

    it('shows stats cards', async () => {
      setupMocks({
        students: [
          factory.studentSummary({ progress_percent: 40 }),
          factory.studentSummary({ student_id: 's2', progress_percent: 100 }),
        ],
        pending: [{ id: 'p1', user_name: 'Test' }],
      });

      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();  // total students
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);  // pending (may have duplicates from mobile/desktop)
      });
    });
  });

  // ═══════════════════════════════════════════
  // STUDENT OVERVIEW
  // ═══════════════════════════════════════════
  describe('student overview', () => {
    it('shows empty state when no students', async () => {
      setupMocks({ students: [] });
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('אין סטודנטים רשומים עדיין')).toBeInTheDocument();
      });
    });

    it('shows student names', async () => {
      setupMocks({
        students: [
          factory.studentSummary({ full_name: 'יוסי כהן' }),
          factory.studentSummary({ student_id: 's2', full_name: 'מיכל לוי' }),
        ],
      });

      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('יוסי כהן').length).toBeGreaterThanOrEqual(1);  // may have duplicates from mobile/desktop
        expect(screen.getAllByText('מיכל לוי').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows student detail view on click', async () => {
      setupMocks({
        students: [factory.studentSummary({ full_name: 'יוסי כהן', progress_percent: 38 })],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getAllByText('יוסי כהן'));
      await user.click(screen.getAllByText('יוסי כהן')[0]);  // click first match (desktop or mobile)

      await waitFor(() => {
        expect(screen.getByText('חזרה לרשימה')).toBeInTheDocument();
        expect(screen.getAllByText('38%').length).toBeGreaterThanOrEqual(1);  // may have duplicates
      });
    });

    it('navigates back from detail view', async () => {
      setupMocks({
        students: [factory.studentSummary({ full_name: 'יוסי כהן' })],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getAllByText('יוסי כהן'));
      await user.click(screen.getAllByText('יוסי כהן')[0]);  // click first match (desktop or mobile)
      await waitFor(() => screen.getByText('חזרה לרשימה'));
      await user.click(screen.getByText('חזרה לרשימה'));

      // Should be back to list, showing the student again
      expect(screen.queryByText('חזרה לרשימה')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // PENDING APPROVALS
  // ═══════════════════════════════════════════
  describe('pending approvals', () => {
    it('shows empty state when no pending logs', async () => {
      setupMocks({ pending: [] });
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישורים/));
      await user.click(screen.getByText(/אישורים/));

      expect(screen.getByText('אין דיווחים ממתינים')).toBeInTheDocument();
    });

    it('shows pending log details', async () => {
      setupMocks({
        pending: [{
          id: 'p1',
          user_name: 'יוסי כהן',
          description: 'חונכות פיזיקה',
          category: 'tutoring',
          date: '2026-02-14',
          duration_minutes: 120,
          created_at: '2026-02-14T10:00:00Z',
        }],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישורים/));
      await user.click(screen.getByText(/אישורים/));

      expect(screen.getByText('יוסי כהן')).toBeInTheDocument();
      expect(screen.getByText('חונכות פיזיקה')).toBeInTheDocument();
      expect(screen.getByText('אשר')).toBeInTheDocument();
      expect(screen.getByText('דחה')).toBeInTheDocument();
    });

    it('calls approveLog on approve click', async () => {
      ShiftLogic.approveLog.mockResolvedValue({});
      ShiftLogic.getAllStudentsSummary.mockResolvedValue([]);
      setupMocks({
        pending: [{
          id: 'p1', user_name: 'X', description: 'Y', category: 'other',
          date: '2026-02-14', duration_minutes: 60, created_at: '2026-02-14T10:00:00Z',
        }],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישורים/));
      await user.click(screen.getByText(/אישורים/));
      await user.click(screen.getByText('אשר'));

      await waitFor(() => {
        expect(ShiftLogic.approveLog).toHaveBeenCalledWith('p1', 'admin-123');
      });
    });

    it('calls rejectLog on reject click', async () => {
      ShiftLogic.rejectLog.mockResolvedValue({});
      setupMocks({
        pending: [{
          id: 'p2', user_name: 'X', description: 'Y', category: 'other',
          date: '2026-02-14', duration_minutes: 60, created_at: '2026-02-14T10:00:00Z',
        }],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישורים/));
      await user.click(screen.getByText(/אישורים/));
      await user.click(screen.getByText('דחה'));

      await waitFor(() => {
        expect(ShiftLogic.rejectLog).toHaveBeenCalledWith('p2', 'admin-123');
      });
    });

    it('removes log from UI after approval', async () => {
      ShiftLogic.approveLog.mockResolvedValue({});
      ShiftLogic.getAllStudentsSummary.mockResolvedValue([]);
      setupMocks({
        pending: [{
          id: 'p1', user_name: 'Y', description: 'Only Log', category: 'other',
          date: '2026-02-14', duration_minutes: 60, created_at: '2026-02-14T10:00:00Z',
        }],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישורים/));
      await user.click(screen.getByText(/אישורים/));
      expect(screen.getByText('Only Log')).toBeInTheDocument();

      await user.click(screen.getByText('אשר'));

      await waitFor(() => {
        expect(screen.queryByText('Only Log')).not.toBeInTheDocument();
        expect(screen.getByText('אין דיווחים ממתינים')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════
  describe('logout', () => {
    it('calls onLogout', async () => {
      setupMocks();
      const onLogout = vi.fn();
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={onLogout} />);

      await waitFor(() => screen.getByTitle('יציאה'));
      await user.click(screen.getByTitle('יציאה'));

      expect(onLogout).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // MANAGEMENT TAB
  // ═══════════════════════════════════════════
  describe('management tab', () => {
    it('shows management tab', async () => {
      setupMocks();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('ניהול')).toBeInTheDocument();
      });
    });

    it('navigates to management tab', async () => {
      setupMocks({
        sites: [{ id: 'site-1', name: 'אתר א', is_active: true }],
        events: [{ id: 'evt-1', name: 'אירוע א', is_active: true }],
      });
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => {
        expect(screen.getByText(/אתרי התנדבות/)).toBeInTheDocument();
        expect(screen.getByText(/מפקחי אתרים/)).toBeInTheDocument();
        expect(screen.getByText(/אירועים כלליים/)).toBeInTheDocument();
        expect(screen.getAllByText(/שיבוצים/).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows site list in management', async () => {
      setupMocks({
        sites: [
          { id: 'site-1', name: 'בית ספר הדר', address: 'רחוב הרצל 5', is_active: true },
          { id: 'site-2', name: 'מרכז קהילתי', address: 'רחוב בן גוריון 10', is_active: true },
        ],
      });
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => {
        expect(screen.getByText('בית ספר הדר')).toBeInTheDocument();
        expect(screen.getByText('מרכז קהילתי')).toBeInTheDocument();
      });
    });

    it('shows event list in management', async () => {
      setupMocks({
        events: [
          { id: 'evt-1', name: 'יום מעשים טובים', is_active: true, event_date: '2026-03-15' },
          { id: 'evt-2', name: 'מבצע חורף', is_active: true, event_date: '2026-01-20' },
        ],
      });
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => {
        expect(screen.getByText('יום מעשים טובים')).toBeInTheDocument();
        expect(screen.getByText('מבצע חורף')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // STUDENT MANAGEMENT (activate/deactivate)
  // ═══════════════════════════════════════════
  describe('student management', () => {
    it('shows students section in management tab with toggle buttons', async () => {
      setupMocks({
        students: [
          factory.studentSummary({ student_id: 's1', full_name: 'יוסי כהן', is_active: true }),
          factory.studentSummary({ student_id: 's2', full_name: 'מיכל לוי', is_active: true }),
        ],
      });
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => {
        // Student names should appear in management section
        expect(screen.getByText(/2 פעילים/)).toBeInTheDocument();
        // "השבת" (deactivate) buttons should exist for active students
        const deactivateButtons = screen.getAllByText('השבת');
        expect(deactivateButtons.length).toBe(2);
      });
    });

    it('shows inactive students with disabled styling and activate button', async () => {
      setupMocks({
        students: [
          factory.studentSummary({ student_id: 's1', full_name: 'יוסי כהן', is_active: true }),
          factory.studentSummary({ student_id: 's2', full_name: 'מיכל לוי', is_active: false }),
        ],
      });
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => {
        // Should show 1 active, 1 deactivated
        expect(screen.getByText(/1 פעילים/)).toBeInTheDocument();
        expect(screen.getByText(/1 מושבתים/)).toBeInTheDocument();
        // Inactive student should have "(מושבת)" label
        expect(screen.getByText('(מושבת)')).toBeInTheDocument();
        // Should have "הפעל" (activate) button for the deactivated student
        expect(screen.getByText('הפעל')).toBeInTheDocument();
        // And "השבת" (deactivate) button for the active student
        expect(screen.getByText('השבת')).toBeInTheDocument();
      });
    });

    it('calls toggleStudentActive to deactivate a student', async () => {
      ShiftLogic.toggleStudentActive.mockResolvedValue({});
      setupMocks({
        students: [
          factory.studentSummary({ student_id: 's1', full_name: 'דני אלון', is_active: true }),
        ],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => screen.getByText('השבת'));
      await user.click(screen.getByText('השבת'));

      await waitFor(() => {
        expect(ShiftLogic.toggleStudentActive).toHaveBeenCalledWith('s1', false);
      });
    });

    it('calls toggleStudentActive to reactivate a student', async () => {
      ShiftLogic.toggleStudentActive.mockResolvedValue({});
      setupMocks({
        students: [
          factory.studentSummary({ student_id: 's1', full_name: 'דני אלון', is_active: false }),
        ],
      });

      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => screen.getByText('הפעל'));
      await user.click(screen.getByText('הפעל'));

      await waitFor(() => {
        expect(ShiftLogic.toggleStudentActive).toHaveBeenCalledWith('s1', true);
      });
    });

    it('counts only active students in stats cards', async () => {
      setupMocks({
        students: [
          factory.studentSummary({ student_id: 's1', full_name: 'א', is_active: true, progress_percent: 50 }),
          factory.studentSummary({ student_id: 's2', full_name: 'ב', is_active: true, progress_percent: 100 }),
          factory.studentSummary({ student_id: 's3', full_name: 'ג', is_active: false, progress_percent: 80 }),
        ],
      });

      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        // Total active students should be 2 (not 3)
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('shows empty state when no students exist in management', async () => {
      setupMocks({ students: [] });
      const user = userEvent.setup();
      render(<AdminPanel profile={adminProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('ניהול'));
      await user.click(screen.getByText('ניהול'));

      await waitFor(() => {
        expect(screen.getByText('אין סטודנטים רשומים')).toBeInTheDocument();
      });
    });
  });
});
