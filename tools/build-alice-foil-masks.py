"""Build reflection masks only; illustrations remain unchanged."""
from pathlib import Path
import base64,json,math
from PIL import Image,ImageFilter
root=Path(__file__).resolve().parents[1]/'assets/skins/alice-foils-v1'
guards={
'A-alice':[[.28,.12,.76,.54],[.75,.39,.99,.80]],
'2-dodo':[[.13,.08,.98,.50],[0,.60,.32,.86]],
'3-bill':[[.24,.22,.88,.61],[.04,.65,.32,.90]],
'4-hatter':[[.26,.24,.77,.64],[0,.47,.30,.83]],
'5-march-hare':[[.32,.13,.91,.62],[0,.53,.28,.78]],
'6-gryphon':[[.25,.08,.99,.53]],
'7-mock-turtle':[[.13,.07,.95,.53],[.10,.82,.38,1]],
'8-white-rabbit':[[.22,.13,.80,.61],[.58,.62,.98,.91]],
'9-caterpillar':[[.21,.17,.75,.63],[.72,.47,1,.77],[.15,.72,.42,.92]],
'10-cheshire-cat':[[.12,.13,.85,.52]],
'J-knave':[[.23,.08,.78,.57],[.67,.38,1,.69]],
'Q-queen':[[.27,.20,.80,.67],[.03,.68,.32,.96]],
'K-king':[[.19,.21,.72,.62],[.66,.73,1,1]]}
entries={}
for name,protected in guards.items():
 w,h=256,341
 art=Image.open(root/(name+'.png')).convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
 blurred=art.filter(ImageFilter.GaussianBlur(1.1))
 material=bytearray(w*h); background=bytearray(w*h)
 for y in range(h):
  for x in range(w):
   nx,ny=(x+.5)/w,(y+.5)/h
   if any(l<=nx<=r and t<=ny<=b for l,t,r,b in protected):continue
   r,g,b=art.getpixel((x,y)); light=max(r,g,b); sat=(light-min(r,g,b))/max(1,light)
   gold=r>130 and g>90 and b<g*.88
   prism=light>100 and sat>.28 and (g>r*1.15 or b>g*1.18 or (r>g*1.28 and b>g*1.15))
   if not (gold or prism):continue
   strength=min(1,(light-75)/150)*min(1,sat/.55)
   edge=math.hypot((nx-.5)/.5,(ny-.58)/.65)>1.03
   if edge:
    detail=max(0,light-max(blurred.getpixel((x,y))))
    background[y*w+x]=round(255*strength*min(1,max(0,(detail-1)/12)))
   else:material[y*w+x]=round(180*strength)
 entries['alice-'+name]={'width':w,'height':h,'alpha':base64.b64encode(material).decode(),'background':base64.b64encode(background).decode(),'protected':protected}
 print(name,sum(v>0 for v in material),sum(v>0 for v in background))
(root/'masks.json').write_text(json.dumps(entries,separators=(',',':'))+'\n')
