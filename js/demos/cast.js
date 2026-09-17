/* ================================================================
   CAST.JS — Replaying a recorded terminal session

   A screen recording of a terminal is one of the worse ways to
   show a terminal. It is megabytes to say what a few kilobytes of
   text would; it blurs the moment anyone zooms; the words in it
   cannot be selected, searched, translated, or read aloud; and it
   locks the colours to whatever theme the machine had that day.

   So this replays the text instead. The recording is a list of
   timestamped chunks of real program output, ANSI and all, and
   this module does three things with it:

     1. parses the ANSI colour codes into styled spans, so the
        palette re-themes with the rest of the site;
     2. flattens the recording into a single timeline, so that
        scrubbing to any point is a synchronous re-render rather
        than a simulation that has to be replayed from the start;
     3. keeps a plain-text transcript one button away, because an
        animation that only exists as motion is not readable.

   The recording format is our own, and deliberately small:

     { cols, shell, events: [ { t, kind, text }, ... ] }

     kind "out"      program output, may contain ANSI
     kind "prompt"   a command the operator typed
     kind "masked"   keystrokes the program hid (getpass)
     kind "caption"  narration, shown beside the screen
================================================================ */

import { el, clear } from '../os/dom.js';

/* ----------------------------------------------------------------
   ANSI

   Only SGR (the "…m" sequences) is supported, because that is all
   a program printing a table and some colour ever emits. Anything
   else — cursor moves, erases — is dropped rather than mangled.
---------------------------------------------------------------- */

const SGR_CLASS = {
  1: 'is-bold',
  30: 'fg-black', 31: 'fg-red', 32: 'fg-green', 33: 'fg-yellow',
  34: 'fg-blue', 35: 'fg-magenta', 36: 'fg-cyan', 37: 'fg-white',
  90: 'fg-grey', 91: 'fg-red', 92: 'fg-green', 93: 'fg-yellow',
  94: 'fg-blue', 95: 'fg-magenta', 96: 'fg-cyan', 97: 'fg-white',
};

const ESCAPE = /\x1b\[([0-9;]*)m|\x1b\[[0-9;?]*[A-Za-z]/g;

/**
 * Split text carrying ANSI into [{ text, classes }].
 * `state` is carried across calls so a colour opened in one chunk
 * survives into the next — which it does constantly, because the
 * recorder captured whatever the pty happened to flush.
 */
function parseAnsi(text, state) {
  const runs = [];
  let last = 0;
  let match;

  ESCAPE.lastIndex = 0;
  while ((match = ESCAPE.exec(text))) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index), classes: [...state.classes] });
    last = match.index + match[0].length;

    // A non-SGR sequence matched: swallow it, leave styling alone.
    if (match[1] === undefined) continue;

    for (const raw of (match[1] || '0').split(';')) {
      const code = Number(raw || 0);
      if (code === 0) state.classes = [];
      else if (SGR_CLASS[code] && !state.classes.includes(SGR_CLASS[code])) {
        // One foreground at a time, or colours stack and the last wins invisibly.
        if (code !== 1) state.classes = state.classes.filter((c) => !c.startsWith('fg-'));
        state.classes.push(SGR_CLASS[code]);
      }
    }
  }
  if (last < text.length) runs.push({ text: text.slice(last), classes: [...state.classes] });
  return runs;
}

/* ----------------------------------------------------------------
   Flattening

   Typing looks like typing because the prompt and the masked input
   are expanded into one chunk per character. Doing it here rather
   than with a timer during playback is what makes seeking cheap:
   every frame of the session is just "all chunks up to i".

   The subtlety is that expansion takes TIME the recording did not
   budget for. The recorder stamped the program's first output a
   few hundred milliseconds after the prompt, because that is when
   the program really spoke — but spelling out "python analyzer.py"
   at a readable speed takes most of a second. Expanding in place
   therefore interleaves the two, and the screen reads

     kian@portfolio:~$ pEnter password to analyze: ython analy•z•e•r•

   which is not a terminal. So expansion also SHIFTS: every chunk
   after an expanded one moves later by exactly the time the typing
   consumed. Relative gaps in the real output are preserved; only
   the typed passages get the room they need.
---------------------------------------------------------------- */

const TYPE_MS = 52;
const TYPE_S = TYPE_MS / 1000;

function flatten(cast) {
  const chunks = [];
  const captions = [];
  const state = { classes: [] };
  const shell = cast.shell || '$ ';

  /* Accumulated time added by expanding typed passages. Everything
     stamped after an expansion is pushed back by this much. */
  let shift = 0;

  for (const event of cast.events) {
    const at = event.t + shift;

    if (event.kind === 'caption') {
      captions.push({ t: at, text: event.text });
      continue;
    }

    if (event.kind === 'prompt') {
      chunks.push({ t: at, text: shell, classes: ['cast-shell'] });
      const text = event.text || '';
      for (let i = 0; i < text.length; i += 1) {
        chunks.push({ t: at + (i + 1) * TYPE_S, text: text[i], classes: ['cast-typed'] });
      }
      if (text) {
        // The newline is the Enter key, and it lands after the last letter.
        chunks.push({ t: at + (text.length + 1) * TYPE_S, text: '\n', classes: [] });
        shift += (text.length + 1) * TYPE_S;
      }
      continue;
    }

    if (event.kind === 'masked') {
      const text = event.text || '';
      for (let i = 0; i < text.length; i += 1) {
        chunks.push({ t: at + i * TYPE_S, text: text[i], classes: ['cast-masked'] });
      }
      chunks.push({ t: at + text.length * TYPE_S, text: '\n', classes: [] });
      shift += (text.length + 1) * TYPE_S;
      continue;
    }

    // Program output. \r\n from the pty would otherwise double-space.
    const text = String(event.text).replace(/\r\n/g, '\n').replace(/\r/g, '');
    for (const run of parseAnsi(text, state)) {
      if (run.text) chunks.push({ t: at, text: run.text, classes: run.classes });
    }
  }

  /* A stable sort keeps chunks stamped at the same instant — one
     output event split into several coloured runs — in the order the
     program emitted them. Array.prototype.sort is specified stable,
     so equal timestamps cannot be shuffled. */
  chunks.sort((a, b) => a.t - b.t);
  captions.sort((a, b) => a.t - b.t);
  return { chunks, captions, duration: chunks.length ? chunks[chunks.length - 1].t + 0.4 : 0 };
}

/** The whole session as plain text, for the transcript and for copying. */
function transcribe(cast) {
  const shell = cast.shell || '$ ';
  let out = '';
  for (const event of cast.events) {
    if (event.kind === 'caption') continue;
    if (event.kind === 'prompt') out += `${shell}${event.text || ''}\n`;
    else if (event.kind === 'masked') out += `${event.text}\n`;
    else out += String(event.text).replace(/\x1b\[[0-9;]*m/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '');
  }
  return out;
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ----------------------------------------------------------------
   The player
---------------------------------------------------------------- */

export function createCastPlayer(cast, { reducedMotion = false } = {}) {
  const { chunks, captions, duration } = flatten(cast);
  const screen = el('pre.cast__screen', { tabindex: '0', 'aria-label': `${cast.title || 'Terminal'} session` });
  const captionText = el('p.cast__caption-text', { text: captions[0]?.text || '' });

  let cursorIndex = 0;      // how many chunks are currently drawn
  let elapsed = 0;
  let raf = 0;
  let startedAt = 0;
  let playing = false;
  let finished = false;

  /* One marker per command, so the view can be scrolled to the start
     of the block being executed rather than to the last line drawn. */
  let anchors = [];

  /* --- drawing --------------------------------------------------- */

  /** Draw forwards from wherever we are; rewind is a clear and redraw. */
  function renderTo(index) {
    if (index < cursorIndex) {
      clear(screen);
      cursorIndex = 0;
      anchors = [];
    }
    const fragment = document.createDocumentFragment();
    for (let i = cursorIndex; i < index; i += 1) {
      const chunk = chunks[i];

      /* The shell prompt is where a command's output begins. Mark it
         with a zero-width element so its position can be measured
         later; a text offset would not survive re-rendering. */
      if (chunk.classes.includes('cast-shell')) {
        const anchor = el('span.cast__anchor', { 'aria-hidden': 'true' });
        anchors.push({ index: i, node: anchor });
        fragment.appendChild(anchor);
      }

      if (!chunk.classes.length) fragment.appendChild(document.createTextNode(chunk.text));
      else fragment.appendChild(el('span', { class: chunk.classes.join(' '), text: chunk.text }));
    }
    screen.appendChild(fragment);
    cursorIndex = index;
    follow();
  }

  /* Scrolling to the bottom on every chunk is the obvious thing and
     the wrong one: it pins the newest line to the bottom edge, so the
     table a command just printed is always half off the top and the
     viewer has to scroll back to read what they came to see.

     Instead the view follows the COMMAND. The prompt of whichever
     command is currently running is put at the top of the screen and
     left there while its output fills the space below, so each block
     is read whole and still. Only when a block is taller than the
     screen does this fall back to trailing the newest line, because
     then there is no single position that shows all of it. */
  function follow() {
    const max = screen.scrollHeight - screen.clientHeight;
    if (max <= 0) return;

    let top = 0;
    for (const anchor of anchors) {
      if (anchor.index < cursorIndex) top = anchor.node.offsetTop - screen.offsetTop;
      else break;
    }

    // `top` is where the current command starts; `max` is as far down
    // as the element can go. The smaller of the two keeps the prompt
    // visible whenever that is possible at all.
    screen.scrollTop = Math.max(0, Math.min(top, max));
  }

  function indexAt(time) {
    let i = 0;
    while (i < chunks.length && chunks[i].t <= time) i += 1;
    return i;
  }

  function captionAt(time) {
    let text = '';
    for (const caption of captions) {
      if (caption.t <= time) text = caption.text; else break;
    }
    return text;
  }

  function paint(time) {
    renderTo(indexAt(time));
    captionText.textContent = captionAt(time);
    scrub.value = String(Math.min(time, duration));
    clock.textContent = `${mmss(Math.min(time, duration))} / ${mmss(duration)}`;
  }

  /* --- transport ------------------------------------------------- */

  function tick(now) {
    if (!playing) return;
    elapsed = (now - startedAt) / 1000;
    if (elapsed >= duration) {
      elapsed = duration;
      paint(elapsed);
      return stop(true);
    }
    paint(elapsed);
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    if (finished || elapsed >= duration) { elapsed = 0; finished = false; }
    playing = true;
    startedAt = performance.now() - elapsed * 1000;
    playButton.dataset.state = 'playing';
    playButton.setAttribute('aria-label', 'Pause');
    clear(playButton).appendChild(glyph('pause'));
    raf = requestAnimationFrame(tick);
  }

  function stop(atEnd = false) {
    playing = false;
    finished = atEnd;
    cancelAnimationFrame(raf);
    playButton.dataset.state = atEnd ? 'ended' : 'paused';
    playButton.setAttribute('aria-label', atEnd ? 'Replay' : 'Play');
    clear(playButton).appendChild(glyph(atEnd ? 'replay' : 'play'));
  }

  function seek(time) {
    elapsed = Math.max(0, Math.min(time, duration));
    finished = false;
    if (playing) startedAt = performance.now() - elapsed * 1000;
    paint(elapsed);
  }

  /* --- chrome ---------------------------------------------------- */

  function glyph(name) {
    const paths = {
      play: 'M5 3.5l9 5.5-9 5.5z',
      pause: 'M5 3.5h2.6v11H5zM10.4 3.5H13v11h-2.6z',
      replay: 'M9 3.2a5.8 5.8 0 1 0 5.6 7.3M9 3.2V.9M9 3.2l3 2.4-3 2.4',
    };
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 18 18');
    node.setAttribute('width', '15');
    node.setAttribute('height', '15');
    node.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', paths[name]);
    if (name === 'replay') {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.8');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    } else {
      path.setAttribute('fill', 'currentColor');
    }
    node.appendChild(path);
    return node;
  }

  const playButton = el('button.cast__play', {
    type: 'button',
    'aria-label': 'Play',
    dataset: { state: 'paused' },
    onclick: () => (playing ? stop() : play()),
  }, glyph('play'));

  const scrub = el('input.cast__scrub', {
    type: 'range',
    min: '0',
    max: String(duration),
    step: '0.05',
    value: '0',
    'aria-label': 'Seek through the session',
    oninput: (e) => seek(Number(e.target.value)),
  });

  const clock = el('span.cast__clock', { text: `0:00 / ${mmss(duration)}` });

  const transcript = el('pre.cast__transcript', { hidden: true, text: transcribe(cast) });
  const transcriptButton = el('button.cast__text-toggle', {
    type: 'button',
    'aria-expanded': 'false',
    onclick() {
      const showing = transcript.hidden;
      transcript.hidden = !showing;
      this.setAttribute('aria-expanded', String(showing));
      this.textContent = showing ? 'Hide transcript' : 'Read as text';
    },
    text: 'Read as text',
  });

  const node = el('div.cast', { dataset: { slug: cast.title || 'cast' } }, [
    el('div.cast__frame', {}, [
      el('div.cast__bar', {}, [
        el('span.cast__dots', {}, [
          el('i.cast__dot'), el('i.cast__dot'), el('i.cast__dot'),
        ]),
        el('span.cast__name', { text: cast.title || 'terminal' }),
      ]),
      screen,
    ]),

    el('div.cast__controls', {}, [
      playButton,
      scrub,
      clock,
      transcriptButton,
    ]),

    el('div.cast__caption', {}, [captionText]),
    transcript,
  ]);

  /* Motion is the whole mechanism here, so reduced motion does not
     get a degraded animation — it gets the finished screen, which
     is the part that carries the information. */
  if (reducedMotion) {
    seek(duration);
    stop(true);
    captionText.textContent = captions[captions.length - 1]?.text || '';
  } else {
    paint(0);
  }

  return {
    node,
    play,
    pause: () => stop(),
    isPlaying: () => playing,
    duration,
    destroy() { cancelAnimationFrame(raf); playing = false; },
  };
}

/** Fetch and build. Kept separate so callers can show their own pending state. */
export async function loadCast(src) {
  const response = await fetch(src, { credentials: 'omit' });
  if (!response.ok) throw new Error(`cast ${src}: HTTP ${response.status}`);
  return response.json();
}
