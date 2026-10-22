/** Soft reward families, rendered in a low register for each harmonic palette. */
export const TONAL_CUES = {
  reveal_r: 1, reveal_sr: 2, reveal_ssr: 3, foil_acquire: 3, foil_open: 1,
  levelup: 2, mastery: 2, title: 2, login: 1, mission: 1, claim_all: 2,
  forge: 3, win: 3, puzzle_correct: 2,
};
export function tonalSound(id, harmony) {
  const family = TONAL_CUES[id];
  if (!family || !harmony) return null;
  const root = Math.max(0, Math.min(11, Math.round(harmony.root)));
  const mode = ['major', 'minor', 'open'].includes(harmony.mode) ? harmony.mode : 'open';
  const key = `bloom-${family}-${root}-${mode}`;
  return { key, file: `se-${key}.m4a` };
}
export const TONAL_ASSETS = [1,2,3].flatMap(family =>
  Array.from({length:12}, (_,root) => ['major','minor','open'].map(mode =>
    tonalSound(Object.keys(TONAL_CUES).find(id => TONAL_CUES[id] === family), {root,mode}))).flat());
