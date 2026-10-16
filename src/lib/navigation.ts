/** Page names shared by the header, crew links and footer. */
export const SITE_LINKS = [
  { path: '/', label: 'Playing' },
  { path: '/night/', label: 'Crew' },
  { path: '/learn/', label: 'Learn' },
];

export const CREW_LINKS = [
  { path: '/setup/', label: 'Rig reference' },
  { path: '/recordings/', label: 'Recordings' },
  { path: '/print/', label: 'Print kit' },
];

export const FOOTER_LINKS = [...SITE_LINKS, ...CREW_LINKS, { path: '/learn/#sources', label: 'Sources' }];
