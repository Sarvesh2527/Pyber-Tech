// All editable site configuration and interactive copy lives here.
// (Static page copy — headings, paragraphs — lives in index.html.)

export const CONFIG = {
  company: 'Pyber Solution',
  email: 'techpyber@gmail.com',

  // Shows the dashed "Team & credentials" slot in the Trust chapter.
  // Set to false to hide it until you have real, verifiable proof to put there.
  showPlaceholders: true,

  // e.g. 'within two working days'. Left empty on purpose: no promise is shown.
  responseTime: '',
};

// What can be tested. `layers` lights the matching layers in the mini model.
// Scope below is typical VAPT scope — confirm it matches what you actually offer.
export const AREAS = [
  {
    id: 'web', icon: 'i-web', label: 'Website', desc: 'Company site, marketing pages, landing pages',
    layers: ['web'],
    looks: [
      { t: 'Forms and search boxes that accept input. Can they be tricked?', tag: 'Injection, XSS' },
      { t: 'Admin pages or files that were never meant to be public.', tag: 'Exposure, misconfiguration' },
      { t: 'Outdated plugins and software with known weaknesses.', tag: 'Known vulnerabilities' },
    ],
  },
  {
    id: 'webapp', icon: 'i-webapp', label: 'Web app or SaaS', desc: 'Customer logins, dashboards, admin areas',
    layers: ['web', 'login'],
    looks: [
      { t: 'Login and password reset: can they be guessed or bypassed?', tag: 'Authentication, sessions' },
      { t: 'Can one customer see another customer’s data?', tag: 'Access control' },
      { t: 'Can an ordinary user do things only admins should?', tag: 'Privilege escalation, logic flaws' },
    ],
  },
  {
    id: 'api', icon: 'i-api', label: 'API', desc: 'For your app, your partners or your mobile app',
    layers: ['api'],
    looks: [
      { t: 'Does every request get checked properly, every time?', tag: 'Broken authorization' },
      { t: 'Does it hand back more data than it should?', tag: 'Data exposure' },
      { t: 'Can someone hammer it without limits?', tag: 'Rate limiting, abuse' },
    ],
  },
  {
    id: 'mobile', icon: 'i-mobile', label: 'Mobile app', desc: 'Android or iOS',
    layers: ['login', 'api'],
    looks: [
      { t: 'What the app stores on the phone, and how well it’s protected.', tag: 'Insecure storage' },
      { t: 'How the app talks to your servers.', tag: 'Transport security' },
      { t: 'Whether the app can be tampered with or picked apart.', tag: 'Reverse engineering' },
    ],
  },
  {
    id: 'cloud', icon: 'i-cloud', label: 'Cloud setup', desc: 'Servers, storage, databases',
    layers: ['cloud'],
    looks: [
      { t: 'Storage that’s accidentally open to the public.', tag: 'Public buckets' },
      { t: 'Accounts and roles with more access than they need.', tag: 'Permissions review' },
      { t: 'Services left open to the internet that shouldn’t be.', tag: 'Exposed services' },
    ],
  },
  {
    id: 'network', icon: 'i-network', label: 'Network', desc: 'Internet-facing servers and office network',
    layers: ['cloud'],
    looks: [
      { t: 'What can be seen and reached from the outside.', tag: 'Port and service discovery' },
      { t: 'Software that’s out of date or poorly configured.', tag: 'Patching, hardening' },
      { t: 'Whether firewall rules do what you think they do.', tag: 'Firewall review' },
    ],
  },
  {
    id: 'unsure', icon: 'i-unsure', label: 'Not sure yet', desc: 'We’ll help you map what you have',
    layers: [],
    looks: [
      { t: 'Tell us what you have, even roughly. A web address and a sentence is enough.', tag: 'Scoping' },
      { t: 'We’ll suggest what’s worth testing first, and what can wait.', tag: 'Priorities' },
      { t: 'You get a quote for that scope and nothing more.', tag: 'Quote' },
    ],
  },
];

export const DEFAULT_LOOKS = {
  title: 'What we’d look at',
  items: [
    { t: 'Pick what you run, and this fills in.', tag: 'Your scope' },
  ],
};
