import { supabase } from './supabase';

// ═══════════════════════════════════════════
// SHIFT LOGIC — All Supabase operations
// ═══════════════════════════════════════════

export const ShiftLogic = {

  // ─── Profile ───

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  // ─── Active Shift ───

  async getActiveShift(userId) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ─── Check In ───
  // Creates a new active shift. Enforces one active shift per user.

  async checkIn(userId, category, taskDescription) {
    const existing = await this.getActiveShift(userId);
    if (existing) {
      throw new Error('כבר יש לך משמרת פעילה. צא מהמשמרת הנוכחית לפני שתתחיל חדשה.');
    }

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        user_id: userId,
        category: category,
        task_description: taskDescription,
        start_time: new Date().toISOString(),
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ─── Check Out ───
  // Updates end_time; the DB trigger calculates duration_minutes and sets status='completed'.

  async checkOut(shiftId) {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ─── Get Completed Shifts ───

  async getShifts(userId) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // ─── Manual Log: Submit ───

  async submitManualLog(userId, { date, durationMinutes, description, category }) {
    const { data, error } = await supabase
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
      .single();

    if (error) throw error;
    return data;
  },

  // ─── Manual Log: Get User's Logs ───

  async getManualLogs(userId) {
    const { data, error } = await supabase
      .from('manual_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // ─── Progress Calculation ───
  // (Total completed shift minutes + approved manual log minutes) / goal

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

  // ─── Approve a manual log ───

  async approveLog(logId, adminId) {
    const { data, error } = await supabase
      .from('manual_logs')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ─── Reject a manual log ───

  async rejectLog(logId, adminId) {
    const { data, error } = await supabase
      .from('manual_logs')
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ─── Get all students summary (calls the DB function) ───

  async getAllStudentsSummary() {
    const { data, error } = await supabase.rpc('get_all_students_summary');
    if (error) throw error;
    return data || [];
  },

  // ─── Get all pending manual logs with student names ───

  async getAllPendingLogs() {
    const { data, error } = await supabase
      .from('manual_logs')
      .select(`
        *,
        profiles!manual_logs_user_id_fkey ( full_name )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(log => ({
      ...log,
      user_name: log.profiles?.full_name || 'לא ידוע',
    }));
  },
};
