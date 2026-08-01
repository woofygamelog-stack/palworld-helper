export type IconName="home"|"map"|"pals"|"skills"|"calculator"|"database"|"server"|"search"|"theme"|"sun"|"moon"|"system"|"more"|"close"|"reset"|"plus"|"minus"|"chevronDown"|"pin"|"fastTravel"|"inherit"|"fixed"|"surgery";

const paths:Record<IconName,string>={
  home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  pals:'<circle cx="12" cy="13" r="6"/><circle cx="6" cy="6" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="18" cy="6" r="2"/>',
  skills:'<path d="m12 2 2.3 6.2L21 10l-5 4.2.8 6.8-4.8-3.2L7.2 21 8 14.2 3 10l6.7-1.8z"/>',
  calculator:'<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M8 6h8M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 19h1M12 19h5"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  server:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h7M11 17.5h7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  theme:'<path d="M20 15.5A8 8 0 1 1 8.5 4 6.5 6.5 0 0 0 20 15.5z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 15.5A8 8 0 1 1 8.5 4 6.5 6.5 0 0 0 20 15.5z"/>',
  system:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close:'<path d="m5 5 14 14M19 5 5 19"/>',
  reset:'<path d="M4 4v6h6"/><path d="M5.5 17a8 8 0 1 0 .5-10L4 10"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  chevronDown:'<path d="m7 9 5 5 5-5"/>',
  pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
  fastTravel:'<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
  inherit:'<path d="M7 20V9m0 0L3.5 12.5M7 9l3.5 3.5M17 20V5m0 0-3.5 3.5M17 5l3.5 3.5"/>',
  fixed:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  surgery:'<path d="m4 20 5.5-5.5M14 4l6 6M8 16l-2-2 8-8 4 4-8 8z"/><path d="m14 14 6 6M17 17l3-3"/>',
};

export function icon(name:IconName,className="ui-icon"){return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`}
