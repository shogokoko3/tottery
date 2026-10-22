import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const { sets } = JSON.parse(await readFile(new URL('sets.json', root), 'utf8'));
await mkdir(new URL('frames/', root), { recursive: true });
// Same transparent vector format and viewBoxes as the first-gacha home frames.
// Symbols occupy a 40x40 space and remain readable at small home-screen sizes.
const symbols = {
  key: '<circle cx="15" cy="12" r="7"/><circle cx="15" cy="12" r="3"/><path d="m20 17 14 14-4 4-3-3-3 3-3-3 3-3-8-8"/>',
  feather: '<path d="M9 33C5 23 11 7 33 4c1 18-9 28-24 29Z"/><path d="M6 37 29 8M13 28l-3-10m9 5-2-11m7 5 8-4M17 25l11-3"/>',
  brush: '<path d="m12 35 13-20 3 2-13 20ZM19 12l12 8M16 12l6-8M20 15l8-12M24 17 33 5M28 19l9-10M15 11l19 12"/>',
  hat: '<path d="m10 27-2-19q12-5 24 0l-2 19M10 21q10 4 20 0M4 29q16-8 32 0v4q-16 7-32 0Z"/><path d="m24 18 5-13m-3 14 7-12"/>',
  teapot: '<path d="M10 16c-8 14 1 21 11 20 11-1 14-10 7-20Z M10 16q10-7 18 0M16 11q4-4 8 0M20 6v4M11 20 2 14l3 12 6 4M30 18c13-4 11 12 1 11"/>',
  wing: '<path d="M6 34C8 13 20 8 35 3c0 9-5 14-15 18 7-1 11-4 14-6-1 9-7 13-17 14 5 1 8 0 12-1-4 8-12 11-23 6Z"/><path d="M8 32 29 9M10 29l12-8"/>',
  shell: '<path d="M20 35C13 32 3 24 3 15c0-5 5-8 8-6 1-9 9-9 9-5 4-7 10-2 10 5 5-2 9 3 7 9-2 8-10 14-17 17Z"/><path d="M20 34V5M20 34 11 9M20 34l10-25M20 34 5 16M20 34l15-18"/>',
  clock: '<circle cx="20" cy="24" r="13"/><circle cx="20" cy="24" r="10"/><path d="M20 5V2m-4 4h8v4h-8ZM20 17v7l6 4M20 13v2m0 18v2M9 24h2m18 0h2"/>',
  mushroom: '<path d="M3 23C3 2 36 0 37 23c-11 4-23 4-34 0ZM17 26l-3 10q6 3 12 0l-3-10"/><path d="M4 23q16-6 32 0"/><circle cx="13" cy="14" r="2.4"/><circle cx="25" cy="11" r="3"/><circle cx="29" cy="20" r="1.5"/>',
  cat: '<path d="m6 20-1-15 11 9h8l11-9-1 15c7 17-35 19-28 0Z"/><path d="m10 22 6 2m8 0 6-2M13 29q7 6 14-1M20 25l-2 2h4ZM4 25l-4-2m4 6-4 1m36-5 4-2m-4 6 4 1"/>',
  tart: '<path d="M5 17c-6 0-2 20 15 20s21-20 15-20c-2-2-4 0-6-2-3-3-5 0-9-3-4 3-6 0-9 3-2 2-4 0-6 2Z"/><path d="M20 29C-2 17 13 6 20 16c8-10 22 1 0 13Z"/><path d="m8 26 1 5m6 1 1 3m9-3-1 3m8-9-2 5"/>',
  heart: '<path d="M20 35C-7 20 8 4 20 17 32 4 47 20 20 35Z"/><path d="m9 12-3-9 9 5 5-7 5 7 9-5-3 9ZM11 10h18"/>',
  crown: '<path d="m6 28-3-20 10 9 7-14 7 14 10-9-3 20ZM6 28h28v6H6ZM12 27l-1-7m9 7V15m8 12 1-7"/><circle cx="20" cy="3" r="2"/><circle cx="3" cy="8" r="2"/><circle cx="37" cy="8" r="2"/>',
};
function svg(w,h,body,s) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true"><defs><linearGradient id="metal" x2=".7" y2="1"><stop stop-color="#fff0c4"/><stop offset=".38" stop-color="${s.accent}"/><stop offset=".7" stop-color="#796044"/><stop offset="1" stop-color="${s.accent}"/></linearGradient></defs>${body}</svg>`;
}
function icon(s,transform) {
  return `<g transform="${transform}" fill="${s.panel}" stroke="url(#metal)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${symbols[s.motif]}</g>`;
}
for (const s of sets) {
  const corner = svg(80,80, `<path d="M4 77V28C4 12 13 4 29 4h48l-10 8H31C18 12 12 18 12 31v36Z" fill="${s.panel}" stroke="url(#metal)" stroke-width="1.5"/>
    <path d="M17 65V34c0-10 7-17 17-17h31M7 55c18-4 18 11 10 13-7 2-8-7-3-8M55 7c-4 18 11 18 13 10 2-7-7-8-8-3" stroke="url(#metal)" stroke-width="1.4"/>
    <path d="M10 29 5 20l6-10 10-5 9 5-4 12-4 4Z" fill="${s.secondary}" stroke="url(#metal)"/>
    <path d="m29 29 7-6 7 6-7 7Z" fill="${s.secondary}" stroke="url(#metal)"/>
    ${icon(s,'translate(3 2) scale(.67)')}<circle cx="49" cy="11" r="2" fill="${s.accent}"/><circle cx="11" cy="49" r="2" fill="${s.accent}"/>`,s);
  const crest = svg(120,52, `<path d="M4 35C9 16 28 18 43 29l17 14 17-14c15-11 34-13 39 6-10-6-17 9-34 4L60 49 38 39C21 44 14 29 4 35Z" fill="${s.panel}" stroke="url(#metal)" stroke-width="1.3"/>
    <path d="M48 37C31 20 16 25 19 32s12 3 8-1m45 6c17-17 32-12 29-5s-12 3-8-1" stroke="url(#metal)" stroke-width="1.7"/>
    <path d="M42 17 60 2l18 15-5 22-13 11-13-11Z" fill="${s.panel}" stroke="url(#metal)"/>
    ${icon(s,'translate(42 3) scale(.9)')}<path d="m9 31 6-6m90 0 6 6" stroke="${s.secondary}" stroke-width="2.5"/>`,s);
  const rail = svg(24,160, `<path d="M12 2C1 19 22 35 12 52S2 87 12 106s9 32 0 52" stroke="${s.panel}" stroke-width="7"/>
    <path d="M12 2C1 19 22 35 12 52S2 87 12 106s9 32 0 52" stroke="url(#metal)" stroke-width="2"/>
    <path d="M12 19 4 31l8 10 8-10ZM12 119l-8 11 8 11 8-11Z" fill="${s.secondary}" stroke="url(#metal)"/>
    <path d="M12 57 2 69v22l10 12 10-12V69Z" fill="${s.panel}" stroke="url(#metal)"/>
    ${icon(s,'translate(2 69) scale(.5)')}<path d="M12 6v8m0 132v8" stroke="${s.accent}"/>`,s);
  await writeFile(new URL(s.frames.corner, root), corner);
  await writeFile(new URL(s.frames.crest, root), crest);
  await writeFile(new URL(s.frames.rail, root), rail);
}
console.log(`Created ${sets.length * 3} frame SVGs.`);
