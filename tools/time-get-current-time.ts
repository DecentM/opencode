/**
 * Get current time in a specific IANA timezone.
 * Returns formatted datetime, weekday, UTC offset, and ISO timestamp.
 */

import { tool } from '@opencode-ai/plugin'

// =============================================================================
// Helpers
// =============================================================================

const isValidTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// =============================================================================
// Main Tool
// =============================================================================

export default tool({
  description: `Get the current time in a specific IANA timezone.

Returns the current date and time, weekday, UTC offset, and ISO timestamp
formatted for the given timezone.

Examples of IANA timezone names:
- "America/New_York", "Europe/London", "Asia/Tokyo", "UTC"`,
  args: {
    timezone: tool.schema
      .string()
      .describe('IANA timezone name (e.g., "America/New_York", "Europe/London", "UTC")'),
  },
  async execute(args) {
    const { timezone = 'UTC' } = args

    if (!isValidTimezone(timezone)) {
      return `Error: Invalid timezone "${timezone}". Use a valid IANA timezone name (e.g., "America/New_York", "UTC").`
    }

    const now = new Date()

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long',
      timeZoneName: 'longOffset',
    })

    const parts = formatter.formatToParts(now)
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((p) => p.type === type)?.value ?? ''

    const datetime = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`

    return [
      `Timezone: ${timezone}`,
      `DateTime: ${datetime}`,
      `Weekday:  ${get('weekday')}`,
      `Offset:   ${get('timeZoneName')}`,
      `ISO:      ${now.toISOString()}`,
    ].join('\n')
  },
})
