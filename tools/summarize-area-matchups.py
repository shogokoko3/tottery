import json,collections,statistics,random,pathlib
root=pathlib.Path('reports/area-matchups');j=json.loads((root/'results.json').read_text());rows=j['results']
names={'earth':'土','sea':'海','forest':'森','ice':'氷','sky':'空','palace':'宮殿'};types=list(names)
def ci(rs,t):
 groups=collections.defaultdict(lambda:[0,0])
 for r in rs:
  g=groups[r['seed']]
  if r['completed'] and r['winner'] is not None:g[1]+=1;g[0]+=r['sides'][r['winner']]==t
 g=list(groups.values());rnd=random.Random(90209);v=[]
 for _ in range(2000):
  picks=rnd.choices(g,k=len(g));n=sum(x[1] for x in picks)
  if n:v.append(100*sum(x[0] for x in picks)/n)
 v.sort();return [round(v[int(len(v)*.025)],1),round(v[int(len(v)*.975)],1)]
def stats(rs,t):
 wins=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]==t for r in rs)
 losses=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]!=t for r in rs)
 return {'wins':wins,'losses':losses,'draws':sum(r['completed'] and r['winner'] is None for r in rs),'unfinished':sum(not r['completed'] for r in rs),'rate':round(100*wins/(wins+losses),1),'ci':ci(rs,t)}
summary={}
for policy in ['stock','informed']:
 summary[policy]={}
 for t in types:
  summary[policy][t]={u:stats([r for r in rows if r['policy']==policy and set(r['pair'])=={t,u}],t) for u in types if t!=u}
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
lines=['# エリア相性の検証 — 2026年9月9日','', 'ルール版5・GitHub ba72f08を基準に、両者がエリアを持つ9×9を18,000局実行。公開対局・ランキング・プレイヤーデータへの書き込みは行っていない。','',
'## 検証条件','',
'- 15組の相性 × 300配札・布陣 × 先手後手の入替2局 × CPU方針2種類。各相性は各方針600局。',
'- 同じ配札・布陣を固定した2局で開始手番を反転。赤青の席も均等に入替。成立する王のランク（2/3、4/5、6/7、8/9、10、J/Q/K）を均等にローテーション。',
'- 実際のルール処理を使用。通常の山札から希望の王を各手札に確保し、合法な9枚を自動布陣。K以外の王を指定した場合はKを採用しない。引き直しは行わず、布陣ボーナスの公開情報は維持。開始手番は比較のため強制的に揃える。',
'- 手札救済により指定した王が手札から消えたケースは別の種で再抽選。方針ごとに同じ再抽選を行い、合計4件。',
'- 思考時間の差で結果が決まらないよう時計消費を0とした。160手番または2,400操作で終了しなければ未決着。手の繰り返しだけで勝敗・引き分けにはしない。',
'- 「既存CPU」は現在までの戦い方。「情報活用CPU」は見えている王を優先、既知の道連れへの警戒、Aを残した低価値駒からの10変身、取れる駒がないときの継続的な宮殿活用を追加。深い先読みは行わない。',
'- 4種の自動発動は両CPUとも毎手番実行。空・宮殿の使用は各CPUの方針による。','',
'## 情報活用CPUの相性表','', '**行のエリアが列のエリアに勝った割合。勝敗がついた対局のみを分母とし、引き分け・未決着は除外。**','',
'| 自分＼相手 | '+' | '.join(names.values())+' |','|---|'+'---:|'*6]
for t in types:lines.append('| '+names[t]+' | '+' | '.join('—' if t==u else str(summary['informed'][t][u]['rate'])+'%' for u in types)+' |')
lines+=['','## 方針による違いと集計','', '| エリア | 既存CPUでの総合勝率 | 情報活用CPUでの総合勝率 | 情報活用CPUの平均発動回数／局 |','|---|---:|---:|---:|']
for t in types:
 rates=[]
 for policy in ['stock','informed']:
  rs=[r for r in rows if r['policy']==policy and t in r['sides'] and r['completed'] and r['winner'] is not None]
  rates.append(100*sum(r['sides'][r['winner']]==t for r in rs)/len(rs))
 uses=statistics.mean(r['uses'][r['sides'].index(t)] for r in rows if r['policy']=='informed' and t in r['sides'])
 lines.append(f'| {names[t]} | {rates[0]:.1f}% | {rates[1]:.1f}% | {uses:.1f}回 |')
lines+=['','同じ方針同士の対戦を集計した値であり、情報活用CPUが既存CPUより何％強いという意味ではない。','', '| 方針 | 勝敗あり | 引き分け | 手番上限で未決着 | CPUが手を返せず停止 |','|---|---:|---:|---:|---:|']
for p in ['stock','informed']:
 rs=[r for r in rows if r['policy']==p]
 lines.append('| '+p+' | '+' | '.join(str(sum(f(r) for r in rs)) for f in [lambda r:r['completed'] and r['winner'] is not None,lambda r:r['completed'] and r['winner'] is None,lambda r:r['stop']=='turn_cap',lambda r:r['stop']=='no_action'])+' |')
lines+=['','手を返せず停止した対局は敗北扱いにしていない。時計を進めない本実験では、その後の時間切れ結果を仮定しない。', '', '## 各相性の詳細と95％区間','', '同じ配札・布陣の先後2局を1組として、組単位のブートストラップ2,000回。区間はCPUモデル内の抽選ばらつきだけを表す。多数の組み合わせを比較することに対する補正はしていない。','', '| 左側 vs 右側 | 既存CPU：左の勝率 | 情報活用：左の勝率（95％区間） | 情報活用：左勝–右勝–分–未決着 |','|---|---:|---:|---|']
for i,t in enumerate(types):
 for u in types[i+1:]:
  a=summary['stock'][t][u];b=summary['informed'][t][u]
  lines.append(f"| {names[t]} vs {names[u]} | {a['rate']}% | {b['rate']}%（{b['ci'][0]}–{b['ci'][1]}） | {b['wins']}–{b['losses']}–{b['draws']}–{b['unfinished']} |")
lines+=['','## 読み取れる傾向と限界','',
'- 空は海・森に対して、2種類の方針で一貫して勝ち越す。変身で手番を失わず、10の2回行動を増やせることが有利に働いている可能性がある。ただし因果を切り分けた比較ではない。',
'- 土も森に、氷も森に勝ち越す。森はこの布陣・評価方法では総合的に低い。敵王を直接見抜けないことや、CPUが情報を長期の防御計画に利用しないことも結果に影響し得る。',
'- 氷対空は、既存CPUでは氷51.2%、情報活用では氷43.8%。固定した優劣とは言えず、変身対象などの戦い方に左右される。',
'- 宮殿の発動頻度は増えたが、全体の勝率が上がるとは限らない。昇格で手番を消費する判断の難しさが残る。',
'- 海は中央に集める結果、相手にも攻撃機会を与える可能性がある。この実験では空に大きく負け越すが、適切な布陣による反撃までは最適化していない。',
'- **エリア単体の強さではなく、王の能力・ランク・採用カードとエリアを組み合わせた相性。** 異なる王を必須とするので、差をすべてエリアの効果と見なすことはできない。',
'- 対局の中央値は7手番、平均は%.1f手番。布陣を戦略的に最適化せず、両CPUとも短期の駒取りを重視するため、長期の推理や守りを過小評価し得る。'%statistics.mean(r['turns'] for r in rows),
'- これは実プレイヤーの勝率予測や最適戦略の証明ではない。弱体化・強化を決める前には、人間の布陣を用いた対戦や長期戦を狙う別方針での追試が必要。',
'', '## 再現と保存','', '`SEEDS=300 node tools/area-matchups.mjs` → `python3 tools/summarize-area-matchups.py`。`results.json`に全対局の配札種・王・先手・勝敗・終了理由・発動回数、`summary.json`に相性集計を保存。情報活用CPUは`src/game/cpu-informed.js`に独立保存し、通常CPU戦へ接続。']
(root/'相性検証レポート.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines[15:24]));print('report generated')
