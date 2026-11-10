import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';

import type { Money } from '../gen/subastacampo/v1/common_pb';

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

const TIME = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

/** Colombian pesos, from the contract's int64 amount (a bigint: never loses precision). */
export function formatCop(value: Money | bigint | undefined): string {
  if (value === undefined) return '—';
  return COP.format(typeof value === 'bigint' ? value : value.units);
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

export function toMillis(timestamp: Timestamp | undefined): number {
  return timestamp ? timestampDate(timestamp).getTime() : 0;
}

export function formatTime(timestamp: Timestamp | undefined): string {
  return timestamp ? TIME.format(timestampDate(timestamp)) : '';
}

/** "2 h 05 min", "4:07", "0:09": compact and readable on a small screen. */
export function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' });

/** "7 de noviembre", from a contract date (YYYY-MM-DD) read in local time. */
export function formatDay(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return year && month && day ? DAY.format(new Date(year, month - 1, day)) : isoDate;
}

const SHORT_DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

/** "3 nov.", from a contract timestamp. */
export function formatShortDate(timestamp: Timestamp | undefined): string {
  return timestamp ? SHORT_DATE.format(timestampDate(timestamp)) : '';
}

/** Today's date as YYYY-MM-DD in the user's own time zone (not UTC). */
export function localIsoDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Rounds a peso amount to the nearest multiple of `step`, never below `step`. */
export function roundPesos(value: bigint, step = 100n): bigint {
  const rounded = ((value + step / 2n) / step) * step;
  return rounded < step ? step : rounded;
}

/** Whole pesos typed by the user ("1.250.000", "$ 1250000"), or null if invalid. */
export function parsePesos(text: string): bigint | null {
  const digits = text.replace(/[.\s$]/g, '');
  return /^\d{1,13}$/.test(digits) ? BigInt(digits) : null;
}
