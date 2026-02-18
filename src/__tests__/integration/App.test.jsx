import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { supabase, supabaseFetch } from '../../lib/supabase';

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
  supabaseFetch: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock: no session
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading state initially', () => {
    render(<App />);
    
    // Should show loading spinner or similar
    const loaders = document.querySelectorAll('[class*="animate-spin"]');
    expect(loaders.length).toBeGreaterThan(0);
  });

  it('shows Auth component when not logged in', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('שעון נוכחות קזז')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText('כניסה')).toBeInTheDocument();
  });

  it('fetches profile when logged in', async () => {
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token-123',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      email: 'test@example.com',
      role: 'student',
    };

    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    supabaseFetch.mockResolvedValue(mockProfile);

    render(<App />);

    await waitFor(() => {
      expect(supabaseFetch).toHaveBeenCalledWith(
        expect.stringContaining('profiles?id=eq.user-123'),
        expect.objectContaining({ single: true })
      );
    }, { timeout: 3000 });
  });

  it('shows Dashboard for student role', async () => {
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token-123',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Student User',
      email: 'student@example.com',
      role: 'student',
    };

    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    supabaseFetch.mockResolvedValue(mockProfile);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/שעון נוכחות/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows AdminPanel for admin role', async () => {
    const mockSession = {
      user: { id: 'admin-123' },
      access_token: 'token-123',
    };

    const mockProfile = {
      id: 'admin-123',
      full_name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    };

    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    supabaseFetch.mockResolvedValue(mockProfile);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/לוח בקרה · מנהל/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error state when profile fetch fails', async () => {
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token-123',
    };

    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    supabaseFetch.mockRejectedValue(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/שגיאה/)).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('retries profile fetch once when first attempt returns null', async () => {
    // Use fake timers to control the 1500ms setTimeout delay
    vi.useFakeTimers();

    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token-123',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      email: 'test@example.com',
      role: 'student',
    };

    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // First call returns null, second call returns profile
    supabaseFetch
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockProfile);

    render(<App />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(supabaseFetch).toHaveBeenCalledTimes(1);
    });

    // Advance timers past the 1500ms delay
    vi.advanceTimersByTime(1500);

    // Wait for retry to complete
    await waitFor(() => {
      expect(supabaseFetch).toHaveBeenCalledTimes(2);
    });

    // Should eventually show the dashboard
    await waitFor(() => {
      expect(screen.getByText(/שעון נוכחות/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('shows error when both retry attempts return null', async () => {
    // Use fake timers for the 1500ms delay
    vi.useFakeTimers();

    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token-123',
    };

    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Both attempts return null
    supabaseFetch
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    render(<App />);

    // Wait for first fetch
    await waitFor(() => {
      expect(supabaseFetch).toHaveBeenCalledTimes(1);
    });

    // Advance past the 1500ms delay
    vi.advanceTimersByTime(1500);

    // Wait for second fetch
    await waitFor(() => {
      expect(supabaseFetch).toHaveBeenCalledTimes(2);
    });

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/פרופיל לא נמצא/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('handles auth state changes', async () => {
    let authCallback;
    
    supabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    });

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<App />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('כניסה')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Simulate auth state change (user logs in)
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token-123',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      email: 'test@example.com',
      role: 'student',
    };

    supabaseFetch.mockResolvedValue(mockProfile);

    // Trigger auth state change
    authCallback('SIGNED_IN', mockSession);

    // Should fetch profile and show dashboard
    await waitFor(() => {
      expect(supabaseFetch).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('handles logout', async () => {
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token-123',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      email: 'test@example.com',
      role: 'student',
    };

    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    supabaseFetch.mockResolvedValue(mockProfile);
    supabase.auth.signOut = vi.fn().mockResolvedValue({ error: null });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/שעון נוכחות/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Find and click logout button
    const logoutButton = screen.getByText('התנתק');
    logoutButton.click();

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });
});
