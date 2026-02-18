import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));
vi.mock('../../lib/ShiftLogic', () => ({
  ShiftLogic: {
    getActiveShift: vi.fn(),
    getShifts: vi.fn(),
    getManualLogs: vi.fn(),
    calculateProgress: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    submitManualLog: vi.fn(),
  },
}));

import Dashboard from '../../components/Dashboard';
import { ShiftLogic } from '../../lib/ShiftLogic';
import { factory } from '../../__mocks__/supabase';

const defaultProgress = {
  shiftHours: 10, approvedManualHours: 5, totalHours: 15,
  progressPercent: 10, pendingLogs: 1,
};

const profile = factory.profile();

function setupMocks(overrides = {}) {
  ShiftLogic.getActiveShift.mockResolvedValue(overrides.activeShift ?? null);
  ShiftLogic.getShifts.mockResolvedValue(overrides.shifts ?? []);
  ShiftLogic.getManualLogs.mockResolvedValue(overrides.logs ?? []);
  ShiftLogic.calculateProgress.mockResolvedValue(overrides.progress ?? defaultProgress);
}

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // LOADING & RENDERING
  // ═══════════════════════════════════════════
  describe('loading & rendering', () => {
    it('shows loading spinner initially', () => {
      ShiftLogic.getActiveShift.mockImplementation(() => new Promise(() => {}));
      ShiftLogic.getShifts.mockImplementation(() => new Promise(() => {}));
      ShiftLogic.getManualLogs.mockImplementation(() => new Promise(() => {}));
      ShiftLogic.calculateProgress.mockImplementation(() => new Promise(() => {}));

      render(<Dashboard profile={profile} onLogout={vi.fn()} />);
      // Should see the loading indicator (Loader2 spinner)
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders dashboard after data loads', async () => {
      setupMocks();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/10%/)).toBeInTheDocument(); // progress
      });
    });

    it('displays user name in header', async () => {
      setupMocks();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/ישראל ישראלי/)).toBeInTheDocument();
      });
    });

    it('shows stats grid with correct values', async () => {
      setupMocks();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('10.0')).toBeInTheDocument(); // shift hours
        expect(screen.getByText('5.0')).toBeInTheDocument();  // manual hours
        expect(screen.getByText('15.0')).toBeInTheDocument(); // total
        expect(screen.getByText('1')).toBeInTheDocument();    // pending
      });
    });
  });

  // ═══════════════════════════════════════════
  // TAB NAVIGATION
  // ═══════════════════════════════════════════
  describe('tab navigation', () => {
    it('shows punch clock tab by default', async () => {
      setupMocks();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('התחלת משמרת חדשה')).toBeInTheDocument();
      });
    });

    it('switches to history tab', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('היסטוריה'));
      await user.click(screen.getByText('היסטוריה'));

      expect(screen.getByText('משמרות אחרונות')).toBeInTheDocument();
    });

    it('switches to manual log tab', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('דיווח ידני'));
      await user.click(screen.getByText('דיווח ידני'));

      expect(screen.getByText('דיווח שעות ידני')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // CHECK IN
  // ═══════════════════════════════════════════
  describe('check in', () => {
    it('shows category grid and description input', async () => {
      setupMocks();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('חונכות')).toBeInTheDocument();
        expect(screen.getByText('הדרכה')).toBeInTheDocument();
        expect(screen.getByText('שירות קהילתי')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('תיאור המשימה...')).toBeInTheDocument();
      });
    });

    it('calls ShiftLogic.checkIn on submit', async () => {
      setupMocks();
      ShiftLogic.checkIn.mockResolvedValue(factory.activeShift());

      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByPlaceholderText('תיאור המשימה...'));

      await user.type(screen.getByPlaceholderText('תיאור המשימה...'), 'חונכות מתמטיקה');
      await user.click(screen.getByText('כניסה למשמרת'));

      await waitFor(() => {
        expect(ShiftLogic.checkIn).toHaveBeenCalledWith(
          'user-123',
          'tutoring', // default category
          'חונכות מתמטיקה'
        );
      });
    });

    it('shows error toast when description is empty', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('כניסה למשמרת'));
      await user.click(screen.getByText('כניסה למשמרת'));

      await waitFor(() => {
        expect(screen.getByText('נא להזין תיאור משימה')).toBeInTheDocument();
      });
      expect(ShiftLogic.checkIn).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // ACTIVE SHIFT DISPLAY
  // ═══════════════════════════════════════════
  describe('active shift', () => {
    it('shows live timer when shift is active', async () => {
      setupMocks({ activeShift: factory.activeShift() });
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('משמרת פעילה')).toBeInTheDocument();
        expect(screen.getByText('יציאה ממשמרת')).toBeInTheDocument();
      });
    });

    it('calls ShiftLogic.checkOut when clicking checkout', async () => {
      const active = factory.activeShift();
      setupMocks({ activeShift: active });
      ShiftLogic.checkOut.mockResolvedValue(factory.shift());
      // Re-mock after checkout to refresh
      ShiftLogic.getActiveShift.mockResolvedValue(null);

      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('יציאה ממשמרת'));
      await user.click(screen.getByText('יציאה ממשמרת'));

      await waitFor(() => {
        expect(ShiftLogic.checkOut).toHaveBeenCalledWith(active.id);
      });
    });
  });

  // ═══════════════════════════════════════════
  // HISTORY TAB
  // ═══════════════════════════════════════════
  describe('history', () => {
    it('shows empty state when no shifts', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('היסטוריה'));
      await user.click(screen.getByText('היסטוריה'));

      expect(screen.getByText('עדיין אין משמרות שהושלמו')).toBeInTheDocument();
    });

    it('displays completed shifts', async () => {
      setupMocks({
        shifts: [factory.shift({ task_description: 'חונכות פיזיקה' })],
      });
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('היסטוריה'));
      await user.click(screen.getByText('היסטוריה'));

      expect(screen.getByText('חונכות פיזיקה')).toBeInTheDocument();
    });

    it('shows status badges on manual logs', async () => {
      setupMocks({
        logs: [
          factory.approvedLog({ description: 'עבודה מאושרת' }),
          factory.manualLog({ description: 'ממתין לאישור' }),
          factory.rejectedLog({ description: 'נדחה' }),
        ],
      });
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('היסטוריה'));
      await user.click(screen.getByText('היסטוריה'));

      expect(screen.getByText('אושר ✓')).toBeInTheDocument();
      expect(screen.getByText('ממתין...')).toBeInTheDocument();
      expect(screen.getByText('נדחה ✗')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // MANUAL LOG SUBMISSION
  // ═══════════════════════════════════════════
  describe('manual log form', () => {
    it('calls submitManualLog with correct values', async () => {
      setupMocks();
      ShiftLogic.submitManualLog.mockResolvedValue(factory.manualLog());

      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('דיווח ידני'));
      await user.click(screen.getByText('דיווח ידני'));

      const dateInput = screen.getByLabelText('תאריך') || screen.getAllByRole('textbox')[0];
      // Fill in the form
      await user.type(screen.getByPlaceholderText('0'), '2');      // hours
      await user.type(screen.getByPlaceholderText('תאר את העבודה שביצעת...'), 'עזרה בספרייה');

      await user.click(screen.getByText('שלח לאישור'));

      await waitFor(() => {
        expect(ShiftLogic.submitManualLog).toHaveBeenCalled();
        const callArgs = ShiftLogic.submitManualLog.mock.calls[0];
        expect(callArgs[0]).toBe('user-123');
        expect(callArgs[1].description).toBe('עזרה בספרייה');
        expect(callArgs[1].category).toBeDefined();
      });
    });

    it('shows error when duration is 0', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText('דיווח ידני'));
      await user.click(screen.getByText('דיווח ידני'));
      await user.type(screen.getByPlaceholderText('תאר את העבודה שביצעת...'), 'test');
      await user.click(screen.getByText('שלח לאישור'));

      await waitFor(() => {
        expect(screen.getByText('נא להזין משך זמן תקין')).toBeInTheDocument();
      });
      expect(ShiftLogic.submitManualLog).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // PROGRESS DISPLAY
  // ═══════════════════════════════════════════
  describe('progress', () => {
    it('shows congratulations at 100%', async () => {
      setupMocks({
        progress: { ...defaultProgress, progressPercent: 100, totalHours: 150 },
      });
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/כל הכבוד/)).toBeInTheDocument();
      });
    });

    it('does NOT show congratulations below 100%', async () => {
      setupMocks();
      render(<Dashboard profile={profile} onLogout={vi.fn()} />);

      await waitFor(() => screen.getByText(/10%/));
      expect(screen.queryByText(/כל הכבוד/)).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════
  describe('logout', () => {
    it('calls onLogout when clicking logout button', async () => {
      setupMocks();
      const onLogout = vi.fn();
      const user = userEvent.setup();
      render(<Dashboard profile={profile} onLogout={onLogout} />);

      await waitFor(() => screen.getByTitle('יציאה'));
      await user.click(screen.getByTitle('יציאה'));

      expect(onLogout).toHaveBeenCalled();
    });
  });
});
