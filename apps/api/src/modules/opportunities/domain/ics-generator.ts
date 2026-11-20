/**
 * RFC 5545 iCalendar (.ics) generator for Deadline Radar exports.
 */

export interface CalendarDeadlineItem {
  id: string;
  title: string;
  description: string;
  deadlineAt: Date;
  url?: string;
}

function formatIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function generateDeadlinesIcs(items: readonly CalendarDeadlineItem[]): string {
  const nowStamp = formatIcsUtc(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jonoshheba AI//Deadline Radar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Jonoshheba AI Deadlines',
    'X-WR-TIMEZONE:Asia/Dhaka',
  ];

  for (const item of items) {
    const start = formatIcsUtc(item.deadlineAt);
    const end = formatIcsUtc(new Date(item.deadlineAt.getTime() + 60 * 60 * 1000));
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.id}@jonoshheba.app`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(item.description)}`);
    if (item.url) {
      lines.push(`URL:${item.url}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
