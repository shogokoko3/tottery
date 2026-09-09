import pathlib, json, gzip, collections, random

root = pathlib.Path("reports/area-vs-none")


def read(p):
    return (
        json.loads(p.read_text())
        if p.exists()
        else json.loads(gzip.decompress(p.with_suffix(".json.gz").read_bytes()))
    )


data = read(root / "results.json")
assert data["vsNone"] and data["strategicSetup"]
results = data["results"]
names = {
    "earth": "土",
    "sea": "海",
    "forest": "森",
    "ice": "氷",
    "sky": "空",
    "palace": "宮殿",
}
bands = {
    "earth": "2・3",
    "sea": "4・5",
    "forest": "6・7",
    "ice": "8・9",
    "sky": "10",
    "palace": "J・Q・K",
}


def rows(t, king=None, first=None):
    out = []
    for r in results:
        if r["pair"][0] != t:
            continue
        side = r["sides"].index(t)
        if king is not None and r["kings"][side] != king:
            continue
        if first is not None and (r["first"] == side) != first:
            continue
        out.append(r)
    return out


def won(r, t):
    return r["completed"] and r["winner"] is not None and r["sides"][r["winner"]] == t


def lost(r, t):
    return r["completed"] and r["winner"] is not None and r["sides"][r["winner"]] != t


def stats(rs, t):
    w = sum(won(r, t) for r in rs)
    l = sum(lost(r, t) for r in rs)
    decided = [r for r in rs if r["completed"] and r["winner"] is not None]
    side_uses = [r["uses"][r["sides"].index(t)] for r in rs]
    return {
        "wins": w,
        "losses": l,
        "draws": sum(r["completed"] and r["winner"] is None for r in rs),
        "unfinished": sum(not r["completed"] for r in rs),
        "rate": 100 * w / (w + l) if w + l else None,
        "turns_median": sorted(r["turns"] for r in decided)[len(decided) // 2]
        if decided
        else None,
        "uses_mean": sum(side_uses) / len(side_uses) if side_uses else None,
    }


def interval(rs, t):
    # 同じ配札の先後2局を1組にしたブートストラップ
    groups = collections.defaultdict(lambda: [0, 0])
    for r in rs:
        g = groups[r["seed"]]
        if r["completed"] and r["winner"] is not None:
            g[0] += won(r, t)
            g[1] += 1
    rng = random.Random(90912)
    values = list(groups.values())
    rates = []
    for _ in range(2000):
        w, n = [sum(c) for c in zip(*rng.choices(values, k=len(values)))]
        rates.append(100 * w / n)
    rates.sort()
    return [rates[50], rates[1950]]


summary = {}
for t in names:
    rs = rows(t)
    summary[t] = {
        "all": stats(rs, t),
        "ci95": interval(rs, t),
        "first": stats(rows(t, first=True), t),
        "second": stats(rows(t, first=False), t),
        "kings": {
            k: stats(rows(t, king=k), t)
            for k in sorted({r["kings"][r["sides"].index(t)] for r in rs})
        },
    }
(root / "summary.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=2)
)

n_total = len(results)
seeds = data["seeds"]
lines = [
    "# フォイルあり対なしの検証",
    "",
    f"2026年9月9日。ルール版{data['ruleVersion']}。片側だけがフォイルを装備してエリアを立て、"
    "相手は同じランクの王をフォイルなしで使う9×9を合計{:,}局実行。".format(n_total),
    "公開対局・ランキング・プレイヤーデータへの書き込みは行っていない。",
    "",
    "## 検証条件",
    "",
    f"- 6エリア × {seeds}配札 × 先手後手の入替2局。各エリア{seeds * 2:,}局。CPUはいつもの情報活用CPU（`cpuInformedAction`）で、戦略的な引き直し・布陣を両側に使う。",
    "- **両側とも同じランクの王**を初期手札に確保する（土なら両方2か3、宮殿なら両方J/Q/Kのいずれか）。王の能力・ランクの差を消し、フォイルの有無だけを比べるための設計。帯の中のランクは配札ごとに均等に交代。",
    "- フォイル側は全ランクにフォイルを装備。なし側は装備なしで、エリアは立たない。CPUの構成評価はどちらも同じ関数で、なし側はエリアを前提にしない構成を選ぶ。",
    "- 同じ配札・引き直し・布陣で先後を反転。160手番または2,400操作で未決着。未決着・引き分けは勝率の分母に含めず別記。時計は消費しない。",
    "- 実行は `tools/area-matchups.mjs` の `VS_NONE=1`。通常モードの結果は変更前のツールと全項目一致することを確認した。",
    "",
    "## フォイル側の勝率",
    "",
    "勝敗がついた対局だけを分母にした、フォイル側の勝率。区間は同じ配札の先後2局を組にしたブートストラップ2,000回の95%区間。",
    "",
    "| エリア（王のランク） | 勝率 | 95%区間 | 先手のとき | 後手のとき | 勝–負–分–未決着 | 発動回数／局 | 決着までの手番（中央値） |",
    "|---|---:|---:|---:|---:|---|---:|---:|",
]
for t in names:
    s = summary[t]
    a = s["all"]
    lines.append(
        f"| {names[t]}（{bands[t]}） | **{a['rate']:.1f}%** | {s['ci95'][0]:.1f}–{s['ci95'][1]:.1f} | "
        f"{s['first']['rate']:.1f}% | {s['second']['rate']:.1f}% | "
        f"{a['wins']}–{a['losses']}–{a['draws']}–{a['unfinished']} | {a['uses_mean']:.1f} | {a['turns_median']} |"
    )
lines += [
    "",
    "50%が「フォイルの有無で差がない」線。",
    "",
    "## 王のランク別",
    "",
    "| エリア | 王 | 勝率 | 勝–負 |",
    "|---|---|---:|---|",
]
for t in names:
    for k, s in summary[t]["kings"].items():
        lines.append(f"| {names[t]} | {k} | {s['rate']:.1f}% | {s['wins']}–{s['losses']} |")
lines += [
    "",
    "## 読み方と限界",
    "",
    "- 同じ王のランク同士なので、差はエリアの効果と、エリアを前提にした構成・布陣の差。王の能力差は含まない。",
    "- 実際のオンライン対戦では、フォイルなしの側は別のランクの王を選べる。ここではその自由を与えていないので、なし側の実力はやや低めに出る可能性がある。",
    "- CPU同士の相性であり、人間の勝率ではない。CPUは深い先読みをせず、長期の推理や守りを過小評価しうる。",
    "- 未決着・停止は勝率の分母に含めていない。",
    "",
    "## 再現",
    "",
    "```sh",
    f"VS_NONE=1 STRATEGIC_SETUP=1 POLICIES=informed SEEDS={seeds} OUTPUT=reports/area-vs-none/results.json node tools/area-matchups.mjs",
    "python3 tools/summarize-area-vs-none.py",
    "```",
    "",
    "対局記録は results.json.gz、集計は summary.json。",
]
(root / "検証レポート.md").write_text("\n".join(lines) + "\n")
(root / "results.json.gz").write_bytes(
    gzip.compress((root / "results.json").read_bytes(), mtime=0)
)
(root / ".gitignore").write_text("/results.json\n")
for t in names:
    s = summary[t]
    print(
        f"{names[t]:3} {s['all']['rate']:.1f}% [{s['ci95'][0]:.1f}, {s['ci95'][1]:.1f}] "
        f"first {s['first']['rate']:.1f} second {s['second']['rate']:.1f} "
        f"W-L {s['all']['wins']}-{s['all']['losses']} unfinished {s['all']['unfinished']}"
    )
