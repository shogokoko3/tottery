from pathlib import Path
import subprocess,tempfile,json
import numpy as np
from scipy.io import wavfile
from soft_se_design import radiant
ROOT=Path(__file__).resolve().parent.parent
report=[]
with tempfile.TemporaryDirectory() as temp:
 wav=Path(temp)/'tone.wav'
 for family in [1,2,3]:
  for root in range(12):
   for mode in ['major','minor','open']:
    y=radiant('palette'+str(family),44100,root,mode,family)
    wavfile.write(wav,44100,(y*32767).astype(np.int16))
    file=f'se-bloom-{family}-{root}-{mode}.m4a'
    subprocess.run(['afconvert','-f','m4af','-d','aac','-b','64000',str(wav),str(ROOT/'assets/audio'/file)],check=True,capture_output=True)
    report.append({'file':file,'family':family,'root':root,'mode':mode,'duration':len(y)/44100,'peak':float(max(abs(y)))})
  print('Prepared family',family,flush=True)
(ROOT/'reports/adaptive-music-20261022/tonal-assets.json').write_text(json.dumps(report,indent=2))
