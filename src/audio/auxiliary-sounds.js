// Existing synthesized cues, rendered once for the native iOS playback path.
// Browser playback keeps the original synthesis functions.
export const CAPTURE_KINDS = ["loss-hit", "loss-crack", "loss-break", "loss-open", "loss-royal", "dash", "hit", "open", "break", "crack", "crack2", "crack3", "charge", "royal"];
export const AUXILIARY_SOUNDS = {
  ...Object.fromEntries(CAPTURE_KINDS.map(kind => [`capture:${kind}`, { file: `se-native-capture-${kind}.wav`, gain: 1 }])),
  "area:birth": { file: "se-native-area-birth.wav", gain: 1 },
  "area:default": { file: "se-native-area-default.wav", gain: 1 },
  "battlepass:full": { file: "se-native-battlepass-full.wav", gain: .7 },
  "battlepass:reduced": { file: "se-native-battlepass-reduced.wav", gain: .7 },
};
