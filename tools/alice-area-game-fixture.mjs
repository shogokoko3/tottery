import { initialState } from '../src/game/reducer.js';
import { syncAlice } from '../src/game/alice-rules.js';
import { ALICE_SKINS } from '../src/skins/alice.js';
import { GAME_RULE_VERSION } from '../src/game/rule-version.js';
import { SKINS } from '../src/skins/catalog.js';
import { initAreas } from '../src/game/areas.js';

export const alicePreviewLoadout = Object.fromEntries(ALICE_SKINS.map(s => [s.rank, `${s.id}:foil`]));
export const alicePreviewAreas = [
  ['alice-caucus', 'コーカス・レース', '2'],
  ['alice-quadrille', 'カドリール', '4'],
  ['alice-maze', '迷いの森', '6'],
  ['alice-tea', '終わらないお茶会', '8'],
  ['alice-illusion', '幻影', '10'],
  ['alice-croquet', 'クロッケー大会', 'Q'],
];
export const referencePreviewAreas = [['forest', '森（既存）', '6'], ['sea', '海（既存）', '4']];
const referenceLoadout = Object.fromEntries(SKINS.filter(s=>s.series==='heroes' && !s.foil).map(s=>[s.rank, `${s.id}:foil`]));
export const previewLoadout = theme => theme?.startsWith('alice-') || !theme ? alicePreviewLoadout : referenceLoadout;

export function aliceAreaGameFixture(theme = 'alice-tea', {corners = false} = {}) {
  const rank = [...alicePreviewAreas,...referencePreviewAreas].find(a => a[0] === theme)?.[2] || '8';
  const s = {
    ...initialState(), phase: 'play', ruleVersion: GAME_RULE_VERSION,
    boardSize: 9, board: Array.from({length:9}, () => Array(9).fill(null)),
    pieces: {}, currentTurn: 0, turnNo: 8, firstPlayer: 0,
    areasEnabled: true, areaLoadouts: [previewLoadout(theme), {}],
    setupMode: 'sequential', setupEffects: null, setupAck: null,
    clocks: [245000, 258000], known: [{}, {}],
    log: ['対局開始', '相手の駒がd7からd6に移動した'],
    lastMove: {owner:1, pieceId:'foe-3', from:{row:2,col:3}, to:{row:3,col:3}, seq:4},
  };
  const own = [[rank,7,4,true],['2',5,2],['3',6,3],['4',7,1],['5',6,6],['7',8,2],['9',8,6],['10',4,5]];
  const foe = [['K',0,4,true],['2',1,2],['3',2,5],['4',3,3],['5',1,6],['6',2,1],['9',0,7],['10',4,7]];
  for (const [owner, specs] of [[0,own],[1,foe]]) {
    const hand = [], counts = {};
    specs.forEach(([pieceRank,row,col,isKing = false],i) => {
      const id = `${owner ? 'foe' : 'own'}-${i}`;
      const p = {id,rank:pieceRank,suit:i%2?'spade':'heart',owner,row,col,isKing,alive:true,revealed:!isKing && i===3,history:[]};
      s.pieces[id] = p; s.board[row][col] = p;
      hand.push({id,rank:pieceRank,suit:p.suit}); counts[pieceRank] = (counts[pieceRank] || 0)+1;
      if (isKing) s.players[owner] = {...s.players[owner],kingId:id};
    });
    s.players[owner] = {...s.players[owner],hand,armyRankCounts:counts};
  }
  if (corners) {
    for (const [id,row,col] of [['foe-1',0,0],['foe-4',0,8],['own-3',8,0],['own-6',8,8]]) {
      const p = s.pieces[id];
      s.board[p.row][p.col] = null;
      const moved = {...p,row,col}; s.pieces[id] = moved; s.board[row][col] = moved;
    }
  }
  return theme.startsWith('alice-') ? syncAlice(s) : initAreas(s);
}
