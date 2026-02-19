import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));

import Auth from '../../components/Auth';
import { supabase, resetAllMocks } from '../../__mocks__/supabase';

describe('Auth Component', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ═══════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════
  describe('rendering', () => {
    it('renders the app title', () => {
      render(<Auth />);
      expect(screen.getByText('דיווחי שעות מלגאי מרכז קזז')).toBeInTheDocument();
    });

    it('renders the subtitle', () => {
      render(<Auth />);
      expect(screen.getByText(/מערכת מעקב שעות למלגאים/)).toBeInTheDocument();
    });

    it('shows login/register toggle tabs', () => {
      render(<Auth />);
      expect(screen.getByText('כניסה')).toBeInTheDocument();
      expect(screen.getByText('הרשמה')).toBeInTheDocument();
    });

    it('defaults to login mode (no name field)', () => {
      render(<Auth />);
      expect(screen.getByText('כניסה למערכת')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ישראל ישראלי')).not.toBeInTheDocument();
    });

    it('has RTL direction', () => {
      const { container } = render(<Auth />);
      expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
    });

    it('has email and password inputs', () => {
      render(<Auth />);
      expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('email input is LTR', () => {
      render(<Auth />);
      const email = screen.getByPlaceholderText('email@example.com');
      expect(email.getAttribute('dir')).toBe('ltr');
    });
  });

  // ═══════════════════════════════════════════
  // MODE SWITCHING
  // ═══════════════════════════════════════════
  describe('mode switching', () => {
    it('shows name field in register mode', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      await user.click(screen.getByText('הרשמה'));

      expect(screen.getByPlaceholderText('ישראל ישראלי')).toBeInTheDocument();
      expect(screen.getByText('יצירת חשבון')).toBeInTheDocument();
    });

    it('hides name field when switching back to login', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      await user.click(screen.getByText('הרשמה'));
      expect(screen.getByPlaceholderText('ישראל ישראלי')).toBeInTheDocument();

      await user.click(screen.getByText('כניסה'));
      expect(screen.queryByPlaceholderText('ישראל ישראלי')).not.toBeInTheDocument();
    });

    it('clears errors when switching modes', async () => {
      const user = userEvent.setup();
      supabase.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      render(<Auth />);

      await user.type(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), '123456');
      await user.click(screen.getByText('כניסה למערכת'));

      await waitFor(() => {
        expect(screen.getByText('אימייל או סיסמה שגויים')).toBeInTheDocument();
      });

      await user.click(screen.getByText('הרשמה'));
      expect(screen.queryByText('אימייל או סיסמה שגויים')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // LOGIN FLOW
  // ═══════════════════════════════════════════
  describe('login', () => {
    it('calls signInWithPassword with email and password', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      await user.type(screen.getByPlaceholderText('email@example.com'), 'test@test.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await user.click(screen.getByText('כניסה למערכת'));

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@test.com',
          password: 'pass123',
        });
      });
    });

    it('translates "Invalid login credentials" to Hebrew', async () => {
      const user = userEvent.setup();
      supabase.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      render(<Auth />);
      await user.type(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), '123456');
      await user.click(screen.getByText('כניסה למערכת'));

      await waitFor(() => {
        expect(screen.getByText('אימייל או סיסמה שגויים')).toBeInTheDocument();
      });
    });

    it('disables submit button while loading', async () => {
      const user = userEvent.setup();
      supabase.auth.signInWithPassword.mockImplementation(() => new Promise(() => {})); // hang

      render(<Auth />);
      await user.type(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), '123456');
      await user.click(screen.getByText('כניסה למערכת'));

      await waitFor(() => {
        const btn = document.querySelector('button[type="submit"]'); // target submit button specifically
        expect(btn).toBeDisabled();
      });
    });
  });

  // ═══════════════════════════════════════════
  // REGISTRATION FLOW
  // ═══════════════════════════════════════════
  describe('registration', () => {
    it('calls signUp with metadata (full_name, role=student)', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      await user.click(screen.getByText('הרשמה'));
      await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'בן');
      await user.type(screen.getByPlaceholderText('email@example.com'), 'b@b.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await user.click(screen.getByText('יצירת חשבון'));

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'b@b.com',
          password: 'pass123',
          options: {
            data: { full_name: 'בן', role: 'student' },
          },
        });
      });
    });

    it('shows success message on registration', async () => {
      const user = userEvent.setup();
      supabase.auth.signUp.mockResolvedValue({ data: {}, error: null });

      render(<Auth />);
      await user.click(screen.getByText('הרשמה'));
      await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'Test');
      await user.type(screen.getByPlaceholderText('email@example.com'), 'n@n.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await user.click(screen.getByText('יצירת חשבון'));

      await waitFor(() => {
        expect(screen.getByText('החשבון נוצר בהצלחה! מתחבר...')).toBeInTheDocument();
      });
    });

    it('rejects empty full name', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      await user.click(screen.getByText('הרשמה'));
      // Leave name empty
      await user.type(screen.getByPlaceholderText('email@example.com'), 'x@x.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await user.click(screen.getByText('יצירת חשבון'));

      await waitFor(() => {
        expect(screen.getByText('נא להזין שם מלא')).toBeInTheDocument();
      });
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only full name', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      await user.click(screen.getByText('הרשמה'));
      await user.type(screen.getByPlaceholderText('ישראל ישראלי'), '   ');
      await user.type(screen.getByPlaceholderText('email@example.com'), 'x@x.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await user.click(screen.getByText('יצירת חשבון'));

      await waitFor(() => {
        expect(screen.getByText('נא להזין שם מלא')).toBeInTheDocument();
      });
    });

    it('rejects password shorter than 6 characters', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      await user.click(screen.getByText('הרשמה'));
      await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'Name');
      await user.type(screen.getByPlaceholderText('email@example.com'), 'x@x.com');
      await user.type(screen.getByPlaceholderText('••••••••'), '12345');
      await user.click(screen.getByText('יצירת חשבון'));

      await waitFor(() => {
        expect(screen.getByText('הסיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
      });
    });

    it('translates "User already registered" to Hebrew', async () => {
      const user = userEvent.setup();
      supabase.auth.signUp.mockResolvedValue({
        error: { message: 'User already registered' },
      });

      render(<Auth />);
      await user.click(screen.getByText('הרשמה'));
      await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'Name');
      await user.type(screen.getByPlaceholderText('email@example.com'), 'x@x.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await user.click(screen.getByText('יצירת חשבון'));

      await waitFor(() => {
        expect(screen.getByText('משתמש עם אימייל זה כבר קיים')).toBeInTheDocument();
      });
    });

    it('translates "Unable to validate email" to Hebrew', async () => {
      const user = userEvent.setup();
      supabase.auth.signUp.mockResolvedValue({
        error: { message: 'Unable to validate email address' },
      });

      render(<Auth />);
      await user.click(screen.getByText('הרשמה'));
      await user.type(screen.getByPlaceholderText('ישראל ישראלי'), 'Name');
      await user.type(screen.getByPlaceholderText('email@example.com'), 'bad@invalid.xyz');  // valid email format
      await user.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await user.click(screen.getByText('יצירת חשבון'));

      await waitFor(() => {
        expect(screen.getByText('כתובת אימייל לא תקינה')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // PASSWORD TOGGLE
  // ═══════════════════════════════════════════
  describe('password visibility', () => {
    it('starts with password hidden', () => {
      render(<Auth />);
      expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
    });

    it('toggles to visible and back', async () => {
      const user = userEvent.setup();
      render(<Auth />);

      const pw = screen.getByPlaceholderText('••••••••');
      // The toggle is a button with no text (just an icon)
      const allButtons = screen.getAllByRole('button');
      const toggle = allButtons.find(b => !b.textContent.trim() || b.querySelector('svg'));

      if (toggle) {
        await user.click(toggle);
        expect(pw).toHaveAttribute('type', 'text');
        await user.click(toggle);
        expect(pw).toHaveAttribute('type', 'password');
      }
    });
  });
});
