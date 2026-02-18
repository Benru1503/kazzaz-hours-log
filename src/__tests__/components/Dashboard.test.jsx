import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../../components/Dashboard';
import { ShiftLogic } from '../../lib/ShiftLogic';

// Mock ShiftLogic
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

describe('Dashboard', () => {
  const mockProfile = {
    id: 'student-123',
    full_name: 'Test Student',
    role: 'student',
  };

  const mockOnLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    ShiftLogic.getActiveShift.mockResolvedValue(null);
    ShiftLogic.getShifts.mockResolvedValue([]);
    ShiftLogic.getManualLogs.mockResolvedValue([]);
    ShiftLogic.calculateProgress.mockResolvedValue({
      shiftHours: 0,
      approvedManualHours: 0,
      totalHours: 0,
      progressPercent: 0,
      pendingLogs: 0,
      goal: 150,
    });
  });

  it('renders dashboard with tabs', async () => {
    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('שעון נוכחות')).toBeInTheDocument();
    });

    expect(screen.getByText(/דיווח ידני/)).toBeInTheDocument();
    expect(screen.getByText(/היסטוריה/)).toBeInTheDocument();
  });

  it('shows check-in form when no active shift', async () => {
    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('התחלת משמרת חדשה')).toBeInTheDocument();
    });

    expect(screen.getByText(/בחר קטגוריה/)).toBeInTheDocument();
  });

  it('shows active shift when present', async () => {
    const activeShift = {
      id: 'shift-123',
      start_time: new Date().toISOString(),
      category: 'tutoring',
      task_description: 'Testing',
      status: 'active',
    };

    ShiftLogic.getActiveShift.mockResolvedValue(activeShift);

    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('משמרת פעילה')).toBeInTheDocument();
    });

    expect(screen.getByText('יציאה ממשמרת')).toBeInTheDocument();
  });

  it('calls ShiftLogic.checkIn when starting shift', async () => {
    const user = userEvent.setup();
    
    ShiftLogic.checkIn.mockResolvedValue({
      id: 'shift-123',
      start_time: new Date().toISOString(),
      category: 'tutoring',
      task_description: 'Test task',
      status: 'active',
    });

    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('התחלת משמרת חדשה')).toBeInTheDocument();
    });

    // Select category
    const tutoringButton = screen.getByText(/הדרכה/);
    await user.click(tutoringButton);

    // Fill in description - use correct placeholder
    const descInput = screen.getByPlaceholderText('תיאור המשימה...');
    await user.type(descInput, 'Test task');

    // Click check-in
    const checkInButton = screen.getByRole('button', { name: /כניסה למשמרת/ });
    await user.click(checkInButton);

    await waitFor(() => {
      expect(ShiftLogic.checkIn).toHaveBeenCalledWith(
        'student-123',
        'tutoring',
        'Test task'
      );
    });
  });

  it('calls ShiftLogic.checkOut when clicking checkout', async () => {
    const user = userEvent.setup();
    
    // Mock MUST return truthy active shift for checkout button to appear
    const activeShift = {
      id: 'shift-123',
      start_time: new Date().toISOString(),
      category: 'tutoring',
      task_description: 'Testing',
      status: 'active',
    };

    ShiftLogic.getActiveShift.mockResolvedValue(activeShift);
    ShiftLogic.checkOut.mockResolvedValue({
      ...activeShift,
      end_time: new Date().toISOString(),
      status: 'completed',
    });

    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    // Wait for checkout button to appear
    await waitFor(() => {
      expect(screen.getByText('יציאה ממשמרת')).toBeInTheDocument();
    });

    const checkoutButton = screen.getByRole('button', { name: /יציאה ממשמרת/ });
    await user.click(checkoutButton);

    await waitFor(() => {
      expect(ShiftLogic.checkOut).toHaveBeenCalledWith('shift-123');
    });
  });

  it('switches to manual log tab', async () => {
    const user = userEvent.setup();
    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText(/דיווח ידני/)).toBeInTheDocument();
    });

    const manualTab = screen.getByText(/דיווח ידני/);
    await user.click(manualTab);

    await waitFor(() => {
      expect(screen.getByText('דיווח שעות ידני')).toBeInTheDocument();
    });
  });

  it('calls submitManualLog with correct values', async () => {
    const user = userEvent.setup();
    
    ShiftLogic.submitManualLog.mockResolvedValue({
      id: 'log-123',
      status: 'pending',
    });

    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    // Switch to manual log tab
    await waitFor(() => {
      expect(screen.getByText(/דיווח ידני/)).toBeInTheDocument();
    });

    const manualTab = screen.getByText(/דיווח ידני/);
    await user.click(manualTab);

    await waitFor(() => {
      expect(screen.getByText('דיווח שעות ידני')).toBeInTheDocument();
    });

    // Fill in form - use querySelector for date input since label isn't properly associated
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
    await user.type(dateInput, '2026-02-15');

    // Fill in hours and minutes - use getAllByPlaceholderText since both have "0"
    const numberInputs = screen.getAllByPlaceholderText('0');
    await user.type(numberInputs[0], '2'); // hours
    await user.type(numberInputs[1], '30'); // minutes

    // Fill in description - use correct placeholder
    const descTextarea = screen.getByPlaceholderText('תאר את העבודה שביצעת...');
    await user.type(descTextarea, 'Manual work done');

    // Submit
    const submitButton = screen.getByRole('button', { name: /שלח לאישור/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(ShiftLogic.submitManualLog).toHaveBeenCalledWith(
        'student-123',
        expect.objectContaining({
          date: '2026-02-15',
          durationMinutes: 150, // 2 hours * 60 + 30 minutes
          description: 'Manual work done',
          category: 'other',
        })
      );
    });
  });

  it('shows error when duration is 0', async () => {
    const user = userEvent.setup();
    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    // Switch to manual log tab
    await waitFor(() => {
      expect(screen.getByText(/דיווח ידני/)).toBeInTheDocument();
    });

    const manualTab = screen.getByText(/דיווח ידני/);
    await user.click(manualTab);

    await waitFor(() => {
      expect(screen.getByText('דיווח שעות ידני')).toBeInTheDocument();
    });

    // Fill required date field (HTML validation requires this)
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, '2026-02-15');

    // Fill in description but leave duration at 0
    const descTextarea = screen.getByPlaceholderText('תאר את העבודה שביצעת...');
    await user.type(descTextarea, 'Some work');

    // Don't fill hours/minutes (duration will be 0)

    // Submit
    const submitButton = screen.getByRole('button', { name: /שלח לאישור/ });
    await user.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('נא להזין משך זמן תקין')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error when description is empty', async () => {
    const user = userEvent.setup();
    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    // Switch to manual log tab
    await waitFor(() => {
      expect(screen.getByText(/דיווח ידני/)).toBeInTheDocument();
    });

    const manualTab = screen.getByText(/דיווח ידני/);
    await user.click(manualTab);

    await waitFor(() => {
      expect(screen.getByText('דיווח שעות ידני')).toBeInTheDocument();
    });

    // Fill in date and duration but not description
    const dateInput = document.querySelector('input[type="date"]');
    await user.type(dateInput, '2026-02-15');

    const numberInputs = screen.getAllByPlaceholderText('0');
    await user.type(numberInputs[0], '2'); // hours

    // Submit without description
    const submitButton = screen.getByRole('button', { name: /שלח לאישור/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('נא להזין תיאור')).toBeInTheDocument();
    });
  });

  it('switches to history tab', async () => {
    const user = userEvent.setup();
    
    const mockShifts = [
      {
        id: 'shift-1',
        start_time: '2026-02-10T09:00:00Z',
        end_time: '2026-02-10T11:00:00Z',
        category: 'tutoring',
        task_description: 'Test shift',
        duration_minutes: 120,
        status: 'completed',
      },
    ];

    ShiftLogic.getShifts.mockResolvedValue(mockShifts);

    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText(/היסטוריה/)).toBeInTheDocument();
    });

    const historyTab = screen.getByText(/היסטוריה/);
    await user.click(historyTab);

    await waitFor(() => {
      expect(screen.getByText(/משמרות/)).toBeInTheDocument();
    });
  });

  it('displays progress information', async () => {
    ShiftLogic.calculateProgress.mockResolvedValue({
      shiftHours: 50,
      approvedManualHours: 25,
      totalHours: 75,
      progressPercent: 50,
      pendingLogs: 2,
      goal: 150,
    });

    render(<Dashboard profile={mockProfile} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });
  });
});
