import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Auth from '../../components/Auth';
import { supabase } from '../../lib/supabase';

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

describe('Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    render(<Auth />);
    
    expect(screen.getByText('כניסה')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'כניסה למערכת' })).toBeInTheDocument();
  });

  it('switches to registration form', async () => {
    const user = userEvent.setup();
    render(<Auth />);

    const signupTab = screen.getByText('הרשמה');
    await user.click(signupTab);

    expect(screen.getByRole('button', { name: 'יצירת חשבון' })).toBeInTheDocument();
  });

  it('shows password toggle button', async () => {
    const user = userEvent.setup();
    render(<Auth />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find eye icon button (it's a button without text inside password field)
    const eyeButton = passwordInput.parentElement.querySelector('button[type="button"]');
    expect(eyeButton).toBeInTheDocument();

    await user.click(eyeButton);

    // Password should now be visible
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('handles successful login', async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    });

    render(<Auth />);

    await user.type(screen.getByPlaceholderText('email@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: 'כניסה למערכת' }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows error on invalid credentials', async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    render(<Auth />);

    await user.type(screen.getByPlaceholderText('email@example.com'), 'wrong@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'כניסה למערכת' }));

    await waitFor(() => {
      expect(screen.getByText('אימייל או סיסמה שגויים')).toBeInTheDocument();
    });
  });

  it('handles successful registration', async () => {
    const user = userEvent.setup();
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    });

    render(<Auth />);

    // Switch to registration
    await user.click(screen.getByText('הרשמה'));

    // Fill in form
    await user.type(screen.getByPlaceholderText('email@example.com'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'John Doe');
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'John Doe',
            role: 'student',
          },
        },
      });
    });
  });

  it('shows success message after registration', async () => {
    const user = userEvent.setup();
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    });

    render(<Auth />);

    await user.click(screen.getByText('הרשמה'));
    await user.type(screen.getByPlaceholderText('email@example.com'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'John Doe');
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    await waitFor(() => {
      expect(screen.getByText(/החשבון נוצר בהצלחה/)).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();
    
    // Make the auth call hang to keep loading state
    supabase.auth.signInWithPassword.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 5000))
    );

    render(<Auth />);

    await user.type(screen.getByPlaceholderText('email@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    
    const submitButton = screen.getByRole('button', { name: 'כניסה למערכת' });
    await user.click(submitButton);

    // Wait for loading state - button should be disabled
    // Find submit button by type="submit" to avoid collision with eye icon button
    await waitFor(() => {
      const buttons = document.querySelectorAll('button[type="submit"]');
      expect(buttons.length).toBe(1);
      expect(buttons[0]).toBeDisabled();
    });
  });

  it('translates "Unable to validate email" to Hebrew', async () => {
    const user = userEvent.setup();
    
    // Mock must return error with exact substring "Unable to validate email"
    supabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Unable to validate email address: format is invalid' },
    });

    render(<Auth />);

    // Switch to registration mode
    await user.click(screen.getByText('הרשמה'));

    // Fill in form with invalid email
    await user.type(screen.getByPlaceholderText('email@example.com'), 'invalid-email');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'Test User');
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    // Should show Hebrew translation
    await waitFor(() => {
      expect(screen.getByText('כתובת אימייל לא תקינה')).toBeInTheDocument();
    });
  });

  it('validates password length', async () => {
    const user = userEvent.setup();
    supabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Password should be at least 6 characters' },
    });

    render(<Auth />);

    await user.click(screen.getByText('הרשמה'));
    await user.type(screen.getByPlaceholderText('email@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), '12345');
    await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'Test User');
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    await waitFor(() => {
      expect(screen.getByText('הסיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
    });
  });

  it('validates full name is provided', async () => {
    const user = userEvent.setup();
    render(<Auth />);

    await user.click(screen.getByText('הרשמה'));
    await user.type(screen.getByPlaceholderText('email@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    // Don't fill in full name
    await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));

    await waitFor(() => {
      expect(screen.getByText('נא להזין שם מלא')).toBeInTheDocument();
    });
  });
});
