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
  },
}));

import AdminPanel from '../../components/AdminPanel';
import { ShiftLogic } from '../../lib/ShiftLogic';
import { factory } from '../../__mocks__/supabase';

const adminProfile = factory.adminProfile();

function setupMocks(overrides = {}) {
  ShiftLogic.getAllStudentsSummary.mockResolvedValue(overrides.students ?? []);
  ShiftLogic.getAllPendingLogs.mockResolvedValue(overrides.pending ?? []);
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

      await waitFor(() => screen.getByText(/אישור דיווחים/));
      await user.click(screen.getByText(/אישור דיווחים/));

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

      await waitFor(() => screen.getByText(/אישור דיווחים/));
      await user.click(screen.getByText(/אישור דיווחים/));

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

      await waitFor(() => screen.getByText(/אישור דיווחים/));
      await user.click(screen.getByText(/אישור דיווחים/));
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

      await waitFor(() => screen.getByText(/אישור דיווחים/));
      await user.click(screen.getByText(/אישור דיווחים/));
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

      await waitFor(() => screen.getByText(/אישור דיווחים/));
      await user.click(screen.getByText(/אישור דיווחים/));
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
});
