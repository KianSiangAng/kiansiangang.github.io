/* ================================================================
   TERM-UI.JS — The terminal widget

   Progressive enhancement: the Skills section already contains a
   static, readable terminal mock-up in the HTML. This module finds
   it and *upgrades it in place* into a working shell — the static
   content stays as the initial scrollback, so a visitor with
   JavaScript disabled still sees the full skills list.

   Responsibilities:
     - render ANSI SGR escape codes as styled spans (no innerHTML,
       every write goes through textContent — an XSS-proof renderer)
     - own the input line: history, tab completion, Ctrl-C, Ctrl-L
     - handle the `control` results commands can return (clear,
       matrix, exit)
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('term');

/* ANSI SGR code → CSS class. Only the codes the commands actually
   emit are mapped; anything else is ignored rather than printed. */
const SGR = {
  0: null,          // reset
  1: 'ansi-bold',
  2: 'ansi-dim',
  3: 'ansi-italic',
  4: 'ansi-underline',
  31: 'ansi-red',
  32: 'ansi-green',
  33: 'ansi-yellow',
  34: 'ansi-blue',
  35: 'ansi-magenta',
  36: 'ansi-cyan',
  37: 'ansi-white',
  90: 'ansi-dim',
};

const ANSI_PATTERN = /\x1b\[([0-9;]*)m/g;
const MAX_SCROLLBACK = 400;

/**
 * Turn a string containing ANSI escapes into a DocumentFragment of
 * spans. Text is inserted with textContent, so markup in command
 * output (or in anything a visitor types) can never become HTML.
 */
export function renderAnsi(text) {
  const fragment = document.createDocumentFragment();
  let active = new Set();
  let cursor = 0;

  const emit = (chunk) => {
    if (!chunk) return;
    if (active.size === 0) {
      fragment.appendChild(document.createTextNode(chunk));
      return;
    }
    const span = document.createElement('span');
    span.className = [...active].join(' ');
    span.textContent = chunk;
    fragment.appendChild(span);
  };

  ANSI_PATTERN.lastIndex = 0;
  let match;
  while ((match = ANSI_PATTERN.exec(text)) !== null) {
    emit(text.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    for (const raw of (match[1] || '0').split(';')) {
      const code = Number(raw || 0);
      if (code === 0) active = new Set();
      else if (SGR[code]) active.add(SGR[code]);
    }
  }
  emit(text.slice(cursor));
  return fragment;
}

export function createTerminalUI({ shell, bus, root }) {
  const body = root.querySelector('.terminal__body');
  if (!body) throw new Error('terminal body not found');

  /* The static mock-up ends with a fake blinking cursor line.
     Remove it — we are about to supply a real one. */
  body.querySelectorAll('.terminal__cursor').forEach((el) => el.parentElement?.remove());

  const output = document.createElement('div');
  output.className = 'terminal__output';
  output.setAttribute('role', 'log');
  output.setAttribute('aria-live', 'polite');
  output.setAttribute('aria-label', 'Terminal output');

  const line = document.createElement('form');
  line.className = 'terminal__inputline';
  line.setAttribute('autocomplete', 'off');

  const prompt = document.createElement('span');
  prompt.className = 'terminal__prompt terminal__prompt--live';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'terminal__input';
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('aria-label', 'Terminal input — type help for commands');

  line.append(prompt, input);
  body.append(output, line);

  const scroller = body;
  let busy = false;

  function refreshPrompt() {
    prompt.textContent = '';
    const user = document.createElement('span');
    user.className = 'terminal__user';
    user.textContent = `${shell.env.USER}@${shell.env.HOST}`;
    const path = document.createElement('span');
    path.className = 'terminal__path';
    path.textContent = shell.prettyCwd();
    prompt.append(user, document.createTextNode(':'), path, document.createTextNode('$ '));
  }

  function trimScrollback() {
    while (output.childElementCount > MAX_SCROLLBACK) output.removeChild(output.firstChild);
  }

  function write(text, className) {
    const block = document.createElement('div');
    block.className = `terminal__line${className ? ' ' + className : ''}`;
    block.appendChild(renderAnsi(String(text)));
    output.appendChild(block);
    trimScrollback();
    scroller.scrollTop = scroller.scrollHeight;
    return block;
  }

  function echoCommand(text) {
    const block = document.createElement('div');
    block.className = 'terminal__line terminal__line--echo';
    block.appendChild(prompt.cloneNode(true));
    const typed = document.createElement('span');
    typed.textContent = text;
    block.appendChild(typed);
    output.appendChild(block);
    trimScrollback();
  }

  /* -- control results the shell hands back to the UI -- */
  const controls = {
    clear() {
      output.replaceChildren();
      // Also drop the static mock-up: the visitor asked for a clear screen.
      body.querySelectorAll('.terminal__group').forEach((el) => el.remove());
    },
    matrix() {
      root.classList.add('terminal--matrix');
      setTimeout(() => root.classList.remove('terminal--matrix'), 3200);
      bus.emit('world.request', { world: 'hacker' });
    },
    exit() {
      root.classList.add('terminal--closed');
      setTimeout(() => root.classList.remove('terminal--closed'), 1600);
      write('\x1b[2m(the terminal reopens in a moment — this is a web page, after all)\x1b[0m');
    },
  };

  async function submit(rawLine) {
    if (busy) return;
    const text = rawLine.trim();
    echoCommand(rawLine);
    input.value = '';
    if (!text) return;

    busy = true;
    line.classList.add('is-busy');
    try {
      const result = await shell.run(text);
      if (result.control && controls[result.control.type]) controls[result.control.type]();
      if (result.output) write(result.output, result.error ? 'terminal__line--error' : '');
      bus.emit('term.command', { command: text, code: result.code });
    } catch (err) {
      log.error('command crashed', err);
      write(`ksh: internal error: ${err.message}`, 'terminal__line--error');
    } finally {
      busy = false;
      line.classList.remove('is-busy');
      refreshPrompt();
      scroller.scrollTop = scroller.scrollHeight;
    }
  }

  line.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      input.value = shell.historyBack(input.value);
      requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      input.value = shell.historyForward();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const { completion, candidates } = shell.complete(input.value);
      input.value = completion;
      if (candidates.length > 1) write(candidates.join('  '), 'terminal__line--dim');
    } else if (event.key === 'l' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      controls.clear();
    } else if (event.key === 'c' && event.ctrlKey) {
      event.preventDefault();
      echoCommand(input.value + '^C');
      input.value = '';
    } else if (event.key === 'Escape') {
      input.blur();
    }
    /* Plain typing inside the terminal must not trigger the global
       single-key hotkeys (` opens the HUD, / opens the palette) —
       but deliberate modifier shortcuts like ⌘K still should, or the
       palette would be unreachable from the one place a visitor is
       most likely to be typing. */
    if (!event.metaKey && !event.ctrlKey) event.stopPropagation();
  });

  /* Clicking anywhere in the terminal focuses the input, the way a
     real terminal emulator behaves — but not when the visitor is
     selecting text to copy. */
  root.addEventListener('mouseup', () => {
    if (window.getSelection()?.toString()) return;
    input.focus({ preventScroll: true });
  });

  refreshPrompt();

  return {
    write,
    focus: () => input.focus({ preventScroll: true }),
    submit,
    element: root,
    /** Type a command out character by character, then run it. */
    async demo(text, speed = 45) {
      input.focus({ preventScroll: true });
      for (const char of text) {
        input.value += char;
        await new Promise((r) => setTimeout(r, speed));
      }
      await new Promise((r) => setTimeout(r, 250));
      await submit(input.value);
    },
  };
}
