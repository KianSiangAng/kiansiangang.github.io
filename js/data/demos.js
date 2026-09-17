/* ================================================================
   DEMOS.JS — What a demo is, declaratively

   A portfolio that says "I built a password analyser" is asking to
   be believed. A portfolio that runs it in front of you is not.
   This file is the registry of those runnable proofs.

   Every demo declares a `kind`, and the player for that kind knows
   how to present it. The kinds exist because the projects are
   genuinely different shapes, and flattening them all into video
   would have thrown away what is interesting about each:

     cast         a recorded terminal session, replayed as text.
                  Kilobytes rather than megabytes, sharp at any
                  zoom, selectable, and readable by a screen
                  reader — none of which a video of a terminal is.

     live         the tool itself, running in a sandboxed frame.
                  Strictly more convincing than a recording of it,
                  because the visitor can type their own input.

     walkthrough  captioned frames, for things that cannot be
                  re-run on demand — notably the 3D room, which a
                  phone never renders.

     video        a filmed screen recording. Nothing here uses it
                  yet; it is wired up so that a demo filmed later
                  drops in as data, with no new code.

   The registry is data, not markup, so the same entries drive the
   desktop app and the plain page without either one owning them.
================================================================ */

/** Where a demo's assets live. Relative so the site works from any path. */
const BASE = 'assets/demos/';

export const demos = [
  {
    slug: 'password-analyzer',
    project: 'password-analyzer',
    title: 'Password Analyzer',
    subtitle: 'Three passwords, one live breach database',
    kind: 'cast',
    icon: 'crt',
    src: `${BASE}password-analyzer.cast.json`,

    blurb:
      'A real session, recorded by running the tool against the live Have I Been '
      + 'Pwned API. Every number on screen came back from that API — the breach '
      + 'counts are not illustrations.',

    /* The point the demo is actually making. Worth stating, because a
       viewer watching three tables scroll past can easily miss it. */
    takeaway:
      'The middle case is the one to watch. "Summer2024!" passes every complexity '
      + 'rule a corporate password policy checks — upper, lower, digit, symbol, '
      + '72 bits of entropy — and HIBP still finds it in 3,614 breaches. Complexity '
      + 'rules measure the shape of a password. Only a breach corpus measures '
      + 'whether anyone has already guessed it.',

    notes: [
      'Input is hidden by getpass(), so the bullets are the demo\'s own annotation '
      + 'of the keystrokes going in. Everything else is program output, byte for byte.',
      'The password never leaves the machine: the tool sends the first five '
      + 'characters of its SHA-1 hash and searches the response locally. That is '
      + 'k-anonymity, and it is why a breach check does not require trusting me.',
    ],
  },

  {
    slug: 'suss-calendar-exporter',
    project: 'suss-calendar-exporter',
    title: 'SUSS Calendar Exporter',
    subtitle: 'Paste a timetable, get a calendar file',
    kind: 'live',
    icon: 'letter',
    src: `${BASE}suss-calendar-exporter/index.html`,
    provenance: `${BASE}suss-calendar-exporter/demo.json`,
    sample: `${BASE}suss-timetable-sample.txt`,
    upstream: 'https://github.com/KianSiangAng/suss-calendar-exporter',

    blurb:
      'Not a recording — the actual tool, running here. Paste your own timetable '
      + 'from SUSS e-services and it will produce a real .ics file, or press '
      + '"Run the demo" to watch it work on a sample timetable.',

    takeaway:
      'SUSS e-services can show you a timetable and cannot export one. This is '
      + 'about a hundred lines of parsing standing between that and a calendar '
      + 'that updates itself.',

    /* The guided run, as data. The player performs these against the
       live frame, so the demo exercises the same code path a visitor
       does — there is no separate "demo mode" that could drift. */
    script: [
      {
        caption: 'This is timetable text copied straight out of SUSS e-services — '
          + 'tab-separated, six lessons across three modules.',
        action: 'type', target: '#input', source: 'sample',
      },
      {
        caption: 'Parse it.',
        action: 'click', target: '#preview',
      },
      {
        caption: 'Six events, each with its venue, and the "[Lesson is recorded…]" '
          + 'boilerplate stripped out of the description.',
        action: 'reveal', target: '#previewPanel', hold: 2600,
      },
      {
        caption: 'The .ics is generated in the browser. Nothing is uploaded '
          + 'anywhere — there is no server in this project at all.',
        action: 'highlight', target: '#download', hold: 2200,
      },
      {
        caption: 'Pressing Download runs the real generator. Nothing is saved to '
          + 'your machine during the demo — the file is caught mid-flight instead.',
        action: 'generate', target: '#download', hold: 1200,
      },
      {
        caption: 'And here is that file, read back and drawn as a calendar. Press '
          + 'Download yourself and this is the term that lands in it.',
        action: 'calendar', hold: 3200,
      },
    ],

    notes: [
      'The guided run presses Download for real but stops the file reaching your '
      + 'disk: a demo has no business opening your file manager or leaving litter in '
      + 'Downloads. Everything up to the save is the tool\'s own code — the calendar '
      + 'below is built from the bytes it actually produced, not from a re-derivation '
      + 'of the input, so if the real download broke this would break with it. Press '
      + 'the button yourself and you get the file.',
      'Actually importing into Google Calendar would mean signing you in and writing '
      + 'to your account, which a portfolio has no business asking for. Rendering the '
      + 'file is the honest end of the flow; the import itself is two clicks in your '
      + 'own calendar settings.',
      'Vendored into this site so it keeps working offline and cannot break when '
      + 'the upstream repository moves. tools/vendor-demo.mjs does the copying and '
      + 'records which commit it took.',
      'The frame runs under its own content security policy: no network, no forms, '
      + 'no plugins. It could not phone home with your timetable if it wanted to.',
      'The tool also calls window.open on the blob as a fallback for browsers that '
      + 'ignore the download attribute. The frame has no allow-popups, so that is '
      + 'blocked — which is the sandbox doing its job, not a failure.',
    ],
  },
];

export const demoBySlug = new Map(demos.map((demo) => [demo.slug, demo]));

/** The demo attached to a project, if it has one. */
export function demoForProject(slug) {
  return demos.find((demo) => demo.project === slug) || null;
}
