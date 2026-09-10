/* ================================================================
   COMMANDS.JS — The shell's built-in command set

   Each command is a small object:

     { name, summary, usage, run({ args, stdin, shell, services }) }

   `run` returns a string (stdout), or { output, code, control }
   where `control` asks the terminal UI to do something it alone
   can do — clear the screen, run the matrix effect, and so on.

   Output is coloured with real ANSI SGR escape codes, which the
   terminal UI parses back into styled spans. Yes, this site
   implements a subset of a 1979 terminal control standard.
================================================================ */

import { identity, projects, skills, systemInfo } from '../data/portfolio.js';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const b = (s) => `${C.bold}${s}${C.reset}`;
const dim = (s) => `${C.dim}${s}${C.reset}`;
const cyan = (s) => `${C.cyan}${s}${C.reset}`;
const green = (s) => `${C.green}${s}${C.reset}`;
const yellow = (s) => `${C.yellow}${s}${C.reset}`;
const magenta = (s) => `${C.magenta}${s}${C.reset}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createCommands() {
  return [
    /* ---------------- meta ---------------- */
    {
      name: 'help',
      summary: 'list every available command',
      usage: 'help [command]',
      run({ args, shell }) {
        if (args.positional[0]) {
          const cmd = shell.commands.get(args.positional[0]);
          if (!cmd) return `help: no such command: ${args.positional[0]}`;
          return `${b(cmd.name)} — ${cmd.summary}\n${dim('usage:')} ${cmd.usage}`;
        }
        const catalogue = shell.catalogue();
        const width = Math.max(...catalogue.map((c) => c.name.length)) + 2;
        return [
          `${b('PortfolioOS shell')} ${dim('— ' + catalogue.length + ' commands')}`,
          '',
          ...catalogue.map((c) => `  ${cyan(c.name.padEnd(width))}${c.summary}`),
          '',
          dim('Tab completes · ↑/↓ walks history · pipes work: cat resume.txt | grep -i risk'),
        ].join('\n');
      },
    },
    {
      name: 'man',
      summary: 'show the manual page for a command',
      usage: 'man <command>',
      run({ args, shell }) {
        const name = args.positional[0];
        if (!name) return 'What manual page do you want?';
        const cmd = shell.commands.get(name);
        if (!cmd) return `No manual entry for ${name}`;
        return [
          `${b(name.toUpperCase() + '(1)')}${' '.repeat(30)}${b('PortfolioOS Manual')}`,
          '',
          b('NAME'),
          `    ${cmd.name} — ${cmd.summary}`,
          '',
          b('SYNOPSIS'),
          `    ${cmd.usage}`,
          '',
          b('DESCRIPTION'),
          `    ${cmd.description || cmd.summary}`,
        ].join('\n');
      },
    },
    {
      name: 'clear',
      summary: 'clear the terminal scrollback',
      usage: 'clear',
      run: () => ({ output: '', code: 0, control: { type: 'clear' } }),
    },
    {
      name: 'echo',
      summary: 'print arguments back',
      usage: 'echo [text…]',
      run: ({ argv }) => argv.join(' '),
    },
    {
      name: 'history',
      summary: 'show command history',
      usage: 'history',
      run: ({ shell }) =>
        shell.history.map((line, i) => `${dim(String(i + 1).padStart(4))}  ${line}`).join('\n'),
    },

    /* ---------------- filesystem ---------------- */
    {
      name: 'pwd',
      summary: 'print the working directory',
      usage: 'pwd',
      run: ({ shell }) => shell.cwd,
    },
    {
      name: 'ls',
      summary: 'list directory contents',
      usage: 'ls [-l] [-a] [path]',
      description: '-l for the long format with permissions, -a to include dotfiles.',
      run({ args, shell }) {
        const target = args.positional[0] || '.';
        const nodes = shell.vfs.list(target, shell.cwd, { all: args.has('a') });
        if (nodes.length === 0) return '';

        if (args.has('l')) {
          return nodes
            .map((node) => {
              const size = node.type === 'dir' ? '-' : String(node.content.length);
              const name = node.type === 'dir' ? cyan(node.name + '/') : node.name;
              return `${dim(node.mode)}  ${size.padStart(5)}  ${name}`;
            })
            .join('\n');
        }
        return nodes.map((n) => (n.type === 'dir' ? cyan(n.name + '/') : n.name)).join('  ');
      },
    },
    {
      name: 'cd',
      summary: 'change directory',
      usage: 'cd [path]',
      run({ args, shell }) {
        const target = args.positional[0] || shell.env.HOME;
        const { node, path } = shell.vfs.lookup(target, shell.cwd);
        if (node.type !== 'dir') return `cd: not a directory: ${target}`;
        shell.cwd = path;
        return '';
      },
    },
    {
      name: 'cat',
      summary: 'print a file',
      usage: 'cat <file…>',
      run({ args, shell, stdin }) {
        if (args.positional.length === 0) return stdin;
        return args.positional.map((path) => shell.vfs.read(path, shell.cwd)).join('\n');
      },
    },
    {
      name: 'tree',
      summary: 'draw the filesystem as a tree',
      usage: 'tree [path]',
      run: ({ args, shell }) => {
        const target = args.positional[0] || '.';
        const rendered = shell.vfs.tree(target, shell.cwd);
        return `${cyan(target)}\n${rendered}`;
      },
    },
    {
      name: 'grep',
      summary: 'filter lines matching a pattern',
      usage: 'grep [-i] [-v] <pattern> [file]',
      run({ args, stdin, shell }) {
        const [pattern, ...files] = args.positional;
        if (!pattern) return 'usage: grep [-i] <pattern> [file]';

        const source = files.length
          ? files.map((f) => shell.vfs.read(f, shell.cwd)).join('\n')
          : stdin;

        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), args.has('i') ? 'i' : '');
        const invert = args.has('v');

        return source
          .split('\n')
          .filter((line) => regex.test(line) !== invert)
          .map((line) => (invert ? line : line.replace(regex, (m) => `${C.yellow}${m}${C.reset}`)))
          .join('\n');
      },
    },
    {
      name: 'head',
      summary: 'print the first lines of the input',
      usage: 'head [-n <count>] [file]',
      run({ args, stdin, shell }) {
        const count = Number(args.options.get('n') || args.positional.find((p) => /^\d+$/.test(p)) || 10);
        const file = args.positional.find((p) => !/^\d+$/.test(p));
        const source = file ? shell.vfs.read(file, shell.cwd) : stdin;
        return source.split('\n').slice(0, count).join('\n');
      },
    },
    {
      name: 'wc',
      summary: 'count lines, words and characters',
      usage: 'wc [file]',
      run({ args, stdin, shell }) {
        const source = args.positional[0] ? shell.vfs.read(args.positional[0], shell.cwd) : stdin;
        const lines = source ? source.split('\n').length : 0;
        const words = source.split(/\s+/).filter(Boolean).length;
        return `${String(lines).padStart(6)}${String(words).padStart(8)}${String(source.length).padStart(8)}`;
      },
    },

    /* ---------------- portfolio ---------------- */
    {
      name: 'whoami',
      summary: 'who is behind this site',
      usage: 'whoami',
      run: () =>
        [
          b(identity.name),
          `${identity.role} ${dim('·')} ${identity.location}`,
          '',
          identity.tagline,
          '',
          `${dim('status')}  ${green(identity.status)}`,
          `${dim('email')}   ${identity.email}`,
        ].join('\n'),
    },
    {
      name: 'projects',
      summary: 'list projects, or show one in detail',
      usage: 'projects [slug]',
      run({ args }) {
        const slug = args.positional[0];
        if (!slug) {
          return [
            b('Projects'),
            '',
            ...projects.map(
              (p) => `  ${cyan(p.slug.padEnd(24))}${p.title}\n  ${' '.repeat(24)}${dim(p.badge)}`,
            ),
            '',
            dim('projects <slug> for detail · open <slug> to visit the repo'),
          ].join('\n');
        }
        const project = projects.find((p) => p.slug === slug || p.title.toLowerCase() === slug.toLowerCase());
        if (!project) return `projects: unknown project: ${slug}`;
        return [
          b(project.title),
          yellow(project.badge),
          '',
          project.summary,
          project.threatModel ? `\n${b('Threat modelling')}\n${project.threatModel}` : '',
          '',
          `${dim('stack')}  ${project.tags.join(' · ')}`,
          `${dim('source')} ${project.url}`,
        ]
          .filter(Boolean)
          .join('\n');
      },
    },
    {
      name: 'skills',
      summary: 'print the skills matrix',
      usage: 'skills [category]',
      run({ args }) {
        const wanted = args.positional[0];
        const entries = Object.entries(skills).filter(([k]) => !wanted || k === wanted);
        if (entries.length === 0) return `skills: unknown category: ${wanted}`;
        return entries
          .map(([category, items]) => `${cyan(category)}\n  ${items.join(', ')}`)
          .join('\n\n');
      },
    },
    {
      name: 'contact',
      summary: 'how to get in touch',
      usage: 'contact',
      run: () =>
        [
          `${dim('email')}     ${identity.email}`,
          `${dim('github')}    ${identity.github}`,
          `${dim('linkedin')}  ${identity.linkedin}`,
          '',
          green('Always open to internship opportunities and collaborations.'),
        ].join('\n'),
    },
    {
      name: 'open',
      summary: 'open a project repository in a new tab',
      usage: 'open <slug|github|linkedin|email>',
      run({ args }) {
        const target = args.positional[0];
        const shortcuts = {
          github: identity.github,
          linkedin: identity.linkedin,
          email: `mailto:${identity.email}`,
        };
        const url = shortcuts[target] || projects.find((p) => p.slug === target)?.url;
        if (!url) return `open: nothing known as "${target}"`;
        window.open(url, '_blank', 'noopener,noreferrer');
        return `${green('→')} opening ${url}`;
      },
    },
    {
      name: 'neofetch',
      summary: 'system information, with ASCII art',
      usage: 'neofetch',
      run() {
        const info = systemInfo();
        const art = [
          `${C.magenta}      .-~~~-.      ${C.reset}`,
          `${C.magenta}    .'  o o  '.    ${C.reset}`,
          `${C.magenta}   /   \\___/   \\   ${C.reset}`,
          `${C.magenta}  |   (  .  )   |  ${C.reset}`,
          `${C.magenta}   \\   '---'   /   ${C.reset}`,
          `${C.magenta}    '.       .'    ${C.reset}`,
          `${C.magenta}      '~---~'      ${C.reset}`,
        ];
        const rows = [
          `${green(b(`${identity.handle}@${identity.host}`))}`,
          dim('─'.repeat(30)),
          ...Object.entries(info).map(([k, v]) => `${cyan(k.padEnd(11))}${v}`),
        ];
        const height = Math.max(art.length, rows.length);
        const out = [];
        for (let i = 0; i < height; i++) {
          out.push((art[i] || ' '.repeat(19)) + '  ' + (rows[i] || ''));
        }
        return out.join('\n');
      },
    },

    /* ---------------- system ---------------- */
    {
      name: 'theme',
      summary: 'switch between the ghibli and hacker worlds',
      usage: 'theme [ghibli|hacker|toggle|dark|light]',
      run({ args, services }) {
        const mode = (args.positional[0] || 'toggle').toLowerCase();
        if (['dark', 'light'].includes(mode)) {
          services.bus.emit('theme.set', { theme: mode });
          return `${green('✓')} colour scheme → ${mode}`;
        }
        if (!['ghibli', 'hacker', 'toggle'].includes(mode)) {
          return `theme: expected ghibli, hacker, toggle, dark or light`;
        }
        services.bus.emit('world.request', { world: mode });
        return `${green('✓')} world → ${mode === 'toggle' ? 'the other one' : mode}`;
      },
    },
    {
      name: 'audio',
      summary: 'toggle the generated ambient soundtrack',
      usage: 'audio [on|off]',
      run({ args, services }) {
        const mode = (args.positional[0] || 'toggle').toLowerCase();
        services.bus.emit('audio.request', { mode });
        return `${green('♪')} audio → ${mode}`;
      },
    },
    {
      name: 'dmesg',
      summary: 'print the kernel boot log',
      usage: 'dmesg [-n <count>]',
      async run({ args, services }) {
        const { drainLog } = await import('../core/logger.js');
        const count = Number(args.options.get('n') || 40);
        return drainLog()
          .slice(-count)
          .map((e) => {
            const stamp = dim(`[${(e.t / 1000).toFixed(6).padStart(11)}]`);
            const level = e.level === 'error' ? `${C.red}ERR${C.reset}`
              : e.level === 'warn' ? `${C.yellow}WRN${C.reset}`
              : dim(e.level.slice(0, 3).toUpperCase());
            return `${stamp} ${level} ${cyan(e.ns)}: ${e.msg}`;
          })
          .join('\n');
      },
    },
    {
      name: 'ps',
      summary: 'list running kernel modules and their state',
      usage: 'ps',
      run({ services }) {
        const report = services.kernel?.report?.() || {};
        const rows = Object.entries(report).map(([name, state], i) => {
          const colour = state === 'ready' ? green : state === 'failed' ? (s) => `${C.red}${s}${C.reset}` : dim;
          return `${String(1000 + i * 7).padStart(6)}  ${colour(state.padEnd(8))}  ${name}`;
        });
        return [`${dim('   PID  STATE     MODULE')}`, ...rows].join('\n');
      },
    },
    {
      name: 'deps',
      summary: 'print the dependency-injection graph',
      usage: 'deps',
      run({ services }) {
        const graph = services.container?.graph?.() || {};
        return Object.entries(graph)
          .map(([name, deps]) => `${cyan(name.padEnd(14))}${deps.length ? '← ' + deps.join(', ') : dim('(no dependencies)')}`)
          .join('\n');
      },
    },
    {
      name: 'uptime',
      summary: 'how long this page has been open',
      usage: 'uptime',
      run() {
        const seconds = performance.now() / 1000;
        const mins = Math.floor(seconds / 60);
        return `up ${mins}m ${(seconds % 60).toFixed(0)}s, 1 user, load average: ${(Math.random() * 0.4).toFixed(2)}`;
      },
    },
    {
      name: 'date',
      summary: 'print the current date and time',
      usage: 'date',
      run: () => new Date().toString(),
    },
    {
      name: 'perf',
      summary: 'toggle the performance HUD',
      usage: 'perf',
      run({ services }) {
        services.bus.emit('hud.toggle');
        return `${green('✓')} performance HUD toggled ${dim('(or press ` )')}`;
      },
    },

    /* ---------------- security theatre ---------------- */
    {
      name: 'sudo',
      summary: 'elevate privileges (results may vary)',
      usage: 'sudo <command>',
      run({ argv, shell, services }) {
        if (argv.length === 0) return 'usage: sudo <command>';
        services.bus.emit('achievement.unlock', { id: 'sudo' });
        shell.vfs.elevated = true;
        return [
          `${dim('[sudo] password for kian:')}`,
          '',
          `${C.red}Nice try.${C.reset} There is no password — this filesystem lives in your browser tab.`,
          `${green('Granted anyway.')} Least privilege is for systems with something to protect;`,
          `this one has a ${b('.secret')} directory with a flag in it. ${dim('(hint: ls -a)')}`,
        ].join('\n');
      },
    },
    {
      name: 'ping',
      summary: 'ping a host (simulated)',
      usage: 'ping <host>',
      async run({ args }) {
        const host = args.positional[0] || identity.host;
        const lines = [`PING ${host} (127.0.0.1): 56 data bytes`];
        for (let i = 0; i < 4; i++) {
          lines.push(
            `64 bytes from 127.0.0.1: icmp_seq=${i} ttl=64 time=${(Math.random() * 3 + 0.2).toFixed(3)} ms`,
          );
        }
        await wait(280);
        return [
          ...lines,
          '',
          `--- ${host} ping statistics ---`,
          '4 packets transmitted, 4 received, 0.0% packet loss',
          dim('(nothing left this tab — this is a simulation)'),
        ].join('\n');
      },
    },
    {
      name: 'nmap',
      summary: 'scan this portfolio for open ports (simulated)',
      usage: 'nmap [host]',
      async run({ args, services }) {
        services.bus.emit('achievement.unlock', { id: 'nmap' });
        await wait(650);
        const host = args.positional[0] || 'kiansiangang.github.io';
        return [
          `Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toISOString()}`,
          `Nmap scan report for ${host}`,
          'Host is up (0.00042s latency).',
          '',
          `${dim('PORT     STATE    SERVICE     VERSION')}`,
          `443/tcp  ${green('open')}     https       GitHub Pages (TLS 1.3)`,
          `80/tcp   ${green('open')}     http        301 → https`,
          `22/tcp   ${C.red}closed${C.reset}   ssh`,
          `3306/tcp ${C.red}closed${C.reset}   mysql       ${dim('(there is no database — this is a static site)')}`,
          '',
          `${yellow('Attack surface notes:')}`,
          '  · No server-side code. No database. No cookies. No analytics.',
          '  · CSP restricts scripts to same-origin; every library is self-hosted.',
          '  · The smallest attack surface is the one you never build.',
          '',
          'Nmap done: 1 IP address (1 host up) scanned in 0.65 seconds',
        ].join('\n');
      },
    },
    {
      name: 'matrix',
      summary: 'follow the white rabbit',
      usage: 'matrix',
      run: ({ services }) => {
        services.bus.emit('achievement.unlock', { id: 'matrix' });
        return { output: green('Wake up, Neo…'), code: 0, control: { type: 'matrix' } };
      },
    },
    {
      name: 'fortune',
      summary: 'a security aphorism',
      usage: 'fortune',
      run() {
        const quotes = [
          'Amateurs hack systems, professionals hack people.',
          'Complexity is the enemy of security. This website is a cautionary tale.',
          'The only truly secure system is one that is powered off — and even then.',
          'Threat modelling is just asking "what could go wrong?" on purpose.',
          'Security is a process, not a product.',
          'If you did not log it, it did not happen.',
        ];
        return magenta(quotes[Math.floor(Math.random() * quotes.length)]);
      },
    },
    {
      name: 'exit',
      summary: 'close the terminal',
      usage: 'exit',
      run: () => ({ output: dim('logout'), code: 0, control: { type: 'exit' } }),
      aliases: ['quit', 'logout'],
    },
  ];
}
