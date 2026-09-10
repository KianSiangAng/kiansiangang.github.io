/* ================================================================
   SHELL.JS — Tokeniser, pipeline executor, history, completion

   A real (small) shell. Given the line:

       cat projects/*.md | grep -i python | head -5

   it tokenises with quote and escape handling, splits the
   pipeline, expands globs and $VARIABLES against the environment,
   then runs each stage with the previous stage's stdout as stdin.

   Not implemented, deliberately: redirection to files (the VFS is
   read-only), subshells, and job control. Everything else that a
   visitor is plausibly going to type does the right thing.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('shell');

/* ----------------------------------------------------------------
   Tokeniser — a small state machine over the raw line
---------------------------------------------------------------- */

export function tokenise(line) {
  const tokens = [];
  let current = '';
  let quote = null;          // "'" | '"' | null
  let hasContent = false;    // distinguishes `""` from no token at all

  const push = () => {
    if (current.length || hasContent) tokens.push({ type: 'word', value: current });
    current = '';
    hasContent = false;
  };

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '\\' && i + 1 < line.length && quote !== "'") {
      current += line[++i];
      hasContent = true;
      continue;
    }
    if (quote) {
      if (char === quote) { quote = null; continue; }
      current += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; hasContent = true; continue; }
    if (char === '|') { push(); tokens.push({ type: 'pipe' }); continue; }
    if (/\s/.test(char)) { push(); continue; }

    current += char;
  }

  if (quote) throw new Error(`unexpected EOF while looking for matching ${quote}`);
  push();
  return tokens;
}

/** Group tokens into pipeline stages: [[argv], [argv], …] */
export function parsePipeline(tokens) {
  const stages = [[]];
  for (const token of tokens) {
    if (token.type === 'pipe') stages.push([]);
    else stages[stages.length - 1].push(token.value);
  }
  if (stages.some((stage) => stage.length === 0)) {
    throw new Error('syntax error near unexpected token `|`');
  }
  return stages;
}

/** Split argv into flags and positional arguments, getopt style. */
export function parseArgs(argv) {
  const flags = new Set();
  const options = new Map();
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) options.set(key, value);
      else flags.add(key);
    } else if (arg.startsWith('-') && arg.length > 1) {
      for (const letter of arg.slice(1)) flags.add(letter);   // -la → -l -a
    } else {
      positional.push(arg);
    }
  }
  return { flags, options, positional, has: (...names) => names.some((n) => flags.has(n)) };
}

/* ----------------------------------------------------------------
   The shell itself
---------------------------------------------------------------- */

export function createShell({ vfs, services = {} }) {
  const commands = new Map();
  const aliases = new Map([
    ['ll', 'ls -la'],
    ['la', 'ls -a'],
    ['..', 'cd ..'],
    ['cls', 'clear'],
  ]);

  const history = [];
  let historyCursor = 0;

  const env = {
    USER: 'kian',
    HOST: 'portfolio',
    HOME: vfs.HOME,
    PWD: vfs.HOME,
    SHELL: '/bin/ksh',
    TERM: 'xterm-256color',
    PATH: '/bin:/usr/bin',
  };

  const shell = {
    env,
    vfs,
    services,
    commands,
    aliases,
    history,
    lastExit: 0,

    get cwd() { return env.PWD; },
    set cwd(path) { env.PWD = path; },

    /** Display form of the cwd: /home/kian → ~ */
    prettyCwd() {
      if (env.PWD === env.HOME) return '~';
      if (env.PWD.startsWith(env.HOME + '/')) return '~' + env.PWD.slice(env.HOME.length);
      return env.PWD;
    },

    register(command) {
      commands.set(command.name, command);
      for (const alt of command.aliases || []) commands.set(alt, command);
      return shell;
    },

    /** All unique commands, for `help` and the palette. */
    catalogue() {
      return [...new Set(commands.values())].sort((a, b) => a.name.localeCompare(b.name));
    },

    /** Expand $VAR and ${VAR} against env. */
    expand(word) {
      return word.replace(/\$\{(\w+)\}|\$(\w+)/g, (match, braced, bare) => {
        const key = braced || bare;
        if (key === '?') return String(shell.lastExit);
        return env[key] ?? '';
      });
    },

    /** Expand a single glob pattern against the VFS, else return it as-is. */
    glob(word) {
      if (!/[*?]/.test(word)) return [word];
      const slash = word.lastIndexOf('/');
      const dirPart = slash === -1 ? '.' : word.slice(0, slash) || '/';
      const pattern = slash === -1 ? word : word.slice(slash + 1);
      const regex = new RegExp(
        '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      );
      try {
        const matches = vfs
          .list(dirPart, env.PWD, { all: pattern.startsWith('.') })
          .filter((node) => regex.test(node.name))
          .map((node) => (slash === -1 ? node.name : `${word.slice(0, slash)}/${node.name}`));
        return matches.length ? matches : [word];
      } catch {
        return [word];
      }
    },

    async run(line) {
      const trimmed = line.trim();
      if (!trimmed) return { output: '', code: 0 };

      if (history[history.length - 1] !== trimmed) history.push(trimmed);
      historyCursor = history.length;

      // Alias substitution, applied once to the head word only.
      const headMatch = trimmed.match(/^(\S+)/);
      let expandedLine = trimmed;
      if (headMatch && aliases.has(headMatch[1])) {
        expandedLine = aliases.get(headMatch[1]) + trimmed.slice(headMatch[1].length);
      }

      let stages;
      try {
        stages = parsePipeline(tokenise(expandedLine));
      } catch (err) {
        shell.lastExit = 2;
        return { output: `ksh: ${err.message}`, code: 2, error: true };
      }

      let stdin = '';
      let code = 0;

      for (const stage of stages) {
        const argv = stage.flatMap((word) => shell.glob(shell.expand(word)));
        const [name, ...rest] = argv;
        const command = commands.get(name);

        if (!command) {
          shell.lastExit = 127;
          return {
            output: `ksh: command not found: ${name}\nType \`help\` for the list of commands.`,
            code: 127,
            error: true,
          };
        }

        try {
          const parsed = parseArgs(rest);
          const result = await command.run({ args: parsed, argv: rest, stdin, shell, services });
          if (typeof result === 'string') { stdin = result; code = 0; }
          else { stdin = result?.output ?? ''; code = result?.code ?? 0; }
          if (result?.control) return { output: stdin, code, control: result.control };
        } catch (err) {
          log.warn(`${name} failed`, err);
          shell.lastExit = 1;
          return { output: `${name}: ${err.message}`, code: 1, error: true };
        }
      }

      shell.lastExit = code;
      return { output: stdin, code };
    },

    /* -- History navigation, bound to ↑ / ↓ in the terminal UI -- */
    historyBack(currentLine) {
      if (historyCursor > 0) historyCursor--;
      return history[historyCursor] ?? currentLine;
    },
    historyForward() {
      if (historyCursor < history.length) historyCursor++;
      return history[historyCursor] ?? '';
    },

    /**
     * Tab completion. Completes command names in the first word
     * position and VFS paths everywhere else. Returns
     * { completion, candidates } — the UI decides whether to
     * insert the completion or list the candidates.
     */
    complete(line) {
      const parts = line.split(/\s+/);
      const word = parts[parts.length - 1];
      const isFirstWord = parts.length === 1;

      let candidates;
      if (isFirstWord) {
        candidates = [...commands.keys(), ...aliases.keys()]
          .filter((name) => name.startsWith(word))
          .sort();
      } else {
        const slash = word.lastIndexOf('/');
        const dirPart = slash === -1 ? '.' : word.slice(0, slash) || '/';
        const stem = slash === -1 ? word : word.slice(slash + 1);
        try {
          candidates = vfs
            .list(dirPart, env.PWD, { all: stem.startsWith('.') })
            .filter((node) => node.name.startsWith(stem))
            .map((node) => {
              const suffix = node.type === 'dir' ? '/' : '';
              return (slash === -1 ? '' : word.slice(0, slash + 1)) + node.name + suffix;
            });
        } catch {
          candidates = [];
        }
      }

      if (candidates.length === 0) return { completion: line, candidates: [] };

      // Insert the longest common prefix of all candidates.
      const common = candidates.reduce((prefix, candidate) => {
        let i = 0;
        while (i < prefix.length && i < candidate.length && prefix[i] === candidate[i]) i++;
        return prefix.slice(0, i);
      });

      const head = parts.slice(0, -1).join(' ');
      const completion = (head ? head + ' ' : '') + common;
      return { completion, candidates: candidates.length > 1 ? candidates : [] };
    },
  };

  return shell;
}
