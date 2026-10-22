import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('sets.json', root), 'utf8'));
const revised = new Map([['4-hatter','v2'],['5-march-hare','v2'],['8-white-rabbit','v3'],['Q-queen','v2']]);
const decorRevised = new Set(['A-alice','2-dodo','3-bill']);
let total = 0;
const results = [];
for (const s of data.sets) {
  s.sceneSource = s.slug + (revised.has(s.slug) ? '-' + revised.get(s.slug) : '') + '.png';
  s.decorationSource = s.slug + '-decor' + (decorRevised.has(s.slug) ? '-v2' : '') + '.png';
  for (const [source, dest, width] of [[s.sceneSource,s.scene,1672],[s.decorationSource,s.decoration,1080]]) {
    const png = await readFile(new URL(source, root));
    if (png.toString('ascii',1,4) !== 'PNG') throw Error(`Invalid PNG: ${source}`);
    const w=png.readUInt32BE(16), h=png.readUInt32BE(20);
    const ratio=w/h;
    if (dest===s.scene ? ratio<1.7||ratio>1.85 : ratio<.53||ratio>.6) throw Error(`Unexpected ratio ${source}: ${w}x${h}`);
    const proc = spawnSync('/usr/local/bin/cwebp', ['-quiet','-q','88','-m','6','-resize',String(width),'0',fileURLToPath(new URL(source,root)),'-o',fileURLToPath(new URL(dest,root))], { encoding:'utf8' });
    if (proc.status !== 0) throw Error(proc.stderr || `Conversion failed: ${source}`);
    const bytes=(await stat(new URL(dest,root))).size;
    if (!bytes) throw Error(`Empty output: ${dest}`);
    total+=bytes;
    results.push({file:dest,source,sourceWidth:w,sourceHeight:h,bytes});
  }
  for (const file of Object.values(s.frames)) {
    const svg=await readFile(new URL(file,root),'utf8');
    if (!svg.includes('<svg')||!svg.includes('</svg>')) throw Error(`Invalid frame: ${file}`);
  }
}
await writeFile(new URL('sets.json',root), JSON.stringify(data,null,2)+'\n');
await writeFile(new URL('asset-check.json',root), JSON.stringify({sets:data.sets.length,webpFiles:results.length,svgFiles:data.sets.length*3,webpBytes:total,images:results},null,2)+'\n');
console.log(JSON.stringify({sets:data.sets.length,webpFiles:results.length,svgFiles:data.sets.length*3,webpMB:(total/1048576).toFixed(2)}));
