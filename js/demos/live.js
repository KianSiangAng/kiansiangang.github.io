/* ================================================================
   LIVE.JS — Running the actual tool, and narrating it

   The Calendar Exporter is a single self-contained HTML file, which
   means the honest demo is not a recording of it. It is it.

   So it is vendored into this site and embedded in a frame. Two
   consequences worth being explicit about:

     A recording can go stale and lie. This cannot — if the tool
     breaks, the demo breaks, which is the correct behaviour.

     A visitor can paste their own timetable and get their own .ics
     out. The demo is the product.

   The guided run exists for everyone who does not happen to have
   SUSS timetable text in their clipboard. It drives the real frame
   — same DOM, same handlers, same code path a visitor takes — from
   the declarative script in demos.js. There is no "demo mode"
   inside the tool that could quietly diverge from the real thing.

   Reaching into the frame works because the copy is same-origin.
   If that ever stops being true the guided run disables itself and
   says so, rather than failing silently in a way nobody notices.
================================================================ */

import { el, clear } from '../os/dom.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('demos');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createLiveDemo(demo, { reducedMotion = false } = {}) {
  let cancelled = false;
  let running = false;
  let sampleText = null;

  /* The bytes the tool's own download handed over, kept so the last
     step can read them back rather than regenerate them. */
  let generated = null;

  const frame = el('iframe.live__frame', {
    src: demo.src,
    title: `${demo.title} — running live`,
    loading: 'lazy',
    /* allow-scripts lets the tool run, allow-same-origin lets the guided
       run reach in, allow-downloads lets it hand over the .ics. Popups,
       top-level navigation, form submission and pointer lock stay denied.

       Worth being straight about what this sandbox is and is not: those
       first two together mean the frame could remove its own sandboxing,
       so this is not a boundary that would contain hostile code. It does
       not need to be — the content is our own vendored copy served from
       our own origin, and its real containment is the CSP it carries,
       which permits it no network at all. The sandbox here is the
       narrower statement that this frame has no business navigating the
       page or opening windows. */
    sandbox: 'allow-scripts allow-same-origin allow-downloads',
  });

  const caption = el('p.live__caption', { text: '' });
  const status = el('p.live__status', { role: 'status', text: '' });

  /* Where the generated file gets drawn back as a calendar. Hidden
     until there is something real to put in it. */
  const calendar = el('div.live__calendar', { hidden: true });

  /** The tool's document, or null if the browser will not hand it over. */
  function reach() {
    try {
      const doc = frame.contentDocument;
      return doc && doc.readyState !== 'uninitialized' ? doc : null;
    } catch (err) {
      log.warn('frame is not same-origin; guided run unavailable', err);
      return null;
    }
  }

  async function loadSample() {
    if (sampleText !== null) return sampleText;
    const response = await fetch(demo.sample, { credentials: 'omit' });
    if (!response.ok) throw new Error(`sample: HTTP ${response.status}`);
    sampleText = (await response.text()).trimEnd();
    return sampleText;
  }

  /* --- the actions a script step can take ------------------------ */

  const actions = {
    /** Type into a field the way a person would, so it reads as input. */
    async type(doc, step) {
      const field = doc.querySelector(step.target);
      if (!field) throw new Error(`no ${step.target}`);
      const text = step.source === 'sample' ? await loadSample() : (step.text || '');

      field.focus();
      field.value = '';
      if (reducedMotion) {
        field.value = text;
      } else {
        /* Per line rather than per character: six lines of timetable
           typed letter by letter is forty seconds of nothing. */
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
          if (cancelled) return;
          field.value += (i ? '\n' : '') + lines[i];
          field.scrollTop = field.scrollHeight;
          await wait(170);
        }
      }
      field.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
      await wait(reducedMotion ? 0 : 320);
    },

    async click(doc, step) {
      const button = doc.querySelector(step.target);
      if (!button) throw new Error(`no ${step.target}`);
      button.classList.add('demo-pressed');
      await wait(reducedMotion ? 0 : 260);
      button.click();
      button.classList.remove('demo-pressed');
      await wait(reducedMotion ? 0 : 420);
    },

    /** Scroll a panel into view inside the frame and let it settle. */
    async reveal(doc, step) {
      const panel = doc.querySelector(step.target);
      if (panel) panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      await wait(reducedMotion ? 0 : (step.hold || 1800));
    },

    async highlight(doc, step) {
      const target = doc.querySelector(step.target);
      if (!target) return;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      target.classList.add('demo-glow');
      await wait(reducedMotion ? 0 : (step.hold || 1800));
      target.classList.remove('demo-glow');
    },

    /* Press the real Download button, and keep a copy of what came
       out. The bytes are captured by watching URL.createObjectURL --
       the tool hands its Blob to exactly that on its way to the
       anchor it clicks -- rather than by rebuilding the file here.
       A demo that re-derived the .ics could agree with itself while
       the real download was broken; this one cannot. */
    async download(doc, step) {
      const button = doc.querySelector(step.target);
      if (!button) throw new Error(`no ${step.target}`);
      const win = doc.defaultView;

      const nativeCreate = win.URL.createObjectURL.bind(win.URL);
      let captured = null;
      win.URL.createObjectURL = (obj) => {
        if (obj instanceof win.Blob && !captured) captured = obj;
        return nativeCreate(obj);
      };

      /* On a device with a share sheet the tool offers one before
         falling back to a download. Mid-demo that hijacks the screen
         with an OS dialog nobody asked for, so the share path is
         stood down for the duration of this step and put back
         immediately. The download path it falls through to is the
         tool's own, unmodified. */
      const nativeShare = win.navigator.share;
      if (nativeShare) {
        try {
          Object.defineProperty(win.navigator, 'share', { configurable: true, value: undefined });
        } catch { /* locked down: let the share sheet happen */ }
      }

      button.classList.add('demo-pressed');
      await wait(reducedMotion ? 0 : 260);
      button.click();
      button.classList.remove('demo-pressed');

      // saveICS is async; give it a moment to reach createObjectURL.
      for (let i = 0; i < 40 && !captured; i += 1) await wait(50);

      win.URL.createObjectURL = nativeCreate;
      if (nativeShare) {
        try {
          Object.defineProperty(win.navigator, 'share', { configurable: true, value: nativeShare });
        } catch { /* nothing to restore */ }
      }

      if (captured) {
        generated = { text: await captured.text(), bytes: captured.size };
      }
      await wait(reducedMotion ? 0 : (step.hold || 900));
    },

    /* Read the downloaded file back and draw it as a month. */
    async calendar(doc, step) {
      if (!generated) {
        throw new Error('nothing was generated to show');
      }
      const { parseICS, createCalendarPreview } = await import('./ics.js');
      const { events, tzid } = parseICS(generated.text);
      const now = new Date();
      const filename = `suss-timetable-${now.getFullYear()}`
        + `${String(now.getMonth() + 1).padStart(2, '0')}`
        + `${String(now.getDate()).padStart(2, '0')}.ics`;

      clear(calendar).appendChild(
        createCalendarPreview({ events, tzid, filename, bytes: generated.bytes }),
      );
      calendar.hidden = false;
      if (!reducedMotion) calendar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await wait(reducedMotion ? 0 : (step.hold || 2600));
    },
  };

  /* The classes the actions below toggle are defined in
     demo-drive.css, which the vendored copy links. They deliberately
     are NOT injected from here: the frame's policy blocks an injected
     <style>, and shipping a real file is how you satisfy a policy
     rather than argue with it. */

  async function run() {
    if (running) return;
    const doc = reach();
    if (!doc) {
      status.textContent = 'The guided run needs the demo frame to finish loading. '
        + 'The tool itself works regardless — paste a timetable into it.';
      return;
    }

    running = true;
    cancelled = false;
    generated = null;
    clear(calendar);
    calendar.hidden = true;
    runButton.textContent = 'Stop';
    runButton.dataset.state = 'running';
    status.textContent = '';

    try {
      for (const step of demo.script) {
        if (cancelled) break;
        caption.textContent = step.caption;
        await actions[step.action]?.(doc, step);
      }
      if (!cancelled) {
        caption.textContent = 'That is the whole tool. Now try it with your own timetable — '
          + 'the text area above is live.';
      }
    } catch (err) {
      log.warn('guided run stopped', err);
      status.textContent = 'The guided run could not finish, but the tool below still works.';
    } finally {
      running = false;
      cancelled = false;
      runButton.textContent = 'Run the demo';
      runButton.dataset.state = 'idle';
    }
  }

  const runButton = el('button.live__run', {
    type: 'button',
    dataset: { state: 'idle' },
    onclick: () => (running ? (cancelled = true) : run()),
    text: 'Run the demo',
  });

  const resetButton = el('button.live__reset', {
    type: 'button',
    onclick() {
      cancelled = true;
      caption.textContent = '';
      status.textContent = '';
      generated = null;
      clear(calendar);
      calendar.hidden = true;
      frame.src = demo.src;
    },
    text: 'Reset',
  });

  const node = el('div.live', {}, [
    el('div.live__controls', {}, [
      runButton,
      resetButton,
      el('span.live__hint', { text: 'or paste your own timetable straight into it' }),
    ]),
    el('div.live__caption-row', {}, [caption]),
    status,
    el('div.live__stage', {}, [frame]),
    calendar,
  ]);

  return {
    node,
    play: run,
    pause() { cancelled = true; },
    isPlaying: () => running,
    destroy() { cancelled = true; frame.removeAttribute('src'); },
  };
}

/** Provenance for the vendored copy, so the page can say how fresh it is. */
export async function loadProvenance(src) {
  try {
    const response = await fetch(src, { credentials: 'omit' });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}
