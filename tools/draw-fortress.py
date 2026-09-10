import sys, json
# 使い方: python3 draw-fort.py out.svg '<題>' '<左の題>' '<左の並び json>' '<右の題>' '<右の並び json>' '<脚注>'
out, title, tA, gA, tB, gB, foot = sys.argv[1:8]
def board(x0, y0, title, grid, cell=54):
    o=[f'<text x="{x0+cell*4.5}" y="{y0-16}" text-anchor="middle" font-size="25" font-weight="700" fill="#1d2b4c">{title}</text>']
    for r in range(9):
        for c in range(9):
            fill = "#f6e9e3" if r>=6 else "#e6eef4" if r<=2 else "#fbf7ef"
            if (r+c)%2: fill = {"#f6e9e3":"#f0dcd3","#e6eef4":"#d9e5ee","#fbf7ef":"#f3ecdd"}[fill]
            o.append(f'<rect x="{x0+c*cell}" y="{y0+r*cell}" width="{cell}" height="{cell}" fill="{fill}" stroke="#c9b99a"/>')
    kr=kc=None
    for k,lab in grid.items():
        r,c=map(int,k.split(",")); x=x0+c*cell; y=y0+r*cell
        king=lab.startswith("["); rank=lab.strip("[]")
        if king: kr,kc=r,c
        o.append(f'<rect x="{x+4}" y="{y+4}" width="{cell-8}" height="{cell-8}" rx="8" fill="{"#d9a441" if king else "#c1543a"}" stroke="#7a2f1f" stroke-width="2"/>')
        o.append(f'<text x="{x+cell/2}" y="{y+cell/2+9}" text-anchor="middle" font-size="{26 if len(rank)<2 else 22}" font-weight="700" fill="#fff8ee">{rank}</text>')
        if king: o.append(f'<text x="{x+cell/2}" y="{y+13}" text-anchor="middle" font-size="11" font-weight="700" fill="#5a3a00">王</text>')
    kx=x0+kc*cell+cell/2; ky=y0+kr*cell+cell/2
    for dr,dc in [(-1,0),(0,1),(-1,1)]:
        o.append(f'<line x1="{kx}" y1="{ky}" x2="{kx+dc*cell*2.6}" y2="{ky+dr*cell*2.6}" stroke="#7a2f1f" stroke-width="3" stroke-dasharray="6 5" opacity="0.55"/>')
    o.append(f'<rect x="{x0}" y="{y0}" width="{cell*9}" height="{cell*9}" fill="none" stroke="#8a7350" stroke-width="3"/>')
    o.append(f'<text x="{x0+cell*9+6}" y="{y0+cell*1.5+8}" font-size="15" fill="#3e8e90" font-weight="700">相手陣</text>')
    o.append(f'<text x="{x0+cell*9+6}" y="{y0+cell*7.5+8}" font-size="15" fill="#c1543a" font-weight="700">自陣</text>')
    return "\n".join(o)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1300" viewBox="0 0 1300 1300" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif">','<rect width="1300" height="1300" fill="#fffdf7"/>',
 f'<text x="650" y="52" text-anchor="middle" font-size="30" font-weight="800" fill="#1d2b4c">{title}</text>',
 board(60,130,tA,json.loads(gA)), board(820,130,tB,json.loads(gB))]
notes=[("王","#d9a441",["いちばん奥の隅に置く。縦・横・斜めの線（点線）はすべて味方で塞がり、","桂馬で跳び込める2升にも味方が居るので、どのランクの駒も王に届かない"]),
("駒","#c1543a",["9体すべてに「取られたら取り返す」味方の手がある。","相手の王が取りに来たら、その場で討ち取って勝ち"]),
("役","#1d2b4c",["J・Q を2枚ずつ：遠くから取り返す。2・4・8 は縦横1マス先を守り、Q は斜めを守る。","6・7（偶数歩）と A は隣を守れないので入れない。5・3 も J・Q・8 に劣る"]),
("氷","#3e8e90",["毎手番、相手の王以外の1体が自動で凍る。自陣から出ず、","相手が要塞に手を出して駒を失うか、凍って動けなくなるのを待つ"])]
y=700
for tag,col,lines in notes:
    svg.append(f'<rect x="60" y="{y-24}" width="36" height="34" rx="6" fill="{col}"/><text x="78" y="{y}" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">{tag}</text>')
    for i,t in enumerate(lines): svg.append(f'<text x="112" y="{y+i*28}" font-size="21" fill="#2a2a2a">{t}</text>')
    y+=96
svg.append(f'<text x="60" y="1250" font-size="17" fill="#666">{foot}</text></svg>')
open(out,"w").write("\n".join(svg))
