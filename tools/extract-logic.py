"""app.pretty.js から、指定した関数の依存クロージャだけを機械的に切り出す。"""
import re, sys, json

SRC = "reference/app.pretty.js"
lines = open(SRC, encoding="utf-8").read().split("\n")

# --- トップレベル宣言（IIFE 内なのでインデント2）を範囲つきで拾う ---
decls = {}          # name -> (start, end) 行番号(0始まり, endは含む)
order = []          # 出現順の (name, start, end)

def scan():
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = re.match(r'^  (?:async )?function ([A-Za-z0-9_$]+)\(', ln)
        if m:
            # 対応する閉じ括弧 "  }" を探す
            j = i + 1
            while j < len(lines) and lines[j] != "  }":
                j += 1
            order.append((m.group(1), i, j))
            decls[m.group(1)] = (i, j)
            i = j + 1
            continue
        if re.match(r'^  var ', ln):
            j = i
            # インデント2で ; 終わりの行まで
            while j < len(lines) and not lines[j].rstrip().endswith(";"):
                j += 1
            block = "\n".join(lines[i:j+1])
            # この var 文が宣言している名前（= の左辺）
            names = re.findall(r'(?:^  var |^    )([A-Za-z0-9_$]+) =', block, re.M)
            if not names:
                names = re.findall(r'^  var ([A-Za-z0-9_$]+)', block, re.M)
            for n in names:
                decls[n] = (i, j)
            order.append((names[0] if names else "?", i, j))
            i = j + 1
            continue
        i += 1

scan()

def body(name):
    s, e = decls[name]
    return "\n".join(lines[s:e+1])

IDENT = re.compile(r'\b([A-Za-z_$][A-Za-z0-9_$]*)\b')

def closure(roots):
    seen, stack = set(), list(roots)
    while stack:
        n = stack.pop()
        if n in seen or n not in decls:
            continue
        seen.add(n)
        for ident in set(IDENT.findall(body(n))):
            if ident in decls and ident not in seen:
                stack.append(ident)
    return seen

if __name__ == "__main__":
    roots = sys.argv[1:] or ["ki", "Eo"]
    need = closure(roots)
    missing = [r for r in roots if r not in decls]
    if missing:
        sys.exit("未定義のルート: " + ", ".join(missing))
    # 出現順を保って出力（宣言順＝定義順なので前方参照を壊さない）
    emitted, out = set(), []
    for name, s, e in order:
        chunk_names = {n for n, (a, b) in decls.items() if (a, b) == (s, e)}
        if chunk_names & need and (s, e) not in emitted:
            emitted.add((s, e))
            out.append("\n".join(lines[s:e+1]))
    print("// 自動抽出: %s の依存クロージャ (%d 宣言)" % (", ".join(roots), len(out)))
    print("\n".join(out))
    exported = sorted(need)
    print("\nexport { %s };" % ", ".join(exported))
    print("\n// 抽出した名前: %d" % len(need), file=sys.stderr)
