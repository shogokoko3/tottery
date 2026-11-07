// Existing synthesized cues, rendered once for the native iOS playback path.
// Browser playback keeps the original synthesis functions.
export const CAPTURE_KINDS = ["loss-hit", "loss-crack", "loss-break", "loss-open", "loss-royal", "dash", "hit", "open", "break", "crack", "crack2", "crack3", "charge", "royal"];
// About +3 dB for the body of a successful capture. Keep loss/air/charge
// cues unchanged and share the same gain on native and browser playback.
export const capturePresentationGain = kind =>
  ["hit", "break", "crack", "crack2", "crack3", "royal"].includes(kind) ? 1.4 : 1;
export const AUXILIARY_SOUNDS = {
  ...Object.fromEntries(CAPTURE_KINDS.map(kind => [`capture:${kind}`, { file: `se-native-capture-${kind}.wav`, gain: capturePresentationGain(kind) }])),
  "area:birth": { file: "se-native-area-birth.wav", gain: 1 },
  "area:default": { file: "se-native-area-default.wav", gain: 1 },
  "battlepass:full": { file: "se-native-battlepass-full.wav", gain: .7 },
  "battlepass:reduced": { file: "se-native-battlepass-reduced.wav", gain: .7 },
};
