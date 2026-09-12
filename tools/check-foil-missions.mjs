import assert from "node:assert/strict";
import { FOIL_SKINS, POOL, foilId, rate } from "../src/skins/catalog.js";
import {
  claimFoilMilestone,
  craft,
  shatter,
  normalize,
  pull,
} from "../src/skins/collection.js";
import { CRAFT } from "../src/skins/ether.js";
import { FOIL_MISSION_DEFS } from "../src/game/foil-missions.js";
import {
  KINDS,
  MISSIONS,
  claimableCount,
  listMissions,
  statusOf,
} from "../src/game/missions.js";
import {
  findTitle,
  hasTitle,
  ownedTitles,
  titleNameOf,
  titleOf,
} from "../src/game/titles.js";
import {
  grantMissionTitle,
  loadProfile,
  saveName,
  saveTitle,
} from "../src/game/profile.js";
import { giveGift } from "../src/game/gifts.js";

const memory = new Map();
const profileKey = "tottery.account.v1";
const persist = (key, value) => memory.set(key, String(value));
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: persist,
  removeItem: (key) => memory.delete(key),
};
saveName("フォイル検査");
const fresh = loadProfile();
const resetProfile = () => memory.set(profileKey, JSON.stringify(fresh));
const sequence = (values) => {
  let n = 0;
  return () => {
    assert.ok(n < values.length, "余分な抽選をしない");
    return values[n++];
  };
};
const foilMissions = MISSIONS.filter((mission) => mission.kind === "foil");
assert.ok(KINDS.foil);
assert.equal(FOIL_MISSION_DEFS.length, 15);
assert.equal(foilMissions.length, 15);
assert.equal(new Set(foilMissions.map((m) => m.id)).size, 15);
assert.equal(new Set(foilMissions.map((m) => m.reward.id)).size, 15);
assert.deepEqual(
  foilMissions.map((m) => m.skinId).sort(),
  FOIL_SKINS.map((s) => s.id).sort(),
);
assert.deepEqual(
  FOIL_MISSION_DEFS.map((d) => d.baseId).sort(),
  POOL.map((s) => s.id).sort(),
);
assert.equal(
  foilMissions.some((m) =>
    ["genie-magician", "pegasus-knight"].includes(m.baseId),
  ),
  false,
);

const normalOnly = normalize({
  owned: Object.fromEntries(POOL.map((skin) => [skin.id, 1000])),
});
let threshold = 0;
for (const skin of POOL) {
  const mission = foilMissions.find((m) => m.baseId === skin.id);
  const definition = FOIL_MISSION_DEFS.find((d) => d.baseId === skin.id);
  assert.ok(mission && definition);
  assert.equal(mission.id, "foil-" + skin.id);
  assert.equal(mission.goal, 1);
  assert.equal(mission.skinId, foilId(skin.id));
  assert.deepEqual(mission.reward, { type: "title", id: "foil-" + skin.id });
  assert.equal(definition.missionId, mission.id);
  assert.equal(definition.titleId, mission.reward.id);
  assert.equal(definition.skinId, mission.skinId);
  const title = findTitle(mission.reward.id);
  assert.ok(title);
  assert.equal(title.name, "煌めく" + skin.name);
  assert.equal(title.name, definition.titleName);
  assert.ok(!title.free && !title.unlocked, "所持だけで称号を自動開放しない");
  assert.equal(hasTitle(fresh, title.id), false);
  assert.equal(
    statusOf(mission, fresh).done,
    false,
    "旧APIでcollection省略しても未達",
  );
  assert.equal(statusOf(mission, fresh, normalize(null)).done, false);
  assert.equal(statusOf(mission, fresh, normalOnly).done, false);
  const other = FOIL_SKINS.find((candidate) => candidate.id !== mission.skinId);
  assert.equal(
    statusOf(mission, fresh, normalize({ owned: { [other.id]: 1 } })).done,
    false,
    "別キャラのフォイルは一致しない",
  );
  for (const amount of [0, -1, 1.5, "1", NaN, Infinity]) {
    assert.equal(
      statusOf(mission, fresh, { owned: { [mission.skinId]: amount } }).done,
      false,
      "壊れた所持数は獲得扱いにしない",
    );
  }

  // Existing ownership from before the mission's release already qualifies.
  const existing = normalize({ owned: { [mission.skinId]: 1 } });
  const restored = normalize(JSON.parse(JSON.stringify(existing)));
  for (const collection of [existing, restored]) {
    const status = statusOf(mission, fresh, collection);
    assert.deepEqual(
      {
        done: status.done,
        claimed: status.claimed,
        now: status.now,
        ratio: status.ratio,
      },
      { done: true, claimed: false, now: 1, ratio: 1 },
    );
    assert.equal(
      hasTitle(fresh, title.id),
      false,
      "達成しても報酬受取前は未開放",
    );
  }
  assert.equal(
    statusOf(mission, fresh, normalize({ owned: { [mission.skinId]: 3 } })).now,
    1,
  );

  // The actual acquisition functions determine the same status through all routes.
  const baseRoll = (threshold + rate(skin) / 2) / 100;
  threshold += rate(skin);
  const fromPull = pull(normalize(null), 1, sequence([baseRoll, 0.005]), { free: true });
  const fromCraft = craft(
    normalize({ ether: CRAFT[skin.rarity] }),
    skin.id,
    () => 0.005,
  );
  const fromMilestone = claimFoilMilestone(
    normalize({ acquired: { [skin.id]: 100 }, owned: { [skin.id]: 1 } }),
    skin.id,
  );
  for (const collection of [fromPull, fromCraft, fromMilestone]) {
    assert.equal(statusOf(mission, fresh, collection).done, true);
    assert.equal(
      statusOf(
        mission,
        fresh,
        normalize(JSON.parse(JSON.stringify(collection))),
      ).done,
      true,
    );
  }
  const ordinaryPull = pull(normalize(null), 1, sequence([baseRoll, 0.5]), { free: true });
  const ordinaryCraft = craft(
    normalize({ ether: CRAFT[skin.rarity] }),
    skin.id,
    () => 0.5,
  );
  assert.equal(statusOf(mission, fresh, ordinaryPull).done, false);
  assert.equal(statusOf(mission, fresh, ordinaryCraft).done, false);

  // Use the production atomic title+mission grant, then equip and reload that title.
  resetProfile();
  const before = loadProfile();
  assert.equal(saveTitle(title.id).title, before.title);
  const granted = grantMissionTitle(mission.id, title.id);
  assert.equal(hasTitle(granted, title.id), true);
  assert.equal(granted.missions.filter((id) => id === mission.id).length, 1);
  assert.equal(granted.titles.filter((id) => id === title.id).length, 1);
  assert.equal(saveTitle(title.id).title, title.id);
  assert.equal(titleOf(loadProfile()).id, title.id);
  assert.equal(titleNameOf(title.id), title.name);
  await giveGift(mission.reward);
  grantMissionTitle(mission.id, title.id);
  const reread = loadProfile();
  assert.equal(reread.missions.filter((id) => id === mission.id).length, 1);
  assert.equal(reread.titles.filter((id) => id === title.id).length, 1);
  assert.equal(ownedTitles(reread).filter((t) => t.id === title.id).length, 1);
  const claimed = statusOf(mission, reread);
  assert.equal(claimed.claimed, true);
  assert.equal(
    claimed.done,
    true,
    "受取済みはcollection省略でも完了表示を保つ",
  );
  assert.equal(claimed.now, 1);
  assert.equal(claimed.ratio, 1);
  assert.equal(claimed.raw, 0, "未読所持情報のrawは完成表示に置き換えない");
  // フォイルのダブりは欠片にする(2026-09-10)。1枚残れば称号は保たれる
  const afterDismantle = shatter(
    normalize({ owned: { [mission.skinId]: 2 } }),
    mission.skinId,
  );
  assert.equal(statusOf(mission, reread, afterDismantle).done, true);
  assert.equal(hasTitle(reread, title.id), true);
}
console.log(
  "フォイル称号: 15キャラ1対1・既所持・通常/別キャラ除外・3獲得経路・称号受取/装備/復元: OK",
);

resetProfile();
const all = normalize({
  owned: Object.fromEntries(FOIL_SKINS.map((skin) => [skin.id, 1])),
});
assert.equal(claimableCount(fresh, all), claimableCount(fresh) + 15);
assert.equal(
  listMissions(fresh, all)
    .slice(0, 15)
    .every((m) => m.kind === "foil" && m.done && !m.claimed),
  true,
);
const first = foilMissions[0];
grantMissionTitle(first.id, first.reward.id);
assert.equal(claimableCount(loadProfile(), all), 14);
assert.equal(listMissions(loadProfile(), all).at(-1).id, first.id);

// A failed profile write must not leave just the claimed marker or just the title.
resetProfile();
const original = memory.get(profileKey);
const writes = [];
globalThis.localStorage.setItem = (key, value) => {
  writes.push([key, value]);
  throw new Error("quota");
};
assert.throws(() => grantMissionTitle(first.id, first.reward.id));
assert.equal(writes.length, 1, "称号と受取済みを1回で保存");
assert.equal(memory.get(profileKey), original);
assert.equal(hasTitle(loadProfile(), first.reward.id), false);
assert.equal(loadProfile().missions.includes(first.id), false);
assert.equal(statusOf(first, loadProfile(), all).claimed, false);
const attempted = JSON.parse(writes[0][1]);
assert.equal(attempted.titles.includes(first.reward.id), true);
assert.equal(attempted.missions.includes(first.id), true);
globalThis.localStorage.setItem = persist;
const retried = grantMissionTitle(first.id, first.reward.id);
assert.equal(hasTitle(retried, first.reward.id), true);
assert.equal(retried.missions.includes(first.id), true);
const stable = memory.get(profileKey);
grantMissionTitle(first.id, first.reward.id);
assert.equal(
  memory.get(profileKey),
  stable,
  "受取済みの再呼び出しで重複しない",
);
assert.equal(hasTitle(loadProfile(), first.reward.id), true);
console.log(
  "フォイル称号: 一覧/入口件数・受取済表示・単一保存・失敗後再試行・冪等: OK",
);
