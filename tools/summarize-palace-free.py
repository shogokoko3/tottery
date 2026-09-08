import pathlib,json,gzip,collections,random
root=pathlib.Path('reports/area-matchups-palace-free')
def read(p):return json.loads(p.read_text()) if p.exists() else json.loads(gzip.decompress(p.with_suffix('.json.gz').read_bytes()))
n=read(root/'results.json'); b=read(root/'control/results.json');previous=read(pathlib.Path('reports/area-matchups-palace/results.json'))
assert n['ruleVersion']==7 and b['ruleVersion']==6
assert len(n['results'])==9000 and len(b['results'])==3000
names={'earth':'土','sea':'海','forest':'森','ice':'氷','sky':'空','palace':'宮殿'}
def key(r):return tuple(r['pair']),r['seed'],r['first']
prior={key(r):r for r in previous['results']};old={key(r):r for r in b['results']}
assert all(r==prior[key(r)] for r in b['results'])
assert all(r==prior[key(r)] for r in n['results'] if 'palace' not in r['sides'])
def rows(data,t='palace',u=None,k=None):return [r for r in data['results'] if t in r['sides'] and (u is None or u in r['sides']) and (k is None or r['kings'][r['sides'].index(t)]==k)]
def stats(rs,t='palace'):
 w=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]==t for r in rs); l=sum(r['completed'] and r['winner'] is not None and r['sides'][r['winner']]!=t for r in rs)
 return {'wins':w,'losses':l,'draws':sum(r['completed'] and r['winner'] is None for r in rs),'unfinished':sum(not r['completed'] for r in rs),'rate':100*w/(w+l)}
def interval(rs):
 groups=collections.defaultdict(lambda:[0,0,0,0])
 for r in rs:
  g=groups[(tuple(r['pair']),r['seed'])]
  for offset,x in [(0,r),(2,old[key(r)])]:
   if x['completed'] and x['winner'] is not None:g[offset]+=x['sides'][x['winner']]=='palace';g[offset+1]+=1
 rng=random.Random(90911);values=list(groups.values());ds=[]
 for _ in range(2000):
  ts=[sum(c) for c in zip(*rng.choices(values,k=len(values)))]; ds.append(100*ts[0]/ts[1]-100*ts[2]/ts[3])
 ds.sort();return [ds[50],ds[1950]]
matrix={t:{u:stats(rows(n,t,u),t) for u in names if u!=t} for t in names}
changes={t:{'before':stats(rows(b,u=t)),'after':stats(rows(n,u=t)),'ci95':interval(rows(n,u=t))} for t in names if t!='palace'}
kings={k:{'before':stats(rows(b,k=k)),'after':stats(rows(n,k=k))} for k in ['J','Q','K']}
allstats={'before':stats(rows(b)),'after':stats(rows(n)),'ci95':interval(rows(n))}
(root/'summary.json').write_text(json.dumps({'matrix':matrix,'changes':changes,'kings':kings,'all':allstats,'identical_nonpalace':6000},ensure_ascii=False,indent=2))
lines=['# 宮殿：昇格後も移動できる仕様の比較','',
'2026年9月9日。ルール版7では、宮殿で1体を昇格させても手番は続き、昇格した駒または別の駒を通常どおり動かせる。任意発動・毎手番1回は維持。旧版6以前の対局・リプレイは従来の手番消費を保持する。','',
'## 条件','',
'- 新仕様9,000局（全15組）、旧仕様3,000局（宮殿の5組）。各組300配札×先後2局、600局。',
'- 同じCPUを使用。新仕様では手番を消費しない前提で昇格を判断し、昇格で目前の攻撃を失う場合はその対象を避ける。J・Qの補充価値、A包囲、予備札再配置、エリアに合う引き直しと布陣は共通。',
'- 王の帯内の数字を均等に交代。宮殿のJ・Q・K王は各相手200局。希望の王を初期手札に確保し、残りは抽選。理想の構成を毎回与える実験ではない。',
'- 配札の種、王、先後を対応させる。旧仕様の3,000局は前回保存した版6の対局と全項目一致。宮殿を含まない新仕様6,000局も前回と全項目一致。',
'- 160手番／2,400操作まで。未決着は勝率の分母に含めず別記。時計は消費しない。公開ランキングへは書き込まない。','',
'## 宮殿の相性の変化','', '| 相手 | 旧仕様 | 新仕様 | 差 | 新仕様：勝–負–分–未決着 |','|---|---:|---:|---:|---|']
for t,c in [*changes.items(),('all',allstats)]:
 x,y=c['before'],c['after'];lines.append(f"| {names.get(t,'全相手合計')} | {x['rate']:.1f}% | {y['rate']:.1f}% | {y['rate']-x['rate']:+.1f}pt | {y['wins']}–{y['losses']}–{y['draws']}–{y['unfinished']} |")
lines+=['',f"全相手合計の差の95%区間：{allstats['ci95'][0]:+.1f}〜{allstats['ci95'][1]:+.1f}ポイント。配札ごとの先後2局を組にした対応ありブートストラップ2,000回。各相性の区間はsummary.jsonに保存。",'',
'## 宮殿の王別','', '| 王 | 旧仕様 | 新仕様 |','|---|---:|---:|']
for k,c in kings.items():lines.append(f"| {k} | {c['before']['rate']:.1f}% | {c['after']['rate']:.1f}% |")
lines+=['','## 新仕様の全相性表','', '行の勝率。','', '| 自分＼相手 | '+' | '.join(names.values())+' |','|---|'+'---:|'*6]
for t in names:lines.append('| '+names[t]+' | '+' | '.join('—' if t==u else f"{matrix[t][u]['rate']:.1f}%" for u in names)+' |')
lines+=['','## 検証の範囲','',
'- 現CPU同士の相性であり、人間の勝率や最適戦略を保証する結果ではない。エリアと王の能力、採用札を合わせて評価している。',
'- 新旧の手番、昇格後の移動、同じ手番での再発動禁止、CPUの移動継続、演出文言をcheck-palace-free.mjsで検査した。',
'- エリア以外の駒能力は変更していない。宮殿で10になっても、空の軍全体への2回行動付与は発生しない。','',
'## 再現','', '```sh',
'STRATEGIC_SETUP=1 POLICIES=informed SEEDS=300 OUTPUT=reports/area-matchups-palace-free/results.json node tools/area-matchups.mjs',
'RULE_VERSION=6 ONLY_AREA=palace STRATEGIC_SETUP=1 POLICIES=informed SEEDS=300 OUTPUT=reports/area-matchups-palace-free/control/results.json node tools/area-matchups.mjs',
'python3 tools/summarize-palace-free.py','```']
(root/'検証レポート.md').write_text('\n'.join(lines)+'\n')
for d in [root,root/'control']:
 (d/'results.json.gz').write_bytes(gzip.compress((d/'results.json').read_bytes(),mtime=0));(d/'.gitignore').write_text('/results.json\n')
print(json.dumps({'all':allstats,'kings':kings,'changes':changes},ensure_ascii=False,indent=2))
