import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));

import { ShiftLogic } from '../../lib/ShiftLogic';
import { supabaseFetch, supabaseRpc, resetAllMocks, factory } from '../../__mocks__/supabase';

describe('Edge Cases', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ═══════════════════════════════════════════
  // OVERLAPPING SHIFTS
  // ═══════════════════════════════════════════
  describe('overlapping shifts', () => {
    it('prevents check-in when an active shift already exists', async () => {
      supabaseFetch.mockResolvedValueOnce([factory.activeShift()]);

      await expect(
        ShiftLogic.checkIn('user-123', 'tutoring', 'second shift')
      ).rejects.toThrow('כבר יש לך משמרת פעילה');
    });

    it('only calls getActiveShift, does NOT insert', async () => {
      supabaseFetch.mockResolvedValueOnce([factory.activeShift()]);

      try {
        await ShiftLogic.checkIn('user-123', 'tutoring', 'test');
      } catch {}

      expect(supabaseFetch).toHaveBeenCalledTimes(1);
    });

    it('allows check-in after previous shift is completed', async () => {
      supabaseFetch
        .mockResolvedValueOnce([]) // no active shift
        .mockResolvedValueOnce(factory.activeShift()); // insert succeeds

      const result = await ShiftLogic.checkIn('user-123', 'other', 'new task');
      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // NETWORK FAILURES
  // ═══════════════════════════════════════════
  describe('network failures', () => {
    it('checkIn propagates network errors', async () => {
      supabaseFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        ShiftLogic.checkIn('user-123', 'tutoring', 'desc')
      ).rejects.toThrow('Network error');
    });

    it('checkOut propagates network errors', async () => {
      supabaseFetch.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        ShiftLogic.checkOut('shift-001')
      ).rejects.toThrow('Connection timeout');
    });

    it('submitManualLog propagates network errors', async () => {
      supabaseFetch.mockRejectedValue(new Error('Offline'));

      await expect(
        ShiftLogic.submitManualLog('user-123', {
          date: '2026-02-15', durationMinutes: 60, description: 'x', category: 'other',
        })
      ).rejects.toThrow('Offline');
    });

    it('calculateProgress handles partial failures gracefully', async () => {
      // Shifts load fine, manual logs fail
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: 60 })])
        .mockRejectedValueOnce(new Error('logs fetch failed'));

      await expect(
        ShiftLogic.calculateProgress('user-123')
      ).rejects.toThrow('logs fetch failed');
    });

    it('admin approveLog propagates errors', async () => {
      supabaseFetch.mockRejectedValue(new Error('RLS violation'));

      await expect(
        ShiftLogic.approveLog('log-1', 'admin-1')
      ).rejects.toThrow('RLS violation');
    });

    it('admin rejectLog propagates errors', async () => {
      supabaseFetch.mockRejectedValue(new Error('Server error'));

      await expect(
        ShiftLogic.rejectLog('log-1', 'admin-1')
      ).rejects.toThrow('Server error');
    });

    it('getAllStudentsSummary propagates RPC errors', async () => {
      supabaseRpc.mockRejectedValue(new Error('Function not found'));

      await expect(
        ShiftLogic.getAllStudentsSummary()
      ).rejects.toThrow('Function not found');
    });

    it('getAllPendingLogs propagates errors', async () => {
      supabaseFetch.mockRejectedValue(new Error('Forbidden'));

      await expect(
        ShiftLogic.getAllPendingLogs()
      ).rejects.toThrow('Forbidden');
    });
  });

  // ═══════════════════════════════════════════
  // DATA INTEGRITY
  // ═══════════════════════════════════════════
  describe('data integrity', () => {
    it('submitManualLog always sets status=pending (cannot forge approved)', async () => {
      supabaseFetch.mockResolvedValue(factory.manualLog());

      await ShiftLogic.submitManualLog('user-123', {
        date: '2026-02-15',
        durationMinutes: 120,
        description: 'Trying to hack approved status',
        category: 'other',
      });

      const body = supabaseFetch.mock.calls[0][1].body;
      expect(body.status).toBe('pending');
    });

    it('calculateProgress only counts approved logs, not pending/rejected', async () => {
      supabaseFetch
        .mockResolvedValueOnce([]) // no shifts
        .mockResolvedValueOnce([
          factory.approvedLog({ duration_minutes: 60 }),     // counted
          factory.manualLog({ duration_minutes: 120, status: 'pending' }),  // skipped
          factory.rejectedLog({ duration_minutes: 180 }),    // skipped
        ]);

      const r = await ShiftLogic.calculateProgress('user-123', 100);
      expect(r.approvedManualHours).toBe(1); // only the 60-min approved
      expect(r.totalHours).toBe(1);
    });

    it('calculateProgress only counts completed shifts', async () => {
      supabaseFetch
        .mockResolvedValueOnce([
          factory.shift({ status: 'completed', duration_minutes: 120 }),
          factory.shift({ status: 'active', duration_minutes: null }),
          factory.shift({ status: 'completed', duration_minutes: 0 }),
        ])
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123');
      expect(r.shiftHours).toBe(2); // only 120 min counted
    });

    it('calculateProgress handles NaN-ish duration_minutes', async () => {
      supabaseFetch
        .mockResolvedValueOnce([
          factory.shift({ duration_minutes: null }),
          factory.shift({ duration_minutes: undefined }),
          factory.shift({ duration_minutes: 120 }),
        ])
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123');
      expect(r.shiftHours).toBe(2); // filters out falsy duration_minutes
    });

    it('approveLog sends timestamp', async () => {
      supabaseFetch.mockResolvedValue(factory.approvedLog());

      const before = new Date().toISOString();
      await ShiftLogic.approveLog('log-1', 'admin-1');
      const after = new Date().toISOString();

      const body = supabaseFetch.mock.calls[0][1].body;
      expect(body.reviewed_at >= before).toBe(true);
      expect(body.reviewed_at <= after).toBe(true);
    });

    it('rejectLog sends correct reviewer ID', async () => {
      supabaseFetch.mockResolvedValue(factory.rejectedLog());

      await ShiftLogic.rejectLog('log-1', 'specific-admin-id');

      const body = supabaseFetch.mock.calls[0][1].body;
      expect(body.reviewed_by).toBe('specific-admin-id');
    });
  });

  // ═══════════════════════════════════════════
  // BOUNDARY VALUES
  // ═══════════════════════════════════════════
  describe('boundary values', () => {
    it('progress at exactly 0 hours', async () => {
      supabaseFetch.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const r = await ShiftLogic.calculateProgress('user-123', 150);
      expect(r.progressPercent).toBe(0);
      expect(r.totalHours).toBe(0);
    });

    it('progress at exactly the goal (100%)', async () => {
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: 9000 })]) // 150h
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123', 150);
      expect(r.progressPercent).toBe(100);
    });

    it('progress beyond the goal (capped at 100%)', async () => {
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: 12000 })]) // 200h
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123', 150);
      expect(r.progressPercent).toBe(100); // capped
      expect(r.totalHours).toBeGreaterThan(150); // actual hours uncapped
    });

    it('very small duration (fractional minutes)', async () => {
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: '0.5' })])
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123');
      expect(r.shiftHours).toBeCloseTo(0.00833, 4);
    });

    it('very large number of shifts', async () => {
      const manyShifts = Array.from({ length: 500 }, (_, i) =>
        factory.shift({ id: `s-${i}`, duration_minutes: 60 })
      );
      supabaseFetch
        .mockResolvedValueOnce(manyShifts)
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123', 150);
      expect(r.shiftHours).toBe(500); // 500 * 60min = 500h
      expect(r.progressPercent).toBe(100);
    });

    it('getAllPendingLogs with many items', async () => {
      const manyLogs = Array.from({ length: 100 }, (_, i) => ({
        ...factory.manualLog({ id: `p-${i}` }),
        profiles: { full_name: `Student ${i}` },
      }));
      supabaseFetch.mockResolvedValue(manyLogs);

      const result = await ShiftLogic.getAllPendingLogs();
      expect(result).toHaveLength(100);
      expect(result[0].user_name).toBe('Student 0');
      expect(result[99].user_name).toBe('Student 99');
    });
  });

  // ═══════════════════════════════════════════
  // CONCURRENT OPERATIONS
  // ═══════════════════════════════════════════
  describe('concurrent operations', () => {
    it('multiple checkOuts on same shift return results', async () => {
      const completed = factory.shift();
      supabaseFetch.mockResolvedValue(completed);

      const [r1, r2] = await Promise.all([
        ShiftLogic.checkOut('shift-001'),
        ShiftLogic.checkOut('shift-001'),
      ]);

      expect(r1).toEqual(completed);
      expect(r2).toEqual(completed);
      expect(supabaseFetch).toHaveBeenCalledTimes(2);
    });

    it('parallel calculateProgress calls work independently', async () => {
      // User A
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: 60 })])
        .mockResolvedValueOnce([])
        // User B
        .mockResolvedValueOnce([factory.shift({ duration_minutes: 120 })])
        .mockResolvedValueOnce([]);

      const [rA, rB] = await Promise.all([
        ShiftLogic.calculateProgress('user-a', 100),
        ShiftLogic.calculateProgress('user-b', 100),
      ]);

      expect(rA.shiftHours).toBe(1);
      expect(rB.shiftHours).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // SPECIAL CHARACTERS & ENCODING
  // ═══════════════════════════════════════════
  describe('special characters', () => {
    it('handles Hebrew text in task descriptions', async () => {
      supabaseFetch
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(factory.activeShift({ task_description: 'חונכות מתמטיקה לתלמידי י"ב' }));

      const result = await ShiftLogic.checkIn('user-123', 'tutoring', 'חונכות מתמטיקה לתלמידי י"ב');
      expect(supabaseFetch.mock.calls[1][1].body.task_description).toBe('חונכות מתמטיקה לתלמידי י"ב');
    });

    it('handles Hebrew text in manual log descriptions', async () => {
      supabaseFetch.mockResolvedValue(factory.manualLog({ description: 'ארגון אירוע "יום המשפחה"' }));

      const result = await ShiftLogic.submitManualLog('user-123', {
        date: '2026-02-15',
        durationMinutes: 120,
        description: 'ארגון אירוע "יום המשפחה"',
        category: 'event_support',
      });

      expect(result.description).toContain('יום המשפחה');
    });

    it('handles emoji in descriptions', async () => {
      supabaseFetch
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(factory.activeShift());

      await ShiftLogic.checkIn('user-123', 'other', '🎉 אירוע מיוחד');
      expect(supabaseFetch.mock.calls[1][1].body.task_description).toBe('🎉 אירוע מיוחד');
    });
  });
});
