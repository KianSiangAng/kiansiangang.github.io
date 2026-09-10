/* ================================================================
   PORTFOLIO.JS — The single source of truth

   Every dynamic surface on this site reads from this one object:
   the virtual filesystem, the terminal commands, the command
   palette, the neofetch banner. Change a fact here and it changes
   everywhere at once.

   (The HTML keeps its own static copy of this content so the page
   is fully readable with JavaScript disabled. This module is the
   machine-readable mirror of it.)
================================================================ */

export const identity = {
  name: 'Ang Kian Siang',
  handle: 'kian',
  host: 'portfolio',
  role: 'Cybersecurity Analyst',
  tagline: 'ICT undergraduate at SUSS, specialising in cybersecurity.',
  location: 'Singapore',
  school: 'Singapore University of Social Sciences (SUSS)',
  degree: 'BSc ICT (Cybersecurity)',
  status: 'Open to internships',
  email: 'ksang017@suss.edu.sg',
  github: 'https://github.com/KianSiangAng',
  linkedin: 'https://linkedin.com/in/kiansiangang',
};

export const experience = [
  {
    org: 'DHL Supply Chain',
    title: 'Cybersecurity Analyst Intern',
    summary:
      'Conducted risk assessments for APAC-region applications alongside the CISO. ' +
      'Worked on vulnerability management and presenting security findings to stakeholders.',
    tools: ['Qualys', 'LeanIX', 'Risk Assessment', 'Vulnerability Management'],
  },
];

export const projects = [
  {
    slug: 'password-analyzer',
    title: 'Password Analyzer',
    badge: 'CLI-Only by Design',
    summary:
      'Python terminal tool that analyses password strength, entropy, complexity and ' +
      'breach exposure. Uses the Have I Been Pwned API with k-anonymity so the password ' +
      'never leaves the machine. 0-100 risk score with colour-coded output.',
    threatModel:
      'Deliberately a local CLI, not a web app: a password typed into a website is a ' +
      'password transmitted over the network. Removing the network removes the threat.',
    tags: ['Python', 'HIBP API', 'k-Anonymity', 'Entropy Analysis'],
    url: 'https://github.com/KianSiangAng/password-analyzer',
  },
  {
    slug: 'suss-calendar-exporter',
    title: 'SUSS Calendar Exporter',
    badge: 'Solves a Real Problem',
    summary:
      'Browser tool that parses SUSS timetable data and generates a downloadable .ics ' +
      'file. SUSS e-services cannot export to Google or Apple Calendar; this closes that gap.',
    tags: ['HTML', 'JavaScript', '.ics Generation', 'Web Tool'],
    url: 'https://github.com/KianSiangAng/suss-calendar-exporter',
  },
  {
    slug: 'this-portfolio',
    title: 'This Portfolio',
    badge: 'Wildly Over-Engineered',
    summary:
      'Hand-written vanilla JS with no build step and no framework, running a signals ' +
      'reactivity core, a dependency-injection container, a module kernel, a WebGL2 ' +
      'background renderer, a WebAudio synth and the shell you are typing into.',
    tags: ['WebGL2', 'Web Audio', 'Signals', 'Service Worker', '0 dependencies'],
    url: 'https://github.com/KianSiangAng/kiansiangang.github.io',
  },
];

export const skills = {
  languages: ['Python', 'JavaScript', 'HTML', 'CSS'],
  'security-tools': ['Qualys', 'LeanIX', 'HIBP API'],
  concepts: ['Risk Assessment', 'Threat Modelling', 'Entropy Analysis', 'k-Anonymity'],
  certifications: ['ITIL 4 Foundation', 'Generative AI Specialization'],
};

export const education = {
  school: identity.school,
  degree: identity.degree,
  focus: 'Cybersecurity',
  status: 'Current student',
};

/* Facts the `neofetch` command prints beside its ASCII art. */
export const systemInfo = () => ({
  OS: 'PortfolioOS 2.0 (over-engineered edition)',
  Host: `${identity.handle}@${identity.host}`,
  Kernel: 'kernel.js 2.0.0 — topological module boot',
  Shell: 'ksh (kian shell) 2.0.0',
  Renderer: 'WebGL2 / fbm clouds / canvas2d fallback',
  Reactivity: 'signals — fine-grained, 120 LOC, 0 deps',
  Theme: document.documentElement.dataset.world || 'ghibli',
  Packages: '0 (npm-free by design)',
  Uptime: `${(performance.now() / 1000).toFixed(1)}s`,
});
