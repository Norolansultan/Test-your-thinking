/**
 * SPEC/28 §3: CoT times from virtual time only (I2). The incident day is Friday 26 July 2030, Finnish
 * summer time (UTC+3). Virtual time 0 is 13:20 local, the start of step 1 (`app/scenario/views.ts`),
 * so 13:20 local = 2030-07-26T10:20:00.000Z and 13:00 local (virtual −1200, step W5) = 10:00:00.000Z.
 *
 * Pure integer arithmetic (the civil-date algorithms of H. Hinnant, public domain): no `Date` object,
 * no wall clock, no locale, so the same virtual time gives the same string on every machine (I1).
 */

/** The incident day, local (Finnish summer time). */
export const INCIDENT_DATE = { year: 2030, month: 7, day: 26 } as const;
/** Finnish summer time (EEST) is UTC+3. */
export const UTC_OFFSET_HOURS = 3;
/** Virtual time 0 is 13:20 local (`app/scenario/views.ts`: the start of step 1). */
export const VIRTUAL_ZERO_LOCAL_MINUTES = 13 * 60 + 20;

const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 of a proleptic Gregorian date. */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** The proleptic Gregorian date of a day count since 1970-01-01. */
export function civilFromDays(days: number): { readonly year: number; readonly month: number; readonly day: number } {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** UTC milliseconds since the epoch of virtual time 0 (2030-07-26T10:20:00.000Z). */
export const VIRTUAL_ZERO_UTC_MS =
  daysFromCivil(INCIDENT_DATE.year, INCIDENT_DATE.month, INCIDENT_DATE.day) * MS_PER_DAY +
  (VIRTUAL_ZERO_LOCAL_MINUTES - UTC_OFFSET_HOURS * 60) * 60_000;

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** UTC milliseconds since the epoch → `YYYY-MM-DDTHH:MM:SS.mmmZ`. Integer milliseconds only. */
export function isoOfUtcMs(ms: number): string {
  if (!Number.isInteger(ms)) throw new RangeError(`isoOfUtcMs: ${ms} is not an integer number of milliseconds`);
  const days = Math.floor(ms / MS_PER_DAY);
  const inDay = ms - days * MS_PER_DAY;
  const { year, month, day } = civilFromDays(days);
  if (year < 0 || year > 9999) throw new RangeError(`isoOfUtcMs: year ${year} out of range`);
  const h = Math.floor(inDay / 3_600_000);
  const m = Math.floor((inDay % 3_600_000) / 60_000);
  const s = Math.floor((inDay % 60_000) / 1000);
  const milli = inDay % 1000;
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(milli, 3)}Z`;
}

const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

/** `YYYY-MM-DDTHH:MM:SS[.mmm]Z` → UTC milliseconds since the epoch. Strict: UTC (`Z`) only. */
export function utcMsOfIso(iso: string): number {
  const m = ISO_UTC.exec(iso);
  if (!m) throw new SyntaxError(`not an ISO-8601 UTC timestamp: ${JSON.stringify(iso)}`);
  const [year, month, day, h, min, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number) as [number, number, number, number, number, number];
  const milli = m[7] === undefined ? 0 : Number(m[7].padEnd(3, "0"));
  if (month < 1 || month > 12 || day < 1 || day > 31 || h > 23 || min > 59 || s > 59) throw new RangeError(`ISO timestamp out of range: ${iso}`);
  const days = daysFromCivil(year, month, day);
  const back = civilFromDays(days);
  if (back.year !== year || back.month !== month || back.day !== day) throw new RangeError(`no such date: ${iso}`);
  return days * MS_PER_DAY + ((h * 60 + min) * 60 + s) * 1000 + milli;
}

/**
 * Virtual time (seconds from 13:20 local on the incident day) → ISO-8601 UTC with milliseconds.
 * `isoOfVirtual(0)` = `2030-07-26T10:20:00.000Z`; `isoOfVirtual(-1200)` (13:00 local) = `2030-07-26T10:00:00.000Z`.
 * Sub-millisecond fractions are rounded to the millisecond.
 */
export function isoOfVirtual(virtualSeconds: number): string {
  if (!Number.isFinite(virtualSeconds)) throw new RangeError(`isoOfVirtual: ${virtualSeconds} is not finite`);
  return isoOfUtcMs(VIRTUAL_ZERO_UTC_MS + Math.round(virtualSeconds * 1000));
}

/** Inverse of {@link isoOfVirtual}: an ISO-8601 UTC timestamp → virtual seconds (may be fractional). */
export function virtualOfIso(iso: string): number {
  return (utcMsOfIso(iso) - VIRTUAL_ZERO_UTC_MS) / 1000;
}
