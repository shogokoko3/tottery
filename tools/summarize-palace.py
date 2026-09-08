"""Compare palace policy while keeping opponents on the same new CPU."""
import pathlib,json,gzip,collections,random
root=pathlib.Path('reports/area-matchups-palace')
def read(p):return json.loads(p.read_text()) if p.exists() else json.loads(gzip.decompress(p.with_suffix('.json.gz').read_bytes()))
n=read(root/'results.json');b=read(root/'control/results.json')
assert len(n['results'])==9000 and len(b['results'])==3000
assert n['ruleVersion']==b['ruleVersion']==6 and b['baselinePalace']
N={'earth':'土','sea':'海','forest':'森','ice':'氷','sky':'空','palace':'宮殿'}
def rows(data,foe=None,king=None):
 return [r for r in data['results'] if 'palace' in r['sides'] and (foe is None or foe in r['sides']) and (king is None or r['kings'][r['sides'].index('palace')]==king)]
def stat(rs,t='palace'):
 w=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]==t for r in rs);l=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]!=t for r in rs)
 return {'wins':w,'losses':l,'draws':sum(r['completed'] and r['winner'] is None for r in rs),'unfinished':sum(not r['completed'] for r in rs),'rate':100*w/(w+l) if w+l else None}
def diagnostics(rs):
 total=collections.Counter()
 for r in rs: total.update(r['palaceStats'][r['sides'].index('palace')])
 return total
oldmap={(tuple(r['pair']),r['seed'],r['first']):r for r in b['results']}
matched=0
for r in rows(n):
 assert (tuple(r['pair']),r['seed'],r['first']) in oldmap
 matched+=1
changes={k:{'before':stat(rows(b,king=k if k!='all' else None)),'after':stat(rows(n,king=k if k!='all' else None)),'before_actions':diagnostics(rows(b,king=k if k!='all' else None)),'after_actions':diagnostics(rows(n,king=k if k!='all' else None))} for k in ['J','Q','K','all']}
for king,c in changes.items():
 groups=collections.defaultdict(lambda:[0,0,0,0])
 for r in rows(n,king=king if king!='all' else None):
  g=groups[(tuple(r['pair']),r['seed'])]
  for offset,x in [(0,r),(2,oldmap[(tuple(r['pair']),r['seed'],r['first'])])]:
   if x['completed'] and x['winner'] is not None:
    g[offset]+=x['sides'][x['winner']]=='palace'; g[offset+1]+=1
 values=list(groups.values()); rnd=random.Random(90910); differences=[]
 for _ in range(2000):
  totals=[sum(col) for col in zip(*rnd.choices(values,k=len(values)))]
  differences.append(100*totals[0]/totals[1]-100*totals[2]/totals[3])
 differences.sort();c['difference_ci95']=[differences[50],differences[1950]]
matrix={t:{u:stat([r for r in n['results'] if t in r['sides'] and u in r['sides']],t) for u in N if u!=t} for t in N}
(root/'summary.json').write_text(json.dumps({'matrix':matrix,'palace_changes':changes,'matched':matched},ensure_ascii=False,indent=2))
lines=['# 宮殿：J・Q増産・予備札再配置・A包囲を使うCPUの再検証','',
'2026年9月9日。ルール変更なし。基本構成は9×2、10×4、J・Q・K各1。手札にない札を生成することはせず、現行の引き直し・採用上限に従う。','',
'## 修正した判断','',
'- K王による補充を評価し、10→Jと9→10→Jの育成を重視する。Q→Kは補充対象から外れるため、移動能力の利益が十分な場合に限る。',
'- 基本構成と、手札に応じてAを含む代替構成を評価する。基本9枚が揃った手札でそれを採用し、余剰の低数字を引き直すテストを追加。',
'- 複数のA・味方の組み合わせについて実際の三角形内の敵を数える。長距離駒の移動で包囲を作れるかも評価する。',
'- 補充された札は最初の空きマスへ置くのではなく、既知の敵の射程・味方の援護・攻撃可能なマスを評価して配置する。',
'- 昇格したJが倒されて予備札を引き、CPUの選んだ位置へ再配置できることを実reducerで確認。伏せ札の正体にアクセスすると失敗するテストも実施。','',
'## 比較条件','',
'- 改善CPUの全15組9,000局、宮殿だけ前のCPUへ戻した比較用5組3,000局、合計12,000局。各組300配札×先後2局。',
'- 比較用の相手は改善CPUのまま。宮殿側のみf91eaccの採用・引き直し・布陣・対戦判断へ戻した。ルールは双方とも版6。',
'- 宮殿のJ・Q・K王を均等に交代する。K王は各相手200局、合計1,000局。王の種類は固定して、その手札で合法な構成を選ぶ。',
'- 同じ初期配札の種・王・先後で対応。ただし引き直しや構成・行動が変わるため、その後の盤面は異なる。補充判断だけ単独の効果ではなく、宮殿戦略一式の比較。',
'- 希望の王だけを初期手札に確保し、他の札は抽選。毎回理想の9枚を渡す実験ではない。王・エリアの選択確率はこの検証の対象外。',
'- 160手番／2,400操作で未決着。勝率の分母は勝敗がついた局。未決着は別記。公開ゲーム・ランキングへのテスト対局の書き込みはない。','',
'## 宮殿の王別結果','', '| 王 | 前CPU | 改善CPU | 差 | 改善CPU：勝–負–分–未決着 |','|---|---:|---:|---:|---|']
for k,c in changes.items():
 x,y=c['before'],c['after'];lines.append(f"| {k if k!='all' else '全体'} | {x['rate']:.1f}% | {y['rate']:.1f}% | {y['rate']-x['rate']:+.1f}pt | {y['wins']}–{y['losses']}–{y['draws']}–{y['unfinished']} |")
lines+=['',f"K王の差の95%区間：{changes['K']['difference_ci95'][0]:+.1f}〜{changes['K']['difference_ci95'][1]:+.1f}ポイント。全体の差：{changes['all']['difference_ci95'][0]:+.1f}〜{changes['all']['difference_ci95'][1]:+.1f}ポイント。配札ごとの先後2局を組にした対応ありブートストラップ2,000回。0をまたぐ場合は勝率の改善を断定しない。"]
lines+=['','## K王の相手別結果' ,'', '| 相手 | 前CPU | 改善CPU | 改善CPU：勝–負–分–未決着 |','|---|---:|---:|---|']
for t in N:
 if t=='palace':continue
 x=stat(rows(b,t,'K'));y=stat(rows(n,t,'K'));lines.append(f"| {N[t]} | {x['rate']:.1f}% | {y['rate']:.1f}% | {y['wins']}–{y['losses']}–{y['draws']}–{y['unfinished']} |")
lines+=['','## K王の判断・行動実績（1,000局）','', '| CPU | Jへ昇格 | Qへ昇格 | Kへ昇格 | 予備札を再配置 | 入れ替えで撃破した駒数 |','|---|---:|---:|---:|---:|---:|']
for label,key in [('前CPU','before_actions'),('改善CPU','after_actions')]:
 d=changes['K'][key]; lines.append(f"| {label} | {d.get('toJ',0)} | {d.get('toQ',0)} | {d.get('toK',0)} | {d.get('reservePlaced',0)} | {d.get('surroundKills',0)} |")
lines+=['','## 改善CPU同士の全相性表','', '行の勝率。宮殿はJ・Q・K王を均等に混ぜた結果。','', '| 自分＼相手 | '+' | '.join(N.values())+' |','|---|'+'---:|'*6]
for t in N:lines.append('| '+N[t]+' | '+' | '.join('—' if t==u else f"{matrix[t][u]['rate']:.1f}%" for u in N)+' |')
lines+=['','## 解釈の範囲','',
'- 予備札の補充はK王の能力であり、J王・Q王では同じ増産でも補充は起きない。宮殿全体の平均だけでK王の持久力を判断しない。',
'- J・Qの増産と再配置を評価に含めたCPUの結果であり、全ての布陣や長期戦略を探索した最適勝率ではない。特に各相手のK王200局は、細かな勝率差を断定する規模ではない。',
'- 引く前の山札や相手の非公開の正体は使わない。Aの将来の包囲評価は1手先の形を評価するもので、相手が対応しないことを保証しない。','',
'## 再現','', '```sh',
'STRATEGIC_SETUP=1 POLICIES=informed SEEDS=300 OUTPUT=reports/area-matchups-palace/results.json node tools/area-matchups.mjs',
'mkdir -p /tmp/tottery-palace-baseline',
'git archive f91eacc src/game | tar -x -C /tmp/tottery-palace-baseline',
'''printf '{"type":"module"}' > /tmp/tottery-palace-baseline/package.json''',
'BASELINE_PALACE_DIR=/tmp/tottery-palace-baseline ONLY_AREA=palace STRATEGIC_SETUP=1 POLICIES=informed SEEDS=300 OUTPUT=reports/area-matchups-palace/control/results.json node tools/area-matchups.mjs',
'python3 tools/summarize-palace.py','```']
(root/'検証レポート.md').write_text('\n'.join(lines)+'\n')
for d in [root,root/'control']:
 (d/'results.json.gz').write_bytes(gzip.compress((d/'results.json').read_bytes(),mtime=0));(d/'.gitignore').write_text('/results.json\n')
print(json.dumps(changes,ensure_ascii=False,indent=2))
