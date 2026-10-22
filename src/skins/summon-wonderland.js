// Inner edges of the six Wonderland paintings. Only the door leaves move;
// the columns, carved frame and stairs remain part of the fixed architecture.
const arch = [
  [.315, .619], [.317, .298], [.333, .263], [.361, .239],
  [.397, .220], [.449, .207], [.5, .203], [.551, .207],
  [.603, .220], [.639, .239], [.667, .263], [.683, .298], [.685, .619],
];
const contours = {
  "alice-caucus": arch.map(([u,v]) => [u, v === .619 ? .626 : v]),
  "alice-quadrille": [
    [.302,.611],[.307,.300],[.318,.273],[.342,.247],[.373,.225],
    [.410,.208],[.445,.196],[.478,.190],[.5,.214],[.522,.190],
    [.555,.196],[.590,.208],[.627,.225],[.658,.247],[.682,.273],
    [.693,.300],[.698,.611],
  ],
  "alice-maze": [
    [.315,.617],[.323,.287],[.333,.260],[.354,.235],[.382,.215],
    [.416,.200],[.453,.188],[.478,.181],[.5,.190],[.522,.181],
    [.547,.188],[.584,.200],[.618,.215],[.646,.235],[.667,.260],
    [.677,.287],[.685,.617],
  ],
  "alice-tea": arch,
  "alice-illusion": [
    [.312,.621],[.314,.275],[.329,.242],[.352,.219],[.382,.197],
    [.418,.180],[.453,.170],[.480,.165],[.5,.176],[.520,.165],
    [.547,.170],[.582,.180],[.618,.197],[.648,.219],[.671,.242],
    [.686,.275],[.688,.621],
  ],
  "alice-croquet": [[.31,.615],[.31,.237],[.363,.20],[.5,.20],[.637,.20],[.69,.237],[.69,.615]],
};
export const WONDERLAND_ARCHITECTURE = Object.fromEntries(
  Object.entries(contours).map(([world, edge], index) => [world, {
    seam: .5, edge, motif: index + 1,
    exterior: `skins/summon/wonderland-v1/${world}-gate.webp`,
    interior: `skins/summon/wonderland-v1/${world}-interior.webp`,
  }]),
);
