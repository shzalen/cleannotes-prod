/**
 * Shared utilities for AI chat API URL construction and HTML escaping.
 */

/**
 * Build a chat completions API URL from user-provided input.
 * Handles various formats: bare base URL, /v1, /chat/completions, etc.
 */
export function buildChatUrl(input: string): string {
  const url = input.trim()
  if (url.includes('/chat/completions')) return url
  const base = url.replace(/\/+$/, '')
  if (base.endsWith('/v1')) return base + '/chat/completions'
  return base + '/v1/chat/completions'
}

/**
 * Escape HTML special characters to prevent XSS.
 * Used when DOMPurify is not yet loaded or for safe text insertion.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Compute ISO 8601 week number for a date string (YYYY-MM-DD).
 * ISO 8601: Week 1 is the week containing the first Thursday of the year.
 * Weeks start on Monday.
 */
export function getISOWeekNumber(weekStart: string): number {
  const [y, m, d] = weekStart.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  // Move to the Thursday of this week (ISO week is determined by Thursday)
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  // First day of the ISO year (Monday of the week containing Jan 4)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  // Week number = 1 + floor((ordinal day - 1) / 7)
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
