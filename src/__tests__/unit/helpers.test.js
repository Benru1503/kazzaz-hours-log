import { describe, it, expect } from 'vitest';

// ─── Re-implement helpers from Dashboard.jsx for isolated testing ───
// In a real refactor, extract these to src/lib/helpers.js

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const fmtDur = (m) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (h > 0 && r > 0) return `${h} שעות ו-${r} דק'`;
  if (h > 0) return `${h} שעות`;
  return `${r} דקות`;
};

const pColor = (p) =>
  p >= 100 ? '#10b981' : p >= 60 ? '#06b6d4' : p >= 30 ? '#3b82f6' : '#8b5cf6';

// ═══════════════════════════════════════════
// fmtDate — Hebrew date formatting
// ═══════════════════════════════════════════
describe('fmtDate', () => {
  it('formats an ISO date string to Hebrew locale', () => {
    const result = fmtDate('2026-02-17T08:00:00Z');
    // Should contain the year and day
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/17/);
  });

  it('handles date-only strings', () => {
    const result = fmtDate('2026-01-01');
    expect(result).toMatch(/2026/);
  });

  it('handles Date objects', () => {
    const result = fmtDate(new Date('2026-06-15'));
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/15/);
  });
});

// ═══════════════════════════════════════════
// fmtTime — Hebrew time formatting
// ═══════════════════════════════════════════
describe('fmtTime', () => {
  it('formats time in HH:MM format', () => {
    const result = fmtTime('2026-02-17T14:30:00Z');
    // Time zone dependent, but should contain digits and colon
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('handles midnight', () => {
    const result = fmtTime('2026-02-17T00:00:00Z');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

// ═══════════════════════════════════════════
// fmtDur — Duration formatting (minutes → Hebrew)
// ═══════════════════════════════════════════
describe('fmtDur', () => {
  it('formats minutes only', () => {
    expect(fmtDur(30)).toBe('30 דקות');
  });

  it('formats hours only (exact)', () => {
    expect(fmtDur(120)).toBe('2 שעות');
  });

  it('formats hours and minutes', () => {
    expect(fmtDur(150)).toBe("2 שעות ו-30 דק'");
  });

  it('handles 1 hour exactly', () => {
    expect(fmtDur(60)).toBe('1 שעות');
  });

  it('handles 0 minutes', () => {
    expect(fmtDur(0)).toBe('0 דקות');
  });

  it('handles large durations', () => {
    expect(fmtDur(600)).toBe('10 שעות');
  });

  it('rounds partial minutes', () => {
    const result = fmtDur(91.7);
    expect(result).toBe("1 שעות ו-32 דק'");
  });

  it('handles fractional minutes under 60', () => {
    expect(fmtDur(3.28)).toBe('3 דקות');
  });
});

// ═══════════════════════════════════════════
// pColor — Progress color thresholds
// ═══════════════════════════════════════════
describe('pColor', () => {
  it('returns purple (#8b5cf6) below 30%', () => {
    expect(pColor(0)).toBe('#8b5cf6');
    expect(pColor(15)).toBe('#8b5cf6');
    expect(pColor(29)).toBe('#8b5cf6');
  });

  it('returns blue (#3b82f6) at 30-59%', () => {
    expect(pColor(30)).toBe('#3b82f6');
    expect(pColor(45)).toBe('#3b82f6');
    expect(pColor(59)).toBe('#3b82f6');
  });

  it('returns cyan (#06b6d4) at 60-99%', () => {
    expect(pColor(60)).toBe('#06b6d4');
    expect(pColor(80)).toBe('#06b6d4');
    expect(pColor(99)).toBe('#06b6d4');
  });

  it('returns green (#10b981) at 100%', () => {
    expect(pColor(100)).toBe('#10b981');
  });

  it('returns green above 100%', () => {
    expect(pColor(150)).toBe('#10b981');
  });
});
