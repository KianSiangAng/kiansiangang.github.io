/* ================================================================
   ICS.JS — Reading back what the exporter just produced

   The Calendar Exporter's whole job is to turn pasted text into a
   .ics file. A demo that stops at "a file was downloaded" stops one
   step short of the point: nobody wants a .ics, they want the
   lessons to appear in their calendar.

   Importing into Google Calendar for real would mean signing the
   visitor in and writing to their account, which is not something a
   portfolio should ask for. So this does the honest equivalent: it
   parses the actual generated file — the same bytes the download
   produced, not a re-derivation from the input — and draws it as a
   calendar. What you see is what the file says.

   The parser is deliberately small. RFC 5545 is enormous; this
   handles the subset the exporter emits, and says so rather than
   pretending to be a general implementation.
================================================================ */

import { el } from '../os/dom.js';

/* ----------------------------------------------------------------
   Parsing
---------------------------------------------------------------- */

/** RFC 5545 folds long lines by inserting CRLF + one space. Undo that first. */
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

/** "\," "\;" "\n" "\\" are the four escapes the spec defines for text values. */
function unescapeText(value) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Parse a local date-time: 20260113T190000.
 * Deliberately built with the local Date constructor rather than
 * Date.parse, so the wall-clock time in the file is the wall-clock
 * time displayed. The file's TZID is shown as a label instead of
 * being converted — converting would mean showing a visitor in
 * London times that are not what their calendar will show them.
 */
function parseDateTime(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh = '0', mm = '0', ss = '0'] = m;
  return new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
}

export function parseICS(text) {
  const lines = unfold(text).split('\n');
  const events = [];
  let current = null;
  let tzid = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') { if (current) events.push(current); current = null; continue; }

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const rawKey = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [key, ...params] = rawKey.split(';');

    if (!current) {
      // Outside a VEVENT the only thing worth keeping is the timezone.
      if (key === 'TZID' && !tzid) tzid = value;
      continue;
    }

    const tzParam = params.find((p) => p.startsWith('TZID='));
    switch (key) {
      case 'DTSTART': current.start = parseDateTime(value); if (tzParam) current.tzid = tzParam.slice(5); break;
      case 'DTEND': current.end = parseDateTime(value); break;
      case 'SUMMARY': current.summary = unescapeText(value); break;
      case 'LOCATION': current.location = unescapeText(value); break;
      case 'DESCRIPTION': current.description = unescapeText(value); break;
      case 'UID': current.uid = value; break;
      default: break;
    }
  }

  events.sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0));
  return { events, tzid };
}

/* ----------------------------------------------------------------
   Rendering
---------------------------------------------------------------- */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * A month grid with the events dropped onto their days.
 *
 * A month rather than a week because the exporter's whole selling
 * point is that a term's worth of lessons lands in one go — a week
 * view would show a third of them and undersell it.
 */
export function createCalendarPreview({ events, tzid, filename, bytes }) {
  if (!events.length) {
    return el('div.ics__empty', { text: 'The generated file contained no events.' });
  }

  // The month the timetable starts in. Enough for the sample; if a
  // file spans months, the extra ones are listed underneath.
  const first = events[0].start;
  const year = first.getFullYear();
  const month = first.getMonth();

  const byDay = new Map();
  for (const event of events) {
    const k = key(event.start);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(event);
  }

  /* Monday-first, because this is a Singapore university timetable
     and a week that starts on Sunday would look wrong to everyone
     it is for. */
  const firstOfMonth = new Date(year, month, 1);
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid = el('div.ics__grid', { role: 'grid', 'aria-label': `${MONTH_NAMES[month]} ${year}` });
  for (const name of DAY_NAMES) {
    grid.appendChild(el('div.ics__dayname', { role: 'columnheader', text: name }));
  }
  for (let i = 0; i < offset; i += 1) {
    grid.appendChild(el('div.ics__cell.is-empty', { role: 'gridcell' }));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dayEvents = byDay.get(key(date)) || [];
    grid.appendChild(el('div.ics__cell', {
      role: 'gridcell',
      dataset: dayEvents.length ? { has: 'true' } : {},
    }, [
      el('span.ics__daynum', { text: String(day) }),
      ...dayEvents.map((event) => el('span.ics__chip', {
        title: [event.summary, event.location, `${hhmm(event.start)}–${hhmm(event.end)}`]
          .filter(Boolean).join('\n'),
      }, [
        el('strong', { text: event.summary || 'Event' }),
        el('span.ics__chip-time', { text: `${hhmm(event.start)}–${hhmm(event.end)}` }),
      ])),
    ]));
  }

  const outside = events.filter((e) => e.start.getMonth() !== month || e.start.getFullYear() !== year);

  return el('div.ics', {}, [
    el('div.ics__head', {}, [
      el('h4.ics__month', { text: `${MONTH_NAMES[month]} ${year}` }),
      el('span.ics__file', {
        text: `${filename || 'timetable.ics'} · ${events.length} event${events.length === 1 ? '' : 's'}`
          + (bytes ? ` · ${bytes.toLocaleString()} bytes` : '')
          + (tzid ? ` · ${tzid}` : ''),
      }),
    ]),
    grid,
    outside.length
      ? el('p.ics__outside', {
          text: `${outside.length} further event${outside.length === 1 ? '' : 's'} fall outside `
            + `${MONTH_NAMES[month]} and are in the file too.`,
        })
      : null,
    el('p.ics__note', {
      text: 'Drawn from the bytes the download just produced, not from the input — '
        + 'this is the file being read back. To get it into your own calendar: Google '
        + 'Calendar → Settings → Import & export, or in Apple Calendar, File → Import.',
    }),
  ]);
}
