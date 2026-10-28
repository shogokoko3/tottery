export const DEFAULT_HOME_MUSIC = "homeDefault";
export const HOME_PHASE_TRACK = Object.freeze({ 1: "title", 2: "homePhase2", 3: "homePhase3" });
export const HOME_MUSIC_CHOICES = Object.freeze([
  { id: "auto", name: "背景に合わせる（おまかせ）" },
  { id: DEFAULT_HOME_MUSIC, name: "標準のホームBGM" },
  { id: "title", name: "風と土の道" },
  { id: "homePhase2", name: "息をつく場所" },
  { id: "homePhase3", name: "手を重ねた朝" },
].map(Object.freeze));

export function normalizeHomeMusic(value) {
  return HOME_MUSIC_CHOICES.some((choice) => choice.id === value) ? value : "auto";
}
