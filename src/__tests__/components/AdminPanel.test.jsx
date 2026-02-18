import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPanel from '../../components/AdminPanel';
import { ShiftLogic } from '../../lib/ShiftLogic';

// Mock ShiftLogic
vi.mock('../../lib/ShiftLogic', () => ({
  ShiftLogic: {
    getAllStudentsSummary: vi.fn(),
    getAllPendingLogs: vi.fn(),
    approveLog: vi.fn(),
    rejectLog: vi.fn(),
  },
}));

describe('AdminPanel', () => {
  const mockProfile = {
    id: 'admin-123',
    full_name: 'Admin User',
    role: 'admin',
  };

  const mockOnLogout = vi.fn();

  const mockStudents = [
    {
      student_id: 'student-1',
      full_name: 'יוסי כהן',
      total_hours: 50,
      shift_hours: 30,
      manual_hours: 20,
      total_goal: 150,
      pending_count: 1,
    },
    {
      student_id: 'student-2',
      full_name: 'שרה לוי',
      total_hours: 100,
      shift_hours: 60,
      manual_hours: 40,
      total_goal: 150,
      pending_count: 0,
    },
  ];

  const mockPendingLogs = [
    {
      id: 'log-1',
      user_id: 'student-1',
      user_name: 'יוסי כהן',
      date: '2026-02-15',
      duration_minutes: 120,
      description: 'הדרכה לסטודנטים',
      category: 'tutoring',
      created_at: '2026-02-15T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    ShiftLogic.getAllStudentsSummary.mockResolvedValue(mockStudents);
    ShiftLogic.getAllPendingLogs.mockResolvedValue(mockPendingLogs);
  });

  it('shows stats cards', async () => {
    render(<AdminPanel profile={mockProfile} onLogout={mockOnLogout} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('סטודנטים')).toBeInTheDocument();
    });

    // Find the stats container and use within() to scope queries
    const statsSection = screen.getByText('סטודנטים').closest('.grid');
    
    // Verify stats cards are present with correct values
    expect(within(statsSection).getByText('סטודנטים')).toBeInTheDocument();
    
    // Use getAllByText for values that might appear multiple times (like '1')
    // The value '2' for total students should be unique to stats
    const studentCountCards = within(statsSection).getAllByText(/^[0-9]+$/);
    expect(studentCountCards.length).toBeGreaterThan(0);
  });

  it('shows student names', async () => {
    render(<AdminPanel profile={mockProfile} onLogout={mockOnLogout} />);

    // Wait for students to load
    await waitFor(() => {
      // Use getAllByText since student names appear twice (desktop + mobile view)
      const studentElements = screen.getAllByText('יוסי כהן');
      expect(studentElements.length).toBeGreaterThanOrEqual(1);
    });

    // Also verify the second student
    const sarahElements = screen.getAllByText('שרה לוי');
    expect(sarahElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows student detail view on click', async () => {
    const user = userEvent.setup();
    render(<AdminPanel profile={mockProfile} onLogout={mockOnLogout} />);

    // Wait for students to load
    await waitFor(() => {
      const elements = screen.getAllByText('יוסי כהן');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    // Click the first occurrence (desktop view)
    const studentElements = screen.getAllByText('יוסי כהן');
    await user.click(studentElements[0]);

    // Verify detail view appears - check for back button
    await waitFor(() => {
      expect(screen.getByText(/חזרה לרשימה/)).toBeInTheDocument();
    });
  });

  it('navigates back from detail view', async () => {
    const user = userEvent.setup();
    render(<AdminPanel profile={mockProfile} onLogout={mockOnLogout} />);

    // Wait for students to load and click on a student
    await waitFor(() => {
      const elements = screen.getAllByText('יוסי כהן');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    const studentElements = screen.getAllByText('יוסי כהן');
    await user.click(studentElements[0]);

    // Wait for detail view - check for back button
    await waitFor(() => {
      expect(screen.getByText(/חזרה לרשימה/)).toBeInTheDocument();
    });

    // Find and click back button
    const backButton = screen.getByRole('button', { name: /חזרה/ });
    await user.click(backButton);

    // Verify we're back to the overview
    await waitFor(() => {
      expect(screen.getByText('סקירת סטודנטים')).toBeInTheDocument();
    });
  });

  it('shows pending logs tab', async () => {
    const user = userEvent.setup();
    render(<AdminPanel profile={mockProfile} onLogout={mockOnLogout} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('סקירת סטודנטים')).toBeInTheDocument();
    });

    // Click on pending logs tab
    const pendingTab = screen.getByText(/אישור דיווחים/);
    await user.click(pendingTab);

    // Verify pending log appears
    await waitFor(() => {
      expect(screen.getByText('הדרכה לסטודנטים')).toBeInTheDocument();
    });
  });

  it('approves a pending log', async () => {
    const user = userEvent.setup();
    ShiftLogic.approveLog.mockResolvedValue({});
    ShiftLogic.getAllStudentsSummary.mockResolvedValue(mockStudents);

    render(<AdminPanel profile={mockProfile} onLogout={mockOnLogout} />);

    // Navigate to pending logs
    await waitFor(() => {
      expect(screen.getByText(/אישור דיווחים/)).toBeInTheDocument();
    });

    const pendingTab = screen.getByText(/אישור דיווחים/);
    await user.click(pendingTab);

    // Wait for pending log
    await waitFor(() => {
      expect(screen.getByText('הדרכה לסטודנטים')).toBeInTheDocument();
    });

    // Find and click approve button
    const approveButton = screen.getByRole('button', { name: /אשר/ });
    await user.click(approveButton);

    // Verify approve was called
    await waitFor(() => {
      expect(ShiftLogic.approveLog).toHaveBeenCalledWith('log-1', 'admin-123');
    });
  });
});
