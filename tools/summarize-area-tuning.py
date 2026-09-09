import pathlib, json, gzip, collections, random

root = pathlib.Path("reports/area-tuning")


def read(p):
    return (
        json.loads(p.read_text())
        if p.exists()
        else json.loads(gzip.decompress(p.with_suffix(".json.gz").read_bytes()))
    )


def won(r, t):
    return r["completed"] and r["winner"] is not None and r["sides"][r["winner"]] == t


def lost(r, t):
    return r["completed"] and r["winner"] is not None and r["sides"][r["winner"]] != t


def stats(rs, t):
    w = sum(won(r, t) for r in rs)
    l = sum(lost(r, t) for r in rs)
    return {
        "n": len(rs),
        "wins": w,
        "losses": l,
        "draws": sum(r["completed"] and r["winner"] is None for r in rs),
        "unfinished": sum(not r["completed"] for r in rs),
        "rate": 100 * w / (w + l) if w + l else None,
        "uses": sum(r["uses"][r["sides"].index(t)] for r in rs) / len(rs),
    }


def interval(rs, t):
    groups = collections.defaultdict(lambda: [0, 0])
    for r in rs:
        g = groups[r["seed"]]
        if r["completed"] and r["winner"] is not None:
            g[0] += won(r, t)
            g[1] += 1
    rng = random.Random(90914)
    values = list(groups.values())
    rates = []
    for _ in range(2000):
        w, n = [sum(c) for c in zip(*rng.choices(values, k=len(values)))]
        rates.append(100 * w / n)
    rates.sort()
    return [rates[50], rates[1950]]


def load(name, side):
    data = read(root / name / "results.json")
    rs = data["results"]
    (root / name / "results.json.gz").write_bytes(
        gzip.compress((root / name / "results.json").read_bytes(), mtime=0)
    )
    (root / name / ".gitignore").write_text("/results.json\n")
    return {"all": stats(rs, side), "ci95": interval(rs, side), "meta": {k: data.get(k) for k in ["tuning", "unknownWeight", "sidePolicies"]}}


summary = {}
summary["sanity"] = load("sanity-aware-vs-informed", "foil")
summary["sanity-w0.3"] = load("sanity-w0.3", "foil")
summary["sanity-w0.15"] = load("sanity-w0.15", "foil")
rows = []
for pol, pol_label in [("informed", "従来（見抜いた駒だけを脅威にする）"), ("aware", "改良（正体不明の駒も見込みで脅威にする）")]:
    for odds in ["0.5", "0.75", "1"]:
        name = f"earth-odds{odds}-{pol}"
        summary[name] = load(name, "earth")
        rows.append(("土", f"当たる確率 {float(odds) * 100:.0f}%", pol_label, summary[name]))
    for own, own_label in [("1", "自分の駒も流される（現行）"), ("0", "相手の駒だけ流される")]:
        name = f"sea-own{own}-{pol}"
        summary[name] = load(name, "sea")
        rows.append(("海", own_label, pol_label, summary[name]))
for t, label in [("forest", "森"), ("ice", "氷")]:
    name = f"{t}-aware"
    summary[name] = load(name, t)
    rows.append((label, "現行", "改良", summary[name]))
(root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))

san = summary["sanity"]
n_each = san["all"]["n"]
seeds = n_each // 2
lines = [
    "# 土と海の改善案の検証",
    "",
    f"2026年9月9日。ルール版{read(root / 'sanity-aware-vs-informed' / 'results.json')['ruleVersion']}。"
    "土・海のフォイルを持つ側と、同じランクの王でフォイルを持たない側の9×9。効果の数字を変えた場合と、"
    "情報を活かす検証CPUに替えた場合を比べる。公開対局・ランキング・プレイヤーデータへの書き込みは行っていない。",
    "",
    "## 検証条件",
    "",
    f"- 各条件 {seeds}配札 × 先手後手の入替2局 = {n_each:,}局。{len(summary):,}条件で合計 {n_each * len(summary):,}局。",
    "- 両側とも同じ帯の王（土なら2か3、海なら4か5）を初期手札に確保し、戦略的な引き直し・構成・布陣を使う。フォイル側だけエリアが立つ。",
    "- 「改良」CPUは、正体の分からない敵の駒を「2〜Kのどのランクでもありうる」として実際の移動規則で到達マスを数え、その見込みで危険を避ける（重み0.6）。正体が分かった駒は従来どおり確実な判定に移る。従来CPUは正体の分かった駒だけを脅威にしていたので、見抜いても慎重になるだけで、見抜けない側は無警戒に攻めていた。",
    "- 土の当たる確率は `AREA_TUNING.earthOdds`、海の対象は `AREA_TUNING.seaPullsOwn` を検証時だけ差し替える（`tools/experiment-tuning.mjs`）。配信物の数字は変えていない。",
    "- 同じ配札・引き直し・布陣で先後を反転。160手番または2,400操作で未決着。未決着・引き分けは勝率の分母に含めず別記。",
    "",
    "## 改良CPUの確認",
    "",
    f"エリアなし同士で、改良CPUが従来CPUに勝った割合: 重み0.6で **{san['all']['rate']:.1f}%**（95%区間 {san['ci95'][0]:.1f}–{san['ci95'][1]:.1f}）、"
    f"重み0.3で {summary['sanity-w0.3']['all']['rate']:.1f}%、重み0.15で {summary['sanity-w0.15']['all']['rate']:.1f}%。",
    "",
    "正体不明の駒を警戒する打ち方は、無警戒に攻める従来CPUに一貫して負け越す。このゲームは決着が速く（中央値7〜16手番）、先に取りに行く側が得をするため。"
    "したがって改良CPU同士の行は「慎重に打ち合う場合の情報の値打ち」を示す補助の物差しで、効果の数字を決める主な根拠は従来CPUの行にする。",
    "",
    "## 結果",
    "",
    "フォイル側の勝率。勝敗がついた局が分母。区間は同じ配札の先後2局を組にしたブートストラップ2,000回の95%区間。",
    "",
    "| エリア | 効果の設定 | CPU | 勝率 | 95%区間 | 勝–負–分–未決着 | 発動／局 |",
    "|---|---|---|---:|---:|---|---:|",
]
for t, setting, pol, s in rows:
    a = s["all"]
    lines.append(
        f"| {t} | {setting} | {pol} | **{a['rate']:.1f}%** | {s['ci95'][0]:.1f}–{s['ci95'][1]:.1f} | "
        f"{a['wins']}–{a['losses']}–{a['draws']}–{a['unfinished']} | {a['uses']:.1f} |"
    )
lines += [
    "",
    "森・氷の行は、改良CPUでの物差し（同じ王同士でのフォイルの効き目）。",
    "",
    "## 読み方と限界",
    "",
    "- CPU同士の結果で、人間の勝率ではない。改良CPUも深い先読みはしない。",
    "- 土の情報は「王候補の絞り込み」「見抜いた駒の脅威判定」「見抜いた駒を取る価値」に使う。人が使える「相手の帯からの推理」は使っていない。",
    "- 海の「相手だけ流される」は検証用の数字の差し替えで、ルール版は上げていない。採用するならルール版を上げ、旧対局の再生を守る必要がある。",
    "",
    "## 再現",
    "",
    "```sh",
    f"OVERALL=1 FOIL_SET=none SIDE_POLICIES=aware,informed STRATEGIC_SETUP=1 POLICIES=informed SEEDS={seeds} OUTPUT=reports/area-tuning/sanity-aware-vs-informed/results.json node tools/area-matchups.mjs",
    f"VS_NONE=1 ONLY_AREA=earth EARTH_ODDS=<0.5|0.75|1> STRATEGIC_SETUP=1 POLICIES=<informed|aware> SEEDS={seeds} OUTPUT=reports/area-tuning/earth-odds<確率>-<CPU>/results.json node tools/area-matchups.mjs",
    f"VS_NONE=1 ONLY_AREA=sea SEA_PULLS_OWN=<1|0> STRATEGIC_SETUP=1 POLICIES=<informed|aware> SEEDS={seeds} OUTPUT=reports/area-tuning/sea-own<1|0>-<CPU>/results.json node tools/area-matchups.mjs",
    "python3 tools/summarize-area-tuning.py",
    "```",
]
(root / "検証レポート.md").write_text("\n".join(lines) + "\n")
print(f"sanity aware vs informed: {san['all']['rate']:.1f}% [{san['ci95'][0]:.1f}, {san['ci95'][1]:.1f}]")
for t, setting, pol, s in rows:
    print(f"{t} {setting:20} {pol[:2]} {s['all']['rate']:.1f}% [{s['ci95'][0]:.1f}, {s['ci95'][1]:.1f}] uses {s['all']['uses']:.1f}")
