/* ================================================================
   MEDIA.JS — The two kinds that are just files

   Nothing in the registry uses these yet. They exist so that a demo
   filmed later is a data change and not a code change:

     video        drop an .mp4/.webm into assets/demos/, add an
                  entry with kind:'video', and it plays. A .vtt
                  beside it becomes captions automatically.

     walkthrough  an ordered list of stills with captions, stepped
                  through by hand. This is the right shape for
                  anything that cannot be re-run live — the 3D room
                  a phone never renders, or a tool that needs
                  credentials to demonstrate.

   Both deliberately refuse to autoplay. A demo that starts making
   noise and motion because someone scrolled past it is the kind of
   thing this site's README promises not to do.
================================================================ */

import { el, clear } from '../os/dom.js';

/* ----------------------------------------------------------------
   Video
---------------------------------------------------------------- */

export function createVideoDemo(demo, { reducedMotion = false } = {}) {
  const video = el('video.video__el', {
    controls: true,
    preload: reducedMotion ? 'metadata' : 'metadata',
    playsInline: true,
    poster: demo.poster || null,
    'aria-label': `${demo.title} — screen recording`,
  });

  for (const source of (Array.isArray(demo.src) ? demo.src : [demo.src])) {
    const type = source.endsWith('.webm') ? 'video/webm'
      : source.endsWith('.mp4') ? 'video/mp4' : undefined;
    video.appendChild(el('source', { src: source, type }));
  }

  /* Captions are not decoration. A demo nobody can follow with the
     sound off is a demo most people will not follow at all. */
  if (demo.captions) {
    video.appendChild(el('track', {
      kind: 'captions',
      src: demo.captions,
      srclang: demo.lang || 'en',
      label: 'English',
      default: true,
    }));
  }

  video.appendChild(document.createTextNode(
    'Your browser cannot play this recording. ',
  ));

  return {
    node: el('div.video', {}, [
      el('div.video__frame', {}, [video]),
      demo.transcript ? el('p.video__transcript-note', { text: demo.transcript }) : null,
    ]),
    play: () => video.play().catch(() => {}),
    pause: () => video.pause(),
    isPlaying: () => !video.paused,
    destroy() { video.pause(); video.removeAttribute('src'); video.load(); },
  };
}

/* ----------------------------------------------------------------
   Walkthrough — stills, stepped
---------------------------------------------------------------- */

export function createWalkthroughDemo(demo) {
  const frames = demo.frames || [];
  let index = 0;

  const image = el('img.walk__image', { alt: '', decoding: 'async', loading: 'lazy' });
  const caption = el('p.walk__caption');
  const counter = el('span.walk__counter');
  const dots = el('div.walk__dots', { role: 'tablist', 'aria-label': 'Steps' });

  function show(next) {
    index = (next + frames.length) % frames.length;
    const frame = frames[index];
    image.src = frame.src;
    image.alt = frame.alt || frame.caption || `Step ${index + 1}`;
    caption.textContent = frame.caption || '';
    counter.textContent = `${index + 1} / ${frames.length}`;
    for (const [i, dot] of [...dots.children].entries()) {
      dot.setAttribute('aria-selected', String(i === index));
    }
  }

  frames.forEach((frame, i) => {
    dots.appendChild(el('button.walk__dot', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(i === 0),
      'aria-label': frame.caption ? `Step ${i + 1}: ${frame.caption}` : `Step ${i + 1}`,
      onclick: () => show(i),
    }));
  });

  const node = el('div.walk', {
    tabindex: '0',
    onkeydown(e) {
      if (e.key === 'ArrowRight') { show(index + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { show(index - 1); e.preventDefault(); }
    },
  }, [
    el('div.walk__stage', {}, [image]),
    el('div.walk__controls', {}, [
      el('button.walk__nav', { type: 'button', 'aria-label': 'Previous step', onclick: () => show(index - 1), text: '‹' }),
      dots,
      el('button.walk__nav', { type: 'button', 'aria-label': 'Next step', onclick: () => show(index + 1), text: '›' }),
      counter,
    ]),
    caption,
  ]);

  if (frames.length) show(0);

  return {
    node,
    play: () => show(index + 1),
    pause() {},
    isPlaying: () => false,
    destroy() { clear(node); },
  };
}
