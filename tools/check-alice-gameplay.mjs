import assert from 'node:assert/strict';
import {initialState,reducer,removePiece,endTurn} from '../src/game/reducer.js';
import {ALICE_SKINS} from '../src/skins/alice.js';
import {getLegalMoves,emptyBoard} from '../src/game/board.js';
import {syncAlice,alive,aliceBoard,aliceClocksHidden,emptyCells,canUseRevolution,revolutionCandidates,reverseLocked,reverseTurnsLeft} from '../src/game/alice-rules.js';
import {enrichAction} from '../src/game/actions.js';
import {cpuAction} from '../src/game/cpu.js';
import {setupFromRoom,acceptAct} from '../src/net/sync.js';
const loadout=Object.fromEntries(ALICE_SKINS.map(s=>[s.rank,s.id+':foil']));
function game(rank='4') {
  let s={...initialState(),ruleVersion:19,phase:'play',boardSize:9,board:emptyBoard(9),currentTurn:0,turnNo:0,areaLoadouts:[loadout,{}],areasEnabled:true,log:[],setupEffects:null,clocks:[300000,300000]};
  const ps=[['k',rank,0,6,4,true],['p','2',0,6,3,false],['q','3',0,7,2,false],['a','A',0,8,4,false],['ek','K',1,0,4,true],['ep','2',1,2,3,false],['ea','A',1,0,0,false]];
  for(const [id,rank,owner,row,col,isKing] of ps){const p={id,rank,owner,row,col,isKing,alive:true,revealed:false,suit:'heart',history:[]};s.pieces[id]=p;s.board[row][col]=p;}
  s.players=s.players.map((p,i)=>({...p,kingId:i?'ek':'k',armyRankCounts:{2:2,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1,A:1,J:1,Q:1,K:1}}));
  return syncAlice(s);
}
const act=(s,kind,extra={})=>reducer(s,{type:'ALICE_ACTION',kind,seed:123,player:s.currentTurn,...extra});
function invariant(s){const ids=s.board.flat().filter(Boolean).map(p=>p.id);assert.equal(ids.length,new Set(ids).size);for(const p of alive(s)){assert.equal(s.board[p.row][p.col]?.id,p.id);assert.deepEqual(s.board[p.row][p.col],p);}}
let s=game('2');s=removePiece(s,'k',{by:'ep'});assert.equal(s.winner,null);assert.equal(s.aliceRevive.pieceId,'k');assert.equal(reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3}),s);s=act(s,'revive',{row:8,col:8});assert.ok(s.pieces.k.alive);assert.equal(s.aliceRevives.k,1);invariant(s);
s=removePiece(s,'k',{by:'ep'});s=act(s,'revive',{row:8,col:8});s=removePiece(s,'k',{by:'ep'});assert.equal(s.winner,1,'復活回数を使い切ると敗北');
s=game('3');const [lo,hi]=[6,8];for(let r=lo;r<=hi;r++)for(let c=0;c<9;c++){if(s.board[r][c])continue;const p={...s.pieces.p,id:`z${r}${c}`,row:r,col:c};s.pieces[p.id]=p;s.board[r][c]=p;} // 王は敵陣で倒れ、自陣の空きなし
const fill={...s.pieces.p,id:'fill',row:s.pieces.k.row,col:s.pieces.k.col};s.pieces.fill=fill;s.board[fill.row][fill.col]=fill;s.pieces.k={...s.pieces.k,row:4,col:4};s.board[4][4]=s.pieces.k;s=removePiece(s,'k',{by:'ep'});assert.equal(s.winner,1);
s=game('4');s=act(s,'reverse',{aId:'a',pickIds:['ea']});assert.equal(s.pieces.ea.rank,'A');assert.equal(s.pieces.a.revealed,true);assert.equal(act(s,'reverse',{aId:'a',pickIds:['p']}),s,'不発でも再使用できない');
s=game('A'); // duplicate A fixture remove own ace
s.board[8][4]=null;s.pieces.a={...s.pieces.a,alive:false};s=act(s,'reverse',{aId:'k',pickIds:['p','ep','ea']});assert.equal(s.pieces.p.rank,'K');assert.equal(s.pieces.ep.rank,'K');assert.equal(s.pieces.ea.rank,'A');assert.equal(s.pieces.ep.revealed,true);assert.equal(s.pieces.k.revealed,false);assert.equal(s.currentTurn,0);invariant(s);
s=game('4');s=act(s,'king');assert.ok(s.pieces.p.barrier);assert.ok(s.pieces.k.barrier);s=endTurn(s);assert.ok(s.pieces.p.barrier);s=endTurn(s);assert.equal(s.pieces.p.barrier,false);
s=game('5');s=act(s,'king',{pickIds:['p']});s=removePiece(s,'p',{by:'ep'});assert.ok(s.pieces.ep.frozenUntil>0);assert.equal(s.pieces.ep.revealed,true);
s=game('6');s=act(s,'king');assert.equal(s.clocks[1],270000);s=game('6');s.clocks[1]=20000;s=act(s,'king');assert.equal(s.clocks[1],10000);assert.ok(aliceClocksHidden(s));s=endTurn(s);assert.ok(s.aliceBlocked[1]);s=endTurn(s);assert.equal(s.aliceBlocked[1],null);
s=game('7');s=act(s,'king');assert.equal(alive(s,1).filter(p=>p.ownerHidden).length,2);s=endTurn(s);const hidden=alive(s,1).find(p=>p.ownerHidden);s=act(s,'unmask',{pickIds:[hidden.id]});assert.equal(s.pieces[hidden.id].ownerHidden,false);assert.equal(s.aliceCommitted,hidden.id);
s=game('8');s=act(s,'king');assert.equal(s.currentTurn,1);assert.equal(alive(s).filter(p=>p.tea).length,1);invariant(s);
s=game('9');s=act(s,'field');assert.equal(alive(s).length,18);assert.ok(alive(s).filter(p=>p.tea).every(p=>p.teaMovement==='diag'));invariant(s);
s=game('4');s=act(s,'field',{pickIds:['p','ea']});assert.equal(s.pieces.ea.movementRank,'2');assert.ok(getLegalMoves(s.pieces.ea,s.board,9,{},'K').length);
s=game('10');s.pieces.p={...s.pieces.p,revealed:true};s.board[6][3]=s.pieces.p;s.known=[{}, {p:true}];s=act(s,'field',{pickIds:['p','q']});assert.equal(s.pieces.p.row,7);assert.equal(s.pieces.q.row,6);assert.equal(s.pieces.p.revealed,false);assert.equal(s.known[1].p,undefined);invariant(s);
s=game('10');s=reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3,fakeRow:6,fakeCol:2,seed:9});assert.equal(s.currentTurn,1);assert.equal(aliceBoard(s,1)[5][3],null);assert.equal(aliceBoard(s,1)[6][2].ghostOf,'p');assert.equal(aliceBoard(s,0)[5][3].id,'p');invariant(s);s=endTurn(s);assert.equal(aliceBoard(s,1)[5][3].id,'p');
s=game('Q');s.pieces.ep={...s.pieces.ep,row:5,col:3};s.board[2][3]=null;s.board[5][3]=s.pieces.ep;s=reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3,seed:1});assert.equal(s.aliceRecruit[0].card.id,'ep');assert.equal(reducer(s,{type:'ALICE_ACTION',kind:'recruit',player:0,row:4,col:4}),s,'仲間は自陣の空きマスにしか置けない(Kの予備札と同じ)');s=reducer(s,{type:'ALICE_ACTION',kind:'recruit',player:0,row:8,col:8});assert.equal(s.board[8][8].owner,0);assert.equal(s.board[8][8].isKing,false);invariant(s);
s=game('J');s=act(s,'field',{pickIds:['p'],row:4,col:4});assert.equal(s.currentTurn,0);invariant(s);
s=game('4');assert.equal(act(s,'king',{player:1}),s,'相手からの能力使用拒否');s.ruleVersion=18;assert.equal(act(s,'king'),s,'旧対局に新能力を適用しない');
s=game('4');const a=enrichAction({type:'ALICE_ACTION',kind:'field'},s);assert.deepEqual(reducer(structuredClone(s),a),reducer(structuredClone(s),a));assert.equal(setupFromRoom({type:'START_SETUP',size:5},[loadout,{}],{ruleVersion:19}).loadouts[0].A,loadout.A);assert.equal(acceptAct({type:'ALICE_ACTION',kind:'king',by:'other',__id:'test'},'me',0,'other').player,1);
// 幻の駒への攻撃では実体を倒さず、攻撃側だけが名乗る。
s=game('10');s=reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3,fakeRow:6,fakeCol:2,seed:9});
s.board[2][3]=null;s.pieces.ep={...s.pieces.ep,row:5,col:2};s.board[5][2]=s.pieces.ep;
s=reducer(s,{type:'MOVE_PIECE',pieceId:'ep',player:1,row:6,col:2,seed:7});assert.ok(s.pieces.p.alive);assert.equal(s.pieces.p.row,5);assert.equal(s.pieces.ep.revealed,true);assert.equal(s.board[6][2].id,'ep');invariant(s);
// 見えない実体のマスに着地した場合は、実体を撃破する。
s=game('10');s=reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3,fakeRow:6,fakeCol:2,seed:9});s.board[2][3]=null;s.pieces.ep={...s.pieces.ep,row:4,col:3};s.board[4][3]=s.pieces.ep;s=reducer(s,{type:'MOVE_PIECE',pieceId:'ep',player:1,row:5,col:3,seed:7});assert.equal(s.pieces.p.alive,false);invariant(s);
// 同じ手番で偽の王を3体任命でき、4体目は拒否する。
s=game('5');for(const id of ['p','q','a'])s=act(s,'king',{pickIds:[id]});assert.equal(alive(s,0).filter(p=>p.falseKing).length,3);assert.equal(s.aliceCharges.k,3);
// 王アリスの対象が3体未満なら、その数だけで発動できる。
s=game('A');for(const id of ['a','q','ep','ea','ek']){const p=s.pieces[id];s.board[p.row][p.col]=null;s.pieces[id]={...p,alive:false};}s=act(s,'reverse',{aId:'k',pickIds:['p']});assert.equal(s.pieces.p.rank,'K');
// バリアは通常の捕獲対象として選べない。
s=game('4');s=act(s,'king');s=endTurn(s);s.board[2][3]=null;s.pieces.ep={...s.pieces.ep,row:5,col:3};s.board[5][3]=s.pieces.ep;assert.equal(reducer(s,{type:'MOVE_PIECE',pieceId:'ep',row:6,col:3,player:1,seed:2}),s);
// 復活する王とティーカップは、予備札の循環に入れない。
s=game('2');s=removePiece(s,'k',{by:'ep'});assert.ok(!s.discardPile.some(c=>c.id==='k'));s=game('8');s=act(s,'king');const cup=alive(s).find(p=>p.tea);s=removePiece(s,cup.id,{by:null});assert.ok(!s.discardPile.some(c=>c.id===cup.id));
// 王の数字逆転で、新しい数字の装備に対応するエリアへ切り替える。
s=game('A');s.areaLoadouts[1]=loadout;s=syncAlice(s);s=act(s,'reverse',{aId:'k',pickIds:['ek','ep','ea']});assert.equal(s.pieces.ek.rank,'2');assert.equal(s.areas[1].type,'alice-caucus');
// 王の力なしでも、アリスの通常の動きの変更は使える。
s=game('4');s.kingPowers=false;s=syncAlice(s);s=act(s,'reverse',{aId:'a',pickIds:['p']});assert.equal(s.pieces.p.rank,'K');assert.equal(s.currentTurn,0);
// 撃破側の勧誘を先に解決し、それから相手の王を復活させる。
s=game('Q');s.areaLoadouts[1]=loadout;s.pieces.ek={...s.pieces.ek,rank:'2',row:5,col:3};s.board[0][4]=null;s.board[5][3]=s.pieces.ek;s=syncAlice(s);s=reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3,seed:8,player:0});assert.ok(s.aliceRevive);assert.ok(s.aliceRecruit.length);const rejected=reducer(s,{type:'ALICE_ACTION',kind:'revive',row:0,col:0,player:1});assert.equal(rejected,s);s=reducer(s,{type:'ALICE_ACTION',kind:'decline',player:0});assert.ok(!s.discardPile.some(c=>c.id==='ek'));s=reducer(s,{type:'ALICE_ACTION',kind:'revive',row:1,col:1,player:1});assert.ok(s.pieces.ek.alive);invariant(s);
// 数字が逆転して通常シリーズの王になった場合も、エリアを切り替える。
s=game('A');s.areaLoadouts[1]={K:'alice-K-king:foil',2:'zombie-male:foil'};s=syncAlice(s);s=act(s,'reverse',{aId:'k',pickIds:['ek','ep','ea']});assert.equal(s.areas[1].type,'earth');
// 編成時のA禁止を確認。対局中の王の数字変更にはこの制限を遡及しない。
s={...initialState(),phase:'setup',ruleVersion:19,boardSize:9,board:emptyBoard(9),areaLoadouts:[loadout,{}],setupIdx:0,armySize:9};const ranks=['Q','A','2','3','4','5','6','7','8'];s.players[0].hand=ranks.map((rank,i)=>({id:'c'+i,rank,suit:i%2?'spade':'heart'}));const placement=Object.fromEntries(ranks.map((_,i)=>['c'+i,{row:6,col:i}]));assert.equal(reducer(s,{type:'SETUP_CONFIRM',placement,kingId:'c0'}),s);s.kingPowers=false;assert.equal(reducer(s,{type:'SETUP_CONFIRM',placement,kingId:'c0'}).setupDone[0],true);
// すでに10秒未満の相手の時計を、白ウサギが増やしてしまわない。
s=game('6');s.clocks[1]=9000;s=act(s,'king');assert.equal(s.clocks[1],9000);
// 布陣ボーナスの確認前は新能力も受け付けない。
s=game('4');s.online=true;s.setupEffects={};s.setupAck=[false,false];assert.equal(act(s,'king'),s);
// クロッケーで王を撃破した場合は、手番を消費しない効果でも終局になる。
s=game('J');const seedFor=(landing)=>{for(let seed=0;seed<10000;seed++){const trial=act(s,'field',{pickIds:['p'],row:0,col:4,seed});if(landing(trial))return seed;}throw new Error('seed not found');};const killSeed=seedFor(t=>t.winner===0);s=act(s,'field',{pickIds:['p'],row:0,col:4,seed:killSeed});assert.equal(s.phase,'gameover');assert.equal(s.winner,0);assert.equal(s.pieces.k.alive,true);assert.equal(s.pieces.ek.alive,false);assert.equal(s.pieces.p.alive,false);invariant(s);
// 飛ばした駒の出発マスに戻る場合、自分自身とは衝突しない。
s=game('J');let sameSeed;for(let seed=0;seed<10000;seed++){const trial=act(s,'field',{pickIds:['p'],row:6,col:3,seed});if(trial.pieces.p.alive&&trial.pieces.p.row===6&&trial.pieces.p.col===3){sameSeed=seed;break;}}assert.notEqual(sameSeed,undefined);s=act(s,'field',{pickIds:['p'],row:6,col:3,seed:sameSeed});assert.ok(s.pieces.p.alive);invariant(s);
// CPUは任命・復活の選択を通常移動に置き換えず、非公開の駒を確定してから動かす。
s=game('2');s=removePiece(s,'k',{by:'ep'});const cpuRevive=cpuAction(s,0);assert.equal(cpuRevive.kind,'revive');s=reducer(s,enrichAction(cpuRevive,s));assert.ok(s.pieces.k.alive);
s=game('7');s=act(s,'king');s=endTurn(s);const cpuUnmask=cpuAction(s,1);assert.equal(cpuUnmask.kind,'unmask');assert.ok(s.pieces[cpuUnmask.pickIds[0]].ownerHidden);s=reducer(s,enrichAction(cpuUnmask,s));assert.equal(s.aliceCommitted,cpuUnmask.pickIds[0]);
console.log('Alice gameplay: passed (revival, reverse, all king groups, fields, visibility, deterministic replay, CPU choices and actor validation)');
// 革命の扉(Aのフォイル効果)を今使えるかの答え。盤の上の帯(魔術師と同じ作り)が釦と理由に使う(2026-10-15)
{let s=game('4');assert.equal(canUseRevolution(s,0).ok,true,'自分の番・フォイルのAが盤にあれば使える');assert.equal(canUseRevolution(s,1).why,'アリスのAのフォイルを盤に置いていません');
 s=act(s,'revolution');assert.equal(canUseRevolution(s,0).why,'このターンでは発動済みです');s=endTurn(s);assert.equal(canUseRevolution(s,0).why,'相手の番です');
 assert.equal(canUseRevolution({...s,areasEnabled:false},0).ok,false,'エリアなしでは使えない');}
console.log('Alice revolution availability: OK');
// 公開の決まり(2026-10-16 本人): Aが王のときだけ、選んだ駒を自分の駒も相手の駒も公開にする。王でなければそのまま
{let s=game('4');s=act(s,'reverse',{aId:'a',pickIds:['ep']});assert.equal(s.pieces.ep.rank,'K');assert.equal(!!s.pieces.ep.revealed,false,'王でないAの逆転は公開しない');assert.equal(s.pieces.a.revealed,true,'Aの位置は公開');
 s=game('A');s=act(s,'reverse',{aId:'k',pickIds:['p','ep','q']});assert.equal(s.pieces.p.revealed,true,'王のAは自分の駒も公開');assert.equal(s.pieces.q.revealed,true);assert.equal(s.pieces.ep.revealed,true,'相手の駒も公開');assert.equal(!!s.pieces.k.revealed,false,'王のAの位置は非公開のまま');}
// 革命の扉の抽選(2026-10-16 本人の訂正): 自分は王とA以外、相手は王以外
{const s=game('4');const ids=revolutionCandidates(s,0).map(p=>p.id).sort();assert.deepEqual(ids,['ea','ep','p','q'],'自分: 王とA以外 / 相手: 王以外');}
console.log('Alice reveal rule and revolution pool: OK');
// 逆転の縛りを盤で分かるように(2026-10-16 本人の指示): 逆転した駒は縛り中で残りターンが数えられ、3ターン経つと外れる
{let s=game('4');s=act(s,'reverse',{aId:'a',pickIds:['ep']});assert.equal(reverseLocked(s,s.pieces.ep),true);assert.equal(reverseTurnsLeft(s,s.pieces.ep),3,'残りは3ターンと出る(決まりの3を超えない)');
 for(let i=0;i<8;i++)s=endTurn(s);assert.equal(reverseLocked(s,s.pieces.ep),false,'縛りが外れる');assert.equal(reverseTurnsLeft(s,s.pieces.ep),0);}
import fs from 'node:fs';
{const cards=fs.readFileSync(new URL('../src/ui/cards.jsx',import.meta.url),'utf8'),game=fs.readFileSync(new URL('../src/ui/game.jsx',import.meta.url),'utf8');
 assert.ok(/className="reverse-badge"/.test(cards),'駒に逆転中の印');assert.ok(/reversed=\{reverseLocked\(displayed, ze\)\}/.test(game),'盤の駒に縛り中を渡す');}
console.log('Alice reverse lock badge: OK');
// 発動順(2026-10-16 本人の指示): ハートのQが相手のJを取り、相手の王がKのとき、仲間にする配置が終わるまで相手は予備札を置けない
{let s=game('Q');s.pieces.ep={...s.pieces.ep,rank:'J',row:5,col:3};s.board[2][3]=null;s.board[5][3]=s.pieces.ep;s={...s,reserve:[{id:'rsv',rank:'6',suit:'spade'}]};s=syncAlice(s);
 s=reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3,seed:1,player:0});assert.ok(s.aliceRecruit?.length,'仲間にする待ちが立つ');assert.equal(s.kPlacement,null,'相手のKの予備札はまだ引かない');assert.deepEqual(s.kDeferred,[1],'引く権利は控える');assert.equal(s.reserve.length,1);assert.equal(s.currentTurn,1);
 const early=reducer(s,{type:'PLACE_RESERVE_CARD',player:1,row:0,col:1,cardId:'rsv'});assert.equal(early,s,'仲間にする配置が終わるまで予備札は置けない');
 const declined=reducer(s,{type:'ALICE_ACTION',kind:'decline',player:0});assert.equal(declined.kPlacement?.owner,1,'見送っても、決まったら引く');
 s=reducer(s,{type:'ALICE_ACTION',kind:'recruit',player:0,row:8,col:8});assert.equal(s.board[8][8]?.owner,0,'先に仲間を配置');assert.equal(s.kPlacement?.owner,1,'仲間の配置が終わってから相手のKが予備札を引く');assert.deepEqual(s.kDeferred,[]);assert.equal(s.reserve.length,0);
 s=reducer(s,{type:'PLACE_RESERVE_CARD',player:1,row:0,col:1,cardId:'rsv'});assert.equal(s.board[0][1]?.id,'rsv','そのあとで相手が予備札を置ける');assert.equal(s.kPlacement,null);invariant(s);}
import fsOrder from 'node:fs';
{const game=fsOrder.readFileSync(new URL('../src/ui/game.jsx',import.meta.url),'utf8');
 assert.ok(/a\.kPlacement &&\s*a\.kPlacement\.owner === P &&\s*a\.currentTurn === P &&\s*!a\.captureReveal &&\s*!a\.aliceRecruit\?\.length &&\s*!a\.aliceRevive &&\s*!fxBusy && \(\s*<ReservePlacer/.test(game),'予備札の置き場は置く側の手番で、仲間の配置と映像のあと');
 assert.ok(/相手がKの効果で予備札を配置しています/.test(game),'相手側に待ちの一言');}
console.log('Recruit → film → K reserve order: OK');
// 相手の効果の一覧のための公開の記録(2026-10-16 本人の指示): 技の発動と仲間にする待ちを、誰が・何を・いつ、で積む
{let s=game('4');s=act(s,'king');assert.deepEqual(s.alicePowerLog.map(e=>[e.owner,e.kind,e.rank]),[[0,'king','4']],'王の力の発動を記録');
 s=game('Q');s.pieces.ep={...s.pieces.ep,rank:'J',row:5,col:3};s.board[2][3]=null;s.board[5][3]=s.pieces.ep;s=syncAlice(s);s=reducer(s,{type:'MOVE_PIECE',pieceId:'p',row:5,col:3,seed:1,player:0});
 assert.ok(s.alicePowerLog.some(e=>e.owner===0&&e.kind==='recruit'&&e.rank==='Q'),'仲間にする待ちが立ったことを記録');
 assert.ok(!JSON.stringify(s.alicePowerLog).includes('pickIds'),'記録に選んだ駒は入れない');}
console.log('Alice power log for foe effects: OK');
