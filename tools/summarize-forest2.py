"""Matched comparison using the same current CPU and setup/initiative seeds."""
import json, gzip, pathlib, random, statistics, collections
root=pathlib.Path('reports/area-matchups-forest2')
def read(path):
 return json.loads(path.read_text()) if path.exists() else json.loads(gzip.decompress(path.with_suffix('.json.gz').read_bytes()))
new=read(root/'results.json');old=read(root/'control/results.json')
assert new['ruleVersion']==6 and old['ruleVersion']==5
assert len(new['results'])==len(old['results'])==18000
names={'earth':'土','sea':'海','forest':'森','ice':'氷','sky':'空','palace':'宮殿'};types=list(names)
def key(r):return r['policy'],tuple(r['pair']),r['seed'],r['first']
oldmap={key(r):r for r in old['results']}
assert len(oldmap)==18000
unchanged=0
for r in new['results']:
 b=oldmap[key(r)]
 assert r['sides']==b['sides'] and r['kings']==b['kings']
 if 'forest' not in r['pair']:
  assert r==b,('unmatched control',key(r));unchanged+=1

def counts(rows,t):
 wins=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]==t for r in rows)
 losses=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]!=t for r in rows)
 return {'wins':wins,'losses':losses,'draws':sum(r['completed'] and r['winner'] is None for r in rows),'unfinished':sum(not r['completed'] for r in rows),'rate':100*wins/(wins+losses)}
def selected(data,policy,t,u=None):return [r for r in data['results'] if r['policy']==policy and t in r['sides'] and (u is None or u in r['sides'])]
def interval(rows,t,delta=False):
 groups=collections.defaultdict(lambda:[0,0,0,0])
 for r in rows:
  g=groups[(tuple(r['pair']),r['seed'])]
  for offset,x in [(0,r),(2,oldmap[key(r)])]:
   if x['completed'] and x['winner'] is not None:
    g[offset]+=x['sides'][x['winner']]==t;g[offset+1]+=1
 vals=list(groups.values());rnd=random.Random(90906);out=[]
 for _ in range(2000):
  sums=[0,0,0,0]
  for g in rnd.choices(vals,k=len(vals)):
   for i in range(4):sums[i]+=g[i]
  if sums[1] and sums[3]:out.append(100*sums[0]/sums[1]-(100*sums[2]/sums[3] if delta else 0))
 out.sort();return [round(out[int(.025*len(out))],1),round(out[int(.975*len(out))],1)]
summary={p:{t:{u:counts(selected(new,p,t,u),t) for u in types if u!=t} for t in types} for p in ['stock','informed']}
changes={}
for p in ['stock','informed']:
 changes[p]={}
 for u in [*filter(lambda x:x!='forest',types),'all']:
  a=selected(old,p,'forest',None if u=='all' else u);b=selected(new,p,'forest',None if u=='all' else u)
  before=counts(a,'forest');after=counts(b,'forest')
  changes[p][u]={'before':before,'after':after,'difference':after['rate']-before['rate'],'difference_ci95':interval(b,'forest',True)}
(root/'summary.json').write_text(json.dumps({'matrix':summary,'forest_changes':changes,'identical_nonforest_games':unchanged},ensure_ascii=False,indent=2))
lines=['# 森2体への変更後：相性再検証','',
'2026年9月9日。最新版e0abfbdのルール版6と、森だけ1体のルール版5を、現在のCPUで比較。ゲームやランキングへの書き込みは行っていない。','',
'## 比較条件','',
'- 変更後18,000局＋変更前の再実行18,000局＝36,000局。15組×300配札・布陣×先後2局×CPU方針2種類。各相性・各方針600局。',
'- 前回保存した表とは直接差し引かず、同じ現在のCPUで1体仕様も再実行した。検証用CPUを通常CPU戦に組み込んだ際、盤面サイズ対応に伴って前進評価の目標行が変わっていたため、その差を除いた比較。',
'- すべての配札種・王のランク・開始手番を照合。森を含まない12,000局では勝敗・手数・発動回数まで完全一致した。森の対象数だけが比較の差となる。',
'- 9×9で両者ともエリアを持つ。王のランクを帯内で均等に交代し、赤青と先後を均等化。同じ配札・布陣のまま開始手番を反転する。',
'- 希望の王を手札に確保し、合法な9枚を自動布陣。引き直しはしない。手札救済で希望の王が消えた場合は再抽選（各ルールの全試行を通して4件）。',
'- 通常CPU戦に導入した「情報活用CPU」と、比較用の「既存CPU」を使用。どちらも深い先読みや最適布陣は行わない。',
'- 時計消費は0。160手番／2,400操作で未決着扱い。CPUが手を返せない場合も未決着であり、敗北・引き分けに置き換えない。',
'- 勝率は勝敗がついた対局のみを分母とする。以下の主表は情報活用CPU同士。','',
'## 森2体での相性表','', '**行のエリアが列のエリアに勝った割合。**','',
'| 自分＼相手 | '+' | '.join(names.values())+' |','|---|'+'---:|'*6]
for t in types:lines.append('| '+names[t]+' | '+' | '.join('—' if t==u else f"{summary['informed'][t][u]['rate']:.1f}%" for u in types)+' |')
lines+=['','## 森の変更前後：同じ情報活用CPUで比較','', '| 相手 | 1体仕様 | 2体仕様 | 差 | 差の95%区間 | 2体仕様の勝–負–分–未決着 |','|---|---:|---:|---:|---:|---|']
for u,c in changes['informed'].items():
 a,b=c['before'],c['after'];lo,hi=c['difference_ci95']
 lines.append(f"| {names.get(u,'全相手合計')} | {a['rate']:.1f}% | {b['rate']:.1f}% | {c['difference']:+.1f}pt | {lo:+.1f}～{hi:+.1f}pt | {b['wins']}–{b['losses']}–{b['draws']}–{b['unfinished']} |")
lines+=['','区間は同一配札の先後2局をひと組として再抽選する、対応ありブートストラップ2,000回。0をまたぐ区間では、この試行だけから増減を断定しない。複数の相性比較への補正はしていない。','',
'## CPU方針による違い','', '| 方針 | 森1体：総合勝率 | 森2体：総合勝率 | 差 |','|---|---:|---:|---:|']
for p in changes:
 c=changes[p]['all'];lines.append(f"| {p} | {c['before']['rate']:.1f}% | {c['after']['rate']:.1f}% | {c['difference']:+.1f}pt |")
lines+=['','既存CPUは見抜いた情報を評価に使わない。そこでの勝率差は情報活用による強化の証拠ではない。抽選対象数が変わることで後続の乱数列や行動経路も変わる。','',
'## 終了状況','', '| 仕様・方針 | 勝敗あり | 引き分け | 手番上限 | 手を返せず停止 |','|---|---:|---:|---:|---:|']
for label,data in [('森1体',old),('森2体',new)]:
 for p in ['stock','informed']:
  rs=[r for r in data['results'] if r['policy']==p]
  vals=[sum(r['completed'] and r['winner'] is not None for r in rs),sum(r['completed'] and r['winner'] is None for r in rs),sum(r['stop']=='turn_cap' for r in rs),sum(r['stop']=='no_action' for r in rs)]
  lines.append('| '+label+'・'+p+' | '+' | '.join(map(str,vals))+' |')
lines+=['','## 判断上の限界','',
'- エリアだけでなく成立条件となる王の能力・採用札を含めた相性。効果単体の純粋な強さではない。',
'- 変更後の対局の中央値は%.0f手番、平均は%.1f手番。短期戦が多く、情報を使った長期の防御計画や推理を十分に評価していない。'%(statistics.median(r['turns'] for r in new['results']),statistics.mean(r['turns'] for r in new['results'])),
'- 情報活用CPUも、既知の王や道連れなどを局所的に評価する方針。森の王以外の情報を、人間のように長期の読みへ使い切れるわけではない。特に「既知の駒を除外して残った王候補を絞る」消去法は未実装。',
'- 統計区間はこのCPUモデル内の試行ばらつきであり、人間の対戦での優劣や勝率の保証ではない。','',
'## 再現','',
'```sh',
'SEEDS=300 OUTPUT=reports/area-matchups-forest2/results.json node tools/area-matchups.mjs',
'RULE_VERSION=5 SEEDS=300 OUTPUT=reports/area-matchups-forest2/control/results.json node tools/area-matchups.mjs',
'python3 tools/summarize-forest2.py','```','',
'全対局記録は各ディレクトリのresults.json.gz、集計はsummary.json。元の1体仕様の前回レポートも別フォルダに保持。']
(root/'再検証レポート.md').write_text('\n'.join(lines)+'\n')
for path in [root,root/'control']:
 (path/'results.json.gz').write_bytes(gzip.compress((path/'results.json').read_bytes(),mtime=0))
 (path/'.gitignore').write_text('/results.json\n')
print(json.dumps(changes,ensure_ascii=False,indent=2));print('unchanged nonforest:',unchanged)
