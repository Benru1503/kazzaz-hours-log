import { supabase, supabaseFetch, supabaseRpc } from './supabase';

// ═══════════════════════════════════════════
// SHIFT LOGIC — Using raw fetch (never hangs)
// ═══════════════════════════════════════════

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export const ShiftLogic = {

  // ─── Profile ───

  async getProfile(userId) {
    return supabaseFetch(`profiles?id=eq.${userId}`, { single: true });
  },

  // ─── Active Shift ───

  async getActiveShift(userId) {
    const data = await supabaseFetch(
      `shifts?user_id=eq.${userId}&status=eq.active`
    );
    return data?.[0] || null;
  },

  // ─── Check In (updated: accepts optional siteId) ───

  async checkIn(userId, category, taskDescription, siteId = null) {
    const existing = await this.getActiveShift(userId);
    if (existing) {
      throw new Error('כבר יש לך משמרת פעילה. צא מהמשמרת הנוכחית לפני שתתחיל חדשה.');
    }

    const body = {
      user_id: userId,
      category: category,
      task_description: taskDescription,
      start_time: new Date().toISOString(),
      status: 'active',
    };

    if (siteId) body.site_id = siteId;

    return supabaseFetch('shifts', {
      method: 'POST',
      body,
      single: true,
    });
  },

  // ─── Check Out ───

  async checkOut(shiftId) {
    return supabaseFetch(`shifts?id=eq.${shiftId}`, {
      method: 'PATCH',
      body: { end_time: new Date().toISOString() },
      single: true,
    });
  },

  // ─── Get Completed Shifts ───

  async getShifts(userId) {
    const data = await supabaseFetch(
      `shifts?user_id=eq.${userId}&order=start_time.desc`
    );
    return data || [];
  },

  // ─── Manual Log: Submit (updated: accepts siteId, generalEventId) ───

  async submitManualLog(userId, { date, durationMinutes, description, category, siteId, generalEventId }) {
    const body = {
      user_id: userId,
      date: date,
      duration_minutes: durationMinutes,
      description: description,
      category: category,
      status: 'pending',
    };

    if (generalEventId) {
      // General event: no supervisor step, goes straight to admin
      body.general_event_id = generalEventId;
    } else if (siteId) {
      // Site-linked: needs supervisor approval first
      body.site_id = siteId;
      body.supervisor_status = 'pending_supervisor';
    }

    return supabaseFetch('manual_logs', {
      method: 'POST',
      body,
      single: true,
    });
  },

  // ─── Manual Log: Get User's Logs (updated: includes site/event info) ───

  async getManualLogs(userId) {
    const data = await supabaseFetch(
      `manual_logs?user_id=eq.${userId}&select=*,sites(name),general_events(name)&order=created_at.desc`
    );
    return (data || []).map(log => ({
      ...log,
      site_name: log.sites?.name || null,
      event_name: log.general_events?.name || null,
    }));
  },

  // ─── Progress Calculation ───

  async calculateProgress(userId, goal = 150) {
    const [shifts, logs] = await Promise.all([
      this.getShifts(userId),
      this.getManualLogs(userId),
    ]);

    const shiftMinutes = shifts
      .filter(s => s.status === 'completed' && s.duration_minutes)
      .reduce((sum, s) => sum + parseFloat(s.duration_minutes), 0);

    const approvedMinutes = logs
      .filter(l => l.status === 'approved')
      .reduce((sum, l) => sum + l.duration_minutes, 0);

    const totalMinutes = shiftMinutes + approvedMinutes;
    const totalHours = totalMinutes / 60;
    const progressPercent = Math.min((totalHours / goal) * 100, 100);

    return {
      shiftHours: shiftMinutes / 60,
      approvedManualHours: approvedMinutes / 60,
      pendingLogs: logs.filter(l => l.status === 'pending').length,
      totalHours,
      progressPercent,
      goal,
    };
  },

  // ═══════════════════════════════════════════
  // ADMIN OPERATIONS
  // ═══════════════════════════════════════════

  async approveLog(logId, adminId) {
    return supabaseFetch(`manual_logs?id=eq.${logId}`, {
      method: 'PATCH',
      body: {
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      },
      single: true,
    });
  },

  async rejectLog(logId, adminId) {
    return supabaseFetch(`manual_logs?id=eq.${logId}`, {
      method: 'PATCH',
      body: {
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      },
      single: true,
    });
  },

  async getAllStudentsSummary() {
    return await supabaseRpc('get_all_students_summary');
  },

  async getAllPendingLogs() {
    const data = await supabaseFetch(
      `manual_logs?status=eq.pending&select=*,profiles!manual_logs_user_id_fkey(full_name),sites(name),general_events(name)&order=created_at.asc`
    );
    return (data || []).map(log => ({
      ...log,
      user_name: log.profiles?.full_name || 'לא ידוע',
      site_name: log.sites?.name || null,
      event_name: log.general_events?.name || null,
    }));
  },

  // ═══════════════════════════════════════════
  // SITE OPERATIONS (Admin)
  // ═══════════════════════════════════════════

  async getAllSites() {
    const data = await supabaseFetch('sites?order=name.asc');
    return data || [];
  },

  async getActiveSites() {
    const data = await supabaseFetch('sites?is_active=eq.true&order=name.asc');
    return data || [];
  },

  async createSite({ name, address, description }) {
    return supabaseFetch('sites', {
      method: 'POST',
      body: { name, address, description },
      single: true,
    });
  },

  async updateSite(siteId, updates) {
    return supabaseFetch(`sites?id=eq.${siteId}`, {
      method: 'PATCH',
      body: { ...updates, updated_at: new Date().toISOString() },
      single: true,
    });
  },

  async deactivateSite(siteId) {
    return this.updateSite(siteId, { is_active: false });
  },

  // ═══════════════════════════════════════════
  // SITE SUPERVISOR OPERATIONS (Admin)
  // ═══════════════════════════════════════════

  async getSiteSupervisors(siteId) {
    const data = await supabaseFetch(
      `site_supervisors?site_id=eq.${siteId}&select=*,profiles!site_supervisors_supervisor_id_fkey(id,full_name,email)`
    );
    return (data || []).map(ss => ({
      ...ss,
      supervisor_name: ss.profiles?.full_name || '',
      supervisor_email: ss.profiles?.email || '',
    }));
  },

  async getAllSupervisors() {
    const data = await supabaseFetch(
      'profiles?role=eq.site_supervisor&order=full_name.asc'
    );
    return data || [];
  },

  async assignSupervisorToSite(supervisorId, siteId) {
    return supabaseFetch('site_supervisors', {
      method: 'POST',
      body: { supervisor_id: supervisorId, site_id: siteId },
      single: true,
    });
  },

  async removeSupervisorFromSite(assignmentId) {
    return supabaseFetch(`site_supervisors?id=eq.${assignmentId}`, {
      method: 'DELETE',
    });
  },

  // ═══════════════════════════════════════════
  // STUDENT PLACEMENT OPERATIONS (Admin)
  // ═══════════════════════════════════════════

  async getStudentPlacement(studentId) {
    const data = await supabaseFetch(
      `student_placements?student_id=eq.${studentId}&status=eq.active&select=*,sites(id,name)`,
      { single: true }
    );
    return data;
  },

  async getAllPlacements(academicYear) {
    const data = await supabaseFetch(
      `student_placements?academic_year=eq.${academicYear}&select=*,profiles!student_placements_student_id_fkey(full_name),sites(name)&order=created_at.desc`
    );
    return (data || []).map(p => ({
      ...p,
      student_name: p.profiles?.full_name || '',
      site_name: p.sites?.name || '',
    }));
  },

  async createPlacement(studentId, siteId, academicYear) {
    return supabaseFetch('student_placements', {
      method: 'POST',
      body: {
        student_id: studentId,
        site_id: siteId,
        academic_year: academicYear,
        status: 'active',
      },
      single: true,
    });
  },

  async updatePlacementStatus(placementId, status) {
    return supabaseFetch(`student_placements?id=eq.${placementId}`, {
      method: 'PATCH',
      body: { status },
      single: true,
    });
  },

  // ═══════════════════════════════════════════
  // GENERAL EVENT OPERATIONS (Admin)
  // ═══════════════════════════════════════════

  async getActiveEvents() {
    const data = await supabaseFetch(
      'general_events?is_active=eq.true&order=event_date.desc'
    );
    return data || [];
  },

  async getAllEvents() {
    const data = await supabaseFetch('general_events?order=created_at.desc');
    return data || [];
  },

  async createEvent(adminId, { name, description, eventDate }) {
    return supabaseFetch('general_events', {
      method: 'POST',
      body: {
        name,
        description,
        event_date: eventDate,
        created_by: adminId,
      },
      single: true,
    });
  },

  async updateEvent(eventId, updates) {
    return supabaseFetch(`general_events?id=eq.${eventId}`, {
      method: 'PATCH',
      body: updates,
      single: true,
    });
  },

  async deactivateEvent(eventId) {
    return this.updateEvent(eventId, { is_active: false });
  },

  // ═══════════════════════════════════════════
  // SUPERVISOR PANEL OPERATIONS
  // ═══════════════════════════════════════════

  async getSupervisorStudents(supervisorId) {
    return supabaseRpc('get_supervisor_students', {
      p_supervisor_id: supervisorId,
    });
  },

  async getSupervisorPendingLogs(supervisorId) {
    return supabaseRpc('get_supervisor_pending_logs', {
      p_supervisor_id: supervisorId,
    });
  },

  async supervisorApproveLog(logId) {
    return supabaseRpc('supervisor_approve_log', { p_log_id: logId });
  },

  async supervisorRejectLog(logId) {
    return supabaseRpc('supervisor_reject_log', { p_log_id: logId });
  },

  async getSupervisorSites(supervisorId) {
    const data = await supabaseFetch(
      `site_supervisors?supervisor_id=eq.${supervisorId}&select=*,sites(id,name,address,description)`
    );
    return (data || []).map(ss => ss.sites).filter(Boolean);
  },

  // ─── Email Notification (non-blocking, fire-and-forget) ───

  async notifySupervisor({ logId, studentName, siteName, description, durationMinutes, date }) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await fetch(`${supabaseUrl}/functions/v1/send-supervisor-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logId, studentName, siteName, description, durationMinutes, date }),
      });
    } catch (err) {
      // Non-blocking: don't throw, just log
      console.warn('Supervisor email notification failed:', err);
    }
  },

  // ─── Create Supervisor (via Edge Function, admin only) ───

  async createSupervisorAccount({ email, password, fullName, siteIds }) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const resp = await fetch(`${supabaseUrl}/functions/v1/create-supervisor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, fullName, siteIds }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    return resp.json();
  },
};
