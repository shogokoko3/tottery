"""Summarize matched real-reducer games with the area-aware production CPU."""
import collections, gzip, json, pathlib, random, statistics
root=pathlib.Path('reports/area-matchups-strategy')
def read(p):
 return json.loads(p.read_text()) if p.exists() else json.loads(gzip.decompress(p.with_suffix('.json.gz').read_bytes()))
new=read(root/'results.json'); old=read(root/'control/results.json')
assert new['ruleVersion']==6 and old['ruleVersion']==5
assert new['strategicSetup'] and old['strategicSetup']
assert len(new['results'])==len(old['results'])==9000
names={'earth':'土','sea':'海','forest':'森','ice':'氷','sky':'空','palace':'宮殿'}
def key(r): return tuple(r['pair']),r['seed'],r['first']
oldmap={key(r):r for r in old['results']}; identical=0
for r in new['results']:
 b=oldmap[key(r)]
 assert r['sides']==b['sides'] and r['kings']==b['kings'] and r['formations']==b['formations']
 if 'forest' not in r['sides']:
  assert r==b; identical+=1

def stats(rows,t):
 w=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]==t for r in rows)
 l=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]!=t for r in rows)
 return {'wins':w,'losses':l,'draws':sum(r['completed'] and r['winner'] is None for r in rows),'unfinished':sum(not r['completed'] for r in rows),'rate':100*w/(w+l) if w+l else None}
def rows(data,t,u=None): return [r for r in data['results'] if t in r['sides'] and (u is None or u in r['sides'])]
matrix={t:{u:stats(rows(new,t,u),t) for u in names if u!=t} for t in names}
forest_new=stats(rows(new,'forest'),'forest'); forest_old=stats(rows(old,'forest'),'forest')
groups=collections.defaultdict(lambda:[0,0,0,0])
for r in rows(new,'forest'):
 g=groups[(tuple(r['pair']),r['seed'])]
 for offset,x in [(0,r),(2,oldmap[key(r)])]:
  if x['completed'] and x['winner'] is not None:
   g[offset]+=x['sides'][x['winner']]=='forest';g[offset+1]+=1
rnd=random.Random(90909); bootstrap=[]; values=list(groups.values())
for _ in range(2000):
 sums=[sum(col) for col in zip(*rnd.choices(values,k=len(values)))]
 bootstrap.append(100*sums[0]/sums[1]-100*sums[2]/sums[3])
bootstrap.sort();ci=[bootstrap[50],bootstrap[1950]]
deduction={t:collections.Counter() for t in names}; formations={t:[] for t in names}
for r in new['results']:
 for i,t in enumerate(r['sides']):
  deduction[t].update(r['deduction'][i]); formations[t].append(r['formations'][i])
summary={'matrix':matrix,'forest_before':forest_old,'forest_after':forest_new,'forest_difference_ci95':ci,'identical_nonforest_games':identical,'deduction':deduction,'formation_mean_covered':{t:statistics.mean(m['covered'] for m in a) for t,a in formations.items()}}
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
lines=['# エリア戦略・王候補推理・相互援護を追加したCPUの相性検証','',
'2026年9月9日。通常CPU戦で使うcpuInformedActionと実際のゲームreducerで検証。公開ランキングへの書き込みはない。','',
'## 今回のCPU','',
'- 手札の王候補ごとにエリアと採用上限を評価し、9枚の構成を比較する。土は後継者、海は同数字の海賊と密集戦のA・10、森は判明した敵へ届く駒、氷は射程、空は10、宮殿は昇格先の価値を重視する。',
'- 引き直しでは王と構成の中核を残して最大4枚を交換。引いた後はその手札だけで採用札・王・エリアを再評価する。山札の中身や相手の手札は参照しない。',
'- 布陣は味方が取られたマスを仮の敵で置き換え、実移動ルールで取り返せる味方を数える。相互援護、王の後列配置、移動先の数、後継者の分散を評価して配置を改善する。王の撃破は即敗北になり得るため、王の護衛と後列配置は取り返しとは別に評価する。',
'- 公開情報・私的に見抜いた情報から非王を除外して王候補を絞る。最後の1体なら王と推定し、複数なら候補への攻撃と接近を評価する。',
'- 対戦中も取り返しの支援と既知の敵からの脅威を評価。10の2回移動、Aによる解凍、凍った敵への攻撃を考慮。空の変身で目の前の攻撃を失わないようにし、宮殿の昇格で王を危険にさらす手を避ける。','',
'## 実験条件','',
'- 森2体9,000局＋同じCPUで森1体9,000局＝18,000局。15組×300配札×先後2局。各組600局。',
'- 相性を分けて測るため、実験では指定エリアの王を初期手札に確保し、その王を維持して構成・引き直し・布陣を行う。通常CPU戦では手札と装備から王・エリアも比較して選ぶ。狙ったエリアを引ける確率の比較ではない。',
'- 同じ配札・同じ引き直し乱数・同じ布陣で先後を反転。王の数字は帯内で交代。森以外の6,000局は勝敗・手数・発動回数・診断値まで完全一致を確認。',
'- 160手番または2,400操作で未決着。手を返せない停止も未決着とし、敗北や引き分けに置き換えない。勝率は勝敗のついた局のみを分母にする。時計は消費しない。','',
'## 森2体の相性表','', '行のエリアが列のエリアに勝った割合。','',
'| 自分＼相手 | '+' | '.join(names.values())+' |','|---|'+'---:|'*6]
for t in names: lines.append('| '+names[t]+' | '+' | '.join('—' if t==u else f"{matrix[t][u]['rate']:.1f}%" for u in names)+' |')
lines+=['','## 森1体との同条件比較','',f"森の全相手合計勝率：1体 {forest_old['rate']:.1f}% → 2体 {forest_new['rate']:.1f}%（差 {forest_new['rate']-forest_old['rate']:+.1f}ポイント）。",f'差の95%区間：{ci[0]:+.1f}〜{ci[1]:+.1f}ポイント。同配札の先後2局を一組にした対応ありブートストラップ2,000回。','',
'## 判断が実際に使われたか','',
'「絞り込み後の移動」は候補の除外が発生した局面の移動数。「推定王への攻撃」は非公開の候補が最後の1体になった局面で、その候補を取りに行った移動数。候補の内部的な王フラグは判定に使わない。','',
'| エリア | 絞り込み後の移動 | 推定王への攻撃 | 布陣の被支援駒数（9体中・平均） |','|---|---:|---:|---:|']
for t in names: lines.append(f"| {names[t]} | {deduction[t]['narrowed']:,} | {deduction[t]['inferredAttacks']:,} | {summary['formation_mean_covered'][t]:.2f} |")
lines+=['','## 終了状況','', '| 仕様 | 勝敗あり | 引き分け | 未決着 |','|---|---:|---:|---:|']
for label,data in [('森1体',old),('森2体',new)]:
 rs=data['results'];lines.append(f"| {label} | {sum(r['completed'] and r['winner'] is not None for r in rs)} | {sum(r['completed'] and r['winner'] is None for r in rs)} | {sum(not r['completed'] for r in rs)} |")
lines+=['','## 読み方','',
'- この表はエリア、王の能力、採用札をまとめた現CPUの相性。探索評価による構成であり、全陣形を探索した最適解や人間の対戦勝率ではない。',
'- 初期の援護は相手の攻撃元を仮定しない評価。実際の捕獲で空く攻撃元、連続撃破、道連れ、海の配置変更、凍結などによって取り返しが成立しなくなる場合もある。対戦中は現在の盤面で再評価する。',
'- 既知の敵による脅威は確認できる駒だけで計算する。非公開の採用枚数による射程の増加などは完全には読めない。',
'- 今回より前の推理・構成を使わないCPUの表と差し引いて、エリア変更の効果とは判断しない。比較対象は今回再実行した森1体仕様。','',
'## 再現','', '```sh',
'STRATEGIC_SETUP=1 POLICIES=informed SEEDS=300 OUTPUT=reports/area-matchups-strategy/results.json node tools/area-matchups.mjs',
'STRATEGIC_SETUP=1 POLICIES=informed SEEDS=300 RULE_VERSION=5 OUTPUT=reports/area-matchups-strategy/control/results.json node tools/area-matchups.mjs',
'python3 tools/summarize-strategy.py','```','',
'対局記録はresults.json.gzとcontrol/results.json.gz。集計はsummary.json。']
(root/'検証レポート.md').write_text('\n'.join(lines)+'\n')
for d in [root,root/'control']:
 (d/'results.json.gz').write_bytes(gzip.compress((d/'results.json').read_bytes(),mtime=0));(d/'.gitignore').write_text('/results.json\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
