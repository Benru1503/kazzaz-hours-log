import { supabaseFetch, supabaseRpc } from './supabase';

// ═══════════════════════════════════════════
// SHIFT LOGIC — Using raw fetch (never hangs)
// ═══════════════════════════════════════════

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

  // ─── Check In ───

  async checkIn(userId, category, taskDescription) {
    const existing = await this.getActiveShift(userId);
    if (existing) {
      throw new Error('כבר יש לך משמרת פעילה. צא מהמשמרת הנוכחית לפני שתתחיל חדשה.');
    }

    return supabaseFetch('shifts', {
      method: 'POST',
      body: {
        user_id: userId,
        category: category,
        task_description: taskDescription,
        start_time: new Date().toISOString(),
        status: 'active',
      },
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

  // ─── Manual Log: Submit ───

  async submitManualLog(userId, { date, durationMinutes, description, category }) {
    return supabaseFetch('manual_logs', {
      method: 'POST',
      body: {
        user_id: userId,
        date: date,
        duration_minutes: durationMinutes,
        description: description,
        category: category,
        status: 'pending',
      },
      single: true,
    });
  },

  // ─── Manual Log: Get User's Logs ───

  async getManualLogs(userId) {
    const data = await supabaseFetch(
      `manual_logs?user_id=eq.${userId}&order=created_at.desc`
    );
    return data || [];
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
      `manual_logs?status=eq.pending&select=*,profiles!manual_logs_user_id_fkey(full_name)&order=created_at.asc`
    );
    return (data || []).map(log => ({
      ...log,
      user_name: log.profiles?.full_name || 'לא ידוע',
    }));
  },
};