/**
 * Convert a time (HH:MM) from one IANA timezone to another.
 * Returns formatted source and target time info.
 */

import { tool } from '@opencode-ai/plugin'

// =============================================================================
// Constants
// =============================================================================

const MINUTES_PER_HOUR = 60
const MS_PER_MINUTE = 60 * 1000
const MAX_HOURS = 23
const MAX_MINUTES = 59

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
  description: `Convert a time from one IANA timezone to another.

Takes a time in HH:MM format (24-hour) and converts it between the specified
timezones. Uses today's date as the reference for offset calculations.

Examples:
- Convert 14:30 from New York to London
- Convert 09:00 from UTC to Tokyo`,
  args: {
    source_timezone: tool.schema
      .string()
      .describe('Source IANA timezone name (e.g., "America/New_York")'),
    time: tool.schema.string().describe('Time in HH:MM format (24-hour)'),
    target_timezone: tool.schema
      .string()
      .describe('Target IANA timezone name (e.g., "Europe/London")'),
  },
  async execute(args) {
    const { source_timezone, time, target_timezone } = args

    if (!isValidTimezone(source_timezone)) {
      return `Error: Invalid source timezone "${source_timezone}". Use a valid IANA timezone name.`
    }

    if (!isValidTimezone(target_timezone)) {
      return `Error: Invalid target timezone "${target_timezone}". Use a valid IANA timezone name.`
    }

    const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/)
    if (!timeMatch) {
      return `Error: Invalid time format "${time}". Use HH:MM format (24-hour).`
    }

    const hours = Number.parseInt(timeMatch[1], 10)
    const minutes = Number.parseInt(timeMatch[2], 10)

    if (hours < 0 || hours > MAX_HOURS || minutes < 0 || minutes > MAX_MINUTES) {
      return `Error: Invalid time value "${time}". Hours must be 0-23, minutes must be 0-59.`
    }

    // Build a date in the source timezone by finding the UTC offset
    // Use today's date as the reference
    const now = new Date()
    const refDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0)
    )

    // Get the offset of the source timezone at this reference point
    const sourceFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: source_timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })

    const sourceParts = sourceFormatter.formatToParts(refDate)
    const sourceHour = Number.parseInt(sourceParts.find((p) => p.type === 'hour')?.value ?? '0', 10)
    const sourceMinute = Number.parseInt(
      sourceParts.find((p) => p.type === 'minute')?.value ?? '0',
      10
    )

    // Calculate the difference between what we wanted and what the source tz shows
    const wantedMinutes = hours * MINUTES_PER_HOUR + minutes
    const gotMinutes = sourceHour * MINUTES_PER_HOUR + sourceMinute
    const diffMinutes = wantedMinutes - gotMinutes

    // Adjust the reference date so that the source timezone reads the desired time
    const adjusted = new Date(refDate.getTime() + diffMinutes * MS_PER_MINUTE)

    // Now format in the target timezone
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: target_timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZoneName: 'longOffset',
    })

    const targetParts = targetFormatter.formatToParts(adjusted)
    const tget = (type: Intl.DateTimeFormatPartTypes): string =>
      targetParts.find((p) => p.type === type)?.value ?? ''

    const sourceOffsetFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: source_timezone,
      timeZoneName: 'longOffset',
    })
    const sourceOffset =
      sourceOffsetFmt.formatToParts(adjusted).find((p) => p.type === 'timeZoneName')?.value ?? ''

    const sourceTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    const targetTime = `${tget('hour')}:${tget('minute')}`
    const targetDatetime = `${tget('year')}-${tget('month')}-${tget('day')} ${tget('hour')}:${tget('minute')}:${tget('second')}`

    return [
      `Source: ${source_timezone}`,
      `  Time:   ${sourceTime}`,
      `  Offset: ${sourceOffset}`,
      '',
      `Target: ${target_timezone}`,
      `  Time:     ${targetTime}`,
      `  DateTime: ${targetDatetime}`,
      `  Offset:   ${tget('timeZoneName')}`,
    ].join('\n')
  },
})
