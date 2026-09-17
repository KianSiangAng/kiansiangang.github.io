/* ================================================================
   PORTFOLIO.JS — The single source of truth

   Every dynamic surface on this site reads from this one object:
   the virtual filesystem, the terminal commands, the command
   palette, the neofetch banner, the résumé window. Change a fact
   here and it changes everywhere at once.

   (The HTML keeps its own static copy of this content so the page
   is fully readable with JavaScript disabled. This module is the
   machine-readable mirror of it.)

   On the cybersecurity framing, which this file used to get wrong:
   the SUSS degree is a general Bachelor of Information and
   Communication Technology. It is not a cybersecurity
   specialisation and must not be described as one. The security
   background is real but it comes from elsewhere — a Diploma in
   Cybersecurity and Digital Forensics, and an internship spent
   doing risk assessments — and the security work is the direction
   of travel rather than the current course title. Saying so
   plainly is both accurate and a better story than the
   overstatement was.
================================================================ */

export const identity = {
  name: 'Ang Kian Siang',
  handle: 'kian',
  host: 'portfolio',

  /* What to call him today, not what he is aiming at. The aim is
     `seeking`, below, and the two are deliberately separate. */
  role: 'ICT Undergraduate',
  seeking: 'Cybersecurity',

  tagline: 'ICT undergraduate at SUSS, with a cybersecurity diploma and an '
    + 'internship behind me and security as where I want to end up.',

  location: 'Singapore',
  school: 'Singapore University of Social Sciences (SUSS)',
  degree: 'BSc Information and Communication Technology',
  status: 'Open to internships',

  email: 'ksang017@suss.edu.sg',
  github: 'https://github.com/KianSiangAng',
  linkedin: 'https://linkedin.com/in/kiansiangang',

  /* The authored PDF, which is the document that actually gets sent
     to people. The site's own résumé view is a convenience; this is
     the artefact. */
  resume: 'assets/resume/Ang-Kian-Siang-Resume.pdf',
};

export const experience = [
  {
    org: 'DHL Supply Chain',
    title: 'Cybersecurity Analyst Intern',
    location: 'Singapore',
    period: 'Jun 2022 – Feb 2023',
    summary:
      'Assisted the CISO with end-to-end risk assessments for new applications '
      + 'entering the company\'s ecosystem across the APAC region.',
    points: [
      'Identified and documented application vulnerabilities using Qualys and '
      + 'LeanIX, liaising directly with product owners to track remediation.',
      'Checked onboarded applications against DHL\'s security baseline, reducing '
      + 'the risk of exploitation before go-live.',
    ],
    tools: ['Qualys', 'LeanIX', 'Risk Assessment', 'Vulnerability Management'],
  },
  {
    org: 'The Logic Coders',
    title: 'Student Tutor (Python & Robotics)',
    location: 'Singapore',
    period: 'Nov 2025 – Present',
    summary:
      'Teaching Python and robotics to students across a wide range of ages and '
      + 'skill levels.',
    points: [
      'Taught robotics with Lego EV3 and block-based languages including '
      + 'CodeMonkey and MakeCode.',
      'Coached students for competitions including the Hwa Chong '
      + 'Information-Communication Challenge and CodeFest.',
    ],
    tools: ['Python', 'Lego EV3', 'CodeMonkey', 'MakeCode'],
  },
  {
    org: 'MathVision',
    title: 'Student Tutor (Mathematics)',
    location: 'Singapore',
    period: 'Jul 2025 – Nov 2025',
    summary:
      'Tutored Grades 1–8 in mathematics and lower-grade Olympiad maths, adapting '
      + 'lessons to how each student actually learns.',
    points: [],
    tools: ['Mathematics', 'Olympiad Maths'],
  },
];

export const projects = [
  {
    slug: 'password-analyzer',
    title: 'Password Analyzer',
    badge: 'CLI-Only by Design',
    summary:
      'Python terminal tool that analyses password strength, entropy, complexity and '
      + 'breach exposure. Uses the Have I Been Pwned API with k-anonymity so the password '
      + 'never leaves the machine. 0-100 risk score with colour-coded output.',
    threatModel:
      'Deliberately a local CLI, not a web app: a password typed into a website is a '
      + 'password transmitted over the network. Removing the network removes the threat.',
    tags: ['Python', 'HIBP API', 'k-Anonymity', 'Entropy Analysis'],
    url: 'https://github.com/KianSiangAng/password-analyzer',
  },
  {
    slug: 'suss-calendar-exporter',
    title: 'SUSS Calendar Exporter',
    badge: 'Solves a Real Problem',
    summary:
      'Browser tool that parses SUSS timetable data and generates a downloadable .ics '
      + 'file. SUSS e-services cannot export to Google or Apple Calendar; this closes that gap. '
      + 'Used by SUSS students to keep their schedules in the calendar they already use.',
    tags: ['HTML', 'JavaScript', '.ics Generation', 'Web Tool'],
    url: 'https://github.com/KianSiangAng/suss-calendar-exporter',
  },
  {
    slug: 'this-portfolio',
    title: 'This Portfolio',
    badge: 'Wildly Over-Engineered',
    summary:
      'Hand-written vanilla JS with no build step and no framework, running a signals '
      + 'reactivity core, a dependency-injection container, a module kernel, a WebGL2 '
      + 'background renderer, a WebAudio synth and the shell you are typing into.',
    tags: ['WebGL2', 'Web Audio', 'Signals', 'Service Worker', '0 dependencies'],
    url: 'https://github.com/KianSiangAng/kiansiangang.github.io',
  },
];

export const skills = {
  languages: ['Python', 'JavaScript', 'HTML', 'CSS', 'SQL (basic)'],
  'security-tools': ['Qualys', 'LeanIX', 'HIBP API'],
  concepts: [
    'Cybersecurity Risk Assessment',
    'Password Security Analysis',
    'Digital Forensics',
    'Data Analysis',
    'Threat Modelling',
    'REST APIs',
    'iCal / ICS',
  ],
  certifications: [
    'ITIL 4 Foundation (2025)',
    'Introduction to Generative AI Learning Path Specialization (2024)',
  ],
  'soft-skills': [
    'Communication',
    'Stakeholder management',
    'Analytical thinking',
    'Adaptability',
  ],
};

/* Two entries, and the order matters. The degree in progress comes
   first because it is the current answer to "what are you doing";
   the diploma comes second because it is the answer to "where does
   the security come from". */
export const education = [
  {
    school: 'Singapore University of Social Sciences',
    qualification: 'Bachelor of Information and Communication Technology',
    period: 'Aug 2025 – Jan 2029 (expected)',
    detail: 'GPA 4.45 / 5.00',
    points: [
      'Relevant coursework: Data Structures, Cybersecurity Fundamentals, '
      + 'Programming with Python, Networking.',
    ],
  },
  {
    school: 'Temasek Polytechnic',
    qualification: 'Diploma in Cybersecurity and Digital Forensics',
    period: 'Apr 2020 – Apr 2023',
    detail: 'Where the security grounding comes from',
    points: [
      'Class Representative (2021 and 2023); member of the IIT Subcommittee.',
    ],
  },
];

export const achievements = [
  'Colours Award — 1st individual placing, NSG Taekwondo Championship (2018)',
];

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
