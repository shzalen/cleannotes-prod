/**
 * Timestamp utilities for CleanNotes.
 *
 * Storage convention (TIMESTAMPTZ):
 *   All timestamps stored in Supabase use UTC ISO format with 'Z' suffix
 *   (e.g. 2026-07-01T04:34:00.000Z). This ensures PostgreSQL interprets
 *   them correctly regardless of client timezone.
 *
 * Display convention:
 *   Frontend displays use new Date(ts).getHours() which auto-converts
 *   UTC to local timezone. datetime-local inputs also work in local time.
 *
 * Legacy data note:
 *   Older records may contain timestamps without 'Z' suffix (local time
 *   masquerading as UTC). normalizeTimestamp() handles these during Supabase
 *   sync by converting them to proper UTC.
 */

/** Generate UTC ISO timestamp: 2026-07-01T04:34:00.000Z (standard JS toISOString) */
export function toUTCISO(date?: Date): string {
  return (date || new Date()).toISOString()
}

/** Generate local-time ISO-like string (NO timezone suffix) — for datetime-local inputs only.
 *  NOT for Supabase storage (use toUTCISO instead). */
export function toLocalISO(date?: Date): string {
  const d = date || new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const ms = d.getMilliseconds().toString().padStart(3, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
}

/** Generate local YYYY-MM-DD date string */
export function toLocalDate(date?: Date): string {
  const d = date || new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Normalize a timestamp string for Supabase TIMESTAMPTZ storage.
 *
 * - If the string already has 'Z' or timezone offset (+08:00 etc.), return as-is.
 * - If it has no timezone suffix (legacy toLocalISO format), treat it as LOCAL time
 *   and convert to UTC ISO with 'Z'. This fixes the old bug where local time was
 *   mistakenly stored as-if-UTC in PostgreSQL.
 */
export function normalizeTimestamp(ts: string | null): string | null {
  if (!ts) return null
  // Already has timezone info — safe for PG
  if (ts.endsWith('Z') || /[+\-]\d{2}:\d{2}$/.test(ts)) return ts
  // Legacy format (no timezone) — interpret as local time, convert to UTC
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts // can't parse, pass through
  return d.toISOString()
}
