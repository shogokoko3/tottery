let embeddedConfig=null;

const THEMES={
 earth:{formationName:'冥府の追撃',label:'土',area:'土のエリア',symbol:'✧',title:'軌跡の追跡者',formation:'heir-hunt',rgb:'105,232,191',crest:'earth-crest',english:'SPECTRAL TRACKER',flavor:'消えた足跡にも、魂は宿る。',intro:'灯火を辿り、<br>軌跡を刻む。',lead:'鬼火が王から仲間へ巡り、<br>九枚の軌跡をひとつに結ぶ。<br>魂の灯から、追跡者の紋章へ。',step:'鬼火が軌跡を結ぶ',detail:'淡い尾を引き、王から仲間のもとへ。',caption:'九つの灯が、道を示す。',noise:650,bass:82,notes:[392,466.16,587.33,784]},
 sea:{formationName:'怒濤の強襲',label:'海',area:'海のエリア',symbol:'❈',title:'荒波の航海士',formation:'kamikaze',rgb:'101,202,244',crest:'sea-crest',english:'STORM NAVIGATOR',flavor:'荒れ狂う海も、進むべき航路。',intro:'荒波を拓き、<br>航路を刻む。',lead:'九枚を結ぶ金の航路へ、<br>青い波頭が巻き上がる。<br>波の彼方に、帆船の紋章を。',step:'荒波が航路を拓く',detail:'大きな二つの波が、布陣の両側へ開く。',caption:'九枚の覚悟が、荒波を越える。',noise:440,bass:73.4,notes:[440,554.37,659.25,880]},
 forest:{formationName:'翠影の包囲',label:'森',area:'森のエリア',symbol:'❧',title:'静寂な狩人',formation:'elimination',rgb:'153,218,125',crest:'forest-crest',english:'SILENT HUNTER',flavor:'静寂の先に、ただ一つの答え。',intro:'静寂を纏い、<br>真実を射る。',lead:'薄闇に差す、細い一筋の光。<br>九枚を包む葉が左右に開き、<br>狩人の紋章を明るみに。',step:'木々の帳が開く',detail:'葉の間から光がこぼれ、布陣を照らす。',caption:'深い森に、狩人の眼が灯る。',noise:2400,bass:110,notes:[587.33,739.99,880,1174.66]},
 ice:{formationName:'不落の氷城',label:'氷',area:'氷のエリア',symbol:'❄',title:'堅牢な要塞',formation:'fortress',rgb:'155,224,250',crest:'fortress-crest',english:'FROZEN CITADEL',flavor:'幾重の守りに、王は揺るがず。',intro:'守りを築き、<br>その名を刻む。',lead:'9枚の布陣から、氷の要塞へ。<br>氷壁が完成した瞬間に、<br>紋章と称号を授けます。',step:'氷壁が立ち上がる',detail:'王から外周へ。九枚を囲む守りが完成。',caption:'九枚の守りが、ひとつになる。',noise:1700,bass:96,notes:[523.25,659.25,783.99,1046.5]},
 sky:{formationName:'蒼穹の双翼',label:'空',area:'空のエリア',symbol:'✦',title:'双翼の将',formation:'twin-wings',rgb:'198,223,255',crest:'sky-crest',english:'TWIN WING COMMANDER',flavor:'双翼の先に、果てなき空。',intro:'双翼を広げ、<br>空を統べる。',lead:'九枚の風が王のもとに集まり、<br>大きな双翼が雲を切り拓く。<br>風と羽根の向こうに、双翼の紋章を。',step:'双翼が雲を切り拓く',detail:'風を溜め、大きく羽ばたく。雲の向こうに紋章が現れる。',caption:'九枚の意志が、翼になる。',noise:980,bass:130.8,notes:[659.25,830.61,987.77,1318.5]},
 heaven:{formationName:'天光の王陣',label:'天界',area:'宮殿・天界',symbol:'♛',title:'覇道',formation:'royal-road',rgb:'255,224,149',crest:'heaven-crest',english:'CELESTIAL SOVEREIGN',flavor:'光を戴き、王道を征く。',intro:'聖火を灯し、<br>王冠を戴く。',lead:'九枚の光が王へ集まり、<br>天上の光輪へと昇る。<br>幾重の光輪が降り、戴冠の刻を迎える。',step:'九つの光が王へ集う',detail:'聖火・光の軌跡・天上の光輪から、戴冠へ。',caption:'九枚の忠誠に、天の祝福を。',noise:1200,bass:130.8,notes:[523.25,659.25,783.99,1046.5]},
 hell:{formationName:'獄炎の王陣',label:'魔界',area:'宮殿・魔界',symbol:'♜',title:'覇道',formation:'royal-road',rgb:'255,119,68',crest:'hell-crest',english:'INFERNAL SOVEREIGN',flavor:'炎を従え、覇道を征く。',intro:'魔炎を纏い、<br>覇道を征く。',lead:'大きな炎が中央へ集まり、<br>煙の中で炎がほどけ、左右へ流れる。<br>開かれた中央に、覇道の名が現れる。',step:'炎と煙が左右へ流れる',detail:'ひとつの大きな炎から煙が広がり、中央に称号が現れる。',caption:'九枚の力が、王冠を鍛える。',noise:320,bass:55,notes:[261.63,311.13,392,523.25]}
};
let theme=THEMES.ice,themeId='ice',activeWidth=3,activeCells=[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],loadToken=0;
const assetMap={'2':'zombie-male','3':'zombie-female','4':'pirate-male','5':'pirate-female','6':'elf-male','7':'elf-female','8':'viking-male','9':'viking-female','10':'dragon-knight','J':'angel-j','Q':'angel-q','K':'angel-k'};
const effectImages={};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stage=$('#stage'),canvas=$('#effects'),ctx=canvas.getContext('2d'),smokeCanvas=$('#smoke-effects'),smokeCtx=smokeCanvas.getContext('2d');
let cards=[['J','angel-j'],['10','dragon-knight'],['Q','angel-q'],['4','pirate-male'],['2','zombie-male'],['J','angel-j'],['9','viking-female',true],['Q','angel-q'],['10','dragon-knight']];
let order=[6,7,3,8,4,0,5,1,2];
let elements=[];
let now=0,last=0,playing=false,mode='new',mirrored=false,raf=0,duration=6,ctxAudio=null,voices=[],fired=new Set();const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const ease=x=>1-(1-clamp(x))**3;const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const seed=n=>{let x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x)};
function point(el){const b=el.getBoundingClientRect(),s=stage.getBoundingClientRect();return {x:b.x-s.x+b.width/2,y:b.y-s.y+b.height/2,w:b.width,h:b.height}}
let geom=[],cw=0,ch=0,scale=1;
function measure(){const r=stage.getBoundingClientRect();cw=r.width;ch=r.height;scale=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*scale);canvas.height=Math.round(ch*scale);smokeCanvas.width=canvas.width;smokeCanvas.height=canvas.height;const old=$('#formation').style.transform;$('#formation').style.transform='none';geom=elements.map(point);$('#formation').style.transform=old;}
function layoutCards(){elements.forEach((e,i)=>{const [r,c]=activeCells[i];e.style.gridRow=r+1;e.style.gridColumn=mirrored?activeWidth-c:c+1});measure()}
function glow(x,y,r,opacity=1,color='155,224,250'){if(r<=0||opacity<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},${opacity*.65})`);g.addColorStop(.2,`rgba(${color},${opacity*.17})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
function crack(a,b,progress,id,alpha=.5){if(progress<=0)return;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),n=14,pts=[];for(let i=0;i<=n;i++){const q=i/n,j=(seed(id+i)-.5)*7*Math.sin(q*Math.PI);pts.push({x:a.x+dx*q-dy/len*j,y:a.y+dy*q+dx/len*j})}ctx.lineWidth=.75;ctx.strokeStyle=`rgba(185,236,255,${alpha})`;ctx.shadowColor='#98defd';ctx.shadowBlur=4;ctx.beginPath();for(let i=0;i<Math.min(n+1,Math.ceil(progress*(n+1)));i++){const p=pts[i];i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();for(let i=3;i<Math.floor(progress*n);i+=4){const p=pts[i],v=(seed(id+i*3)-.5)*15;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-dy/len*v+dx/len*5,p.y+dx/len*v+dy/len*5);ctx.stroke()}ctx.shadowBlur=0}
function snow(t,a){for(let i=0;i<65;i++){const speed=9+seed(i+70)*16;const x=(seed(i+120)*cw+Math.sin(t*.35+i)*9),y=(seed(i+230)*ch+t*speed)%(ch+20)-10;ctx.fillStyle=`rgba(214,243,255,${a*(.08+seed(i+550)*.28)})`;ctx.beginPath();ctx.ellipse(x,y,.5+seed(i)*1,.7+seed(i)*1.2,.4,0,Math.PI*2);ctx.fill()}}
function motes(t,start,x,y,count=50,force=1){const age=t-start;if(age<0||age>2)return;for(let i=0;i<count;i++){const theta=seed(i+901)*Math.PI*2,v=(18+seed(i+78)*75)*force,lifetime=.5+seed(i+33)*1.2,life=clamp(1-age/lifetime);if(life<=0)continue;const px=x+Math.cos(theta)*v*age,py=y+Math.sin(theta)*v*age+age*age*14;ctx.save();ctx.translate(px,py);ctx.rotate(theta+age*.7);ctx.fillStyle=`rgba(191,230,247,${life*.65})`;ctx.fillRect(-.8,-2,.8+seed(i)*1.4,3+seed(i+30)*2);ctx.restore()}}
function star(x,y,a,s=6){ctx.globalAlpha=a;ctx.strokeStyle='#f0faff';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x-s,y);ctx.lineTo(x+s,y);ctx.moveTo(x,y-s);ctx.lineTo(x,y+s);ctx.stroke();ctx.globalAlpha=1;glow(x,y,s*2,a*.6)}
function drawIce(t,formationA){ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,cw,ch);if(reduced.matches)return;ctx.save();snow(t,t<4?1:.5);if(formationA>.01){ctx.globalAlpha=formationA;for(let n=0;n<9;n++){const id=order[n],p=geom[id],q=clamp((t-(.35+n*.065))/.42);if(!p)continue;const alpha=Math.sin(q*Math.PI)*.9;glow(p.x,p.y,p.w*.9,alpha);if(n){crack(geom[order[n-1]],p,q,60+n,.45*formationA)}for(let k=0;k<3;k++){const side=k%2?1:-1;const from={x:p.x+side*p.w*.48,y:p.y+p.h*(.3-k*.3)},to={x:p.x+side*p.w*.18,y:from.y-p.h*.14};crack(from,to,q,120+id*8+k,.3*formationA)}}
const king=geom[cards.findIndex(c=>c[2])];if(king)glow(king.x,king.y,king.w*1.05,clamp((t-.4)/.4)*clamp((2.5-t)/.4)*.5,'232,204,148');
for(let k=0;k<4;k++){const start=.95+k*.28,q=t-start;if(q>0&&q<1.2){const f=point($('#formation')),sx=f.x+(k===0||k===1?-1:1)*f.w*.36,sy=f.y+(k===0||k===3?1:-1)*f.h*.35;glow(sx,sy,cw*.15,Math.sin(clamp(q/.9)*Math.PI)*.75);motes(t,start+.18,sx,sy,16,.45)}}ctx.globalAlpha=1}
const hit=clamp((t-2.25)/.55);if(hit>0&&hit<1){const r=cw*(.14+ease(hit)*.45);ctx.beginPath();ctx.ellipse(cw*.5,ch*.45,r,r*.55,0,0,Math.PI*2);ctx.strokeStyle=`rgba(178,230,249,${(1-hit)*.5})`;ctx.lineWidth=1.5;ctx.stroke()}
if(t>2.7){motes(t,2.85,cw*.5,ch*.4,70,1.5);const gate=clamp((t-2.8)/.6);glow(cw*.5,ch*.4,cw*.43,Math.max(0,1-(t-2.8)/2.2)*gate*.5);if(t>3.8&&t<4.7){const a=Math.sin((t-3.8)/.9*Math.PI);star(cw*.505,ch*.157,a,7);star(cw*.245,ch*.455,a*.7,5);star(cw*.7,ch*.43,a*.7,5)}}ctx.restore()}
function isPalace(){return themeId==='heaven'||themeId==='hell'}
function timing(){if(mode==='new'&&themeId==='sky')return{fade:2.65,crest:3.05,text:4.1,glint:4.2,finish:5.7};return mode==='new'&&isPalace()?{fade:2.9,crest:themeId==='hell'?4.2:3.55,text:themeId==='hell'?4.5:4.5,glint:themeId==='hell'?4.85:4.6,finish:6.1}: {fade:2.65,crest:2.75,text:3.65,glint:3.7,finish:4.8}}
function render(){const t=mode==='owned'?now*2.8:now,tm=timing(),palace=mode==='new'&&isPalace();const fade=mode==='owned'?1:smooth((t-tm.fade)/.75),awardA=mode==='owned'?smooth((t-.2)/.9):smooth((t-tm.crest)/(themeId==='heaven'?.30:.75));stage.style.setProperty('--formation-alpha',1-fade);stage.style.setProperty('--award-alpha',awardA);$('#formation').style.transform=`translateY(${-fade*20}px) scale(${1-fade*.06})`;
elements.forEach((e,i)=>{const rank=order.indexOf(i),reveal=ease((t-(.15+rank*.065))/.35),frost=clamp((t-(.35+rank*.065))/.6);e.style.opacity=reveal;e.style.transform=`translateY(${(1-reveal)*7}px)`;e.querySelector('.frost').style.opacity=frost*.8;e.querySelector('.shine').style.opacity=Math.sin(clamp((t-(.3+rank*.065))/.48)*Math.PI)*.65});
$$('.wall-part').forEach((e,k)=>{const q=ease((t-(.95+k*.28))/.75);e.style.opacity=q;e.style.transform=`translateY(${(1-q)*17}px)`;e.style.filter=`brightness(${1+(1-q)*.45}) drop-shadow(0 4px 7px #0008)`});
$('.formation-caption').style.opacity=(1-fade)*smooth((t-.55)/.55);$('.ice-wash').style.opacity=mode==='owned'?0:Math.sin(clamp((t-(palace?3.4:2.3))/(palace?.65:.8))*Math.PI)*(palace&&themeId==='heaven'?.64:.45);
const crestP=ease((t-(mode==='owned'?.2:tm.crest))/.9);$('.crest').style.transform=`translateY(${(1-crestP)*14}px) scale(${.95+crestP*.05})`;
const textP=smooth((t-(mode==='owned'?.7:tm.text))/.6);$('.award-copy').style.opacity=textP;$('.award-copy').style.transform=`translateY(${(1-textP)*8}px)`;const glint=clamp((t-tm.glint)/1.1);$('.crest-glint').style.opacity=Math.sin(glint*Math.PI)*.7;$('.crest-glint').style.backgroundPosition=`${(1-glint)*100}% 0`;
const done=now>=duration-.02;$('#finish').disabled=!done;$('#finish').style.opacity=smooth((t-(mode==='owned'?3:tm.finish))/.4);$('#seek').value=now;$('#time').textContent=`${now.toFixed(1)} / ${duration.toFixed(1)}`;$('#play-pause').textContent=playing?'Ⅱ':'▶';$('#play-pause').setAttribute('aria-label',playing?'一時停止':'再生');$$('.steps li').forEach((el,i)=>el.classList.toggle('active',i===(mode==='owned'||t>=tm.crest?2:t>=.95?1:0)));stage.dataset.phase=done?'complete':t>=tm.crest?'award':t>=.95?'ice':'forming';palaceAppearance(t,palace);skyAppearance(t);draw(t,1-fade);drawHellSmoke(t);drawSkyCloud(t);}
function stopSounds(){voices.forEach(v=>{try{v.stop()}catch{}});voices=[]}
function audioReady(){if(!$('#sound').checked)return false;try{ctxAudio??=new (window.AudioContext||window.webkitAudioContext)();ctxAudio.resume().catch(()=>{});return true}catch{return false}}
function tone(freq,time,length,gain,type='sine'){const o=ctxAudio.createOscillator(),g=ctxAudio.createGain();o.type=type;o.frequency.setValueAtTime(freq,time);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0001,gain*(embeddedConfig?.volume??1)),time+.02);g.gain.exponentialRampToValueAtTime(.0001,time+length);o.connect(g).connect(ctxAudio.destination);o.start(time);o.stop(time+length+.02);voices.push(o)}
function soundCue(id){if(!$('#sound').checked||!ctxAudio||ctxAudio.state!=='running')return;const t=ctxAudio.currentTime;if(id==='gust'){skyGust(t);}else if(id==='gather'){[0,1,2,3,4].forEach(i=>tone(theme.notes[i%4]/2,t+i*.14,.55,.016));tone(theme.bass/2,t,1.3,.035);}else if(id==='coronation'){if(themeId==='heaven')coronationAccent(t);tone(themeId==='hell'?43.65:65.4,t,1.5,.09);theme.notes.forEach((f,i)=>{tone(f,t+i*.04,2,.028);tone(f*2.001,t+i*.04,1.2,.009)});for(let i=0;i<3;i++)tone(theme.notes[3]*(1+i*.5),t+.22+i*.18,1.5,.012);}else if(id==='ice'){const n=ctxAudio.createBufferSource(),buffer=ctxAudio.createBuffer(1,ctxAudio.sampleRate*.6,ctxAudio.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length*.18));n.buffer=buffer;const f=ctxAudio.createBiquadFilter(),g=ctxAudio.createGain();f.type='bandpass';f.frequency.value=theme.noise;f.Q.value=.65;g.gain.value=.12*(embeddedConfig?.volume??1);n.connect(f).connect(g).connect(ctxAudio.destination);n.start();voices.push(n);tone(theme.bass,t,.65,.035)}else if(id==='seal'){tone(65.4,t,1.1,.09);tone(130.8,t,1.2,.035);theme.notes.forEach((f,i)=>{tone(f,t+i*.09,1.5,.035);tone(f*2.01,t+i*.09,.65,.009)})}else{tone(660,t,.32,.028);tone(990,t+.1,.5,.021)}}
function tick(stamp){if(!playing)return;if(last)now=Math.min(duration,now+(stamp-last)/1000);last=stamp;const t=mode==='owned'?now*2.8:now;for(const [id,at] of (mode==='new'&&isPalace()?[['ice',.85],['gather',1.65],['coronation',themeId==='hell'?4.1:3.6]]:mode==='new'&&themeId==='sky'?[['ice',.8],['gust',2.82],['seal',3.15]]:[['ice',1],['seal',2.78]]))if(t>=at&&!fired.has(id)){fired.add(id);soundCue(mode==='owned'?'short':id)}render();if(now<duration)raf=requestAnimationFrame(tick);else{playing=false;render();parent.postMessage({type:'tottery-honor-complete'},location.origin);$('#status').textContent=mode==='new'?`称号「${theme.title}」を獲得。もう一度再生して比較できます。`:'獲得済みは短い授与表示に切り替わります。'}}
function play(){if(stage.classList.contains('loading'))return;cancelAnimationFrame(raf);stopSounds();fired.clear();now=0;last=0;duration=mode==='new'?(isPalace()?7.2:themeId==='sky'?6.8:6):1.8;$('#seek').max=duration;$('#award-label').textContent=mode==='new'?'称号獲得':'陣形成立';$('#award-help').textContent=mode==='new'?'紋章アイコンも獲得しました。':'紋章アイコンは設定から選べます。';$('#status').textContent=mode==='new'?'初獲得の演出を再生中':'獲得済みの短い演出を再生中';audioReady();measure();if(reduced.matches){now=duration;playing=false;render();parent.postMessage({type:'tottery-honor-complete'},location.origin);$('#status').textContent='動きを抑えた表示にしています。';return}playing=true;render();raf=requestAnimationFrame(tick)}
$('#replay').onclick=play;$('#play-pause').onclick=()=>{if(now>=duration){play();return}playing=!playing;last=0;audioReady();if(playing)raf=requestAnimationFrame(tick);else{cancelAnimationFrame(raf);stopSounds()}render()};$('#seek').oninput=e=>{cancelAnimationFrame(raf);playing=false;stopSounds();now=+e.target.value;render();$('#status').textContent='再生位置を確認中。▶でここから再生できます。'};
$$('[data-mode]').forEach(e=>e.onclick=()=>{mode=e.dataset.mode;$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b===e));play()});$('#mirror').onchange=()=>{mirrored=$('#mirror').checked;layoutCards();play()};$('#sound').onchange=()=>{if($('#sound').checked){audioReady();play()}else stopSounds()};$('#finish').onclick=()=>{stopSounds();parent.postMessage({type:'tottery-honor-close'},location.origin);};$('#expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();measure();render()}catch{$('#status').textContent='このブラウザーでは全画面表示を利用できません。'}};
$$('.steps li').forEach((e,i)=>{e.setAttribute('role','button');e.tabIndex=0;e.setAttribute('aria-label',['布陣の成立を確認','エリア演出の完成を確認','称号の授与を確認'][i]);const jump=()=>{if(stage.classList.contains('loading'))return;cancelAnimationFrame(raf);stopSounds();playing=false;now=mode==='owned'?duration:(isPalace()?[.85,themeId==='hell'?3.42:2.45,5.4]:themeId==='sky'?[.85,2.85,4.9]:[.85,2.38,4.55])[i];render();$('#status').textContent='演出の場面を確認中。▶で続きを再生できます。'};e.onclick=jump;e.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();jump()}}});
new ResizeObserver(()=>{measure();render()}).observe(stage);let resumeOnVisible=false;document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){resumeOnVisible=true;playing=false;cancelAnimationFrame(raf);stopSounds();render()}else if(!document.hidden&&resumeOnVisible){resumeOnVisible=false;playing=true;last=0;raf=requestAnimationFrame(tick)}});

function sprite(im,x,y,w,h,a=1,rot=0,flip=false){if(!im?.complete||!im.naturalWidth||a<=0)return;ctx.save();ctx.globalAlpha*=clamp(a);ctx.translate(x,y);ctx.rotate(rot);ctx.scale(flip?-1:1,1);ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore()}
function ribbon(points,q,a,color=theme.rgb){if(!points.length)return;ctx.save();ctx.strokeStyle=`rgba(${color},${a})`;ctx.lineWidth=1.3;ctx.shadowBlur=7;ctx.shadowColor=`rgb(${theme.rgb})`;ctx.beginPath();points.forEach((p,i)=>{if(i<=q*(points.length-1)){i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}});ctx.stroke();ctx.restore()}
function draw(t,fa){if(themeId==='sky'&&mode==='new'){drawSky(t,fa);return}if(isPalace()&&mode==='new'){drawPalace(t,fa);return}if(themeId==='ice'){drawIce(t,fa);return}ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,cw,ch);if(reduced.matches)return;const color=theme.rgb,im=effectImages[themeId],u=clamp((t-.65)/1.9),envelope=smooth((t-.7)/.45)*(1-smooth((t-2.6)/.65));
const left=Math.min(...geom.map(p=>p.x-p.w/2)),right=Math.max(...geom.map(p=>p.x+p.w/2)),top=Math.min(...geom.map(p=>p.y-p.h/2)),bottom=Math.max(...geom.map(p=>p.y+p.h/2));const mx=(left+right)/2,my=(top+bottom)/2;
for(let i=0;i<34;i++){const x=seed(i+220)*cw,y=(seed(i+41)*ch-t*(3+seed(i)*7)+ch*3)%ch,a=(.10+seed(i+21)*.18)*Math.sin(clamp(t/5)*Math.PI);ctx.fillStyle=`rgba(${color},${a})`;ctx.beginPath();ctx.arc(x,y,.5+seed(i+810),0,Math.PI*2);ctx.fill()}
ctx.save();ctx.globalAlpha=fa;
for(let n=0;n<order.length;n++){const p=geom[order[n]];glow(p.x,p.y,p.w*.95,Math.sin(clamp((t-.3-n*.065)/.6)*Math.PI)*.75,color)}
if(themeId==='earth'){
const route=order.map(i=>geom[i]);ribbon(route,u,.16*envelope);
for(let k=0;k<3;k++){const travel=clamp((t-.6-k*.13)/1.8)*8,idx=Math.min(7,Math.floor(travel)),f=smooth(travel-idx),a=route[idx],b=route[idx+1];const x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;glow(x,y,cw*.17,envelope*.85,color);sprite(im,x,y-cw*.015,cw*.16,cw*.20,envelope,.15*Math.sin(t*2+k));for(let j=1;j<7;j++){let d=Math.max(0,travel-j*.12),ii=Math.min(7,Math.floor(d)),ff=d-ii;glow(route[ii].x+(route[ii+1].x-route[ii].x)*ff,route[ii].y+(route[ii+1].y-route[ii].y)*ff,cw*.025,envelope*(1-j/7)*.8,color)}}
}else if(themeId==='sea'){
ribbon(order.map(i=>geom[i]),u,.4*envelope,'228,195,118');let open=ease((t-1.8)/.9);for(let side of [-1,1]){const x=mx+side*cw*(.20+.12*open),y=bottom-cw*.08-Math.sin(u*Math.PI)*cw*.08;glow(x,y,cw*.27,envelope*.55,color);sprite(im,x,y,cw*.5,cw*.35,envelope*.98,side*(-.22+.3*u),side>0)}
}else if(themeId==='forest'){
const open=ease((t-1.65)/1.1);for(let side of [-1,1]){sprite(im,mx+side*cw*(.22+.08*open),my,cw*.26,cw*.49,envelope,side*(.12+.18*open),side>0)}
for(let k=0;k<3;k++){const p=geom[order[[0,4,8][k]]],a=envelope*(.15+.18*Math.sin(u*Math.PI));ctx.save();const g=ctx.createLinearGradient(p.x-cw*.12,top-cw*.2,p.x,p.y);g.addColorStop(0,`rgba(244,245,175,0)`);g.addColorStop(.7,`rgba(244,245,175,${a})`);g.addColorStop(1,'rgba(244,245,175,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(p.x-cw*.21,top-cw*.23);ctx.lineTo(p.x-cw*.17,top-cw*.23);ctx.lineTo(p.x+cw*.075,p.y+cw*.07);ctx.lineTo(p.x-cw*.025,p.y+cw*.07);ctx.fill();ctx.restore();glow(p.x,p.y,p.w*1.1,envelope*.5,color)}
}else if(themeId==='sky'){
const open=ease((t-.8)/1.4);for(let side of [-1,1])sprite(im,mx+side*cw*(.1+.18*open),my-cw*.015,cw*(.24+.12*open),cw*.42,envelope,side*(.4-.4*open),side>0);
for(let k=0;k<12;k++){let v=clamp((t-1.3-seed(k)*.7)/1.6);ctx.save();ctx.translate(mx+(seed(k+12)-.5)*cw*.65,my+cw*.2-v*cw*.45);ctx.rotate((seed(k+32)-.5)*1.6);ctx.fillStyle=`rgba(238,247,255,${envelope*Math.sin(v*Math.PI)*.55})`;ctx.beginPath();ctx.ellipse(0,0,1.2,5+seed(k)*3,0,0,Math.PI*2);ctx.fill();ctx.restore()}
}else if(themeId==='heaven'){
for(let side of [-1,1]){sprite(im,mx+side*cw*.39,my+cw*.02,cw*.13,cw*.48,envelope);glow(mx+side*cw*.39,my-cw*.15,cw*.22,envelope*.8,color)}
for(let n=0;n<9;n++){const p=geom[order[n]],a=envelope*smooth((t-.85-n*.045)/.55);const g=ctx.createLinearGradient(p.x,top-cw*.25,p.x,p.y+p.h*.5);g.addColorStop(0,`rgba(${color},0)`);g.addColorStop(.8,`rgba(${color},${a*.21})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.fillRect(p.x-p.w*.37,top-cw*.25,p.w*.74,p.y+p.h*.5-top+cw*.25);glow(p.x,p.y,p.w*.85,a*.65,color)}
}else if(themeId==='hell'){
const king=geom[cards.findIndex(c=>c[2])],gather=smooth((t-2.05)/.7);for(let k=0;k<3;k++){const startX=mx+(k-1)*cw*.29,x=startX+(king.x-startX)*gather,height=cw*(k===1?.33:.48),rise=ease((t-.75-k*.15)/.8),y=bottom-height*.26+cw*.11*(1-rise)+(king.y-(bottom-height*.26))*gather;sprite(im,x,y,cw*(k===1?.19:.27)*(1-.38*gather),height*rise*(1-.18*gather),envelope*(k===1?.58:.9),(.015*Math.sin(t*4+k)),k===2);glow(x,y,cw*.16,envelope*.6,color)}
for(let k=0;k<28;k++){let v=clamp((t-.8-seed(k)*.6)/1.8);ctx.fillStyle=`rgba(255,181,91,${envelope*Math.sin(v*Math.PI)*.8})`;ctx.fillRect(mx+(seed(k+82)-.5)*cw*.68,bottom-v*cw*.45,1.2,2.6)}
}ctx.restore();
const seal=smooth((t-2.5)/.45)*(1-smooth((t-3.25)/.9));glow(cw*.5,ch*.38,cw*.43,seal*.9,color);
if(t>2.7){for(let k=0;k<48;k++){const v=clamp((t-2.75)/1.7),theta=seed(k+701)*Math.PI*2,r=cw*(.08+v*(.14+seed(k)*.25));ctx.fillStyle=`rgba(${color},${(1-v)*.6})`;ctx.beginPath();ctx.arc(cw*.5+Math.cos(theta)*r,ch*.38+Math.sin(theta)*r*.85,.7+seed(k)*1.2,0,Math.PI*2);ctx.fill()}}
if(t>3.8&&t<4.7){const a=Math.sin((t-3.8)/.9*Math.PI);star(cw*.5,ch*.19,a,7);star(cw*.27,ch*.39,a*.7,5);star(cw*.72,ch*.44,a*.7,5)}
}
function coronationAccent(time){
 const buffer=ctxAudio.createBuffer(1,Math.floor(ctxAudio.sampleRate*.55),ctxAudio.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(data.length*.17));
 const source=ctxAudio.createBufferSource(),filter=ctxAudio.createBiquadFilter(),gain=ctxAudio.createGain();
 source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(2100,time);filter.frequency.exponentialRampToValueAtTime(240,time+.5);gain.gain.value=.095*(embeddedConfig?.volume??1);
 source.connect(filter).connect(gain).connect(ctxAudio.destination);source.start(time);source.stop(time+.55);voices.push(source);
 tone(98,time,.85,.047);tone(1568,time+.03,.75,.014);
}
function heavenImpact(t,x,y,crown){
 // A single coronation burst; the backdrop stays still.
 const buildup=smooth((t-3.12)/.25)*(1-smooth((t-3.52)/.08));
 glow(crown.x,crown.y,cw*.10,buildup*.95,'255,243,204');
 const age=t-3.55;if(age<0||age>1.65)return;
 const opening=ease(age/.52),fade=1-smooth((age-.28)/1.12),strength=smooth(age/.075)*fade;
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<18;i++){
  const angle=i*Math.PI/9-.11,inner=cw*.13,outer=cw*(.39+(i%3===0?.15:.055))*opening,half=i%3===0?.024:.012;
  if(outer<=inner)continue;
  const g=ctx.createRadialGradient(x,y,inner,x,y,outer);g.addColorStop(0,`rgba(255,235,178,${strength*.52})`);g.addColorStop(.5,`rgba(255,219,135,${strength*.24})`);g.addColorStop(1,'rgba(255,218,128,0)');ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*inner,y+Math.sin(angle)*inner);
  ctx.lineTo(x+Math.cos(angle-half)*outer,y+Math.sin(angle-half)*outer);
  ctx.lineTo(x+Math.cos(angle+half)*outer,y+Math.sin(angle+half)*outer);ctx.closePath();ctx.fill();
 }
 for(let k=0;k<2;k++){
  const q=clamp((age-k*.09)/.72);if(q<=0||q>=1)continue;
  const radius=cw*(.13+.42*ease(q));ctx.beginPath();ctx.ellipse(x,y,radius,radius*.80,0,0,Math.PI*2);ctx.strokeStyle=`rgba(255,239,195,${(1-q)*.85})`;ctx.shadowColor='#ffe4a6';ctx.shadowBlur=10;ctx.lineWidth=k===0?2.2:1.0;ctx.stroke();
 }
 ctx.restore();
 star(crown.x,crown.y,strength*.85,17*(1-age/1.65));
}

function palaceAppearance(t,enabled){
 const crest=$('.crest'),field=$('.field');
 if(!enabled){crest.style.filter='';crest.style.clipPath='';crest.style.maskImage='';crest.style.webkitMaskImage='';field.style.opacity='';return}
 const tm=timing(),reveal=ease((t-tm.crest)/(themeId==='heaven'?.40:.8)),charge=smooth((t-1.3)/.65)*(1-smooth((t-3.75)/.75));
 field.style.opacity=1-charge*(themeId==='heaven'?.64:.40);
 if(themeId==='heaven'){
  const settle=ease((t-tm.crest)/.78);crest.style.transform=`translateY(${(1-settle)*5}px) scale(${1.10-settle*.10})`;
  crest.style.clipPath='';crest.style.maskImage=crest.style.webkitMaskImage=`linear-gradient(to bottom,#000 ${Math.max(0,reveal*120-20)}%,transparent ${reveal*120}%)`;
  crest.style.filter=`brightness(${1+(1-reveal)*2.2}) drop-shadow(0 0 ${4+(1-reveal)*26}px rgba(255,224,150,${.20+(1-reveal)*.65}))`;
 }else{
  crest.style.clipPath='';crest.style.maskImage=crest.style.webkitMaskImage=`linear-gradient(to top,#000 ${Math.max(0,reveal*120-20)}%,transparent ${reveal*120}%)`;
  crest.style.filter=`brightness(${.55+reveal*.45}) sepia(${(1-reveal)*.8}) drop-shadow(0 0 ${5+(1-reveal)*18}px rgba(255,80,25,${.22+(1-reveal)*.55}))`;
 }
}
function ceremonialRing(x,y,r,flat,a,rotation=0,infernal=false){
 if(a<=0||r<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(1,flat);ctx.rotate(rotation);ctx.globalAlpha*=a;
 ctx.strokeStyle=infernal?'#df7638':'#f6d594';ctx.shadowColor=infernal?'#fd591d':'#ffe5ac';ctx.shadowBlur=8;ctx.lineWidth=.85;
 for(const factor of [1,.88]){ctx.beginPath();ctx.arc(0,0,r*factor,0,Math.PI*2);ctx.stroke()}
 ctx.shadowBlur=0;
 for(let i=0;i<24;i++){const theta=i*Math.PI/12,inner=i%3===0?.79:.92;ctx.beginPath();ctx.moveTo(Math.cos(theta)*r*inner,Math.sin(theta)*r*inner);ctx.lineTo(Math.cos(theta)*r*.99,Math.sin(theta)*r*.99);ctx.stroke()}
 for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);ctx.translate(r*.68,0);ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(0,-5);ctx.lineTo(3,0);ctx.lineTo(0,5);ctx.closePath();ctx.stroke();ctx.restore()}
 ctx.restore();
}
function curvedLight(a,b,q,alpha,bend,color){
 const cx=(a.x+b.x)/2+bend,cy=Math.min(a.y,b.y)-Math.abs(bend)*.55,at=u=>({x:(1-u)**2*a.x+2*(1-u)*u*cx+u*u*b.x,y:(1-u)**2*a.y+2*(1-u)*u*cy+u*u*b.y});
 ctx.save();ctx.strokeStyle=`rgba(${color},${alpha*.6})`;ctx.lineWidth=1.05;ctx.shadowColor=`rgb(${color})`;ctx.shadowBlur=7;ctx.beginPath();
 const start=Math.max(0,q-.42);for(let j=0;j<=24;j++){const p=at(start+(q-start)*j/24);j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();ctx.restore();const tip=at(q);glow(tip.x,tip.y,cw*.034,alpha,color);
}
function velvetBeam(x,y,span,height,a,color){
 if(a<=0)return;ctx.save();const g=ctx.createLinearGradient(x-span,y,x+span,y);g.addColorStop(0,`rgba(${color},0)`);g.addColorStop(.4,`rgba(${color},${a*.16})`);g.addColorStop(.5,`rgba(${color},${a*.48})`);g.addColorStop(.6,`rgba(${color},${a*.16})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;
 ctx.beginPath();ctx.moveTo(x-span*.3,y-height);ctx.lineTo(x+span*.3,y-height);ctx.lineTo(x+span,y);ctx.quadraticCurveTo(x,y+span*.22,x-span,y);ctx.closePath();ctx.fill();ctx.restore();
}
function drawPalace(t,fa){
 ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,cw,ch);if(reduced.matches||geom.length!==9)return;
 const heaven=themeId==='heaven',color=theme.rgb,king=geom[cards.findIndex(c=>c[2])],cx=cw*.5,cy=ch*.365;
 const lit=smooth((t-.65)/.6),gather=smooth((t-1.5)/1.2),lift=smooth((t-2.75)/.75),pre=lit*(1-smooth((t-3.4)/.45)),hit=smooth((t-3.55)/.16)*(1-smooth((t-3.8)/.85));
 const core={x:king.x+(cx-king.x)*lift,y:king.y+(cy-king.y)*lift};
 // The nine cards charge the actual king before the energy rises to the crest.
 for(let n=0;n<9;n++){
  const p=geom[order[n]],q=clamp((t-1.0-n*.065)/1.6),a=pre*Math.sin(q*Math.PI);
  glow(p.x,p.y,p.w*.85,fa*.6*lit,color);
  if(n>0&&q>0&&q<1)curvedLight(p,king,ease(q),a,(n%2?1:-1)*cw*(.035+.035*seed(n)),color);
 }
 if(heaven){
  const im=effectImages.heaven;
  for(const side of [-1,1]){const bx=cx+side*cw*.39,by=ch*.49;sprite(im,bx,by,cw*.115,cw*.42,pre*.9);glow(bx,by-cw*.17,cw*.19,pre*.8,color);if(t>1.25&&t<2.8)curvedLight({x:bx,y:by-cw*.16},king,ease((t-1.25)/1.55),pre*.7,-side*cw*.12,color)}
  ceremonialRing(king.x,king.y+king.h*.25,cw*(.11+.035*gather),.35,pre*.8,t*.1);
  const haloY=ch*.24+(cy-ch*.24)*lift;
  ceremonialRing(cx,haloY,cw*(.22-.045*lift),.30,pre*.9,-t*.085);
  velvetBeam(core.x,core.y,cw*(.10+.10*gather),ch*.31,pre*(.30+.5*gather),color);
  // Descending coronation rings and golden filaments distinguish heaven from sky.
  glow(core.x,core.y,cw*(.16+.15*gather),pre*(.7+.25*gather),color);
  const crown={x:cx,y:ch*.205};
  for(let k=0;k<3;k++){
   const age=t-3.12-k*.14,q=ease(age/.90),alpha=smooth(age/.25)*(1-smooth((age-.82)/.6));
   const y=ch*.115+(crown.y-ch*.115)*q-k*cw*.022,radius=cw*(.255-.085*q-k*.023);
   ceremonialRing(cx,y,radius,.27,alpha*(.70-k*.10),(-1)**k*t*.075);
   glow(cx,y,cw*.20,alpha*.22,color);
  }
  for(let k=0;k<12;k++){
   const age=t-3.3-k*.025,q=clamp(age/.95),angle=k*Math.PI*2/12;
   const from={x:cx+Math.cos(angle)*cw*.32,y:cy+Math.sin(angle)*cw*.22};
   const alpha=Math.sin(q*Math.PI)*.90;
   if(alpha>0)curvedLight(from,crown,ease(q),alpha,(k%2?1:-1)*cw*.05,color);
  }
  velvetBeam(cx,cy+cw*.20,cw*.36,ch*.6,hit*1.15,color);
  glow(crown.x,crown.y,cw*.21,hit*1.10,color);
  heavenImpact(t,cx,cy,crown);
  for(let i=0;i<24;i++){
   const age=t-3.85-seed(i)*.45;if(age<0||age>1.8)continue;
   const life=Math.sin(clamp(age/1.8)*Math.PI),x=cx+(seed(i+20)-.5)*cw*.69,y=cy-cw*.04+age*cw*.09;
   ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle=`rgba(255,225,156,${life*.55})`;
   const size=.8+seed(i+32)*1.1;ctx.fillRect(-size,-size,size*2,size*2);ctx.restore();
  }
 }else{
  const seal=smooth((t-.7)/.7)*(1-smooth((t-3.1)/.55)),shrink=smooth((t-1.85)/1.35);
  const rx=cx+(king.x-cx)*shrink,ry=ch*.56+(king.y-ch*.56)*shrink,radius=cw*(.35-.255*shrink);
  ceremonialRing(rx,ry,radius,.32,seal*.95,-t*.15,true);
  // Flame curtains are behind the formation's edges and contract into the king.
  for(let k=0;k<7;k++){
   const angle=k*Math.PI*2/7+.2,x=rx+Math.cos(angle)*radius,y=ry+Math.sin(angle)*radius*.32;
   const rise=ease((t-.8-k*.055)/.55),height=cw*(.16+.07*seed(k+90))*(1-shrink*.38);
   sprite(effectImages.hell,x,y-height*.43,cw*(.085+.035*seed(k+9))*(1-shrink*.2),height*rise,seal*(.6+.2*seed(k)),0,k%2===0);
  }
  // A living flame exhales smoke; complete flame tongues curl out of it.
  const arrival=smooth((t-2.25)/1.02),flameX=king.x+(cx-king.x)*arrival,flameY=king.y+(ch*.44-king.y)*arrival;
  const born=smooth((t-2.10)/.55),opening=smooth((t-3.55)/1.45),ending=1-smooth((t-5.20)/1.05);
  const core=born*(1-smooth((t-3.65)/.85));
  livingFlame(effectImages.hell,flameX,flameY,cw*(.20+.21*arrival),cw*(.38+.30*arrival),core,t,0);
  glow(flameX,flameY,cw*.22,core*.43,color);
  for(const side of [-1,1]){
   const drift=opening*cw*.27;
   const strength=smooth((t-3.65)/.7)*ending;
   const px=cx+side*drift,py=ch*.45-opening*cw*.065;
   livingFlame(effectImages.hell,px,py,cw*(.25-.085*opening),cw*(.57-.13*opening),strength*.86,t+side*.31,side*opening);
   glow(px,py+cw*.09,cw*.14,strength*.23,color);
  }
  // Small, buoyant embers follow the same outward and upward air flow.
  for(let i=0;i<32;i++){
   const age=t-3.50-seed(i)*.75;if(age<0||age>1.8)continue;
   const side=i%2?1:-1,life=Math.sin(clamp(age/1.8)*Math.PI),q=smooth(age/1.65);
   const x=cx+side*cw*(.025+q*(.22+seed(i+28)*.05)),y=ch*.48-age*cw*(.10+seed(i+72)*.10);
   ctx.fillStyle=`rgba(255,${Math.round(135+70*life)},75,${life*.6})`;ctx.beginPath();ctx.ellipse(x,y,.6,1.5,side*.3,0,Math.PI*2);ctx.fill();
  }
 }
 glow(cx,cy,cw*.43,hit*.75,color);
 const settle=smooth((t-(heaven?3.8:4.25))/.75)*(1-smooth((t-5.75)/1));ceremonialRing(cx,cy,cw*.345,1,settle*(heaven?.24:.17),heaven?t*.035:-t*.035,!heaven);
 if(t>4.5&&t<5.65){const a=Math.sin((t-4.5)/1.15*Math.PI);star(cx,ch*.18,a*.9,7);star(cx-cw*.23,cy+cw*.14,a*.6,4)}
}

function livingFlame(im,x,y,w,h,alpha,t,bend){
 if(!im?.complete||!im.naturalWidth||alpha<=0)return;
 ctx.save();ctx.globalAlpha=clamp(alpha);
 // Continuous scanlines deform the intact flame, with a stable base and rising tips.
 const rows=96,pixels=Math.round(h*scale),top=Math.round((y-h/2)*scale)/scale;
 for(let row=0;row<rows;row++){
  const v=row/rows,tip=(1-v)**1.5;
  const sway=Math.sin(t*5.1-v*8.5)*w*.018+Math.sin(t*7.2-v*13)*w*.009;
  const dx=tip*(sway+bend*w*.29*Math.sin((1-v)*1.9));
  const width=w*(1+tip*.035*Math.sin(t*4.8-v*7));
  const p0=Math.round(row*pixels/rows),p1=Math.round((row+1)*pixels/rows);
  ctx.drawImage(im,0,p0/pixels*im.naturalHeight,im.naturalWidth,(p1-p0)/pixels*im.naturalHeight,x-width/2+dx,top+p0/scale,width,(p1-p0)/scale);
 }
 ctx.restore();
}

let smokeStamp=null;
function makeSmokeStamp(){
 const stamp=document.createElement('canvas');stamp.width=256;stamp.height=256;const c=stamp.getContext('2d');
 // Overlapping soft volumes make a cloud with an irregular, feathered contour.
 for(let layer=0;layer<2;layer++)for(let i=0;i<15;i++){
  const theta=seed(i+layer*80+31)*Math.PI*2,dist=seed(i+51)*57,x=128+Math.cos(theta)*dist,y=132+Math.sin(theta)*dist,r=35+seed(i+81)*43;
  const g=c.createRadialGradient(x-r*.16,y-r*.22,1,x,y,r);
  if(layer===0){g.addColorStop(0,'rgba(14,10,22,.46)');g.addColorStop(.55,'rgba(24,18,32,.30)');g.addColorStop(1,'rgba(22,15,30,0)');}
  else{g.addColorStop(0,'rgba(105,100,110,.16)');g.addColorStop(.43,'rgba(69,61,77,.13)');g.addColorStop(1,'rgba(44,30,54,0)');}
  c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
 }
 // Fine uneven eddies keep the smoke from reading as a pair of blurred discs.
 for(let i=0;i<65;i++){
  const angle=seed(i+640)*Math.PI*2,d=18+seed(i+651)*63,x=128+Math.cos(angle)*d,y=125+Math.sin(angle)*d*.83,r=9+seed(i+660)*17;
  const g=c.createRadialGradient(x-r*.2,y-r*.4,0,x,y,r);g.addColorStop(0,'rgba(155,144,155,.09)');g.addColorStop(.48,'rgba(91,82,102,.055)');g.addColorStop(1,'rgba(54,46,66,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
 }
 return stamp;
}
function drawHellSmoke(t){
 const c=smokeCtx;c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,cw,ch);
 if(themeId!=='hell'||mode!=='new'||reduced.matches||t<3.12||t>5.8)return;
 smokeStamp??=makeSmokeStamp();
 // Overlapping plumes bloom centrally before buoyancy opens a clear middle.
 for(let i=0;i<27;i++){
  const age=t-3.12-seed(i+180)*.60;if(age<=0||age>2.35)continue;
  const side=i%2?1:-1,q=smooth(age/1.65);
  const life=smooth(age/.43)*(1-smooth((age-1.05)/1.1))*(1-smooth((t-4.85)/.75));
  const size=cw*(.31+seed(i+260)*.16+age*.095);
  const x=cw*(.5+side*q*(.25+seed(i+280)*.06))+(seed(i+44)-.5)*cw*.045;
  const y=ch*.43-age*cw*(.075+seed(i+301)*.045)+(seed(i+303)-.5)*cw*.14;
  c.save();c.translate(x,y);c.rotate(side*(seed(i+390)*.5+age*.07));c.globalAlpha=life*(.50+seed(i+420)*.15);c.drawImage(smokeStamp,-size/2,-size*.48,size,size*.96);c.restore();
 }
 const edge=c.createLinearGradient(0,ch*.55,0,ch*.66);edge.addColorStop(0,'rgba(0,0,0,1)');edge.addColorStop(1,'rgba(0,0,0,0)');c.globalCompositeOperation='destination-in';c.fillStyle=edge;c.fillRect(0,0,cw,ch);c.globalCompositeOperation='source-over';
}

let skyCloudStamp=null;
function skyAppearance(t){
 if(themeId!=='sky'||mode!=='new')return;
 const q=ease((t-3.05)/.58),crest=$('.crest');
 crest.style.transform=`translateY(${(1-q)*-16}px) scale(${.91+.09*q})`;
 crest.style.filter=`brightness(${1+(1-q)*.6}) drop-shadow(0 10px 22px rgba(13,29,48,.6))`;
}
function skyGust(time){
 const b=ctxAudio.createBuffer(1,Math.floor(ctxAudio.sampleRate*.8),ctxAudio.sampleRate),a=b.getChannelData(0);
 for(let i=0;i<a.length;i++){const p=i/a.length;a[i]=(Math.random()*2-1)*Math.sin(p*Math.PI)**2;}
 const n=ctxAudio.createBufferSource(),f=ctxAudio.createBiquadFilter(),g=ctxAudio.createGain();n.buffer=b;f.type='bandpass';f.frequency.setValueAtTime(360,time);f.frequency.exponentialRampToValueAtTime(2100,time+.25);f.frequency.exponentialRampToValueAtTime(500,time+.78);f.Q.value=.5;g.gain.value=.13*(embeddedConfig?.volume??1);n.connect(f).connect(g).connect(ctxAudio.destination);n.start(time);n.stop(time+.8);voices.push(n);tone(130.8,time+.2,.55,.045);
}
function windArc(x,y,side,q,a){
 if(a<=0)return;ctx.save();ctx.strokeStyle=`rgba(208,235,252,${a})`;ctx.shadowColor='#bfe7ff';ctx.shadowBlur=7;
 for(let k=0;k<3;k++){ctx.lineWidth=k===0?1.5:.65;ctx.beginPath();const start=Math.max(0,q-.64);for(let j=0;j<=32;j++){
  const u=start+(q-start)*j/32,theta=-Math.PI*.9+u*Math.PI*1.3,r=cw*(.29+k*.018)*(1-u*.36),px=x+side*Math.cos(theta)*r,py=y+Math.sin(theta)*r*.55-u*cw*.06;
  j?ctx.lineTo(px,py):ctx.moveTo(px,py);
 }ctx.stroke();}ctx.restore();
}
function feather(x,y,size,rotation,a){
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=a;const g=ctx.createLinearGradient(-size*.24,0,size*.24,0);g.addColorStop(0,'#8bb5d2');g.addColorStop(.5,'#f7fcff');g.addColorStop(1,'#c4e5f8');ctx.fillStyle=g;
 ctx.beginPath();ctx.moveTo(0,-size);ctx.bezierCurveTo(size*.42,-size*.32,size*.28,size*.52,0,size);ctx.bezierCurveTo(-size*.22,size*.40,-size*.26,-size*.45,0,-size);ctx.fill();ctx.strokeStyle='#ffffffa0';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(0,-size*.8);ctx.quadraticCurveTo(size*.05,0,-size*.08,size*1.15);ctx.stroke();ctx.restore();
}
function drawSky(t,fa){
 ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,cw,ch);if(reduced.matches||geom.length!==9)return;
 const king=geom[cards.findIndex(c=>c[2])],cx=cw*.5,cy=ch*.37,lift=smooth((t-2.30)/.75),root={x:king.x+(cx-king.x)*lift,y:king.y+(cy-king.y)*lift};
 const charge=smooth((t-.7)/.65)*(1-smooth((t-2.85)/.55));
 for(let n=0;n<9;n++){const p=geom[order[n]],q=clamp((t-.65-n*.045)/1.45);glow(p.x,p.y,p.w*.9,fa*.55*Math.sin(q*Math.PI),'183,221,253');if(n>0&&q>0&&q<1)curvedLight(p,king,ease(q),Math.sin(q*Math.PI)*.55,(n%2?1:-1)*cw*.12,'200,233,255');}
 for(const side of [-1,1])windArc(root.x,root.y-cw*.04,side,clamp((t-.9)/1.65),charge*.75);
 const open=ease((t-.8)/.8),tuck=smooth((t-2.05)/.43),beat=ease((t-2.66)/.38),spread=.16*open-.065*tuck+.195*beat,wingA=smooth((t-.72)/.4)*(1-smooth((t-3.25)/.58));
 for(const side of [-1,1]){
  sprite(effectImages.sky,root.x+side*cw*spread,root.y-cw*.09,cw*(.32+.065*beat),cw*(.40+.035*beat),wingA,side*(.20*(1-open)+.18*tuck-.35*beat),side>0);
  if(t>2.65&&t<3.65)windArc(cx,cy+cw*.04,side,ease((t-2.65)/.75),(1-smooth((t-3.12)/.53))*.9);
 }
 const release=smooth((t-2.68)/.12)*(1-smooth((t-3.05)/.6));glow(cx,cy,cw*.34,release*.9,'206,237,255');
 for(let i=0;i<22;i++){
  const age=t-2.82-seed(i+18)*.42;if(age<0||age>2.7)continue;
  const side=i%2?1:-1,speed=cw*(.08+seed(i+72)*.13),x=cx+side*(cw*.11+speed*age),y=cy-cw*.05+(seed(i+32)-.5)*cw*.26-age*cw*.035+age*age*cw*.045;
  feather(x,y,3.5+seed(i+42)*5.5,side*(.6+age*.45),smooth(age/.12)*(1-smooth((age-1.1)/1.4))*.76);
 }
 if(t>3.2&&t<4.8){const a=smooth((t-3.2)/.2)*(1-smooth((t-3.65)/1.15));for(const side of [-1,1]){ctx.save();ctx.strokeStyle=`rgba(187,219,242,${a*.35})`;ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(cx+side*cw*.15,cy+cw*.20);ctx.bezierCurveTo(cx+side*cw*.46,cy+cw*.28,cx+side*cw*.50,cy-cw*.07,cx+side*cw*.31,cy-cw*.22);ctx.stroke();ctx.restore();}}
}
function makeSkyCloud(){
 const stamp=document.createElement('canvas');stamp.width=256;stamp.height=256;const c=stamp.getContext('2d');
 for(let i=0;i<16;i++){const theta=seed(i+540)*Math.PI*2,d=seed(i+541)*58,x=128+Math.cos(theta)*d,y=135+Math.sin(theta)*d*.7,r=38+seed(i+550)*43,g=c.createRadialGradient(x-r*.14,y-r*.3,0,x,y,r);g.addColorStop(0,'rgba(230,242,250,.27)');g.addColorStop(.40,'rgba(178,204,224,.20)');g.addColorStop(.75,'rgba(105,143,175,.09)');g.addColorStop(1,'rgba(89,128,160,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}return stamp;
}
function drawSkyCloud(t){
 if(themeId!=='sky'||mode!=='new'||reduced.matches||t<2.35||t>4.6)return;
 skyCloudStamp??=makeSkyCloud();const c=smokeCtx,enter=smooth((t-2.35)/.45),open=ease((t-2.9)/1.05),fade=1-smooth((t-3.45)/1.0);
 for(let i=0;i<18;i++){const side=i%2?1:-1,x=cw*(.5+side*(.055+.52*open)+(seed(i+910)-.5)*.16),y=ch*(.36+(seed(i+940)-.5)*.22),size=cw*(.35+seed(i+971)*.21);c.save();c.globalAlpha=enter*fade*.43;c.translate(x,y);c.rotate(side*open*.10);c.drawImage(skyCloudStamp,-size/2,-size*.36,size,size*.72);c.restore();}
}

function loading(on){stage.classList.toggle('loading',on);$$('#replay,#seek,#play-pause,[data-mode],#mirror').forEach(e=>e.disabled=on)}
async function selectTheme(id){loading(true);const token=++loadToken;cancelAnimationFrame(raf);playing=false;stopSounds();themeId=id;theme=THEMES[id];stage.dataset.area=id;stage.style.setProperty('--accent-rgb',theme.rgb);stage.style.setProperty('--crest-url',`url('assets/${theme.crest}.png')`);$('.field').src=embeddedConfig.field;
if(id!=='ice'){const im=new Image();im.src=`assets/${id}-effect.png`;effectImages[id]=im;}$('.field').alt=theme.area+'の盤面';$('.crest>img').src=`assets/${theme.crest}.png`;$('.crest>img').alt=theme.area+'の称号紋章';$('.snow-mark').textContent=theme.symbol;$('.stage-top>span:nth-child(2)').innerHTML=theme.area+'<small>あなたの布陣</small>';$('.award-copy h1').textContent=theme.title;$('.award-flavor').textContent=theme.flavor;$('.editorial-tag').textContent=id.toUpperCase()+' / FORMATION HONOR';$('aside h2').innerHTML=theme.intro;$('.lead').innerHTML=theme.lead;$('.steps li:nth-child(2)>div').innerHTML=theme.step+`<small>${theme.detail}</small>`;$('.steps li:nth-child(3) small').textContent='専用の紋章と、古金に輝く文字。';$('.formation-caption p').textContent=theme.caption;$('.stage-bottom').innerHTML='FORMATION HONOR <i></i> '+theme.english;stage.setAttribute('aria-label',theme.area+'・'+theme.title+'の称号獲得演出');$('.wall').hidden=id!=='ice';
let def;if(id==='ice'){def={width:3,name:'隅の要塞',cells:[['J','angel-j'],['10','dragon-knight'],['Q','angel-q'],['4','pirate-male'],['2','zombie-male'],['J','angel-j'],['9','viking-female',true],['Q','angel-q'],['10','dragon-knight']].map((c,i)=>[Math.floor(i/3),i%3,c[0],!!c[2]])}}else def=FORMATIONS.find(d=>d.id===theme.formation);
if(embeddedConfig){def={width:embeddedConfig.width,cells:embeddedConfig.cells.map(c=>[c.row,c.col,c.rank,c.king])};}
activeWidth=def.width;activeCells=def.cells;$('.formation-caption h2').textContent=theme.formationName;$('#cards').setAttribute('aria-label',theme.formationName+'・9枚の布陣');$('#cards').style.gridTemplateColumns=`repeat(${activeWidth},1fr)`;stage.dataset.width=activeWidth;
cards=def.cells.map(([r,c,rank,king])=>[rank,id==='hell'&&'JQK'.includes(rank)?'demon-'+rank.toLowerCase():assetMap[rank],king]);const king=cards.findIndex(c=>c[2]);order=cards.map((_,i)=>i).sort((a,b)=>Math.hypot(def.cells[a][0]-def.cells[king][0],def.cells[a][1]-def.cells[king][1])-Math.hypot(def.cells[b][0]-def.cells[king][0],def.cells[b][1]-def.cells[king][1]));$('#cards').replaceChildren();elements=cards.map(([rank,asset,isKing],i)=>{const e=document.createElement('div');e.className='card'+(isKing?' king':'');e.innerHTML=`<div class="art"><img src="${embeddedConfig.cells[i].image}" alt="${rank}${isKing?'・王':''}"></div><span class="rank">${rank}<span class="suit">♠</span></span><div class="frost"></div><div class="shine"></div>${isKing?'<span class="crown" aria-label="王">♛</span>':''}`;$('#cards').append(e);return e});
if(embeddedConfig)elements.forEach((e,i)=>{const c=embeddedConfig.cells[i];e.querySelector('img').src=c.image;e.querySelector('.suit').textContent=c.suit;e.querySelector('.rank').style.display=c.printed?'none':'';});
$$('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.theme===id));$('#status').textContent=theme.area+'の素材を読み込み中';now=0;layoutCards();render();await Promise.all([...document.images,effectImages[id]].filter(Boolean).map(im=>im.decode().catch(()=>{})));if(token!==loadToken)return;loading(false);layoutCards();play();}
window.addEventListener('message',e=>{
 if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='tottery-honor-start'||embeddedConfig)return;
 const c=e.data.config;
 if(!THEMES[c?.theme]||!Array.isArray(c.cells)||c.cells.length!==9||!c.cells.some(p=>p.king))return;
 embeddedConfig=c;mode=c.fresh?'new':'owned';mirrored=false;$('#sound').checked=c.volume>0;
 selectTheme(c.theme).then(()=>parent.postMessage({type:'tottery-honor-loaded'},location.origin)).catch(()=>parent.postMessage({type:'tottery-honor-error'},location.origin));
});
parent.postMessage({type:'tottery-honor-ready'},location.origin);


window.addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage({type:'tottery-honor-close'},location.origin)});
