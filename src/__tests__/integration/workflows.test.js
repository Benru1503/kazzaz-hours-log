import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase module BEFORE importing ShiftLogic
vi.mock('../../lib/supabase', () => import('../../__mocks__/supabase'));

import { ShiftLogic } from '../../lib/ShiftLogic';
import { supabaseFetch, supabaseRpc, resetAllMocks, factory } from '../../__mocks__/supabase';

// ═══════════════════════════════════════════════════════════════════
// WORKFLOW INTEGRATION TESTS
// These test complete user journeys through ShiftLogic, verifying
// that the functions chain together correctly.
// ═══════════════════════════════════════════════════════════════════

describe('Workflow: Student Shift Lifecycle', () => {
  beforeEach(() => resetAllMocks());

  it('check-in → active shift exists → check-out → shift completed', async () => {
    // 1. Check in
    const activeShift = factory.activeShift({ id: 'shift-new' });
    supabaseFetch
      .mockResolvedValueOnce([])           // getActiveShift → no active
      .mockResolvedValueOnce(activeShift);  // insert shift

    const shift = await ShiftLogic.checkIn('user-123', 'other', 'חונכות', 'site-1');
    expect(shift.status).toBe('active');
    expect(shift.id).toBe('shift-new');

    // 2. Verify active shift exists
    supabaseFetch.mockResolvedValueOnce([activeShift]);
    const active = await ShiftLogic.getActiveShift('user-123');
    expect(active).not.toBeNull();
    expect(active.id).toBe('shift-new');

    // 3. Cannot check in again while active
    supabaseFetch.mockResolvedValueOnce([activeShift]);
    await expect(
      ShiftLogic.checkIn('user-123', 'other', 'second shift')
    ).rejects.toThrow('כבר יש לך משמרת פעילה');

    // 4. Check out
    const completedShift = factory.shift({ id: 'shift-new', duration_minutes: 240 });
    supabaseFetch.mockResolvedValueOnce(completedShift);
    const result = await ShiftLogic.checkOut('shift-new');
    expect(result.status).toBe('completed');
    expect(result.duration_minutes).toBe(240);

    // 5. No more active shift
    supabaseFetch.mockResolvedValueOnce([]);
    const afterCheckout = await ShiftLogic.getActiveShift('user-123');
    expect(afterCheckout).toBeNull();
  });
});

describe('Workflow: Manual Log → Supervisor Approval → Admin Approval', () => {
  beforeEach(() => resetAllMocks());

  it('student submits site log → supervisor approves → admin approves → counts in progress', async () => {
    // 1. Student submits manual log tied to a site
    const pendingLog = factory.manualLog({
      id: 'log-flow',
      site_id: 'site-1',
      supervisor_status: 'pending_supervisor',
      duration_minutes: 120,
    });
    supabaseFetch.mockResolvedValueOnce(pendingLog);

    const log = await ShiftLogic.submitManualLog('user-123', {
      date: '2026-03-01',
      durationMinutes: 120,
      description: 'חונכות',
      category: 'other',
      siteId: 'site-1',
    });

    // Verify supervisor_status was set
    const body = supabaseFetch.mock.calls[0][1].body;
    expect(body.supervisor_status).toBe('pending_supervisor');
    expect(body.site_id).toBe('site-1');
    expect(body.status).toBe('pending');

    // 2. Supervisor sees the pending log
    supabaseRpc.mockResolvedValueOnce([{
      log_id: 'log-flow',
      student_name: 'יוסי',
      description: 'חונכות',
      duration_minutes: 120,
      supervisor_status: 'pending_supervisor',
    }]);

    const pendingLogs = await ShiftLogic.getSupervisorPendingLogs('supervisor-123');
    expect(pendingLogs).toHaveLength(1);
    expect(pendingLogs[0].log_id).toBe('log-flow');

    // 3. Supervisor approves
    supabaseRpc.mockResolvedValueOnce({ success: true });
    await ShiftLogic.supervisorApproveLog('log-flow');
    expect(supabaseRpc).toHaveBeenCalledWith('supervisor_approve_log', { p_log_id: 'log-flow' });

    // 4. Admin sees it (now supervisor_approved, still pending admin)
    supabaseFetch.mockResolvedValueOnce([{
      ...pendingLog,
      supervisor_status: 'supervisor_approved',
      status: 'pending',
      profiles: { full_name: 'יוסי' },
    }]);

    const adminPending = await ShiftLogic.getAllPendingLogs();
    expect(adminPending).toHaveLength(1);
    expect(adminPending[0].user_name).toBe('יוסי');

    // 5. Admin approves
    const approvedLog = factory.approvedLog({ id: 'log-flow', duration_minutes: 120 });
    supabaseFetch.mockResolvedValueOnce(approvedLog);
    await ShiftLogic.approveLog('log-flow', 'admin-123');

    const approveBody = supabaseFetch.mock.calls[supabaseFetch.mock.calls.length - 1][1].body;
    expect(approveBody.status).toBe('approved');
    expect(approveBody.reviewed_by).toBe('admin-123');

    // 6. Progress now reflects the approved hours
    supabaseFetch
      .mockResolvedValueOnce([])  // no shifts
      .mockResolvedValueOnce([{ ...approvedLog, sites: null, general_events: null }]);  // approved log

    const progress = await ShiftLogic.calculateProgress('user-123', 150);
    expect(progress.approvedManualHours).toBe(2); // 120 min = 2h
    expect(progress.totalHours).toBe(2);
  });

  it('student submits site log → supervisor REJECTS → log is rejected (skips admin)', async () => {
    // 1. Student submits
    supabaseFetch.mockResolvedValueOnce(factory.manualLog({
      id: 'log-rej',
      site_id: 'site-1',
      supervisor_status: 'pending_supervisor',
    }));

    await ShiftLogic.submitManualLog('user-123', {
      date: '2026-03-01',
      durationMinutes: 60,
      description: 'עבודה',
      category: 'other',
      siteId: 'site-1',
    });

    // 2. Supervisor rejects
    supabaseRpc.mockResolvedValueOnce({ success: true });
    await ShiftLogic.supervisorRejectLog('log-rej');
    expect(supabaseRpc).toHaveBeenCalledWith('supervisor_reject_log', { p_log_id: 'log-rej' });

    // 3. The rejected log does NOT count in progress
    supabaseFetch
      .mockResolvedValueOnce([])  // no shifts
      .mockResolvedValueOnce([{
        ...factory.rejectedLog({ id: 'log-rej', duration_minutes: 60 }),
        sites: null,
        general_events: null,
      }]);

    const progress = await ShiftLogic.calculateProgress('user-123', 150);
    expect(progress.approvedManualHours).toBe(0);
    expect(progress.totalHours).toBe(0);
  });

  it('student submits general event log → goes straight to admin (no supervisor)', async () => {
    supabaseFetch.mockResolvedValueOnce(factory.manualLog({
      id: 'log-event',
      general_event_id: 'event-1',
    }));

    await ShiftLogic.submitManualLog('user-123', {
      date: '2026-03-01',
      durationMinutes: 90,
      description: 'אירוע מתנדבים',
      category: 'event_support',
      generalEventId: 'event-1',
    });

    const body = supabaseFetch.mock.calls[0][1].body;
    expect(body.general_event_id).toBe('event-1');
    expect(body).not.toHaveProperty('supervisor_status');
    expect(body).not.toHaveProperty('site_id');
    expect(body.status).toBe('pending');
  });
});

describe('Workflow: Admin Site & Supervisor Setup', () => {
  beforeEach(() => resetAllMocks());

  it('create site → assign supervisor → place student → verify supervisor sees student', async () => {
    // 1. Admin creates a site
    const site = { id: 'site-new', name: 'אתר חדש', address: 'רחוב 1', description: 'תיאור' };
    supabaseFetch.mockResolvedValueOnce(site);
    const createdSite = await ShiftLogic.createSite({ name: 'אתר חדש', address: 'רחוב 1', description: 'תיאור' });
    expect(createdSite.id).toBe('site-new');

    // 2. Admin assigns a supervisor to the site
    const assignment = { id: 'assign-1', supervisor_id: 'supervisor-1', site_id: 'site-new' };
    supabaseFetch.mockResolvedValueOnce(assignment);
    await ShiftLogic.assignSupervisorToSite('supervisor-1', 'site-new');
    expect(supabaseFetch.mock.calls[1][1].body).toEqual({
      supervisor_id: 'supervisor-1',
      site_id: 'site-new',
    });

    // 3. Admin places student at the site
    const placement = { id: 'p-1', student_id: 'user-123', site_id: 'site-new', academic_year: '2025-2026', status: 'active' };
    supabaseFetch.mockResolvedValueOnce(placement);
    await ShiftLogic.createPlacement('user-123', 'site-new', '2025-2026');
    expect(supabaseFetch.mock.calls[2][1].body).toEqual({
      student_id: 'user-123',
      site_id: 'site-new',
      academic_year: '2025-2026',
      status: 'active',
    });

    // 4. Supervisor can now see the student
    supabaseRpc.mockResolvedValueOnce([
      factory.supervisorStudent({ student_id: 'user-123', site_name: 'אתר חדש', site_id: 'site-new' }),
    ]);

    const students = await ShiftLogic.getSupervisorStudents('supervisor-1');
    expect(students).toHaveLength(1);
    expect(students[0].student_id).toBe('user-123');
    expect(students[0].site_name).toBe('אתר חדש');
  });

  it('deactivate site → supervisor loses students at that site', async () => {
    // 1. Deactivate the site
    supabaseFetch.mockResolvedValueOnce({ id: 'site-1', is_active: false });
    await ShiftLogic.deactivateSite('site-1');

    // 2. Supervisor now sees no students (site inactive)
    supabaseRpc.mockResolvedValueOnce([]);
    const students = await ShiftLogic.getSupervisorStudents('supervisor-1');
    expect(students).toEqual([]);
  });

  it('remove supervisor from site → no longer sees that site', async () => {
    // Remove assignment
    supabaseFetch.mockResolvedValueOnce(undefined);
    await ShiftLogic.removeSupervisorFromSite('assign-1');

    // Supervisor sites are now empty
    supabaseFetch.mockResolvedValueOnce([]);
    const sites = await ShiftLogic.getSupervisorSites('supervisor-1');
    expect(sites).toEqual([]);
  });
});

describe('Workflow: Approved Scholars Registration Flow', () => {
  beforeEach(() => resetAllMocks());

  it('admin adds email → student checks → email found → student registers', async () => {
    // 1. Admin adds approved email
    supabaseFetch.mockResolvedValueOnce({ id: 'as-1', email: 'new@student.com', status: 'pending' });
    await ShiftLogic.addApprovedScholar('new@student.com', 'admin-123');

    // 2. Student checks if their email is approved
    supabaseRpc.mockResolvedValueOnce(true);
    const isApproved = await ShiftLogic.checkApprovedEmail('new@student.com');
    expect(isApproved).toBe(true);

    // 3. Registration proceeds (tested in Auth.test.jsx)
  });

  it('unapproved email is rejected', async () => {
    supabaseRpc.mockResolvedValueOnce(false);
    const isApproved = await ShiftLogic.checkApprovedEmail('random@nobody.com');
    expect(isApproved).toBe(false);
  });

  it('bulk add scholars → all emails lowered/trimmed', async () => {
    supabaseFetch.mockResolvedValueOnce([
      { email: 'a@test.com' },
      { email: 'b@test.com' },
      { email: 'c@test.com' },
    ]);

    await ShiftLogic.addApprovedScholarsBulk(
      ['  A@Test.COM  ', 'B@TEST.com', '  c@test.com'],
      'admin-123'
    );

    const body = supabaseFetch.mock.calls[0][1].body;
    expect(body).toHaveLength(3);
    expect(body[0].email).toBe('a@test.com');
    expect(body[1].email).toBe('b@test.com');
    expect(body[2].email).toBe('c@test.com');
    expect(body.every(s => s.added_by === 'admin-123')).toBe(true);
  });
});

describe('Workflow: Student Progress Tracking', () => {
  beforeEach(() => resetAllMocks());

  it('combines shift hours + approved manual hours correctly', async () => {
    // Student has both shifts and approved manual logs
    supabaseFetch
      .mockResolvedValueOnce([
        factory.shift({ duration_minutes: 240 }),  // 4h
        factory.shift({ duration_minutes: 180 }),  // 3h
        factory.shift({ status: 'active', duration_minutes: null }), // ignored
      ])
      .mockResolvedValueOnce([
        { ...factory.approvedLog({ duration_minutes: 120 }), sites: null, general_events: null },  // 2h
        { ...factory.manualLog({ duration_minutes: 60, status: 'pending' }), sites: null, general_events: null },  // ignored
        { ...factory.rejectedLog({ duration_minutes: 90 }), sites: null, general_events: null },  // ignored
      ]);

    const progress = await ShiftLogic.calculateProgress('user-123', 150);

    expect(progress.shiftHours).toBe(7);           // 4 + 3
    expect(progress.approvedManualHours).toBe(2);   // only approved
    expect(progress.totalHours).toBe(9);            // 7 + 2
    expect(progress.pendingLogs).toBe(1);           // 1 pending
    expect(progress.progressPercent).toBe(6);       // 9/150*100 = 6
    expect(progress.goal).toBe(150);
  });

  it('reaches 100% and caps correctly', async () => {
    supabaseFetch
      .mockResolvedValueOnce([factory.shift({ duration_minutes: 9000 })]) // 150h exactly
      .mockResolvedValueOnce([
        { ...factory.approvedLog({ duration_minutes: 60 }), sites: null, general_events: null }, // +1h
      ]);

    const progress = await ShiftLogic.calculateProgress('user-123', 150);

    expect(progress.totalHours).toBe(151);       // exceeds goal
    expect(progress.progressPercent).toBe(100);   // capped
  });
});

describe('Workflow: Supervisor Multi-Site Management', () => {
  beforeEach(() => resetAllMocks());

  it('supervisor sees students from multiple sites', async () => {
    supabaseRpc.mockResolvedValueOnce([
      factory.supervisorStudent({ student_id: 's1', full_name: 'יוסי', site_name: 'אתר א', site_id: 'site-1' }),
      factory.supervisorStudent({ student_id: 's2', full_name: 'שרה', site_name: 'אתר א', site_id: 'site-1' }),
      factory.supervisorStudent({ student_id: 's3', full_name: 'נועם', site_name: 'אתר ב', site_id: 'site-2' }),
    ]);

    const students = await ShiftLogic.getSupervisorStudents('supervisor-123');
    expect(students).toHaveLength(3);

    const siteNames = [...new Set(students.map(s => s.site_name))];
    expect(siteNames).toContain('אתר א');
    expect(siteNames).toContain('אתר ב');
  });

  it('supervisor sees pending logs from all their sites', async () => {
    supabaseRpc.mockResolvedValueOnce([
      factory.supervisorPendingLog({ log_id: 'l1', site_name: 'אתר א', student_name: 'יוסי' }),
      factory.supervisorPendingLog({ log_id: 'l2', site_name: 'אתר ב', student_name: 'נועם' }),
    ]);

    const logs = await ShiftLogic.getSupervisorPendingLogs('supervisor-123');
    expect(logs).toHaveLength(2);
    expect(logs[0].site_name).toBe('אתר א');
    expect(logs[1].site_name).toBe('אתר ב');
  });

  it('supervisor gets their assigned sites list', async () => {
    supabaseFetch.mockResolvedValueOnce([
      { id: 'a1', sites: { id: 'site-1', name: 'אתר א', address: 'כתובת 1', description: 'תיאור' } },
      { id: 'a2', sites: { id: 'site-2', name: 'אתר ב', address: 'כתובת 2', description: 'תיאור' } },
    ]);

    const sites = await ShiftLogic.getSupervisorSites('supervisor-123');
    expect(sites).toHaveLength(2);
    expect(sites[0].name).toBe('אתר א');
    expect(sites[1].name).toBe('אתר ב');
  });
});

describe('Workflow: Event Management', () => {
  beforeEach(() => resetAllMocks());

  it('admin creates event → shows in active events → student can select', async () => {
    // 1. Create event
    const event = { id: 'ev-new', name: 'יום מעשים טובים', description: 'אירוע', event_date: '2026-04-01', created_by: 'admin-123' };
    supabaseFetch.mockResolvedValueOnce(event);
    const created = await ShiftLogic.createEvent('admin-123', {
      name: 'יום מעשים טובים',
      description: 'אירוע',
      eventDate: '2026-04-01',
    });
    expect(created.name).toBe('יום מעשים טובים');

    // 2. Active events list includes it
    supabaseFetch.mockResolvedValueOnce([event]);
    const active = await ShiftLogic.getActiveEvents();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('יום מעשים טובים');

    // 3. Deactivate event
    supabaseFetch.mockResolvedValueOnce({ ...event, is_active: false });
    await ShiftLogic.deactivateEvent('ev-new');

    // 4. No longer in active events
    supabaseFetch.mockResolvedValueOnce([]);
    const afterDeactivate = await ShiftLogic.getActiveEvents();
    expect(afterDeactivate).toEqual([]);
  });
});
