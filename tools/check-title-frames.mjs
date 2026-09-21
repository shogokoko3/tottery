import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TITLES } from "../src/game/titles.js";
import { seasonTitle } from "../src/game/season.js";
import { titleDesign } from "../src/ui/title-design.js";
import { POOL } from "../src/skins/catalog.js";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-title-frames-"));
try {
  const outfile = path.join(temp, "render.cjs");
  await build({
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `
      import {renderToStaticMarkup} from 'react-dom/server';
      import {TitleFrame} from './src/ui/title-frame.jsx';
      export const render = (props) => renderToStaticMarkup(<TitleFrame {...props}/>);
    `,
    },
  });
  const { render } = createRequire(import.meta.url)(outfile);
  const seasonal = ["king", "first", "three", "ten"].map((place) =>
    seasonTitle(`season:2026-09:${place}`),
  );
  for (const title of [...TITLES, ...seasonal]) {
    const design = titleDesign(title.id);
    assert.ok(
      design && design.motif && design.level >= 1 && design.level <= 6,
      title.id,
    );
    assert.ok(
      Object.values(design.style).every(
        (value) => typeof value === "string" && value.length,
      ),
      title.id,
    );
    for (const size of ["compact", "standard", "showcase"]) {
      const html = render({ id: title.id, size });
      assert.ok(html.includes(`data-title-id="${title.id}"`));
      assert.ok(
        !html.includes("undefined"),
        `${title.id} must have a complete engraving`,
      );
      const text = html.replace(/<[^>]+>/g, "");
      assert.equal(
        text,
        title.name,
        "Full title, including season, stays accessible",
      );
      assert.equal(
        (html.match(/<svg[^>]*aria-hidden="true"/g) || []).length,
        (html.match(/<svg\b/g) || []).length,
      );
      assert.ok(
        html.includes('data-animated="false"'),
        "Battle and list frames are static by default",
      );
    }
  }
  for (const id of [
    undefined,
    null,
    "",
    "new-client-title",
    "season:2026-13:first",
    "<script>",
  ]) {
    assert.equal(
      render({ id }),
      "",
      "Missing or unknown opponent titles render safely",
    );
  }
  assert.ok(
    render({ id: "rank-o", animated: true }).includes('data-animated="true"'),
  );
  assert.ok(
    render({ id: "novice", animated: true }).includes('data-animated="false"'),
  );
  for (const family of new Set(
    TITLES.filter((t) => t.family).map((t) => t.family),
  )) {
    const titles = TITLES.filter((t) => t.family === family);
    const designs = titles.map((t) => JSON.stringify(titleDesign(t.id)));
    for (let i = 1; i < titles.length; i++) {
      const earlier = titleDesign(titles[i - 1].id);
      const later = titleDesign(titles[i].id);
      assert.ok(
        later.level >= earlier.level,
        `${family}: harder tier never loses ornaments`,
      );
      assert.ok(
        later.gems >= earlier.gems,
        `${family}: harder tier never loses jewels`,
      );
    }
    assert.equal(
      new Set(designs).size,
      titles.length,
      `${family}: each earned tier is visually distinct`,
    );
  }
  const grade = (id) => titleDesign(id).level;
  assert.equal(grade("novice"), 1);
  assert.equal(grade("first"), grade("rated"));
  assert.ok(grade("gacha-freeze-1") > grade("gacha-pulls-10"));
  assert.ok(
    grade("gacha-foil-complete-15") > grade("gacha-normal-complete-15"),
  );
  assert.equal(grade("gacha-foil-complete-15"), 6);
  assert.equal(grade("gacha-pulls-10000"), 6);
  for (const rarity of ["R", "SR", "SSR"]) {
    const levels = POOL.filter((s) => s.rarity === rarity).map((s) =>
      grade(`foil-${s.id}`),
    );
    assert.equal(
      new Set(levels).size,
      1,
      `${rarity}: equal acquisition rarity has equal decoration`,
    );
  }
  assert.ok(grade("foil-zombie-male") < grade("foil-elf-male"));
  assert.ok(grade("foil-elf-male") < grade("foil-angel-j"));
  assert.equal(grade("rank-o"), grade("season:2026-09:king"));
  assert.ok(grade("season:2026-09:first") > grade("season:2026-09:three"));
  assert.ok(grade("season:2026-09:three") > grade("season:2026-09:ten"));
  console.log(
    `${TITLES.length} titles + 4 seasonal frames: all sizes, complete names, unknown IDs, static battle display and tier variation OK`,
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
