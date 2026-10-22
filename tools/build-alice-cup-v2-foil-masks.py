"""Create reflection masks for the three extra cards; never edit artwork."""
from pathlib import Path
import base64,json,math
from PIL import Image,ImageFilter
root=Path(__file__).resolve().parents[1]/'assets/skins/alice-extra-foils-v2'
names=['teacup-blue-gold','teacup-green-copper']
entries={}
for name in names:
 w,h=256,341
 art=Image.open(root/(name+'.png')).convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
 blurred=art.filter(ImageFilter.GaussianBlur(1.1))
 material=bytearray(w*h);background=bytearray(w*h)
 for y in range(h):
  for x in range(w):
   nx,ny=(x+.5)/w,(y+.5)/h
   r,g,b=art.getpixel((x,y));light=max(r,g,b);sat=(light-min(r,g,b))/max(1,light)
   gold=r>130 and g>90 and b<g*.88
   prism=light>100 and sat>.28 and (g>r*1.15 or b>g*1.18 or (r>g*1.28 and b>g*1.15))
   if not (gold or prism):continue
   strength=min(1,(light-75)/150)*min(1,sat/.55)
   if name=='card-soldier':
    subject=(ny>.51 or ((nx-.57)/.22)**2+((ny-.37)/.25)**2<1 or .07<nx<.25 or ((nx-.57)/.15)**2+((ny-.14)/.16)**2<1)
   else:
    subject=(((nx-.45)/.36)**2+((ny-.48)/.27)**2<1 or ((nx-.50)/.49)**2+((ny-.73)/.19)**2<1 or ((nx-.86)/.13)**2+((ny-.44)/.15)**2<1)
   if subject:material[y*w+x]=round((55 if ny>.72 else 150)*strength)
   else:
    detail=max(0,light-max(blurred.getpixel((x,y))))
    background[y*w+x]=round(255*strength*min(1,max(0,(detail-1)/12)))
 entries['alice-extra-'+name]={'width':w,'height':h,'alpha':base64.b64encode(material).decode(),'background':base64.b64encode(background).decode(),'protected':[]}
 print(name, 'material',sum(v>0 for v in material),'sparkles',sum(v>0 for v in background))
(root/'masks.json').write_text(json.dumps(entries,separators=(',',':'))+'\n')
