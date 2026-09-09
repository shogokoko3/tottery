import pathlib, json, gzip, collections, random

root = pathlib.Path("reports/foil-vs-none")
variants = [
    ("all-v20", "全フォイル（6エリア）・エリアの値打ち×2.0（10があれば空を選ぶ）"),
    ("SSR-v20", "SSRのフォイルだけ（空・宮殿）×2.0"),
    ("all-v10", "全フォイル×1.0"),
    ("SSR-v10", "SSRだけ×1.0"),
    ("SR-v10", "SRのフォイルだけ（森・氷）×1.0"),
    ("R-v10", "Rのフォイルだけ（土・海）×1.0"),
    ("all-v04", "全フォイル×0.4"),
    ("SSR-v04", "SSRだけ×0.4"),
    ("SR-v04", "SRだけ×0.4"),
    ("R-v04", "Rだけ×0.4"),
    ("all-stock", "全フォイル・エリアの値打ちを足さない（従来の構成評価）"),
]
names = {
    "earth": "土",
    "sea": "海",
    "forest": "森",
    "ice": "氷",
    "sky": "空",
    "palace": "宮殿",
    "none": "立たず",
}


def read(p):
    return (
        json.loads(p.read_text())
        if p.exists()
        else json.loads(gzip.decompress(p.with_suffix(".json.gz").read_bytes()))
    )


def side_of(r, t):
    return r["sides"].index(t)


def won(r, t):
    return r["completed"] and r["winner"] is not None and r["sides"][r["winner"]] == t


def lost(r, t):
    return r["completed"] and r["winner"] is not None and r["sides"][r["winner"]] != t


def stats(rs, t="foil"):
    w = sum(won(r, t) for r in rs)
    l = sum(lost(r, t) for r in rs)
    return {
        "n": len(rs),
        "wins": w,
        "losses": l,
        "draws": sum(r["completed"] and r["winner"] is None for r in rs),
        "unfinished": sum(not r["completed"] for r in rs),
        "rate": 100 * w / (w + l) if w + l else None,
    }


def interval(rs, t="foil"):
    groups = collections.defaultdict(lambda: [0, 0])
    for r in rs:
        g = groups[r["seed"]]
        if r["completed"] and r["winner"] is not None:
            g[0] += won(r, t)
            g[1] += 1
    rng = random.Random(90913)
    values = list(groups.values())
    rates = []
    for _ in range(2000):
        w, n = [sum(c) for c in zip(*rng.choices(values, k=len(values)))]
        rates.append(100 * w / n)
    rates.sort()
    return [rates[50], rates[1950]]


summary = {}
for key, label in variants:
    data = read(root / key / "results.json")
    assert data["overall"]
    rs = data["results"]
    foil_area = lambda r: r["areaTypes"][side_of(r, "foil")]
    by_area = collections.OrderedDict()
    for a in ["sky", "palace", "ice", "forest", "sea", "earth", "none"]:
        sub = [r for r in rs if foil_area(r) == a]
        if sub:
            by_area[a] = stats(sub)
    kings = {
        t: collections.Counter(r["kings"][side_of(r, t)] for r in rs)
        for t in ["foil", "none"]
    }
    summary[key] = {
        "label": label,
        "foilAreas": data["foilAreas"],
        "areaValue": data["areaValue"],
        "all": stats(rs),
        "ci95": interval(rs),
        "first": stats([r for r in rs if r["first"] == side_of(r, "foil")]),
        "second": stats([r for r in rs if r["first"] != side_of(r, "foil")]),
        "byArea": by_area,
        "kings": {t: dict(c.most_common()) for t, c in kings.items()},
    }
    (root / key / "results.json.gz").write_bytes(
        gzip.compress((root / key / "results.json").read_bytes(), mtime=0)
    )
    (root / key / ".gitignore").write_text("/results.json\n")

(root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))

n_each = summary["all-v20"]["all"]["n"]
seeds = n_each // 2
lines = [
    "# フォイルを持つ側と持たない側の検証",
    "",
    f"2026年9月9日。ルール版{read(root / 'all-v20' / 'results.json')['ruleVersion']}。"
    "片側だけがフォイルを装備し、相手は何も装備しない9×9。両者とも配られた手札から王を自由に選び、"
    "引き直し・構成・布陣を自分で決める。特定のエリア同士の相性ではなく、「フォイルを持っていること」全体の効き目を測る。",
    "公開対局・ランキング・プレイヤーデータへの書き込みは行っていない。",
    "",
    "## 検証条件",
    "",
    f"- 各条件 {seeds}配札 × 先手後手の入替2局 = {n_each:,}局。{len(variants)}条件で合計 {n_each * len(variants):,}局。",
    "- 王の指定はしない。配札はそのまま使い、両側とも情報活用CPU（`cpuInformedAction`）の戦略的な構成で、手札の各札を王にした場合を比べて王・採用札を決め、その構成に合わない札を最大4枚引き直し、引いた後の手札で構成し直し、相互に取り返せる布陣を組む。",
    "- フォイル側は「持つ範囲」のランクにだけフォイルを装備する。王に選んだ札のランクにフォイルがあればエリアが立つ。持たない側は装備なしで、エリアは立たない。",
    "- 「エリアの値打ち」は、同じ王同士でのフォイルあり対なし（reports/area-vs-none）の勝率差（pt: 空24.6・氷12.6・森11.9・宮殿7.5・海2.9・土0）に倍率を掛けて、王ごとの構成の点に足したもの。人が強いエリアを知っていて王を選ぶ状況に寄せるための項。×2.0 では 10 が手札にあれば必ず空を選び、×1.0 では手札次第で空と宮殿が分かれ、×0.4 では K があれば K（宮殿）を選び続ける。`all-stock` はこれを足さない従来の構成評価で、ほぼ K の宮殿になる。",
    "- 同じ配札・引き直し・布陣で先後を反転。160手番または2,400操作で未決着。未決着・引き分けは勝率の分母に含めず別記。時計は消費しない。",
    "- 実行は `tools/area-matchups.mjs` の `OVERALL=1`。既存モードの結果は変更前と全項目一致することを確認した。",
    "",
    "## フォイル側の勝率",
    "",
    "勝敗がついた対局だけを分母にした、フォイルを持つ側の勝率。区間は同じ配札の先後2局を組にしたブートストラップ2,000回の95%区間。",
    "",
    "| 持つ範囲 | 勝率 | 95%区間 | 先手のとき | 後手のとき | 勝–負–分–未決着 |",
    "|---|---:|---:|---:|---:|---|",
]
for key, label in variants:
    s = summary[key]
    a = s["all"]
    lines.append(
        f"| {label} | **{a['rate']:.1f}%** | {s['ci95'][0]:.1f}–{s['ci95'][1]:.1f} | "
        f"{s['first']['rate']:.1f}% | {s['second']['rate']:.1f}% | "
        f"{a['wins']}–{a['losses']}–{a['draws']}–{a['unfinished']} |"
    )
lines += [
    "",
    "50%が「持っていても差がない」線。",
    "",
    "## フォイル側に立ったエリアの内訳",
    "",
    "フォイル側がどの王を選び、どのエリアが立ったか。「立たず」は、フォイルの無いランクを王にした局。",
    "",
]
for key, label in variants:
    s = summary[key]
    lines += [f"### {label}", "", "| 立ったエリア | 局数 | 割合 | フォイル側の勝率 |", "|---|---:|---:|---:|"]
    for a, st in s["byArea"].items():
        rate = f"{st['rate']:.1f}%" if st["rate"] is not None else "—"
        lines.append(f"| {names[a]} | {st['n']} | {100 * st['n'] / n_each:.0f}% | {rate} |")
    fk = ", ".join(f"{k}: {v}" for k, v in s["kings"]["foil"].items())
    nk = ", ".join(f"{k}: {v}" for k, v in s["kings"]["none"].items())
    lines += ["", f"王の内訳（フォイル側）: {fk}", "", f"王の内訳（持たない側）: {nk}", ""]
lines += [
    "## 読み方と限界",
    "",
    "- 「持つ範囲」ごとの勝率は、そのフォイルを全部持っている人が、何も持たない人と当たったときの期待勝率。手札にそのランクが無ければエリアは立たないので、その分も含めた全体の値。",
    "- 持たない側は、相手のエリアから王のランクの帯が分かるが、CPUはそれを推理に使っていない。人はここを使えるので、実際の差はこれより少し縮まりうる。",
    "- 土・森の情報は、CPUが王候補の絞り込みと、正体の分かった駒の脅威判定に使う範囲でしか効かない。",
    "- CPU同士の結果で、人間の勝率ではない。CPUは深い先読みをしない。",
    "",
    "## 再現",
    "",
    "```sh",
    "# <倍率> は 2 / 1 / 0.4 / 0、<範囲> は all / SSR / SR / R",
    f"OVERALL=1 FOIL_SET=<範囲> AREA_VALUE=<倍率> STRATEGIC_SETUP=1 POLICIES=informed SEEDS={seeds} OUTPUT=reports/foil-vs-none/<範囲>-v10/results.json node tools/area-matchups.mjs",
    "python3 tools/summarize-foil-vs-none.py",
    "```",
    "",
    "対局記録は各フォルダの results.json.gz、集計は summary.json。",
]
(root / "検証レポート.md").write_text("\n".join(lines) + "\n")
for key, label in variants:
    s = summary[key]
    print(
        f"{key:10} {s['all']['rate']:.1f}% [{s['ci95'][0]:.1f}, {s['ci95'][1]:.1f}] "
        f"first {s['first']['rate']:.1f} second {s['second']['rate']:.1f} "
        f"W-L {s['all']['wins']}-{s['all']['losses']} unfinished {s['all']['unfinished']} "
        "areas {" + ", ".join(names[a] + ":" + str(st["n"]) for a, st in s["byArea"].items()) + "}"
    )
