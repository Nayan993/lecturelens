import { describe, expect, it } from 'vitest';
import { formatDuration, formatTimestamp, parseTimeParam } from './formatTime';

describe('formatTimestamp', () => {
  it('formats minutes and seconds, truncating fractions', () => {
    expect(formatTimestamp(612.34)).toBe('10:12');
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(59.999)).toBe('0:59');
  });

  it('adds hours at or above one hour', () => {
    expect(formatTimestamp(3600)).toBe('1:00:00');
    expect(formatTimestamp(4212)).toBe('1:10:12');
  });

  it('clamps invalid input to 0:00', () => {
    expect(formatTimestamp(-3)).toBe('0:00');
    expect(formatTimestamp(Number.NaN)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('formats whole minutes', () => {
    expect(formatDuration(1234)).toBe('20 min');
    expect(formatDuration(1199.398)).toBe('19 min');
  });

  it('formats hours', () => {
    expect(formatDuration(4212)).toBe('1 h 10 min');
    expect(formatDuration(7200)).toBe('2 h');
  });

  it('handles sub-minute and invalid input', () => {
    expect(formatDuration(42)).toBe('< 1 min');
    expect(formatDuration(Number.NaN)).toBe('< 1 min');
  });
});

describe('parseTimeParam', () => {
  it('parses float seconds', () => {
    expect(parseTimeParam('612.34')).toBe(612.34);
    expect(parseTimeParam('0')).toBe(0);
    expect(parseTimeParam(' 357.43 ')).toBe(357.43);
    expect(parseTimeParam('1.23456')).toBe(1.235);
  });

  it('rejects anything that is not plain decimal seconds', () => {
    for (const bad of [null, '', '10:12', '-5', '1e3', 'abc', '0x10', '12.']) {
      expect(parseTimeParam(bad)).toBeNull();
    }
  });
});
