import json, sys
# 4面(2×2)の陣形図。引数: out.svg, 題, panels json [{title, grid, notes:[..]}]
out, title, panels = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
COLORS = {"土":"#8a5a2b","森":"#2f6b3a","氷":"#3e8e90","空":"#4a6fb5"}
def board(x0, y0, p, cell=44):
    o=[]
    tag=p["tag"]; col=COLORS.get(tag,"#1d2b4c")
    o.append(f'<rect x="{x0}" y="{y0-34}" width="34" height="28" rx="6" fill="{col}"/><text x="{x0+17}" y="{y0-13}" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">{tag}</text>')
    o.append(f'<text x="{x0+42}" y="{y0-13}" font-size="19" font-weight="700" fill="#1d2b4c">{p["title"]}</text>')
    for r in range(9):
        for c in range(9):
            fill = "#f6e9e3" if r>=6 else "#e6eef4" if r<=2 else "#fbf7ef"
            if (r+c)%2: fill = {"#f6e9e3":"#f0dcd3","#e6eef4":"#d9e5ee","#fbf7ef":"#f3ecdd"}[fill]
            o.append(f'<rect x="{x0+c*cell}" y="{y0+r*cell}" width="{cell}" height="{cell}" fill="{fill}" stroke="#c9b99a"/>')
    for k,lab in p["grid"].items():
        r,c=map(int,k.split(",")); x=x0+c*cell; y=y0+r*cell
        king=lab.startswith("["); rank=lab.strip("[]")
        o.append(f'<rect x="{x+3}" y="{y+3}" width="{cell-6}" height="{cell-6}" rx="7" fill="{"#d9a441" if king else "#c1543a"}" stroke="#7a2f1f" stroke-width="2"/>')
        o.append(f'<text x="{x+cell/2}" y="{y+cell/2+7}" text-anchor="middle" font-size="{21 if len(rank)<2 else 17}" font-weight="700" fill="#fff8ee">{rank}</text>')
        if king: o.append(f'<text x="{x+cell/2}" y="{y+11}" text-anchor="middle" font-size="10" font-weight="700" fill="#5a3a00">王</text>')
    o.append(f'<rect x="{x0}" y="{y0}" width="{cell*9}" height="{cell*9}" fill="none" stroke="#8a7350" stroke-width="3"/>')
    y=y0+cell*9+26
    for line in p["notes"]:
        o.append(f'<text x="{x0}" y="{y}" font-size="15" fill="#2a2a2a">{line}</text>'); y+=22
    return "\n".join(o)
W,H=1300,1300
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif">',f'<rect width="{W}" height="{H}" fill="#fffdf7"/>',
 f'<text x="{W/2}" y="48" text-anchor="middle" font-size="28" font-weight="800" fill="#1d2b4c">{title}</text>']
pos=[(60,110),(700,110),(60,700),(700,700)]
for p,(x,y) in zip(panels,pos): svg.append(board(x,y,p))
svg.append(f'<text x="60" y="{H-24}" font-size="14" fill="#666">図は自分が下側（赤）。左右対称の配置も同じ。各エリアの指し方は本文のとおり。</text></svg>')
open(out,"w").write("\n".join(svg))
