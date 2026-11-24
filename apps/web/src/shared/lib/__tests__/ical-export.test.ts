import { buildIcs, escapeIcsText, foldIcsLine } from '../ical-export'

describe('buildIcs', () => {
  it('writes one UTC event per appointment with escaped text', () => {
    const ics = buildIcs(
      [
        {
          id: 'b1',
          start: '2026-12-01T15:00:00.000Z',
          end: '2026-12-01T16:00:00.000Z',
          summary: 'Cut, line-up; beard',
          description: 'Line one\nLine two',
          location: 'Chicago, IL',
        },
      ],
      new Date('2026-11-21T12:00:00.000Z')
    )
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('UID:b1@talii')
    expect(lines).toContain('DTSTART:20261201T150000Z')
    expect(lines).toContain('DTEND:20261201T160000Z')
    expect(lines).toContain('DTSTAMP:20261121T120000Z')
    expect(lines).toContain('SUMMARY:Cut\\, line-up\\; beard')
    expect(lines).toContain('DESCRIPTION:Line one\\nLine two')
    expect(lines).toContain('LOCATION:Chicago\\, IL')
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR')
    expect(ics).not.toMatch(/bocm/i)
  })

  it('escapes backslashes first', () => {
    expect(escapeIcsText('a\\b')).toBe('a\\\\b')
  })

  it('folds lines longer than 75 octets', () => {
    const line = 'DESCRIPTION:' + 'é'.repeat(60)
    const folded = foldIcsLine(line).split('\r\n')
    expect(folded.length).toBeGreaterThan(1)
    for (const part of folded) expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75)
    expect(folded.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    expect(folded.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line)
  })
})
