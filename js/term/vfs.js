/* ================================================================
   VFS.JS — An in-memory virtual filesystem

   The terminal needs something to `ls`. Rather than hard-coding
   fake output, we build a real (if tiny) filesystem out of the
   portfolio data model, with directories, files, permissions and
   path resolution that behaves the way a POSIX shell user expects:

     ..  .  ~  /  relative and absolute paths, trailing slashes,
     and a proper ENOENT / ENOTDIR error taxonomy.

   Nodes:
     { type: 'dir',  name, children: Map }
     { type: 'file', name, content: string, mode }
================================================================ */

import { identity, projects, skills, experience, education } from '../data/portfolio.js';

function dir(name, children = []) {
  return { type: 'dir', name, mode: 'drwxr-xr-x', children: new Map(children.map((c) => [c.name, c])) };
}

function file(name, content, mode = '-rw-r--r--') {
  return { type: 'file', name, content: String(content).replace(/\n+$/, ''), mode };
}

/* ----------------------------------------------------------------
   Content generators — data model → text files
---------------------------------------------------------------- */

function projectFile(project) {
  const lines = [
    `# ${project.title}`,
    '',
    project.summary,
    '',
    project.threatModel ? `## Threat modelling\n${project.threatModel}\n` : '',
    `## Stack`,
    project.tags.map((t) => `  - ${t}`).join('\n'),
    '',
    `## Source`,
    `  ${project.url}`,
  ];
  return file(`${project.slug}.md`, lines.filter(Boolean).join('\n'));
}

function skillsFiles() {
  return Object.entries(skills).map(([category, items]) =>
    file(`${category}.txt`, items.join('\n')),
  );
}

const aboutText = [
  `${identity.name} — ${identity.role}`,
  '',
  identity.tagline,
  '',
  `Location   ${identity.location}`,
  `School     ${identity.school}`,
  `Degree     ${identity.degree}`,
  `Status     ${identity.status}`,
  '',
  'I enjoy building practical tools that solve real problems, and I approach',
  'every project with a security-first mindset and a genuine curiosity for',
  'how things work under the hood.',
].join('\n');

const resumeText = [
  '=== EXPERIENCE ===',
  '',
  ...experience.map((job) =>
    [`${job.title} — ${job.org}`, '', `  ${job.summary}`, '', `  Tools: ${job.tools.join(', ')}`].join('\n'),
  ),
  '',
  '=== EDUCATION ===',
  '',
  `${education.degree}`,
  `${education.school}`,
  `Focus: ${education.focus} (${education.status})`,
  '',
  '=== CERTIFICATIONS ===',
  '',
  ...skills.certifications.map((c) => `  * ${c}`),
].join('\n');

const contactText = [
  `email      ${identity.email}`,
  `github     ${identity.github}`,
  `linkedin   ${identity.linkedin}`,
  '',
  'Always open to internship opportunities and collaborations.',
].join('\n');

const motdText = [
  '  Welcome to PortfolioOS.',
  '',
  '  This shell is real: commands are parsed, piped and executed',
  '  against an in-memory filesystem. Nothing here is a screenshot.',
  '',
  "  Try:  help  ·  ls  ·  cat about.txt  ·  neofetch  ·  theme hacker",
].join('\n');

/* ----------------------------------------------------------------
   The tree
---------------------------------------------------------------- */

export function createVFS() {
  const home = dir('kian', [
    file('about.txt', aboutText),
    file('resume.txt', resumeText),
    file('contact.txt', contactText),
    dir('projects', projects.map(projectFile)),
    dir('skills', skillsFiles()),
    dir('.secret', [
      file('flag.txt', 'flag{you_read_the_source_like_a_real_analyst}', '-r--------'),
      file('note.md', 'If you found this by typing `ls -a`, you already think like an attacker.'),
    ]),
  ]);

  const root = dir('/', [
    dir('home', [home]),
    dir('etc', [
      file('motd', motdText),
      file('hostname', identity.host),
      file('shells', '/bin/ksh'),
    ]),
    dir('proc', [
      file('version', 'PortfolioOS 2.0.0 (kernel.js) — vanilla JS, 0 dependencies'),
    ]),
  ]);

  const HOME = '/home/kian';

  /** Split a path into segments, expanding ~ and resolving . / .. */
  function normalise(path, cwd) {
    let raw = String(path || '').trim();
    if (raw === '~' || raw.startsWith('~/')) raw = HOME + raw.slice(1);
    const absolute = raw.startsWith('/');
    const base = absolute ? [] : cwd.split('/').filter(Boolean);
    const segments = raw.split('/').filter(Boolean);

    const stack = base.slice();
    for (const segment of segments) {
      if (segment === '.') continue;
      if (segment === '..') { stack.pop(); continue; }
      stack.push(segment);
    }
    return '/' + stack.join('/');
  }

  /** Walk the tree. Returns { node, path } or throws a shell-shaped error. */
  function lookup(path, cwd = HOME) {
    const full = normalise(path, cwd);
    const segments = full.split('/').filter(Boolean);
    let node = root;

    for (let i = 0; i < segments.length; i++) {
      if (node.type !== 'dir') {
        const err = new Error(`${full}: Not a directory`);
        err.code = 'ENOTDIR';
        throw err;
      }
      const next = node.children.get(segments[i]);
      if (!next) {
        const err = new Error(`${full}: No such file or directory`);
        err.code = 'ENOENT';
        throw err;
      }
      node = next;
    }
    return { node, path: full };
  }

  function list(path, cwd, { all = false } = {}) {
    const { node, path: full } = lookup(path, cwd);
    if (node.type === 'file') return [{ ...node, path: full }];
    return [...node.children.values()]
      .filter((child) => all || !child.name.startsWith('.'))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  }

  function read(path, cwd) {
    const { node, path: full } = lookup(path, cwd);
    if (node.type === 'dir') {
      const err = new Error(`${full}: Is a directory`);
      err.code = 'EISDIR';
      throw err;
    }
    if (node.mode.startsWith('-r--------') && !state.elevated) {
      const err = new Error(`${full}: Permission denied`);
      err.code = 'EACCES';
      throw err;
    }
    return node.content;
  }

  /** Recursive `tree`-style rendering with box-drawing characters. */
  function tree(path, cwd, prefix = '', depth = 0, maxDepth = 3) {
    const { node } = lookup(path, cwd);
    if (node.type === 'file') return node.name;

    const children = [...node.children.values()]
      .filter((c) => !c.name.startsWith('.'))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));

    const lines = [];
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      const branch = last ? '└── ' : '├── ';
      lines.push(prefix + branch + child.name + (child.type === 'dir' ? '/' : ''));
      if (child.type === 'dir' && depth < maxDepth) {
        const childPath = (path === '/' ? '' : path) + '/' + child.name;
        const sub = tree(childPath, cwd, prefix + (last ? '    ' : '│   '), depth + 1, maxDepth);
        if (sub) lines.push(sub);
      }
    });
    return lines.join('\n');
  }

  /** Every file path in the tree — used by tab completion and grep. */
  function walk(node = root, base = '') {
    const out = [];
    for (const child of node.children.values()) {
      const path = `${base}/${child.name}`;
      out.push({ path, node: child });
      if (child.type === 'dir') out.push(...walk(child, path));
    }
    return out;
  }

  /* `sudo` flips this, which is the only thing standing between a
     visitor and /home/kian/.secret/flag.txt. Security theatre, on
     purpose — it is a fake filesystem in a web page. */
  const state = { elevated: false };

  return {
    HOME,
    root,
    lookup,
    list,
    read,
    tree,
    walk,
    normalise,
    get elevated() { return state.elevated; },
    set elevated(v) { state.elevated = Boolean(v); },
  };
}
