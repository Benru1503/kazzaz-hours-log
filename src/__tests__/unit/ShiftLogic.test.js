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

  // ═══════════════════════════════════════════
  // checkIn — siteId parameter
  // ═══════════════════════════════════════════
  describe('checkIn with siteId', () => {
    it('includes site_id in the body when siteId is provided', async () => {
      const newShift = factory.activeShift();
      supabaseFetch
        .mockResolvedValueOnce([])        // getActiveShift → empty
        .mockResolvedValueOnce(newShift);  // insert

      await ShiftLogic.checkIn('user-123', 'tutoring', 'חונכות', 'site-42');

      const insertCall = supabaseFetch.mock.calls[1];
      expect(insertCall[0]).toBe('shifts');
      expect(insertCall[1].body).toMatchObject({
        user_id: 'user-123',
        category: 'tutoring',
        task_description: 'חונכות',
        status: 'active',
        site_id: 'site-42',
      });
    });

    it('omits site_id when siteId is null', async () => {
      supabaseFetch
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(factory.activeShift());

      await ShiftLogic.checkIn('user-123', 'tutoring', 'desc', null);

      const body = supabaseFetch.mock.calls[1][1].body;
      expect(body).not.toHaveProperty('site_id');
    });

    it('omits site_id when siteId is not provided', async () => {
      supabaseFetch
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(factory.activeShift());

      await ShiftLogic.checkIn('user-123', 'tutoring', 'desc');

      const body = supabaseFetch.mock.calls[1][1].body;
      expect(body).not.toHaveProperty('site_id');
    });
  });

  // ═══════════════════════════════════════════
  // submitManualLog — siteId & generalEventId
  // ═══════════════════════════════════════════
  describe('submitManualLog with siteId and generalEventId', () => {
    it('includes site_id and supervisor_status when siteId is provided', async () => {
      supabaseFetch.mockResolvedValue(factory.manualLog());

      await ShiftLogic.submitManualLog('user-123', {
        date: '2026-02-15',
        durationMinutes: 60,
        description: 'x',
        category: 'other',
        siteId: 'site-42',
      });

      expect(supabaseFetch).toHaveBeenCalledWith('manual_logs', {
        method: 'POST',
        body: {
          user_id: 'user-123',
          date: '2026-02-15',
          duration_minutes: 60,
          description: 'x',
          category: 'other',
          status: 'pending',
          site_id: 'site-42',
          supervisor_status: 'pending_supervisor',
        },
        single: true,
      });
    });

    it('includes general_event_id without supervisor_status when generalEventId is provided', async () => {
      supabaseFetch.mockResolvedValue(factory.manualLog());

      await ShiftLogic.submitManualLog('user-123', {
        date: '2026-02-15',
        durationMinutes: 90,
        description: 'event work',
        category: 'event_support',
        generalEventId: 'event-99',
      });

      const body = supabaseFetch.mock.calls[0][1].body;
      expect(body.general_event_id).toBe('event-99');
      expect(body).not.toHaveProperty('site_id');
      expect(body).not.toHaveProperty('supervisor_status');
    });

    it('generalEventId takes precedence over siteId', async () => {
      supabaseFetch.mockResolvedValue(factory.manualLog());

      await ShiftLogic.submitManualLog('user-123', {
        date: '2026-02-15',
        durationMinutes: 60,
        description: 'both',
        category: 'other',
        siteId: 'site-42',
        generalEventId: 'event-99',
      });

      const body = supabaseFetch.mock.calls[0][1].body;
      expect(body.general_event_id).toBe('event-99');
      expect(body).not.toHaveProperty('site_id');
      expect(body).not.toHaveProperty('supervisor_status');
    });
  });

  // ═══════════════════════════════════════════
  // getManualLogs — site/event mapping
  // ═══════════════════════════════════════════
  describe('getManualLogs with site and event joins', () => {
    it('maps sites.name to site_name and general_events.name to event_name', async () => {
      supabaseFetch.mockResolvedValue([
        { ...factory.manualLog(), sites: { name: 'בית ספר הדר' }, general_events: null },
        { ...factory.manualLog({ id: 'log-2' }), sites: null, general_events: { name: 'אירוע מתנדבים' } },
      ]);

      const result = await ShiftLogic.getManualLogs('user-123');

      expect(result[0].site_name).toBe('בית ספר הדר');
      expect(result[0].event_name).toBeNull();
      expect(result[1].site_name).toBeNull();
      expect(result[1].event_name).toBe('אירוע מתנדבים');
    });

    it('sets site_name and event_name to null when joins are missing', async () => {
      supabaseFetch.mockResolvedValue([
        { ...factory.manualLog() },
      ]);

      const result = await ShiftLogic.getManualLogs('user-123');
      expect(result[0].site_name).toBeNull();
      expect(result[0].event_name).toBeNull();
    });

    it('queries with correct select and join syntax', async () => {
      supabaseFetch.mockResolvedValue([]);
      await ShiftLogic.getManualLogs('user-123');

      expect(supabaseFetch).toHaveBeenCalledWith(
        'manual_logs?user_id=eq.user-123&select=*,sites(name),general_events(name)&order=created_at.desc'
      );
    });
  });

  // ═══════════════════════════════════════════
  // SITE OPERATIONS
  // ═══════════════════════════════════════════
  describe('getAllSites', () => {
    it('fetches all sites ordered by name', async () => {
      const sites = [{ id: 'site-1', name: 'אלף' }, { id: 'site-2', name: 'בית' }];
      supabaseFetch.mockResolvedValue(sites);

      const result = await ShiftLogic.getAllSites();

      expect(supabaseFetch).toHaveBeenCalledWith('sites?order=name.asc');
      expect(result).toEqual(sites);
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getAllSites()).toEqual([]);
    });

    it('returns empty array when no sites exist', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getAllSites()).toEqual([]);
    });
  });

  describe('getActiveSites', () => {
    it('fetches only active sites ordered by name', async () => {
      const sites = [{ id: 'site-1', name: 'אלף', is_active: true }];
      supabaseFetch.mockResolvedValue(sites);

      const result = await ShiftLogic.getActiveSites();

      expect(supabaseFetch).toHaveBeenCalledWith('sites?is_active=eq.true&order=name.asc');
      expect(result).toEqual(sites);
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getActiveSites()).toEqual([]);
    });

    it('returns empty array when no active sites exist', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getActiveSites()).toEqual([]);
    });
  });

  describe('createSite', () => {
    it('sends POST with name, address, and description', async () => {
      const newSite = { id: 'site-new', name: 'אתר חדש', address: 'רחוב 1', description: 'תיאור' };
      supabaseFetch.mockResolvedValue(newSite);

      const result = await ShiftLogic.createSite({
        name: 'אתר חדש',
        address: 'רחוב 1',
        description: 'תיאור',
      });

      expect(supabaseFetch).toHaveBeenCalledWith('sites', {
        method: 'POST',
        body: { name: 'אתר חדש', address: 'רחוב 1', description: 'תיאור' },
        single: true,
      });
      expect(result).toEqual(newSite);
    });
  });

  describe('deactivateSite', () => {
    it('patches site with is_active: false via updateSite', async () => {
      const deactivated = { id: 'site-1', name: 'אתר', is_active: false };
      supabaseFetch.mockResolvedValue(deactivated);

      const result = await ShiftLogic.deactivateSite('site-1');

      expect(supabaseFetch).toHaveBeenCalledWith('sites?id=eq.site-1', {
        method: 'PATCH',
        body: { is_active: false, updated_at: expect.any(String) },
        single: true,
      });
      expect(result).toEqual(deactivated);
    });
  });

  // ═══════════════════════════════════════════
  // SUPERVISOR OPERATIONS
  // ═══════════════════════════════════════════
  describe('getAllSupervisors', () => {
    it('fetches profiles with site_supervisor role ordered by name', async () => {
      const supervisors = [factory.supervisorProfile()];
      supabaseFetch.mockResolvedValue(supervisors);

      const result = await ShiftLogic.getAllSupervisors();

      expect(supabaseFetch).toHaveBeenCalledWith('profiles?role=eq.site_supervisor&order=full_name.asc');
      expect(result).toEqual(supervisors);
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getAllSupervisors()).toEqual([]);
    });

    it('returns empty array when no supervisors exist', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getAllSupervisors()).toEqual([]);
    });
  });

  describe('getSiteSupervisors', () => {
    it('fetches supervisors for a site and maps profile fields', async () => {
      supabaseFetch.mockResolvedValue([
        {
          id: 'assign-1',
          site_id: 'site-1',
          supervisor_id: 'supervisor-123',
          profiles: { id: 'supervisor-123', full_name: 'משה לוי', email: 'moshe@test.com' },
        },
      ]);

      const result = await ShiftLogic.getSiteSupervisors('site-1');

      expect(supabaseFetch).toHaveBeenCalledWith(
        'site_supervisors?site_id=eq.site-1&select=*,profiles!site_supervisors_supervisor_id_fkey(id,full_name,email)'
      );
      expect(result[0].supervisor_name).toBe('משה לוי');
      expect(result[0].supervisor_email).toBe('moshe@test.com');
    });

    it('uses empty strings when profiles is null', async () => {
      supabaseFetch.mockResolvedValue([
        { id: 'assign-1', site_id: 'site-1', supervisor_id: 'supervisor-123', profiles: null },
      ]);

      const result = await ShiftLogic.getSiteSupervisors('site-1');
      expect(result[0].supervisor_name).toBe('');
      expect(result[0].supervisor_email).toBe('');
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getSiteSupervisors('site-1')).toEqual([]);
    });

    it('returns empty array when no supervisors assigned', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getSiteSupervisors('site-1')).toEqual([]);
    });
  });

  describe('assignSupervisorToSite', () => {
    it('sends POST with supervisor_id and site_id', async () => {
      const assignment = { id: 'assign-new', supervisor_id: 'supervisor-123', site_id: 'site-1' };
      supabaseFetch.mockResolvedValue(assignment);

      const result = await ShiftLogic.assignSupervisorToSite('supervisor-123', 'site-1');

      expect(supabaseFetch).toHaveBeenCalledWith('site_supervisors', {
        method: 'POST',
        body: { supervisor_id: 'supervisor-123', site_id: 'site-1' },
        single: true,
      });
      expect(result).toEqual(assignment);
    });
  });

  describe('removeSupervisorFromSite', () => {
    it('sends DELETE for the assignment ID', async () => {
      supabaseFetch.mockResolvedValue(undefined);

      await ShiftLogic.removeSupervisorFromSite('assign-1');

      expect(supabaseFetch).toHaveBeenCalledWith('site_supervisors?id=eq.assign-1', {
        method: 'DELETE',
      });
    });
  });

  // ═══════════════════════════════════════════
  // PLACEMENT OPERATIONS
  // ═══════════════════════════════════════════
  describe('getStudentPlacement', () => {
    it('fetches active placement with site join', async () => {
      const placement = {
        id: 'placement-1',
        student_id: 'user-123',
        site_id: 'site-1',
        status: 'active',
        sites: { id: 'site-1', name: 'בית ספר הדר' },
      };
      supabaseFetch.mockResolvedValue(placement);

      const result = await ShiftLogic.getStudentPlacement('user-123');

      expect(supabaseFetch).toHaveBeenCalledWith(
        'student_placements?student_id=eq.user-123&status=eq.active&select=*,sites(id,name)',
        { single: true }
      );
      expect(result).toEqual(placement);
    });

    it('returns null when no placement exists', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getStudentPlacement('user-123')).toBeNull();
    });
  });

  describe('getAllPlacements', () => {
    it('fetches placements for an academic year with profile and site joins', async () => {
      supabaseFetch.mockResolvedValue([
        {
          id: 'p-1',
          student_id: 'user-123',
          site_id: 'site-1',
          academic_year: '2025-2026',
          profiles: { full_name: 'יוסי כהן' },
          sites: { name: 'בית ספר הדר' },
        },
      ]);

      const result = await ShiftLogic.getAllPlacements('2025-2026');

      expect(supabaseFetch).toHaveBeenCalledWith(
        'student_placements?academic_year=eq.2025-2026&select=*,profiles!student_placements_student_id_fkey(full_name),sites(name)&order=created_at.desc'
      );
      expect(result[0].student_name).toBe('יוסי כהן');
      expect(result[0].site_name).toBe('בית ספר הדר');
    });

    it('uses empty strings when profiles or sites are null', async () => {
      supabaseFetch.mockResolvedValue([
        { id: 'p-1', student_id: 'user-123', profiles: null, sites: null },
      ]);

      const result = await ShiftLogic.getAllPlacements('2025-2026');
      expect(result[0].student_name).toBe('');
      expect(result[0].site_name).toBe('');
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getAllPlacements('2025-2026')).toEqual([]);
    });

    it('returns empty array when no placements exist', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getAllPlacements('2025-2026')).toEqual([]);
    });
  });

  describe('createPlacement', () => {
    it('sends POST with student_id, site_id, academic_year, and active status', async () => {
      const placement = { id: 'p-new', student_id: 'user-123', site_id: 'site-1', academic_year: '2025-2026', status: 'active' };
      supabaseFetch.mockResolvedValue(placement);

      const result = await ShiftLogic.createPlacement('user-123', 'site-1', '2025-2026');

      expect(supabaseFetch).toHaveBeenCalledWith('student_placements', {
        method: 'POST',
        body: {
          student_id: 'user-123',
          site_id: 'site-1',
          academic_year: '2025-2026',
          status: 'active',
        },
        single: true,
      });
      expect(result).toEqual(placement);
    });
  });

  // ═══════════════════════════════════════════
  // EVENT OPERATIONS
  // ═══════════════════════════════════════════
  describe('getActiveEvents', () => {
    it('fetches active events ordered by event_date descending', async () => {
      const events = [
        { id: 'ev-1', name: 'אירוע א', is_active: true, event_date: '2026-03-01' },
        { id: 'ev-2', name: 'אירוע ב', is_active: true, event_date: '2026-02-15' },
      ];
      supabaseFetch.mockResolvedValue(events);

      const result = await ShiftLogic.getActiveEvents();

      expect(supabaseFetch).toHaveBeenCalledWith('general_events?is_active=eq.true&order=event_date.desc');
      expect(result).toEqual(events);
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getActiveEvents()).toEqual([]);
    });

    it('returns empty array when no active events exist', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getActiveEvents()).toEqual([]);
    });
  });

  describe('getAllEvents', () => {
    it('fetches all events ordered by created_at descending', async () => {
      const events = [{ id: 'ev-1', name: 'אירוע א' }];
      supabaseFetch.mockResolvedValue(events);

      const result = await ShiftLogic.getAllEvents();

      expect(supabaseFetch).toHaveBeenCalledWith('general_events?order=created_at.desc');
      expect(result).toEqual(events);
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getAllEvents()).toEqual([]);
    });

    it('returns empty array when no events exist', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getAllEvents()).toEqual([]);
    });
  });

  describe('createEvent', () => {
    it('sends POST with name, description, event_date, and created_by', async () => {
      const newEvent = { id: 'ev-new', name: 'אירוע חדש', description: 'תיאור', event_date: '2026-04-01', created_by: 'admin-123' };
      supabaseFetch.mockResolvedValue(newEvent);

      const result = await ShiftLogic.createEvent('admin-123', {
        name: 'אירוע חדש',
        description: 'תיאור',
        eventDate: '2026-04-01',
      });

      expect(supabaseFetch).toHaveBeenCalledWith('general_events', {
        method: 'POST',
        body: {
          name: 'אירוע חדש',
          description: 'תיאור',
          event_date: '2026-04-01',
          created_by: 'admin-123',
        },
        single: true,
      });
      expect(result).toEqual(newEvent);
    });
  });

  // ═══════════════════════════════════════════
  // SUPERVISOR PANEL OPERATIONS
  // ═══════════════════════════════════════════
  describe('getSupervisorStudents', () => {
    it('calls RPC get_supervisor_students with supervisor ID', async () => {
      const students = [factory.supervisorStudent()];
      supabaseRpc.mockResolvedValue(students);

      const result = await ShiftLogic.getSupervisorStudents('supervisor-123');

      expect(supabaseRpc).toHaveBeenCalledWith('get_supervisor_students', {
        p_supervisor_id: 'supervisor-123',
      });
      expect(result).toEqual(students);
    });

    it('returns empty array from RPC when no students', async () => {
      supabaseRpc.mockResolvedValue([]);
      const result = await ShiftLogic.getSupervisorStudents('supervisor-123');
      expect(result).toEqual([]);
    });
  });

  describe('getSupervisorPendingLogs', () => {
    it('calls RPC get_supervisor_pending_logs with supervisor ID', async () => {
      const logs = [factory.supervisorPendingLog()];
      supabaseRpc.mockResolvedValue(logs);

      const result = await ShiftLogic.getSupervisorPendingLogs('supervisor-123');

      expect(supabaseRpc).toHaveBeenCalledWith('get_supervisor_pending_logs', {
        p_supervisor_id: 'supervisor-123',
      });
      expect(result).toEqual(logs);
    });

    it('returns empty array from RPC when no pending logs', async () => {
      supabaseRpc.mockResolvedValue([]);
      const result = await ShiftLogic.getSupervisorPendingLogs('supervisor-123');
      expect(result).toEqual([]);
    });
  });

  describe('supervisorApproveLog', () => {
    it('calls RPC supervisor_approve_log with log ID', async () => {
      supabaseRpc.mockResolvedValue({ success: true });

      const result = await ShiftLogic.supervisorApproveLog('log-1');

      expect(supabaseRpc).toHaveBeenCalledWith('supervisor_approve_log', { p_log_id: 'log-1' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('supervisorRejectLog', () => {
    it('calls RPC supervisor_reject_log with log ID', async () => {
      supabaseRpc.mockResolvedValue({ success: true });

      const result = await ShiftLogic.supervisorRejectLog('log-1');

      expect(supabaseRpc).toHaveBeenCalledWith('supervisor_reject_log', { p_log_id: 'log-1' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('getSupervisorSites', () => {
    it('fetches site_supervisors and extracts the sites objects', async () => {
      supabaseFetch.mockResolvedValue([
        { id: 'assign-1', supervisor_id: 'supervisor-123', sites: { id: 'site-1', name: 'בית ספר הדר', address: 'רחוב 1', description: 'תיאור' } },
        { id: 'assign-2', supervisor_id: 'supervisor-123', sites: { id: 'site-2', name: 'מרכז קהילתי', address: 'רחוב 2', description: 'תיאור 2' } },
      ]);

      const result = await ShiftLogic.getSupervisorSites('supervisor-123');

      expect(supabaseFetch).toHaveBeenCalledWith(
        'site_supervisors?supervisor_id=eq.supervisor-123&select=*,sites(id,name,address,description)'
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('בית ספר הדר');
      expect(result[1].name).toBe('מרכז קהילתי');
    });

    it('filters out null sites entries', async () => {
      supabaseFetch.mockResolvedValue([
        { id: 'assign-1', supervisor_id: 'supervisor-123', sites: { id: 'site-1', name: 'אתר' } },
        { id: 'assign-2', supervisor_id: 'supervisor-123', sites: null },
      ]);

      const result = await ShiftLogic.getSupervisorSites('supervisor-123');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('אתר');
    });

    it('returns empty array when data is null', async () => {
      supabaseFetch.mockResolvedValue(null);
      expect(await ShiftLogic.getSupervisorSites('supervisor-123')).toEqual([]);
    });

    it('returns empty array when no sites assigned', async () => {
      supabaseFetch.mockResolvedValue([]);
      expect(await ShiftLogic.getSupervisorSites('supervisor-123')).toEqual([]);
    });
  });
});
