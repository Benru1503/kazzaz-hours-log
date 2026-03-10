import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));
vi.mock('../../lib/ShiftLogic', () => ({
  ShiftLogic: {
    getSupervisorStudents: vi.fn(),
    getSupervisorPendingLogs: vi.fn(),
    getSupervisorSites: vi.fn(),
    supervisorApproveLog: vi.fn(),
    supervisorRejectLog: vi.fn(),
  },
}));

import SupervisorPanel from '../../components/SupervisorPanel';
import { ShiftLogic } from '../../lib/ShiftLogic';
import { factory } from '../../__mocks__/supabase';

const supervisorProfile = factory.supervisorProfile();

function setupMocks(overrides = {}) {
  ShiftLogic.getSupervisorStudents.mockResolvedValue(overrides.students ?? []);
  ShiftLogic.getSupervisorPendingLogs.mockResolvedValue(overrides.pending ?? []);
  ShiftLogic.getSupervisorSites.mockResolvedValue(overrides.sites ?? []);
}

describe('SupervisorPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════
  describe('rendering', () => {
    it('shows supervisor header text', async () => {
      setupMocks();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/לוח בקרה · מפקח אתר/)).toBeInTheDocument();
      });
    });

    it('shows supervisor name', async () => {
      setupMocks();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('מפקח אתר')).toBeInTheDocument();
      });
    });

    it('shows stats cards', async () => {
      setupMocks({
        students: [
          factory.supervisorStudent({ progress_percent: 40 }),
          factory.supervisorStudent({ student_id: 's2', progress_percent: 100 }),
        ],
        pending: [factory.supervisorPendingLog()],
      });

      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('סטודנטים')).toBeInTheDocument();
        expect(screen.getByText('ממוצע התקדמות')).toBeInTheDocument();
        expect(screen.getByText('השלימו יעד')).toBeInTheDocument();
        expect(screen.getByText('ממתינים לאישור')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();  // total students
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);  // completed + pending (may have duplicates)
      });
    });
  });

  // ═══════════════════════════════════════════
  // STUDENT OVERVIEW
  // ═══════════════════════════════════════════
  describe('student overview', () => {
    it('shows empty state when no students', async () => {
      setupMocks({ students: [] });
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('אין סטודנטים משובצים באתרים שלך')).toBeInTheDocument();
      });
    });

    it('shows student names', async () => {
      setupMocks({
        students: [
          factory.supervisorStudent({ full_name: 'יוסי כהן' }),
          factory.supervisorStudent({ student_id: 's2', full_name: 'מיכל לוי' }),
        ],
      });

      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('יוסי כהן').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('מיכל לוי').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows site name for student', async () => {
      setupMocks({
        students: [factory.supervisorStudent({ site_name: 'בית ספר הדר' })],
      });

      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('בית ספר הדר').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows student detail view on click', async () => {
      setupMocks({
        students: [factory.supervisorStudent({ full_name: 'יוסי כהן', progress_percent: 38 })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getAllByText('יוסי כהן'));
      await user.click(screen.getAllByText('יוסי כהן')[0]);

      await waitFor(() => {
        expect(screen.getByText('חזרה לרשימה')).toBeInTheDocument();
        expect(screen.getAllByText('38%').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows student detail with hours breakdown', async () => {
      setupMocks({
        students: [factory.supervisorStudent({
          full_name: 'יוסי כהן',
          shift_hours: 45.5,
          approved_manual_hours: 12,
          total_hours: 57.5,
          total_goal: 150,
        })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getAllByText('יוסי כהן'));
      await user.click(screen.getAllByText('יוסי כהן')[0]);

      await waitFor(() => {
        expect(screen.getByText('שעות משמרת')).toBeInTheDocument();
        expect(screen.getByText('שעות ידניות')).toBeInTheDocument();
        expect(screen.getByText('45.5')).toBeInTheDocument();
        expect(screen.getByText('12.0')).toBeInTheDocument();
        expect(screen.getByText('57.5')).toBeInTheDocument();
      });
    });

    it('navigates back from detail view', async () => {
      setupMocks({
        students: [factory.supervisorStudent({ full_name: 'יוסי כהן' })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getAllByText('יוסי כהן'));
      await user.click(screen.getAllByText('יוסי כהן')[0]);
      await waitFor(() => screen.getByText('חזרה לרשימה'));
      await user.click(screen.getByText('חזרה לרשימה'));

      // Should be back to list, no more back button
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
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));

      expect(screen.getByText('אין דיווחים ממתינים לאישור')).toBeInTheDocument();
    });

    it('shows pending log details', async () => {
      setupMocks({
        pending: [factory.supervisorPendingLog({
          student_name: 'יוסי כהן',
          description: 'חונכות פיזיקה',
          category: 'tutoring',
          date: '2026-02-14',
          duration_minutes: 120,
          site_name: 'בית ספר הדר',
        })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));

      expect(screen.getByText('יוסי כהן')).toBeInTheDocument();
      expect(screen.getByText('חונכות פיזיקה')).toBeInTheDocument();
      expect(screen.getByText('אשר')).toBeInTheDocument();
      expect(screen.getByText('דחה')).toBeInTheDocument();
    });

    it('shows duration formatted correctly', async () => {
      setupMocks({
        pending: [factory.supervisorPendingLog({ duration_minutes: 120 })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));

      expect(screen.getByText('2 שעות')).toBeInTheDocument();
    });

    it('calls supervisorApproveLog on approve click', async () => {
      ShiftLogic.supervisorApproveLog.mockResolvedValue({});
      ShiftLogic.getSupervisorStudents.mockResolvedValue([]);
      setupMocks({
        pending: [factory.supervisorPendingLog({
          log_id: 'log-42',
          student_name: 'X',
          description: 'Y',
          category: 'other',
          date: '2026-02-14',
          duration_minutes: 60,
        })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));
      await user.click(screen.getByText('אשר'));

      await waitFor(() => {
        expect(ShiftLogic.supervisorApproveLog).toHaveBeenCalledWith('log-42');
      });
    });

    it('refreshes students after approve', async () => {
      ShiftLogic.supervisorApproveLog.mockResolvedValue({});
      ShiftLogic.getSupervisorStudents.mockResolvedValue([]);
      setupMocks({
        pending: [factory.supervisorPendingLog({ log_id: 'log-42' })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));
      await user.click(screen.getByText('אשר'));

      await waitFor(() => {
        // getSupervisorStudents called once on initial load, then again after approve
        expect(ShiftLogic.getSupervisorStudents).toHaveBeenCalledTimes(2);
      });
    });

    it('shows success toast after approve', async () => {
      ShiftLogic.supervisorApproveLog.mockResolvedValue({});
      ShiftLogic.getSupervisorStudents.mockResolvedValue([]);
      setupMocks({
        pending: [factory.supervisorPendingLog({ log_id: 'log-42' })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));
      await user.click(screen.getByText('אשר'));

      await waitFor(() => {
        expect(screen.getByText('השעות אושרו בהצלחה')).toBeInTheDocument();
      });
    });

    it('calls supervisorRejectLog on reject click', async () => {
      ShiftLogic.supervisorRejectLog.mockResolvedValue({});
      setupMocks({
        pending: [factory.supervisorPendingLog({
          log_id: 'log-99',
          student_name: 'X',
          description: 'Y',
          category: 'other',
          date: '2026-02-14',
          duration_minutes: 60,
        })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));
      await user.click(screen.getByText('דחה'));

      await waitFor(() => {
        expect(ShiftLogic.supervisorRejectLog).toHaveBeenCalledWith('log-99');
      });
    });

    it('shows rejection toast after reject', async () => {
      ShiftLogic.supervisorRejectLog.mockResolvedValue({});
      setupMocks({
        pending: [factory.supervisorPendingLog({ log_id: 'log-99' })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));
      await user.click(screen.getByText('דחה'));

      await waitFor(() => {
        expect(screen.getByText('הדיווח נדחה')).toBeInTheDocument();
      });
    });

    it('removes log from UI after approval', async () => {
      ShiftLogic.supervisorApproveLog.mockResolvedValue({});
      ShiftLogic.getSupervisorStudents.mockResolvedValue([]);
      setupMocks({
        pending: [factory.supervisorPendingLog({
          log_id: 'log-1',
          student_name: 'Y',
          description: 'Only Log',
          category: 'other',
          date: '2026-02-14',
          duration_minutes: 60,
        })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));
      expect(screen.getByText('Only Log')).toBeInTheDocument();

      await user.click(screen.getByText('אשר'));

      await waitFor(() => {
        expect(screen.queryByText('Only Log')).not.toBeInTheDocument();
        expect(screen.getByText('אין דיווחים ממתינים לאישור')).toBeInTheDocument();
      });
    });

    it('removes log from UI after rejection', async () => {
      ShiftLogic.supervisorRejectLog.mockResolvedValue({});
      setupMocks({
        pending: [factory.supervisorPendingLog({
          log_id: 'log-1',
          description: 'Rejected Log',
        })],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות/));
      await user.click(screen.getByText(/אישור שעות/));
      expect(screen.getByText('Rejected Log')).toBeInTheDocument();

      await user.click(screen.getByText('דחה'));

      await waitFor(() => {
        expect(screen.queryByText('Rejected Log')).not.toBeInTheDocument();
        expect(screen.getByText('אין דיווחים ממתינים לאישור')).toBeInTheDocument();
      });
    });

    it('updates pending count in tab after approval', async () => {
      ShiftLogic.supervisorApproveLog.mockResolvedValue({});
      ShiftLogic.getSupervisorStudents.mockResolvedValue([]);
      setupMocks({
        pending: [
          factory.supervisorPendingLog({ log_id: 'log-1', description: 'Log A' }),
          factory.supervisorPendingLog({ log_id: 'log-2', description: 'Log B' }),
        ],
      });

      const user = userEvent.setup();
      render(<SupervisorPanel profile={supervisorProfile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/אישור שעות \(2\)/));
      await user.click(screen.getByText(/אישור שעות \(2\)/));

      // Approve the first log
      const approveButtons = screen.getAllByText('אשר');
      await user.click(approveButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/אישור שעות \(1\)/)).toBeInTheDocument();
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
      render(<SupervisorPanel profile={supervisorProfile} onLogout={onLogout} />);

      await waitFor(() => screen.getByTitle('יציאה'));
      await user.click(screen.getByTitle('יציאה'));

      expect(onLogout).toHaveBeenCalled();
    });
  });
});
