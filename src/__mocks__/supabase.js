import { vi } from 'vitest';

// ─── Mock Auth ───
export const supabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
};

// ─── Mock fetch helpers ───
export const supabaseFetch = vi.fn();
export const supabaseRpc = vi.fn();

// ─── Reset all mocks ───
export function resetAllMocks() {
  vi.clearAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: { user: { id: 'user-123' } } }, error: null });
  supabase.auth.signUp.mockResolvedValue({ data: { session: { user: { id: 'user-123' } } }, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  supabaseFetch.mockReset();
  supabaseRpc.mockReset();
}

// ─── Test Data Factories ───
export const factory = {
  profile: (o = {}) => ({
    id: 'user-123',
    full_name: 'ישראל ישראלי',
    role: 'student',
    total_goal: 150,
    created_at: '2026-01-01T00:00:00Z',
    ...o,
  }),

  adminProfile: (o = {}) => factory.profile({
    id: 'admin-123',
    full_name: 'מנהל מערכת',
    role: 'admin',
    ...o,
  }),

  shift: (o = {}) => ({
    id: 'shift-001',
    user_id: 'user-123',
    start_time: '2026-02-17T08:00:00Z',
    end_time: '2026-02-17T12:00:00Z',
    status: 'completed',
    task_description: 'חונכות מתמטיקה',
    category: 'tutoring',
    duration_minutes: 240,
    created_at: '2026-02-17T08:00:00Z',
    ...o,
  }),

  activeShift: (o = {}) => factory.shift({
    id: 'active-001',
    end_time: null,
    status: 'active',
    duration_minutes: null,
    start_time: new Date().toISOString(),
    ...o,
  }),

  manualLog: (o = {}) => ({
    id: 'log-001',
    user_id: 'user-123',
    date: '2026-02-15',
    duration_minutes: 180,
    description: 'סיוע בספרייה',
    category: 'community_service',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-02-15T10:00:00Z',
    ...o,
  }),

  approvedLog: (o = {}) => factory.manualLog({
    id: 'appr-001',
    status: 'approved',
    reviewed_by: 'admin-123',
    reviewed_at: '2026-02-16T10:00:00Z',
    ...o,
  }),

  rejectedLog: (o = {}) => factory.manualLog({
    id: 'rej-001',
    status: 'rejected',
    reviewed_by: 'admin-123',
    reviewed_at: '2026-02-16T10:00:00Z',
    ...o,
  }),

  session: (o = {}) => ({
    access_token: 'test-token',
    user: { id: 'user-123', email: 'test@test.com', ...(o.user || {}) },
    ...o,
  }),

  studentSummary: (o = {}) => ({
    student_id: 'user-123',
    full_name: 'ישראל ישראלי',
    total_goal: 150,
    shift_hours: 45.5,
    approved_manual_hours: 12,
    pending_logs: 2,
    total_hours: 57.5,
    progress_percent: 38.3,
    ...o,
  }),
};
