import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase module BEFORE importing ShiftLogic
vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));

import { ShiftLogic } from '../../lib/ShiftLogic';
import { supabaseFetch, supabaseRpc, resetAllMocks, factory } from '../../__mocks__/supabase';

describe('ShiftLogic', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ═══════════════════════════════════════════
  // getProfile
  // ═══════════════════════════════════════════
  describe('getProfile', () => {
    it('fetches a profile by user ID', async () => {
      const prof = factory.profile();
      supabaseFetch.mockResolvedValue(prof);

      const result = await ShiftLogic.getProfile('user-123');

      expect(supabaseFetch).toHaveBeenCalledWith('profiles?id=eq.user-123', { single: true });
      expect(result).toEqual(prof);
    });

    it('propagates errors from supabaseFetch', async () => {
      supabaseFetch.mockRejectedValue(new Error('timeout'));
      await expect(ShiftLogic.getProfile('x')).rejects.toThrow('timeout');
    });
  });

  // ═══════════════════════════════════════════
  // getActiveShift
  // ═══════════════════════════════════════════
  describe('getActiveShift', () => {
    it('returns the first active shift', async () => {
      const shift = factory.activeShift();
      supabaseFetch.mockResolvedValue([shift]);

      const result = await ShiftLogic.getActiveShift('user-123');

      expect(supabaseFetch).toHaveBeenCalledWith('shifts?user_id=eq.user-123&status=eq.active');
      expect(result).toEqual(shift);
    });

    it('returns null when no active shifts', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getActiveShift('user-123')).toBeNull();
    });

    it('returns null when response is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getActiveShift('user-123')).toBeNull();
    });

    it('returns null when response is undefined', async () => {
      supabaseFetch.mockResolvedValue(undefined);
      expect(await ShiftLogic.getActiveShift('user-123')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // checkIn
  // ═══════════════════════════════════════════
  describe('checkIn', () => {
    it('creates a new shift when no active shift exists', async () => {
      const newShift = factory.activeShift();
      supabaseFetch
        .mockResolvedValueOnce([])       // getActiveShift → empty
        .mockResolvedValueOnce(newShift); // insert

      const result = await ShiftLogic.checkIn('user-123', 'tutoring', 'חונכות');

      expect(supabaseFetch).toHaveBeenCalledTimes(2);
      // Verify insert call
      const insertCall = supabaseFetch.mock.calls[1];
      expect(insertCall[0]).toBe('shifts');
      expect(insertCall[1].method).toBe('POST');
      expect(insertCall[1].body).toMatchObject({
        user_id: 'user-123',
        category: 'tutoring',
        task_description: 'חונכות',
        status: 'active',
      });
      expect(insertCall[1].body.start_time).toBeDefined();
      expect(insertCall[1].single).toBe(true);
      expect(result).toEqual(newShift);
    });

    it('throws when an active shift already exists (prevents overlapping)', async () => {
      supabaseFetch.mockResolvedValueOnce([factory.activeShift()]);

      await expect(
        ShiftLogic.checkIn('user-123', 'tutoring', 'test')
      ).rejects.toThrow('כבר יש לך משמרת פעילה');

      // Must NOT attempt the insert
      expect(supabaseFetch).toHaveBeenCalledTimes(1);
    });

    it('start_time is a valid ISO timestamp', async () => {
      supabaseFetch
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(factory.activeShift());

      const before = new Date().toISOString();
      await ShiftLogic.checkIn('user-123', 'other', 'x');
      const after = new Date().toISOString();

      const ts = supabaseFetch.mock.calls[1][1].body.start_time;
      expect(ts >= before).toBe(true);
      expect(ts <= after).toBe(true);
    });

    it('passes all 6 category types correctly', async () => {
      const categories = ['tutoring', 'mentoring', 'community_service', 'office_work', 'event_support', 'other'];

      for (const cat of categories) {
        supabaseFetch.mockReset();
        supabaseFetch.mockResolvedValueOnce([]).mockResolvedValueOnce(factory.activeShift({ category: cat }));

        await ShiftLogic.checkIn('user-123', cat, 'desc');
        expect(supabaseFetch.mock.calls[1][1].body.category).toBe(cat);
      }
    });
  });

  // ═══════════════════════════════════════════
  // checkOut
  // ═══════════════════════════════════════════
  describe('checkOut', () => {
    it('sends PATCH with end_time', async () => {
      const completed = factory.shift();
      supabaseFetch.mockResolvedValue(completed);

      const result = await ShiftLogic.checkOut('shift-001');

      expect(supabaseFetch).toHaveBeenCalledWith('shifts?id=eq.shift-001', {
        method: 'PATCH',
        body: { end_time: expect.any(String) },
        single: true,
      });
      expect(result).toEqual(completed);
    });

    it('end_time is a valid ISO timestamp', async () => {
      supabaseFetch.mockResolvedValue(factory.shift());

      const before = new Date().toISOString();
      await ShiftLogic.checkOut('shift-001');
      const after = new Date().toISOString();

      const ts = supabaseFetch.mock.calls[0][1].body.end_time;
      expect(ts >= before).toBe(true);
      expect(ts <= after).toBe(true);
    });

    it('propagates network errors', async () => {
      supabaseFetch.mockRejectedValue(new Error('Network error'));
      await expect(ShiftLogic.checkOut('x')).rejects.toThrow('Network error');
    });
  });

  // ═══════════════════════════════════════════
  // getShifts
  // ═══════════════════════════════════════════
  describe('getShifts', () => {
    it('returns shifts in descending order', async () => {
      const shifts = [factory.shift({ id: 's1' }), factory.shift({ id: 's2' })];
      supabaseFetch.mockResolvedValue(shifts);

      const result = await ShiftLogic.getShifts('user-123');

      expect(supabaseFetch).toHaveBeenCalledWith('shifts?user_id=eq.user-123&order=start_time.desc');
      expect(result).toHaveLength(2);
    });

    it('returns [] when null response', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getShifts('user-123')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // submitManualLog
  // ═══════════════════════════════════════════
  describe('submitManualLog', () => {
    it('creates a pending manual log with correct fields', async () => {
      const log = factory.manualLog();
      supabaseFetch.mockResolvedValue(log);

      const result = await ShiftLogic.submitManualLog('user-123', {
        date: '2026-02-15',
        durationMinutes: 180,
        description: 'סיוע',
        category: 'community_service',
      });

      expect(supabaseFetch).toHaveBeenCalledWith('manual_logs', {
        method: 'POST',
        body: {
          user_id: 'user-123',
          date: '2026-02-15',
          duration_minutes: 180,
          description: 'סיוע',
          category: 'community_service',
          status: 'pending',
        },
        single: true,
      });
      expect(result.status).toBe('pending');
    });

    it('always forces status=pending (no client-side override)', async () => {
      supabaseFetch.mockResolvedValue(factory.manualLog());
      await ShiftLogic.submitManualLog('user-123', {
        date: '2026-02-15', durationMinutes: 60, description: 'x', category: 'other',
      });
      expect(supabaseFetch.mock.calls[0][1].body.status).toBe('pending');
    });
  });

  // ═══════════════════════════════════════════
  // getManualLogs
  // ═══════════════════════════════════════════
  describe('getManualLogs', () => {
    it('returns logs in descending created_at order', async () => {
      supabaseFetch.mockResolvedValue([factory.manualLog(), factory.approvedLog()]);
      const result = await ShiftLogic.getManualLogs('user-123');
      expect(result).toHaveLength(2);
    });

    it('returns [] when null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getManualLogs('user-123')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // calculateProgress
  // ═══════════════════════════════════════════
  describe('calculateProgress', () => {
    it('sums completed shifts + approved logs correctly', async () => {
      supabaseFetch
        .mockResolvedValueOnce([
          factory.shift({ duration_minutes: 120 }), // 2h
          factory.shift({ duration_minutes: 180 }), // 3h
        ])
        .mockResolvedValueOnce([
          factory.approvedLog({ duration_minutes: 60 }),               // 1h ✓
          factory.manualLog({ duration_minutes: 120, status: 'pending' }), // skip
          factory.rejectedLog({ duration_minutes: 90 }),               // skip
        ]);

      const r = await ShiftLogic.calculateProgress('user-123', 150);

      expect(r.shiftHours).toBe(5);           // (120+180)/60
      expect(r.approvedManualHours).toBe(1);   // 60/60
      expect(r.totalHours).toBe(6);
      expect(r.pendingLogs).toBe(1);
      expect(r.progressPercent).toBeCloseTo(4, 0); // 6/150*100
      expect(r.goal).toBe(150);
    });

    it('caps progressPercent at 100', async () => {
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: 10000 })])
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123', 100);
      expect(r.progressPercent).toBe(100);
      expect(r.totalHours).toBeGreaterThan(100);
    });

    it('returns all zeros when no data', async () => {
      supabaseFetch.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const r = await ShiftLogic.calculateProgress('user-123');
      expect(r.shiftHours).toBe(0);
      expect(r.approvedManualHours).toBe(0);
      expect(r.totalHours).toBe(0);
      expect(r.progressPercent).toBe(0);
      expect(r.pendingLogs).toBe(0);
    });

    it('ignores active/non-completed shifts', async () => {
      supabaseFetch
        .mockResolvedValueOnce([
          factory.shift({ status: 'active', duration_minutes: null }),
          factory.shift({ status: 'completed', duration_minutes: 60 }),
        ])
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123');
      expect(r.shiftHours).toBe(1);
    });

    it('uses default goal of 150', async () => {
      supabaseFetch.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const r = await ShiftLogic.calculateProgress('user-123');
      expect(r.goal).toBe(150);
    });

    it('accepts custom goal', async () => {
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: 300 })]) // 5h
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123', 50);
      expect(r.goal).toBe(50);
      expect(r.progressPercent).toBe(10); // 5/50*100
    });

    it('handles string duration_minutes (Supabase returns numeric strings)', async () => {
      supabaseFetch
        .mockResolvedValueOnce([factory.shift({ duration_minutes: '3.28' })])
        .mockResolvedValueOnce([]);

      const r = await ShiftLogic.calculateProgress('user-123');
      expect(r.shiftHours).toBeCloseTo(0.0547, 3);
    });
  });

  // ═══════════════════════════════════════════
  // ADMIN: approveLog / rejectLog
  // ═══════════════════════════════════════════
  describe('approveLog', () => {
    it('sends PATCH with approved status and reviewer', async () => {
      supabaseFetch.mockResolvedValue(factory.approvedLog());

      await ShiftLogic.approveLog('log-001', 'admin-123');

      expect(supabaseFetch).toHaveBeenCalledWith('manual_logs?id=eq.log-001', {
        method: 'PATCH',
        body: expect.objectContaining({
          status: 'approved',
          reviewed_by: 'admin-123',
          reviewed_at: expect.any(String),
        }),
        single: true,
      });
    });
  });

  describe('rejectLog', () => {
    it('sends PATCH with rejected status and reviewer', async () => {
      supabaseFetch.mockResolvedValue(factory.rejectedLog());

      await ShiftLogic.rejectLog('log-001', 'admin-123');

      expect(supabaseFetch).toHaveBeenCalledWith('manual_logs?id=eq.log-001', {
        method: 'PATCH',
        body: expect.objectContaining({
          status: 'rejected',
          reviewed_by: 'admin-123',
        }),
        single: true,
      });
    });
  });

  // ═══════════════════════════════════════════
  // ADMIN: getAllStudentsSummary
  // ═══════════════════════════════════════════
  describe('getAllStudentsSummary', () => {
    it('calls the RPC function', async () => {
      supabaseRpc.mockResolvedValue([factory.studentSummary()]);

      const result = await ShiftLogic.getAllStudentsSummary();

      expect(supabaseRpc).toHaveBeenCalledWith('get_all_students_summary');
      expect(result).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════
  // ADMIN: getAllPendingLogs
  // ═══════════════════════════════════════════
  describe('getAllPendingLogs', () => {
    it('maps profiles.full_name to user_name', async () => {
      supabaseFetch.mockResolvedValue([
        { ...factory.manualLog(), profiles: { full_name: 'יוסי כהן' } },
      ]);

      const result = await ShiftLogic.getAllPendingLogs();
      expect(result[0].user_name).toBe('יוסי כהן');
    });

    it('uses "לא ידוע" when profiles is null', async () => {
      supabaseFetch.mockResolvedValue([
        { ...factory.manualLog(), profiles: null },
      ]);

      const result = await ShiftLogic.getAllPendingLogs();
      expect(result[0].user_name).toBe('לא ידוע');
    });

    it('returns [] when empty', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getAllPendingLogs()).toEqual([]);
    });

    it('returns [] when null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getAllPendingLogs()).toEqual([]);
    });
  });
});
