import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock supabase module
vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));

// Mock child components to isolate App routing logic
vi.mock('../../components/Auth', () => ({
  default: () => <div data-testid="auth-screen">Auth Screen</div>,
}));
vi.mock('../../components/Dashboard', () => ({
  default: ({ profile, onLogout }) => (
    <div data-testid="dashboard">
      Dashboard: {profile.full_name}
      <button onClick={onLogout}>Logout</button>
    </div>
  ),
}));
vi.mock('../../components/AdminPanel', () => ({
  default: ({ profile, onLogout }) => (
    <div data-testid="admin-panel">
      Admin: {profile.full_name}
      <button onClick={onLogout}>Logout</button>
    </div>
  ),
}));

import App from '../../App';
import { supabase, supabaseFetch, resetAllMocks, factory } from '../../__mocks__/supabase';

describe('App — Auth Routing Integration', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // NO SESSION → AUTH SCREEN
  // ═══════════════════════════════════════════
  describe('no session', () => {
    it('shows Auth when no session exists', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('auth-screen')).toBeInTheDocument();
      });
    });

    it('shows Auth when getSession returns error', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'refresh failed' },
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('auth-screen')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // STUDENT SESSION → DASHBOARD
  // ═══════════════════════════════════════════
  describe('student session', () => {
    it('renders Dashboard for student role', async () => {
      const session = factory.session();
      const profile = factory.profile();

      supabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      supabaseFetch.mockResolvedValue(profile);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
        expect(screen.getByText(/ישראל ישראלי/)).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // ADMIN SESSION → ADMIN PANEL
  // ═══════════════════════════════════════════
  describe('admin session', () => {
    it('renders AdminPanel for admin role', async () => {
      const session = factory.session({ user: { id: 'admin-123' } });
      const profile = factory.adminProfile();

      supabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      supabaseFetch.mockResolvedValue(profile);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('admin-panel')).toBeInTheDocument();
        expect(screen.getByText(/מנהל מערכת/)).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // PROFILE FETCH FAILURE → ERROR SCREEN
  // ═══════════════════════════════════════════
  describe('profile fetch failure', () => {
    it('shows error screen with retry and logout buttons', async () => {
      const session = factory.session();
      supabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      supabaseFetch.mockRejectedValue(new Error('DB error'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('שגיאה בטעינת פרופיל המשתמש.')).toBeInTheDocument();
        expect(screen.getByText('נסה שוב')).toBeInTheDocument();
        expect(screen.getByText('התנתק')).toBeInTheDocument();
      });
    });

    it('logout button clears state and shows Auth', async () => {
      const session = factory.session();
      supabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      supabaseFetch.mockRejectedValue(new Error('fail'));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      await waitFor(() => screen.getByText('התנתק'));
      await user.click(screen.getByText('התנתק'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-screen')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // SAFETY TIMER
  // ═══════════════════════════════════════════
  describe('safety timer', () => {
    it('force-resolves loading after 8 seconds', async () => {
      // Make getSession hang forever
      supabase.auth.getSession.mockImplementation(() => new Promise(() => {}));

      render(<App />);

      // Should be showing loading
      expect(screen.getByText('טוען...')).toBeInTheDocument();

      // Advance past the 8-second safety timer
      await act(async () => {
        vi.advanceTimersByTime(8500);
      });

      // Should have resolved to Auth screen
      await waitFor(() => {
        expect(screen.getByTestId('auth-screen')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // PROFILE RETRY LOGIC
  // ═══════════════════════════════════════════
  describe('profile retry', () => {
    it('retries profile fetch once when first attempt returns null', async () => {
      const session = factory.session();
      const profile = factory.profile();

      supabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });

      // First fetch: null (trigger hasn't fired), second: profile exists
      supabaseFetch
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(profile);

      render(<App />);

      // Flush initial getSession promise
      await act(async () => {
        await Promise.resolve();
      });

      // Advance past the 1.5s retry delay and flush microtasks
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });

      // Should have called supabaseFetch twice
      expect(supabaseFetch).toHaveBeenCalledTimes(2);
    });

    it('shows error when both retry attempts return null', async () => {
      const session = factory.session();

      supabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });

      supabaseFetch
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      render(<App />);

      // Flush initial getSession promise
      await act(async () => {
        await Promise.resolve();
      });

      // Advance past the 1.5s retry delay and flush microtasks
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText('שגיאה בטעינת פרופיל המשתמש.')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // AUTH STATE CHANGE — SIGN IN EVENT
  // ═══════════════════════════════════════════
  describe('onAuthStateChange', () => {
    it('handles SIGNED_IN event', async () => {
      // Start with no session
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Capture the auth callback
      let authCallback;
      supabase.auth.onAuthStateChange.mockImplementation((cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      render(<App />);

      await waitFor(() => screen.getByTestId('auth-screen'));

      // Simulate login
      const session = factory.session();
      const profile = factory.profile();
      supabaseFetch.mockResolvedValue(profile);

      await act(async () => {
        await authCallback('SIGNED_IN', session);
      });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('handles SIGNED_OUT event', async () => {
      const session = factory.session();
      supabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      supabaseFetch.mockResolvedValue(factory.profile());

      let authCallback;
      supabase.auth.onAuthStateChange.mockImplementation((cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      render(<App />);

      await waitFor(() => screen.getByTestId('dashboard'));

      // Simulate logout event
      await act(async () => {
        await authCallback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-screen')).toBeInTheDocument();
      });
    });
  });
});
