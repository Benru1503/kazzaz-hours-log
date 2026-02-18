import { supabase } from './supabase';

// ─── Timeout helper: kills any Supabase request after 8 seconds ───
function withTimeout(ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// Helper to run a supabase query with a timeout
async function query(buildQuery) {
  const { signal, clear } = withTimeout();
  try {
    const result = await buildQuery(signal);
    clear();
    if (result.error) throw result.error;
    return result.data;
  } catch (err) {
    clear();
    if (err.name === 'AbortError') {
      throw new Error('הבקשה נכשלה — נסה שוב');
    }
    throw err;
  }
}

// ═══════════════════════════════════════════
// SHIFT LOGIC — All Supabase operations
// ═══════════════════════════════════════════

export const ShiftLogic = {

  // ─── Profile ───

  async getProfile(userId) {
    return query((signal) =>
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .abortSignal(signal)
    );
  },

  // ─── Active Shift ───

  async getActiveShift(userId) {
    const { signal, clear } = withTimeout();
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
        .abortSignal(signal);
      clear();
      if (error) throw error;
      return data; // can be null
    } catch (err) {
      clear();
      if (err.name === 'AbortError') throw new Error('הבקשה נכשלה — נסה שוב');
      throw err;
    }
  },

  // ─── Check In ───

  async checkIn(userId, category, taskDescription) {
    const existing = await this.getActiveShift(userId);
    if (existing) {
      throw new Error('כבר יש לך משמרת פעילה. צא מהמשמרת הנוכחית לפני שתתחיל חדשה.');
    }

    return query((signal) =>
      supabase
        .from('shifts')
        .insert({
          user_id: userId,
          category: category,
          task_description: taskDescription,
          start_time: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single()
        .abortSignal(signal)
    );
  },

  // ─── Check Out ───

  async checkOut(shiftId) {
    return query((signal) =>
      supabase
        .from('shifts')
        .update({ end_time: new Date().toISOString() })
        .eq('id', shiftId)
        .select()
        .single()
        .abortSignal(signal)
    );
  },

  // ─── Get Completed Shifts ───

  async getShifts(userId) {
    const data = await query((signal) =>
      supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .abortSignal(signal)
    );
    return data || [];
  },

  // ─── Manual Log: Submit ───

  async submitManualLog(userId, { date, durationMinutes, description, category }) {
    return query((signal) =>
      supabase
        .from('manual_logs')
        .insert({
          user_id: userId,
          date: date,
          duration_minutes: durationMinutes,
          description: description,
          category: category,
          status: 'pending',
        })
        .select()
        .single()
        .abortSignal(signal)
    );
  },

  // ─── Manual Log: Get User's Logs ───

  async getManualLogs(userId) {
    const data = await query((signal) =>
      supabase
        .from('manual_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .abortSignal(signal)
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
    return query((signal) =>
      supabase
        .from('manual_logs')
        .update({
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', logId)
        .select()
        .single()
        .abortSignal(signal)
    );
  },

  async rejectLog(logId, adminId) {
    return query((signal) =>
      supabase
        .from('manual_logs')
        .update({
          status: 'rejected',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', logId)
        .select()
        .single()
        .abortSignal(signal)
    );
  },

  async getAllStudentsSummary() {
    const { signal, clear } = withTimeout();
    try {
      const { data, error } = await supabase
        .rpc('get_all_students_summary')
        .abortSignal(signal);
      clear();
      if (error) throw error;
      return data || [];
    } catch (err) {
      clear();
      if (err.name === 'AbortError') throw new Error('הבקשה נכשלה — נסה שוב');
      throw err;
    }
  },

  async getAllPendingLogs() {
    const { signal, clear } = withTimeout();
    try {
      const { data, error } = await supabase
        .from('manual_logs')
        .select(`
          *,
          profiles!manual_logs_user_id_fkey ( full_name )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .abortSignal(signal);
      clear();
      if (error) throw error;
      return (data || []).map(log => ({
        ...log,
        user_name: log.profiles?.full_name || 'לא ידוע',
      }));
    } catch (err) {
      clear();
      if (err.name === 'AbortError') throw new Error('הבקשה נכשלה — נסה שוב');
      throw err;
    }
  },
};