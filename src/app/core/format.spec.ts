import { formatCop, formatDay, formatRemaining, parsePesos, roundPesos } from './format';

describe('format', () => {
  it('formats Colombian pesos without decimals', () => {
    expect(formatCop(1_250_000n).replace(/\s/g, ' ')).toMatch(/\$ ?1\.250\.000/);
  });

  it('keeps large amounts exact (bigint, not floating point)', () => {
    expect(formatCop(9_007_199_254_740_993n)).toContain('9.007.199.254.740.993');
  });

  it('shows a compact countdown', () => {
    expect(formatRemaining(9_000)).toBe('0:09');
    expect(formatRemaining(247_000)).toBe('4:07');
    expect(formatRemaining(2 * 3600_000 + 5 * 60_000)).toBe('2 h 05 min');
    expect(formatRemaining(-5)).toBe('0:00');
  });

  it('parses amounts as the user types them', () => {
    expect(parsePesos('1.250.000')).toBe(1_250_000n);
    expect(parsePesos('$ 500000')).toBe(500_000n);
    expect(parsePesos('12,5')).toBeNull();
    expect(parsePesos('')).toBeNull();
  });

  it('rounds increments to whole hundreds', () => {
    expect(roundPesos(14_163n)).toBe(14_200n);
    expect(roundPesos(20n)).toBe(100n);
  });

  it('reads contract dates in local time, never shifting the day', () => {
    expect(formatDay('2026-11-07')).toBe('7 de noviembre');
  });
});
