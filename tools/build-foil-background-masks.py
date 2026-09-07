"""Sample existing bright, coloured foil flecks near the background edges.
Only creates render masks; source illustrations are never modified.
"""
import base64, json, math
from pathlib import Path
from PIL import Image, ImageFilter
root=Path(__file__).resolve().parents[1]/'assets/skins/foils'
path=root/'masks.json'
entries=json.loads(path.read_text())
for key,entry in entries.items():
    w,h=entry['width'],entry['height']
    art=Image.open(root/(key+'.webp')).convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
    blurred=art.filter(ImageFilter.GaussianBlur(1.1))
    original=base64.b64decode(entry['alpha'])
    alpha=bytearray(w*h)
    for y in range(h):
        for x in range(w):
            nx,ny=(x+.5)/w,(y+.5)/h
            # Keep a broad quiet centre, and preserve all per-character face/skin guards.
            radius=math.hypot((nx-.5)/.5,(ny-.6)/.62)
            edge=max(0,min(1,(radius-.76)/.24))
            if not edge or original[y*w+x]: continue
            if any(l<=nx<=r and t<=ny<=b for l,t,r,b in entry.get('protected',[])):continue
            r,g,b=art.getpixel((x,y)); br,bg,bb=blurred.getpixel((x,y))
            light=max(r,g,b); saturation=(light-min(r,g,b))/max(1,light)
            detail=max(0,light-max(br,bg,bb))
            # Existing cyan/purple/gold flecks, rather than flat dark background paint.
            colour=max(0,min(1,(saturation-.18)/.3))
            brightness=max(0,min(1,(light-45)/100))
            grain=max(0,min(1,(detail-1)/14))
            alpha[y*w+x]=round(255*edge*colour*brightness*grain)
    entry['background']=base64.b64encode(alpha).decode()
    print(key, sum(v>0 for v in alpha), 'background foil pixels')
path.write_text(json.dumps(entries,separators=(',',':'))+'\n')
