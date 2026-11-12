(async()=>{'use strict';
const root=document.getElementById('gameShell'), canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const gameHud=Array.from(root.querySelectorAll(':scope>.hud,:scope>.health-hud,:scope>.task-hud,:scope>.speed-hud,:scope>.controls,:scope>.toast'));
const showGameHud=on=>gameHud.forEach(e=>{e.style.setProperty('display',on?'':'none',on?'':'important')});

let W=1000,H=600,DPR=1,mode='menu',time=0,last=0,travel=0,distance=0,coins=0,health=100,nitro=0,boost=false,best=0,flash=0,invincible=0,spawnT=2,coinT=1.1,itemId=0,playerX=0,velocity=0,keyLeft=false,keyRight=false,toastLeft=0,shake=0;
let braking=false,driveFactor=1,forwardSpeed=0;let objects=[],sparks=[],renderFaces=[];let hudElapsed=0,taskElapsed=0,simulationDebt=0,lastDrawTime=-Infinity;
try{best=Number(localStorage.getItem('highway-rush-3d-best')||0)||0}catch(e){}
$('best').innerHTML=String(best).padStart(5,'0')+' <small>m</small>';
// Landscape fullscreen is requested only from a tap; rotate hint covers portrait phones.
const shellEl=root.closest('.shell');shellEl.append($('rotateHint'));
function refreshMobileLayout(){document.body.classList.toggle('mobile-game',matchMedia('(pointer:coarse)').matches||innerWidth<=950||innerHeight<=540);}
refreshMobileLayout();window.addEventListener('resize',refreshMobileLayout);
async function enterFullscreen(){try{if(!document.fullscreenElement&&shellEl.requestFullscreen)await shellEl.requestFullscreen({navigationUI:'hide'});else if(!document.fullscreenElement&&shellEl.webkitRequestFullscreen)shellEl.webkitRequestFullscreen();if(document.fullscreenElement&&screen.orientation?.lock)try{await screen.orientation.lock('landscape')}catch{} }catch{}refreshMobileLayout();}
$('fullscreenBtn').onclick=async()=>{if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}else await enterFullscreen()};
$('rotateFullscreenBtn').onclick=enterFullscreen;
root.addEventListener('click',e=>{if(document.body.classList.contains('mobile-game')&&e.target.closest('#goBtn,#playBtn,#nextBtn'))enterFullscreen()},true);
document.addEventListener('fullscreenchange',()=>{const full=!!document.fullscreenElement;$('fullscreenBtn').textContent=full?'✕':'⛶';$('fullscreenBtn').setAttribute('aria-label',full?'Exit fullscreen':'Enter fullscreen');refreshMobileLayout()});
const R=(a,b)=>Math.random()*(b-a)+a,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
// ================= PROCEDURAL AUDIO (Web Audio API) =================
let ACTX=null,masterGain=null,engOsc=null,engGain=null,engFilt=null,boostOsc=null,boostGain=null,muted=false,audioReady=false;
function ensureAudio(){if(ACTX)return;try{ACTX=new(window.AudioContext||window.webkitAudioContext)();masterGain=ACTX.createGain();masterGain.gain.value=.45;masterGain.connect(ACTX.destination);
 engOsc=ACTX.createOscillator();engOsc.type='sawtooth';engOsc.frequency.value=55;engGain=ACTX.createGain();engGain.gain.value=0;engFilt=ACTX.createBiquadFilter();engFilt.type='lowpass';engFilt.frequency.value=420;engFilt.Q.value=.7;
 engOsc.connect(engFilt);engFilt.connect(engGain);engGain.connect(masterGain);engOsc.start();
 boostOsc=ACTX.createOscillator();boostOsc.type='sawtooth';boostOsc.frequency.value=90;boostGain=ACTX.createGain();boostGain.gain.value=0;const bf=ACTX.createBiquadFilter();bf.type='bandpass';bf.frequency.value=900;bf.Q.value=2;
 boostOsc.connect(bf);bf.connect(boostGain);boostGain.connect(masterGain);boostOsc.start();audioReady=true}catch(e){muted=true}}
function resumeAudio(){ensureAudio();if(ACTX&&ACTX.state==='suspended')ACTX.resume().catch(()=>{})}
function beep(freq,dur,type,vol,slide){if(muted||!ACTX)return;const t=ACTX.currentTime,o=ACTX.createOscillator(),g=ACTX.createGain();o.type=type||'square';o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,slide),t+dur);g.gain.setValueAtTime(vol||.15,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(masterGain);o.start(t);o.stop(t+dur+.02)}
function noiseBurst(dur,vol,hp){if(muted||!ACTX)return;const t=ACTX.currentTime,len=Math.floor(ACTX.sampleRate*dur),buf=ACTX.createBuffer(1,len,ACTX.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.4);const s=ACTX.createBufferSource();s.buffer=buf;const f=ACTX.createBiquadFilter();f.type=hp?'highpass':'lowpass';f.frequency.value=hp||800;const g=ACTX.createGain();g.gain.setValueAtTime(vol||.2,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(masterGain);s.start(t)}
const SFX={
 coin(){beep(880,.08,'sine',.12,1320);beep(1320,.12,'sine',.08,1760)},
 nitro(){beep(220,.15,'sawtooth',.1,440);beep(440,.25,'triangle',.08,880)},
 heal(){beep(523,.1,'sine',.1);setTimeout(()=>beep(659,.1,'sine',.1),70);setTimeout(()=>beep(784,.18,'sine',.12),140)},
 hit(){noiseBurst(.22,.35,180);beep(90,.2,'sawtooth',.18,40)},
 bomb(){noiseBurst(.35,.4,120);beep(60,.3,'square',.2,30)},
 boostOn(){beep(180,.08,'sawtooth',.12,360);noiseBurst(.15,.15,400)},
 win(){beep(523,.12,'triangle',.12);setTimeout(()=>beep(659,.12,'triangle',.12),100);setTimeout(()=>beep(784,.12,'triangle',.12),200);setTimeout(()=>beep(1046,.35,'sine',.15),320)},
 lose(){beep(300,.2,'sawtooth',.15,120);setTimeout(()=>beep(180,.35,'sawtooth',.12,60),150)},
 click(){beep(600,.04,'square',.06)},
 start(){beep(150,.1,'sawtooth',.1,300);setTimeout(()=>beep(300,.15,'sawtooth',.1,500),80)},
 pass(){beep(200,.05,'triangle',.04,100)},
 ready(){beep(660,.08,'sine',.1);setTimeout(()=>beep(990,.15,'sine',.12),90)}
};
function updateEngine(speedNorm,boosting,running){if(!audioReady||muted)return;const t=ACTX.currentTime;if(!running){engGain.gain.setTargetAtTime(0,t,.08);boostGain.gain.setTargetAtTime(0,t,.05);return}
 const rpm=55+speedNorm*95+(boosting?40:0);engOsc.frequency.setTargetAtTime(rpm,t,.05);engFilt.frequency.setTargetAtTime(380+speedNorm*900+(boosting?600:0),t,.08);engGain.gain.setTargetAtTime(.04+.06*speedNorm+(boosting?.04:0),t,.08);
 boostGain.gain.setTargetAtTime(boosting?.09:0,t,.04);if(boosting)boostOsc.frequency.setTargetAtTime(80+speedNorm*60+Math.sin(t*18)*12,t,.02)}
function resize(){let r=root.getBoundingClientRect();W=Math.max(320,r.width);H=Math.max(420,r.height);DPR=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}resize();new ResizeObserver(resize).observe(root);
// ================= CINEMATIC RENDERER (golden-hour, perspective, glow FX) =================
let cx=0,hor=0,hY=0,ppu=1,camX=0,camRoll=0,camPitch=0,camSmooth=0,pT=0,pT0=performance.now(),bs=0,pC=0,pN=0,pF=0,sunX=0,sunY=0,smokeT=0,steerInput=0,skidMarks=[];
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};
const pr=(x,z)=>{const s=1/(1+(3-z)/12.5);return[cx+(x-camX)*ppu*s,hor+(hY-hor)*s+camPitch*(1-s)*28,s]};
const up=(x,z,h)=>{const p=pr(x,z);return[p[0],p[1]-h*ppu*p[2],p[2]]};
function sh(hex,k){const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255,t=k<0?0:255,a=Math.abs(k);return`rgb(${Math.round(r+(t-r)*a)},${Math.round(g+(t-g)*a)},${Math.round(b+(t-b)*a)})`}
function poly(pts,fill){ctx.fillStyle=fill;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill()}
const qd=(x1,x2,za,zb,c)=>poly([pr(x1,za),pr(x2,za),pr(x2,zb),pr(x1,zb)],c);
function glow(x,y,r,c,a=1){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=a;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore()}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function ln(a,b,c,w){ctx.strokeStyle=c;ctx.lineWidth=Math.max(1,w);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}

function mount(base,amp,col,sp,seed){ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(-20,hor+2);for(let x=-20;x<=W+30;x+=10){const u=x/W*3+seed+camX*sp*.02;ctx.lineTo(x,hor-base-(Math.sin(u*1.7)*.5+Math.sin(u*4.1+seed)*.3+Math.sin(u*9.3)*.12+.9)*amp)}ctx.lineTo(W+30,hor+2);ctx.closePath();ctx.fill()}
function sky(){
 const T=TH(),g=ctx.createLinearGradient(0,0,0,hor);T.s.forEach((c,i)=>g.addColorStop(i/4,c));ctx.fillStyle=g;ctx.fillRect(-60,-60,W+120,hor+62);
 if(T.n)for(let i=0;i<70;i++){ctx.fillStyle=`rgba(255,255,255,${.3+.5*Math.abs(Math.sin(pT*1.5+i))})`;ctx.fillRect(hash(i)*W,hash(i+7)*hor*.8,1.6,1.6)}
 sunX=W*.6-camX*5;sunY=hor-H*(T.n?.3:.06);
 glow(sunX,sunY,H*.6,T.n?'rgba(110,140,255,.3)':T.d?'rgba(255,255,255,.4)':'rgba(255,160,80,.5)');
 ctx.fillStyle=T.n?'#eef2ff':'#fff4d2';ctx.beginPath();ctx.arc(sunX,sunY,H*.045,0,7);ctx.fill();
 glow(sunX,sunY,H*.16,T.n?'rgba(200,215,255,.8)':'rgba(255,235,190,.95)');
 for(let i=0;i<6;i++){const x=((i*297+pT*(4+i*1.5))%(W+500))-250,y=hor*(.16+hash(i)*.5),r=34+hash(i+9)*50;
  ctx.fillStyle=T.c1;ctx.beginPath();ctx.ellipse(x,y+r*.12,r*1.9,r*.28,0,0,7);ctx.fill();
  ctx.fillStyle=T.c2;ctx.beginPath();ctx.ellipse(x-r*.2,y,r*1.5,r*.2,0,0,7);ctx.fill()}
 mount(H*.02,H*.15,T.m[0],.6,1.3);mount(0,H*.10,T.m[1],1.2,4.1);mount(-H*.01,H*.05,T.m[2],2,7.7);
}
function ground(){
 const g=ctx.createLinearGradient(0,hor,0,H);g.addColorStop(0,'#d4a878');g.addColorStop(.2,'#8a8a52');g.addColorStop(.55,'#3d5630');g.addColorStop(1,'#1e3018');
 ctx.fillStyle=g;ctx.fillRect(-60,hor,W+120,H-hor+80);
 // parallax field strips
 for(let z=-228+(travel%14);z<10;z+=14){qd(-95,-7.7,z,z+7,'rgba(0,0,0,.1)');qd(7.7,95,z,z+7,'rgba(0,0,0,.1)')}
 // distant grass texture noise
 for(let i=0;i<18;i++){const z=-180+hash(i+travel*.01)*160,s=hash(i+3)>.5?1:-1,x=s*(9+hash(i+7)*40),p=pr(x,z);if(p[2]<.08)continue;
  ctx.fillStyle=`rgba(40,80,30,${.15*p[2]})`;ctx.fillRect(p[0]-4*p[2]*ppu,p[1],8*p[2]*ppu,3*p[2]*ppu)}
}
function tree(id,z){
 for(const s of[-1,1]){const k=id*2+(s>0?1:0);if(hash(k)>.78)continue;
  const x=s*(11.5+hash(k+3)*9),p=pr(x,z),u=ppu*p[2],r=(1.2+hash(k+5)*.8)*u,dir=sunX>p[0]?1:-1;if(u<1.2)continue;
  ctx.fillStyle='rgba(10,8,25,.3)';ctx.beginPath();ctx.ellipse(p[0]-dir*r*.6,p[1],r*1.5,r*.28,0,0,7);ctx.fill();
  ctx.fillStyle='#4a3524';ctx.fillRect(p[0]-.15*u,p[1]-1.8*u,.3*u,1.8*u);
  for(let j=0;j<3;j++){const cxx=p[0]+(j-1)*r*.7,cyy=p[1]-1.8*u-r*(j===1?1.1:.55),rr_=r*(j===1?1:.8);
   ctx.fillStyle='#1f4228';ctx.beginPath();ctx.arc(cxx,cyy,rr_,0,7);ctx.fill();
   ctx.fillStyle='rgba(76,140,64,.8)';ctx.beginPath();ctx.arc(cxx+dir*rr_*.22,cyy-rr_*.2,rr_*.7,0,7);ctx.fill();
   ctx.fillStyle='rgba(255,190,116,.28)';ctx.beginPath();ctx.arc(cxx+dir*rr_*.45,cyy-rr_*.3,rr_*.35,0,7);ctx.fill()}}
}
function road(){
 // asphalt with depth gradient + subtle wet sheen bands
 const g=ctx.createLinearGradient(0,hor,0,H);g.addColorStop(0,'#9a9098');g.addColorStop(.08,'#6a6e7c');g.addColorStop(.45,'#3a3f4c');g.addColorStop(1,'#1c2028');
 qd(-7.15,7.15,-230,10,g);
 // perspective shade strips (3D depth)
 for(let z=-228+(travel%10);z<10;z+=10){const a=.04+(.08*(z+230)/240);qd(-7.15,7.15,z,z+5,`rgba(0,0,0,${a})`)}
 // lane grooves
 for(let l=0;l<5;l++){const c=(l-2)*2.83;qd(c-1.0,c-.48,-230,10,'rgba(0,0,0,.18)');qd(c+.48,c+1.0,-230,10,'rgba(0,0,0,.18)')}
 // sun reflection on road
 ctx.save();ctx.beginPath();[pr(-7.15,-230),pr(7.15,-230),pr(7.15,10),pr(-7.15,10)].forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.clip();
 glow(sunX,hor+H*.1,H*.5,'rgba(255,180,100,.5)',.85);
 // moving light streaks (motion feel)
 for(let i=0;i<5;i++){const zz=-200+(travel*1.8+i*42)%210,p0=pr(-1.2,zz),p1=pr(1.2,zz+8);if(p0[2]<.08)continue;
  ctx.strokeStyle=`rgba(255,230,180,${.08*p0[2]})`;ctx.lineWidth=Math.max(1,12*p0[2]);ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke()}
 ctx.restore();
 // red/white curbs
 for(const s of[-1,1]){for(let z=-228+(travel%6);z<10;z+=6){qd(s*7.1,s*7.85,z,z+3,'#e03a3a');qd(s*7.1,s*7.85,z+3,z+6,'#f5f2ea')}qd(s*6.9,s*7.15,-230,10,'#f4f1e6')}
 // dashed lane markers with better perspective
 for(const b of[-4.245,-1.415,1.415,4.245])for(let z=-230+(travel%12);z<10;z+=12){
  const pA=pr(b,z),pB=pr(b,z+5.5);if(pA[2]<.05)continue;
  ctx.strokeStyle=`rgba(255,248,230,${.55+pA[2]*.4})`;ctx.lineWidth=Math.max(1.2,.14*ppu*pA[2]);ctx.lineCap='butt';
  ctx.beginPath();ctx.moveTo(pA[0],pA[1]);ctx.lineTo(pB[0],pB[1]);ctx.stroke()}
 // skid marks from hard steering
 for(let i=skidMarks.length-1;i>=0;i--){const m=skidMarks[i];m.z+= (25)*0.016;m.a-=0.012;if(m.a<=0||m.z>8){skidMarks.splice(i,1);continue}
  const p=pr(m.x,m.z);if(p[2]<.06)continue;ctx.fillStyle=`rgba(20,18,25,${m.a*p[2]})`;ctx.beginPath();ctx.ellipse(p[0],p[1],.35*ppu*p[2],.08*ppu*p[2],0,0,7);ctx.fill()}
}
function roadside(){
 for(const s of[-1,1]){const x=s*8.4,a=up(x,-230,.85),b=up(x,10,.85),c=up(x,10,.5),d=up(x,-230,.5);
  const g=ctx.createLinearGradient(0,a[1],0,d[1]+8);g.addColorStop(0,'#e8eef4');g.addColorStop(1,'#7f8996');poly([a,b,c,d],g);
  for(let z=-228+(travel%8);z<10;z+=8){const p=pr(x,z),t=up(x,z,.85);ln(p,t,'#59616c',.22*ppu*p[2])}}
 for(let z=-220+(travel%40);z<12;z+=40)for(const s of[-1,1]){const zz=s>0?z:z+20;if(zz>8)continue;
  const b=pr(s*9.6,zz),t=up(s*9.6,zz,7.5),arm=up(s*7.4,zz,7.5),u=ppu*b[2];
  ln(b,t,'#2c303b',.28*u);ln(t,arm,'#2c303b',.2*u);glow(arm[0],arm[1],u*3.4,'rgba(255,190,100,.9)',.9);
  ctx.fillStyle='#fff3cf';ctx.beginPath();ctx.arc(arm[0],arm[1],Math.max(1,.16*u),0,7);ctx.fill()}
 for(let z=-220+(travel%110);z<6;z+=110){
  for(const s of[-1,1])ln(pr(s*8.8,z),up(s*8.8,z,6.8),'#8f99a3',.4*ppu*pr(0,z)[2]);
  poly([up(-8.8,z,6.8),up(8.8,z,6.8),up(8.8,z,6.3),up(-8.8,z,6.3)],'#a7b1bb');
  poly([up(-5.6,z,6.3),up(-.6,z,6.3),up(-.6,z,4.6),up(-5.6,z,4.6)],'#f1f4f0');
  poly([up(-5.45,z,6.15),up(-.75,z,6.15),up(-.75,z,4.75),up(-5.45,z,4.75)],'#10784c');
  poly([up(.6,z,6.3),up(5.6,z,6.3),up(5.6,z,4.6),up(.6,z,4.6)],'#f1f4f0');
  poly([up(.75,z,6.15),up(5.45,z,6.15),up(5.45,z,4.75),up(.75,z,4.75)],'#10784c')}
}
function haze(){const h=TH().h,g=ctx.createLinearGradient(0,hor-H*.08,0,hor+H*.18);g.addColorStop(0,`rgba(${h},0)`);g.addColorStop(.35,`rgba(${h},.45)`);g.addColorStop(.7,`rgba(${h},.65)`);g.addColorStop(1,`rgba(${h},0)`);ctx.fillStyle=g;ctx.fillRect(-60,hor-H*.08,W+120,H*.26)
 // atmospheric perspective overlay far field
 const g2=ctx.createLinearGradient(0,hor-H*.25,0,hor);g2.addColorStop(0,'rgba(180,200,230,0)');g2.addColorStop(1,`rgba(${h},.25)`);ctx.fillStyle=g2;ctx.fillRect(-60,hor-H*.25,W+120,H*.25)}

const M={muscle:[.31,.25,.70],super:[.25,.20,.60],hyper:[.22,.18,.58],sedan:[.34,.30,.74],suv:[.42,.38,.82],sport:[.28,.24,.66]};
function car(x,y,w,col,type,hero,al,st){
 if(type==='truck'||type==='bike')return big(x,y,w,col,type,al,hero,st);
 const m=M[type]||M.sedan,bh=m[0]*w,ch=m[1]*w,cw=m[2]*w,g0=.13*w,top=-g0-bh,roof=top-ch,cb=cw*.52,ct=cw*.40;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=al;
 ctx.fillStyle='rgba(8,6,20,.55)';ctx.beginPath();ctx.ellipse(0,0,w*.58,w*.07,0,0,7);ctx.fill();
 glow(0,0,w*.9,hero?V.glow:'rgba(255,30,40,.2)',hero?.6:1);
 ctx.fillStyle='#0b0c10';for(const s of[-1,1]){rr(s<0?-.5*w:.35*w,-.24*w,.15*w,.24*w,.04*w);ctx.fill()}
 ctx.fillStyle='rgba(185,195,210,.35)';for(const s of[-1,1]){rr(s<0?-.46*w:.39*w,-.17*w,.07*w,.1*w,.02*w);ctx.fill()}wheelTread(w,st);
 let g=ctx.createLinearGradient(0,roof,0,top);g.addColorStop(0,sh(col,.35));g.addColorStop(1,sh(col,-.2));poly([[-cb,top+2],[cb,top+2],[ct,roof],[-ct,roof]],g);
 g=ctx.createLinearGradient(0,roof,0,top);g.addColorStop(0,'#0e1c28');g.addColorStop(1,'#35566f');
 poly([[-cb*.9,top-.01*w],[cb*.9,top-.01*w],[ct*.88,roof+.035*w],[-ct*.88,roof+.035*w]],g);
 poly([[-cb*.6,top],[-cb*.25,top],[-ct*.1,roof+.04*w],[-ct*.45,roof+.04*w]],'rgba(255,200,150,.25)');
 ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=Math.max(1,w*.006);for(let i=1;i<4;i++){const yy=roof+(top-roof)*i/4;ctx.beginPath();ctx.moveTo(-cb*.8,yy);ctx.lineTo(cb*.8,yy);ctx.stroke()}
 rr(-ct*.45,roof+.045*w,ct*.9,.018*w,.008*w);ctx.fillStyle='#ff2b3a';ctx.fill();glow(0,roof+.055*w,w*.18,'rgba(255,40,55,.7)',.8);
 for(const s of[-1,1]){rr(s*(cb+.015*w)-.03*w,top-ch*.38,.06*w,.045*w,.015*w);ctx.fillStyle=sh(col,-.3);ctx.fill()}
 g=ctx.createLinearGradient(0,top,0,top+bh);g.addColorStop(0,sh(col,.4));g.addColorStop(.25,col);g.addColorStop(1,sh(col,-.55));
 rr(-w/2,top,w,bh,w*.08);ctx.fillStyle=g;ctx.fill();
 g=ctx.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'rgba(0,0,0,.4)');g.addColorStop(.28,'rgba(255,255,255,.1)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(.72,'rgba(255,255,255,.06)');g.addColorStop(1,'rgba(0,0,0,.4)');
 rr(-w/2,top,w,bh,w*.08);ctx.fillStyle=g;ctx.fill();
 if(hero&&V.str){ctx.fillStyle=V.str;ctx.fillRect(-.075*w,top,.05*w,bh);ctx.fillRect(.025*w,top,.05*w,bh)}
 ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=Math.max(1,w*.012);ctx.beginPath();ctx.moveTo(-w*.42,top+bh*.12);ctx.lineTo(w*.42,top+bh*.12);ctx.stroke();
 g=ctx.createLinearGradient(0,top,0,top+bh*.4);g.addColorStop(0,'rgba(255,214,170,.35)');g.addColorStop(1,'rgba(255,214,170,0)');rr(-w/2+2,top+2,w-4,bh*.4,w*.07);ctx.fillStyle=g;ctx.fill();
 ctx.strokeStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.moveTo(-w*.47,top+bh*.56);ctx.lineTo(w*.47,top+bh*.56);ctx.stroke();
 const ly=top+bh*.22,lh=bh*.26;
 for(const s of[-1,1]){const lx=s<0?-.47*w:.2*w,lg=ctx.createLinearGradient(0,ly,0,ly+lh);lg.addColorStop(0,'#ff4b55');lg.addColorStop(1,'#8d0014');
  rr(lx,ly,.27*w,lh,lh*.3);ctx.fillStyle=lg;ctx.fill();ctx.fillStyle='rgba(255,210,210,.85)';ctx.fillRect(lx+.03*w,ly+lh*.38,.21*w,lh*.2);for(let i=0;i<5;i++){ctx.fillStyle='rgba(255,230,230,.7)';ctx.fillRect(lx+(.025+i*.045)*w,ly+lh*.08,.02*w,lh*.16)}glow(lx+.135*w,ly+lh/2,w*.36,'rgba(255,40,55,.8)',.85)}
 if(type==='sport'||hero){rr(-.2*w,ly+lh*.3,.4*w,lh*.4,lh*.2);ctx.fillStyle='#ff3a4a';ctx.fill()}
 rr(-.46*w,top+bh*.58,.92*w,bh*.42,w*.05);ctx.fillStyle='#10131a';ctx.fill();
 rr(-.1*w,top+bh*.66,.2*w,.055*w,.01*w);ctx.fillStyle='#e8ecef';ctx.fill();
 ctx.fillStyle='rgba(200,210,225,.5)';ctx.fillRect(-.44*w,top+bh*.6,.88*w,.012*w);ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(-.38*w,top+bh*.7,.1*w,.03*w);ctx.fillRect(.28*w,top+bh*.7,.1*w,.03*w);
 ctx.strokeStyle='rgba(120,130,150,.4)';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*.07*w,top+bh*.84);ctx.lineTo(i*.07*w,top+bh*.98);ctx.stroke()}
 if(hero){
  ctx.fillStyle='#0a0f0c';ctx.fillRect(-.3*w,top-.06*w,.04*w,.06*w);ctx.fillRect(.26*w,top-.06*w,.04*w,.06*w);
  g=ctx.createLinearGradient(0,top-.11*w,0,top-.05*w);g.addColorStop(0,'#5fe333');g.addColorStop(.3,'#16301a');g.addColorStop(1,'#07110a');rr(-.52*w,top-.11*w,1.04*w,.06*w,.015*w);ctx.fillStyle=g;ctx.fill();
  for(const s of[-1,1]){const ex=s*.26*w,ey=-g0*.45;g=ctx.createRadialGradient(ex-.01*w,ey-.01*w,0,ex,ey,.05*w);g.addColorStop(0,'#fff');g.addColorStop(.6,'#8d97a3');g.addColorStop(1,'#2a2f38');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ex,ey,.05*w,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.arc(ex,ey,.03*w,0,7);ctx.fill();
   if(boost){const L=w*(.45+.3*Math.random());poly([[ex-.05*w,ey],[ex+.05*w,ey],[ex,ey+L]],'rgba(70,190,255,.85)');poly([[ex-.025*w,ey],[ex+.025*w,ey],[ex,ey+L*.55]],'rgba(235,252,255,.95)');glow(ex,ey+.12*w,w*.5,'rgba(60,170,255,.9)')}}}
 carDetail(w,type,col,hero,st,top,roof,cb,ct,bh,ly,lh);
 ctx.restore();
}
function wheelTread(w,st){const ph=((((st&&st.ph!==undefined)?st.ph:travel*.5))%1+1)%1;ctx.save();ctx.lineWidth=Math.max(1,w*.008);
 for(const s of[-1,1]){const x0=s<0?-.5*w:.35*w;ctx.save();rr(x0,-.24*w,.15*w,.24*w,.04*w);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.10)';
  for(let i=-1;i<7;i++){const yy=-.24*w+(i+ph)*.045*w;ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x0+.15*w,yy+.012*w);ctx.stroke()}
  const g=ctx.createLinearGradient(x0,0,x0+.15*w,0);g.addColorStop(0,'rgba(255,255,255,.14)');g.addColorStop(.3,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.25)');ctx.fillStyle=g;ctx.fillRect(x0,-.24*w,.15*w,.24*w);ctx.restore()}
 ctx.restore()}
function carDetail(w,type,col,hero,st,top,roof,cb,ct,bh,ly,lh){
 const blink=Math.floor(pT*3.6)%2===0,sg=st?st.sig:0,bk=!!(st&&st.bk);let g;
 // dark underbody between the wheels
 ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(-.36*w,-.13*w,.72*w,.1*w);
 if(!hero){
  // driver (+ optional passenger) silhouettes + headrests behind the rear glass
  const wy0=roof+.035*w,wy1=top-.01*w,wh=wy1-wy0;
  if(wh>2){ctx.fillStyle='rgba(8,12,18,.78)';for(const s of[-1,1]){rr(s*cb*.36-.04*w,wy0+wh*.42,.08*w,.07*w,.02*w);ctx.fill()}
   ctx.fillStyle='rgba(6,9,14,.88)';const heads=st&&st.pax?[-1,1]:[1];for(const s of heads){ctx.beginPath();ctx.arc(s*cb*.36,wy0+wh*.3,.04*w,0,7);ctx.fill();rr(s*cb*.36-.06*w,wy0+wh*.5,.12*w,wh*.5,.03*w);ctx.fill()}}
  if(type==='sedan'||type==='suv'){ctx.strokeStyle='#0c0e12';ctx.lineWidth=Math.max(1,w*.008);ctx.beginPath();ctx.moveTo(ct*.72,roof+.01*w);ctx.lineTo(ct*.72+.012*w,roof-.14*w);ctx.stroke();ctx.fillStyle='#d6dbe2';ctx.beginPath();ctx.arc(ct*.72+.012*w,roof-.14*w,Math.max(1,.009*w),0,7);ctx.fill()}
  if(type==='suv'){ctx.fillStyle='#14171d';rr(-ct*.95,roof-.03*w,ct*1.9,.02*w,.008*w);ctx.fill();ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(-ct*.9,roof-.03*w,ct*1.8,.004*w);ctx.fillStyle='#14171d';ctx.fillRect(-ct*.85,roof-.012*w,.02*w,.015*w);ctx.fillRect(ct*.85-.02*w,roof-.012*w,.02*w,.015*w);
   ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=Math.max(1,w*.007);ctx.beginPath();ctx.moveTo(0,top-.012*w);ctx.lineTo(cb*.45,top-ch0(w,type)*.55);ctx.stroke()}
  if(type==='sport'){ctx.fillStyle=sh(col,-.5);ctx.fillRect(-.34*w,top-.05*w,.025*w,.05*w);ctx.fillRect(.315*w,top-.05*w,.025*w,.05*w);rr(-.5*w,top-.085*w,w,.04*w,.012*w);ctx.fillStyle='#14171d';ctx.fill();ctx.fillStyle=col;ctx.fillRect(-.5*w,top-.085*w,w,.012*w);ctx.fillStyle='#14171d';ctx.fillRect(-.5*w,top-.1*w,.018*w,.07*w);ctx.fillRect(.482*w,top-.1*w,.018*w,.07*w)}
  // exhaust tips
  const ex=type==='sport'||type==='muscle'?[-.3,.3]:[.3];for(const s of ex){const px=s*w,py=-.075*w;g=ctx.createRadialGradient(px-.01*w,py-.01*w,0,px,py,.042*w);g.addColorStop(0,'#fff');g.addColorStop(.6,'#8d97a3');g.addColorStop(1,'#2a2f38');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(px,py,.042*w,.03*w,0,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.ellipse(px,py,.027*w,.019*w,0,0,7);ctx.fill()}
 }
 // badge
 g=ctx.createRadialGradient(-.006*w,top+bh*.47-.006*w,0,0,top+bh*.47,.026*w);g.addColorStop(0,'#fff');g.addColorStop(1,'#7e8794');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,top+bh*.47,.024*w,0,7);ctx.fill();
 // plate text
 plateTxt(w,-.1*w,top+bh*.66,.2*w,.055*w,(st&&st.plate)||(hero?'HR-3D':''));
 // brake lights + indicators
 if(bk){for(const s of[-1,1])glow(s*.335*w,ly+lh/2,w*.6,'rgba(255,30,40,.95)');ctx.fillStyle='#ff5a64';rr(-.14*w,ly+lh*.3,.28*w,lh*.4,lh*.2);ctx.fill()}
 for(const d of[-1,1])if(sg===d&&blink){const x0=d<0?-.47*w:.38*w;ctx.fillStyle='#ffb020';rr(x0,ly,.09*w,lh,lh*.25);ctx.fill();glow(x0+.045*w,ly+lh/2,w*.36,'rgba(255,170,30,.95)')}
}
const ch0=(w,type)=>(M[type]||M.sedan)[1]*w;
function pick(o,p,al){
 const u=ppu*p[2],x=p[0],y=p[1];ctx.save();ctx.globalAlpha=al;
 ctx.fillStyle='rgba(8,6,20,.4)';ctx.beginPath();ctx.ellipse(x,y,.45*u,.1*u,0,0,7);ctx.fill();
 if(o.kind==='coin'){const cy=y-(.95+Math.sin(pT*4+o.id)*.1)*u,k=Math.max(.15,Math.abs(Math.cos(pT*3+o.id*1.7))),r=.42*u;
  glow(x,cy,r*2.6,'rgba(255,200,60,.7)');const g=ctx.createLinearGradient(x-r,cy-r,x+r,cy+r);g.addColorStop(0,'#fff3a6');g.addColorStop(.5,'#f2b01e');g.addColorStop(1,'#a8650c');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,cy,r*k,r,0,0,7);ctx.fill();ctx.strokeStyle='#fff0a0';ctx.lineWidth=Math.max(1,u*.04);ctx.beginPath();ctx.ellipse(x,cy,r*k*.68,r*.68,0,0,7);ctx.stroke()}
 else if(o.kind==='nitro'){glow(x,y-.7*u,u*1.8,'rgba(40,190,255,.8)',.6+.4*Math.sin(pT*6));
  const g=ctx.createLinearGradient(x-.3*u,0,x+.3*u,0);g.addColorStop(0,'#0a4f9a');g.addColorStop(.5,'#38d8ff');g.addColorStop(1,'#0a4f9a');
  rr(x-.3*u,y-1.3*u,.6*u,1.2*u,.14*u);ctx.fillStyle=g;ctx.fill();rr(x-.18*u,y-1.45*u,.36*u,.18*u,.05*u);ctx.fillStyle='#d8f4ff';ctx.fill();
  poly([[x+.04*u,y-1.05*u],[x-.14*u,y-.7*u],[x-.01*u,y-.7*u],[x-.06*u,y-.35*u],[x+.16*u,y-.75*u],[x+.03*u,y-.75*u]],'#fff')}
 else if(o.kind==='heal'){glow(x,y-.7*u,u*1.7,'rgba(40,255,120,.7)',.6+.4*Math.sin(pT*5));const g=ctx.createLinearGradient(0,y-1.2*u,0,y-.2*u);g.addColorStop(0,'#fff');g.addColorStop(1,'#bfe8cf');rr(x-.5*u,y-1.2*u,u,u,.18*u);ctx.fillStyle=g;ctx.fill();ctx.fillStyle='#12b955';ctx.fillRect(x-.14*u,y-1.05*u,.28*u,.7*u);ctx.fillRect(x-.35*u,y-.84*u,.7*u,.28*u)}
 else{const cy=y-.55*u,r=.5*u;glow(x,cy,u*1.6,'rgba(255,40,30,.55)',.5+.5*Math.sin(pT*9));
  const g=ctx.createRadialGradient(x-r*.35,cy-r*.4,r*.1,x,cy,r);g.addColorStop(0,'#6b7483');g.addColorStop(1,'#0d1016');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,cy,r,0,7);ctx.fill();
  ctx.strokeStyle='#e8b923';ctx.lineWidth=u*.09;ctx.beginPath();ctx.ellipse(x,cy+r*.1,r*.96,r*.22,0,0,Math.PI);ctx.stroke();
  rr(x-.12*u,cy-r-.1*u,.24*u,.16*u,.03*u);ctx.fillStyle='#7b858f';ctx.fill();
  ctx.strokeStyle='#c9a46a';ctx.lineWidth=Math.max(1,u*.04);ctx.beginPath();ctx.moveTo(x,cy-r-.1*u);ctx.quadraticCurveTo(x+.05*u,cy-r-.4*u,x+.25*u,cy-r-.38*u);ctx.stroke();
  glow(x+.25*u,cy-r-.38*u,u*(.3+Math.random()*.25),'rgba(255,190,80,1)')}
 ctx.restore();
}
const FXC={spark:'rgba(255,170,60,1)',star:'rgba(255,215,80,1)',fire:'rgba(80,190,255,1)'};
function fx(x,y,n,t,spd){for(let i=0;i<n&&sparks.length<260;i++){const a=Math.random()*6.283,v=R(.3,1)*spd,l=R(.4,.9);sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(t==='star'?spd*.5:0),l,m:l,t,r:R(2,5)*W/1000+1})}}
function parts(dt){for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.l-=dt;if(p.l<=0){sparks.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;const k=p.l/p.m;
 if(p.t==='smoke'){ctx.fillStyle=`rgba(200,190,200,${k*.28})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(2.6-k*1.3),0,7);ctx.fill();ctx.fillStyle=`rgba(255,255,255,${k*.08})`;ctx.beginPath();ctx.arc(p.x-p.r*.3,p.y-p.r*.3,p.r*(1.2-k*.5),0,7);ctx.fill()}
 else if(p.t==='debris'){p.vy+=400*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.l*8);ctx.fillStyle=`rgba(80,70,60,${k*.9})`;ctx.fillRect(-p.r,-p.r*.4,p.r*2,p.r*.8);ctx.restore()}
 else{if(p.t==='spark')p.vy+=600*dt;glow(p.x,p.y,p.r*(p.t==='fire'?5:3.2),FXC[p.t]||'rgba(255,200,80,1)',k);if(p.t==='fire'&&k>.4){ctx.fillStyle=`rgba(200,240,255,${k*.5})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r*.6,0,7);ctx.fill()}}}}
function speedLines(){if(mode!=='run')return;const a=bs*.55+.14+(Math.min(1,time*.02)*.08),D=Math.max(W,H);ctx.save();ctx.lineCap='round';
 for(let i=0;i<34;i++){const ang=hash(i)*6.283,ph=(pT*(1.4+bs*2.6)+hash(i+40))%1,d0=(.22+ph*.92)*D*.72,d1=d0+(.06+bs*.22)*D,c=Math.cos(ang),s=Math.sin(ang);
  ctx.strokeStyle=`rgba(255,240,220,${a*ph*(.7+hash(i+3)*.3)})`;ctx.lineWidth=1+hash(i+80)*2.1+bs*1.2;ctx.beginPath();ctx.moveTo(cx+c*d0,hor+s*d0*.85);ctx.lineTo(cx+c*d1,hor+s*d1*.85);ctx.stroke()}
 // center tunnel streaks when boosting
 if(bs>.2){for(let i=0;i<10;i++){const ph=(pT*(3+bs*4)+i*.17)%1,x=cx+(hash(i+20)-.5)*W*.18,y0=hor+ph*H*.7,y1=y0+(.04+bs*.1)*H;
  ctx.strokeStyle=`rgba(120,210,255,${bs*ph*.55})`;ctx.lineWidth=1.5+bs*2;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x+(hash(i)-.5)*8,y1);ctx.stroke()}}
 ctx.restore()}
function post(){
 if(sunY<hor+5)[.25,.5,.75,1.1].forEach((k,i)=>glow(sunX+(cx-sunX)*k,sunY+(H*.55-sunY)*k,H*(.03+i*.02),'rgba(255,190,120,.5)',.35));
 let g=ctx.createRadialGradient(cx,H*.5,H*.25,cx,H*.5,Math.max(W,H)*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(10,6,28,.55)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.fillStyle=TH().n?'rgba(10,18,60,.3)':'rgba(255,140,60,.05)';ctx.fillRect(0,0,W,H);
 // heat shimmer bands at high speed
 if(mode==='run'&&(bs>.15||time>8)){const shA=.04+bs*.1;ctx.save();ctx.globalAlpha=shA;for(let i=0;i<6;i++){const y=hor+H*(.15+i*.12)+Math.sin(pT*4+i*1.7)*4;g=ctx.createLinearGradient(0,y-8,0,y+8);g.addColorStop(0,'rgba(255,200,140,0)');g.addColorStop(.5,'rgba(255,210,160,.35)');g.addColorStop(1,'rgba(255,200,140,0)');ctx.fillStyle=g;ctx.fillRect(0,y-10,W,20)}ctx.restore()}
 if(bs>.02){g=ctx.createRadialGradient(cx,H*.5,H*.25,cx,H*.5,Math.max(W,H)*.75);g.addColorStop(0,`rgba(80,200,255,${bs*.12})`);g.addColorStop(.5,'rgba(40,150,255,0)');g.addColorStop(1,`rgba(30,120,255,${bs*.45})`);ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore()}
 if(flash>0){g=ctx.createRadialGradient(cx,H*.5,H*.2,cx,H*.5,Math.max(W,H)*.7);g.addColorStop(0,`rgba(255,30,60,${flash*.4})`);g.addColorStop(1,`rgba(255,20,50,${Math.min(.8,flash*2.2)})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
}
let world3D=null;
function draw(){
 const now=performance.now(),dt=clamp((now-pT0)/1000,0,.05);pT0=now;pT+=dt;
 cx=W*.5;hor=H*.38;hY=H*.86;ppu=Math.min(W*.072,H*.085);camX=playerX*.62;
 if(mode==='hub')travel+=dt*8;
 if(world3D)world3D.render({weather:racing&&mode!=='hub'?RLV[rcLv].wx:SV.wx|0,camView:SV.cam|0,dt,mode,travel,playerX,velocity,vehicleId:mode==='hub'?prev:SV.sel,steer:curSteer,objects:(racing&&mode!=='hub'?(RLV[rcLv].city?cityDraw:objects.concat(rivalDraw)):objects).concat(trial&&ghostObj&&mode!=='hub'?[ghostObj]:[]),cust:(mode==='hub'&&GD?{rim:GD.rim,sp:GD.sp,neon:GD.neon}:CU(mode==='hub'?prev:SV.sel)),hubShift:custOpen&&mode==='hub'?1:0,boost,braking,invincible,color:mode==='hub'?(GD?GD.paint:(SV.paint[prev]||VEH[prev].c)):V.col,model:mode==='hub'?(VEH[prev].mdl||VEH[prev].m):(V.mdl||V.model),...(racing&&mode!=='hub'?rfx():null)});
 if(racing&&mode!=='hub')rfxDraw(dt);else if(fxCv)fxG.clearRect(0,0,fxCv.width,fxCv.height);
 if(world3D&&world3D.stats)updateRainSnd(world3D.stats.rain||0);
 const name=document.getElementById('modelName');if(name){name.hidden=mode!=='hub';if(name.textContent!==VEH[prev].n.toUpperCase())name.textContent=VEH[prev].n.toUpperCase()}
 root.style.setProperty('--hit-flash',Math.max(0,flash*1.6));
}

// ================= META: save, vehicles, levels, hub =================
let GD=null;
let SV={coins:400,own:[0],sel:0,up:{},unlocked:1},V={},maxHP=100,lvl=1,selLv=1,prev=0,tab='veh',task=null,passed=0,gN=0,hits=0,lives=3,endless=false;
try{Object.assign(SV,JSON.parse(localStorage.getItem('hr3d-save')||'{}'))}catch(e){}
SV.paint=SV.paint||{};SV.pown=SV.pown||{};if(!SV.apexDefault){SV.sel=0;SV.own=Array.from(new Set([0,...SV.own]));SV.apexDefault=true;if(SV.paint[0]==='#5fe333')delete SV.paint[0]}lvl=selLv=SV.unlocked;
const saveSV=()=>{try{localStorage.setItem('hr3d-save',JSON.stringify(SV))}catch(e){}};

// ===== CONTROLS (arrows / wheel / tilt) + RACE MODE =====
SV.ctl=['arrows','wheel','tilt'].includes(SV.ctl)?SV.ctl:'arrows';SV.cam=[0,1,2,3].includes(SV.cam)?SV.cam:0;SV.wx=[0,1,2,3].includes(SV.wx)?SV.wx:0;SV.tiltSens=clamp(+SV.tiltSens||1,.6,1.6);
const RACE_LEN=4000,ord=n=>['1ST','2ND','3RD','4TH'][n-1]||n+'TH';
let racing=false,rivals=[],rivalDraw=[],finCount=0,lastPlace=4,finWarn=false,curSteer=0,wheelSteer=0,tiltOn=false,tiltRaw=0,tiltZero=0,tiltSeen=false,tiltPerm=false,steerS=0,tiltF=0,tiltWarned=false;
function applyCtl(){root.classList.remove('ctl-arrows','ctl-wheel','ctl-tilt');root.classList.add('ctl-'+SV.ctl)}
// steering wheel
const wheelEl=$('wheel');let wheelPtr=null,wheelA0=0,wheelAng=0;
const wAngle=e=>{const r=wheelEl.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI};
wheelEl.addEventListener('pointerdown',e=>{e.preventDefault();wheelPtr=e.pointerId;wheelEl.setPointerCapture(e.pointerId);wheelA0=wAngle(e)-wheelAng;wheelEl.classList.add('grab')});
wheelEl.addEventListener('pointermove',e=>{if(e.pointerId!==wheelPtr)return;let a=wAngle(e)-wheelA0;a=((a%360)+540)%360-180;wheelAng=clamp(a,-120,120);wheelEl.style.transform='rotate('+wheelAng+'deg)';const x=clamp(wheelAng/95,-1,1),ax=Math.abs(x);wheelSteer=ax<.04?0:Math.sign(x)*Math.pow((ax-.04)/.96,1.25)});
const wheelRel=e=>{if(e.pointerId!==wheelPtr)return;wheelPtr=null;wheelAng=0;wheelSteer=0;wheelEl.classList.remove('grab');wheelEl.style.transform=''};
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>wheelEl.addEventListener(ev,wheelRel));
// screen tilt: lean the phone LEFT / RIGHT and the car goes the same way (works held upright or tilted back)
let tiltOri=false;
const IOSd=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function tiltFromG(gx,gy){const o=(screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:(window.orientation||0),a=((o%360)+360)%360;
 const gr=a===90?-gy:a===270?gy:a===180?-gx:gx;tiltRaw=Math.asin(clamp(gr,-1,1))*180/Math.PI}
function onTilt(ev){if(ev.beta==null||ev.gamma==null)return;tiltSeen=true;tiltOri=true;const b=ev.beta*Math.PI/180,gm=ev.gamma*Math.PI/180;tiltFromG(Math.sin(gm)*Math.cos(b),-Math.sin(b))}
function onMotion(ev){if(tiltOri)return;const a=ev.accelerationIncludingGravity;if(!a||a.x==null||a.y==null)return;const m=Math.hypot(a.x,a.y,a.z||0)||1,k=(IOSd?1:-1)/m;tiltSeen=true;tiltFromG(a.x*k,a.y*k)}
function enableTilt(){if(!tiltOn){window.addEventListener('deviceorientation',onTilt);window.addEventListener('devicemotion',onMotion);tiltOn=true}
 try{if(!tiltPerm){const f=(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function')?DeviceOrientationEvent.requestPermission():(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function')?DeviceMotionEvent.requestPermission():null;if(f)f.then(s=>{if(s==='granted')tiltPerm=true}).catch(()=>{})}}catch(e){}}
function tiltSteerNow(dt){tiltF+=(tiltRaw-tiltF)*(1-Math.exp(-dt*26));const d=tiltF-tiltZero,full=24/(SV.tiltSens||1),dz=2.5,a=Math.abs(d);if(a<dz)return 0;return Math.sign(d)*Math.pow(Math.min(1,(a-dz)/(full-dz)),1.1)}
$('tiltInd').addEventListener('pointerdown',e=>{e.preventDefault();tiltZero=tiltRaw;tiltF=tiltRaw;toast('TILT CENTERED')});
// race mode: 3 AI rivals over RACE_LEN metres
function initRace(){finCount=0;lastPlace=4;finWarn=false;rivalDraw=[];
 rivals=[[1,'#4777f0',.99,16],[3,'#efb83f',1.02,10],[0,'#31b2aa',.96,24]].map(([l,c,k,ps],i)=>({id:++itemId,kind:'car',rival:true,x:(l-2)*2.83,z:3-ps,color:c,model:'sport',hx:1.76,hz:2.6,done:false,lane:l,tl:l,tx:(l-2)*2.83,sp0:.4,sp:.4,ph:Math.random(),lean:0,vx:0,sig:0,sigT:0,sigOff:0,cd:R(.2,.8),wv:0,bk:false,bkp:false,art:true,pax:false,plate:'RACE-'+(70+i*7),brand:'RIVAL',pos:ps,k,fin:0,bst:0,bcd:R(5,9)}))}
function updateRivals(dt,pb){
 for(const r of rivals){
  r.bcd-=dt;if(r.bst>0)r.bst-=dt;else if(r.bcd<=0){r.bst=1.5;r.bcd=R(7,12)}
  const gap=travel-r.pos,rb=1+clamp(gap/500,-.07,.1);
  r.pos+=pb*r.k*rb*(r.bst>0?1.22:1)*(r.slow?.85:1)*dt;
  if(r.pos>=RACE_LEN&&!r.fin)r.fin=++finCount;
  r.z=3-(r.pos-travel);r.ph+=pb*r.k*dt*.55;
  const dx=r.tx-r.x;if(Math.abs(dx)>.01){const mv=Math.sign(dx)*Math.min(Math.abs(dx),2.5*dt);r.x+=mv;r.vx=mv/Math.max(dt,.001)}else{r.x=r.tx;r.vx=0}
  r.lean+=(r.vx*.04-r.lean)*Math.min(1,dt*7);
  if(r.sigT>0){r.sigT-=dt;if(r.sigT<=0){r.lane=r.tl;r.tx=(r.tl-2)*2.83;r.sigOff=.6}}else if(r.sigOff>0){r.sigOff-=dt;if(r.sigOff<=0)r.sig=0}
  r.cd-=dt;
  if(r.cd<=0&&r.sigT<=0){r.cd=R(.3,.6);
   const busy=l=>{const lx=(l-2)*2.83;
    if(Math.abs(playerX-lx)<2.2&&3<r.z+9&&3>r.z-30)return true;
    if(objects.some(q=>q.kind==='car'&&!q.done&&Math.abs(q.x-lx)<2.2&&q.z<r.z+9&&q.z>r.z-30))return true;
    return rivals.some(o=>o!==r&&Math.abs(o.x-lx)<2.2&&o.z<r.z+9&&o.z>r.z-26)};
   r.slow=false;
   if(busy(r.lane)){const opts=[r.lane-1,r.lane+1].filter(l=>l>=0&&l<=4&&!busy(l));
    if(opts.length){const nl=opts[Math.floor(R(0,opts.length))];r.sig=nl>r.lane?1:-1;r.sigT=.5;r.tl=nl}else r.slow=true}}
 }
 rivalDraw=rivals.filter(r=>r.z>-300&&r.z<18)}
function endRace(place){braking=false;boost=false;mode='over';updateEngine(0,false,false);place<=3?SFX.win():SFX.lose();
 const rw=[400,250,120,0][place-1]||0;SV.coins+=coins+rw;if(!SV.raceBest||place<SV.raceBest)SV.raceBest=place;const _L=recordRun({kind:'race',place,won:place===1});saveSV();
 $('menuTag').textContent='RACE FINISHED';$('menuTitle').innerHTML=place===1?'YOU<br><em>WON!</em>':'FINISHED<br><em>'+ord(place)+'</em>';
 $('menuText').innerHTML=`Position <b>${ord(place)}</b> of 4 • Coins <b>✦${coins}</b> • Prize <b>✦${rw}</b><br>Best finish: ${ord(SV.raceBest)}`;
 $('playBtn').textContent='RACE AGAIN →';showGains(_L);$('nextBtn').style.display='none';$('overlay').classList.remove('hidden')}
// ===== RACING MODE (Asphalt-style): level cards • 6 racers • ramps • stunts • drift • perfect nitro • results =====
const RLV=[
 {n:'SUNSET SPRINT',s:'Golden-hour highway',wx:0,len:3600,diff:1,k:.975,tr:.9,rw:300,ic:'🌇',th:'day'},
 {n:'MIDNIGHT CITY',s:'Moonlit downtown run',wx:1,len:4200,diff:1,k:1.0,tr:1.0,rw:420,ic:'🌃',th:'night'},
 {n:'RAIN RUSH',s:'Slick wet asphalt',wx:2,len:4600,diff:2,k:1.03,tr:1.05,rw:560,ic:'🌧️',th:'rain'},
 {n:'SUNSET SPEEDWAY',s:'Flowing sweepers at golden hour',wx:0,len:0,diff:1,k:.975,tr:0,rw:300,ic:'🌇',th:'day',city:true,circ:1,trk:100,laps:3,vt:66},
 {n:'MIDNIGHT RING',s:'Technical night circuit',wx:1,len:0,diff:2,k:1.0,tr:0,rw:450,ic:'🌃',th:'night',city:true,circ:1,trk:101,laps:3,vt:70},
 {n:'RAIN RIDGE GP',s:'Slick asphalt, brake early',wx:2,len:0,diff:3,k:1.03,tr:0,rw:650,ic:'🌧️',th:'rain',city:true,circ:1,trk:102,laps:3,vt:73},
 {n:'STORM CIRCUIT',s:'Thunder, spray and hairpins',wx:3,len:0,diff:4,k:1.06,tr:0,rw:900,ic:'⛈️',th:'storm',city:true,circ:1,trk:103,laps:4,vt:77},
 {n:'APEX INTERNATIONAL',s:'The full Grand Prix',wx:0,len:0,diff:5,k:1.09,tr:0,rw:1400,ic:'🏆',th:'day',city:true,circ:1,trk:104,laps:5,vt:82},
 {n:'NEON STORM',s:'Rainy neon night',wx:3,len:5000,diff:2,k:1.055,tr:1.1,rw:720,ic:'⛈️',th:'storm'},
 {n:'DAWN PATROL',s:'Fast open road',wx:0,len:5400,diff:3,k:1.08,tr:1.15,rw:880,ic:'🌅',th:'day'},
 {n:'GHOST HIGHWAY',s:'Empty night, hungry rivals',wx:1,len:5800,diff:3,k:1.105,tr:1.2,rw:1050,ic:'👻',th:'night'},
 {n:'THUNDER ROAD',s:'Lightning and heavy traffic',wx:3,len:6200,diff:4,k:1.13,tr:1.27,rw:1300,ic:'⚡',th:'storm'},
 {n:'APEX GRAND PRIX',s:'The final showdown',wx:2,len:7000,diff:5,k:1.16,tr:1.35,rw:1700,ic:'🏆',th:'rain'}];
const RIV=[['Kai Storm','Quartz R','#4777f0'],['Mika Vance','Falcon GT','#efb83f'],['Rex Hunter','Viper S','#31b2aa'],['Dante Cruz','Nova X','#e11d3a'],['Zara Blaze','Comet 9','#a74edc']];
const RPRIZE=[1,.6,.4,.2,.1,.05];
const ordS=n=>n+(['th','st','nd','rd'][(n%100>10&&n%100<14)?0:(n%10<4?n%10:0)]);
const fmtRT=s=>{s=Math.max(0,+s||0);const m=Math.floor(s/60),r=s-m*60;return String(m).padStart(2,'0')+':'+r.toFixed(3).padStart(6,'0')};
SV.rc=(SV.rc&&typeof SV.rc==='object')?SV.rc:{};SV.rc.un=clamp(Math.floor(+SV.rc.un)||1,1,RLV.length);SV.rc.b=(SV.rc.b&&typeof SV.rc.b==='object')?SV.rc.b:{};
let rcLv=Math.min(SV.rc.un-1,RLV.length-1);
let rcT=0,raceCD=0,cdLast=0,raceDone=false,finT=0,finPlace=0,finTime=0,rbT=0,rhT=0,rKmh=0,rPitch=0;
let air=0,airV=0,airOn=false,airT=0,roll=0,spin=0,rolling=false,spinning=false,rollGoal=0,spinGoal=0,rollDir=1,spinDir=1,rideObj=null;
let crashT=0,camShk=0,driftOn=false,driftYaw=0,pnWin=0,pnArm=false,pnUsed=false,cleanT=0,lastBase=30;
let sNM=0,sRoll=0,sSpin=0,sHav=0,sTD=0,sPick=0,sPN=0,sAir=0,sDrift=0,sNitroM=0,sBest=0,rampT=3,propT=5,finSpawned=false,rcFeed=[],feedHtml='',lastPosN=0;
const GRAV=24;
function feedAdd(k,l,v){const t=performance.now(),e=rcFeed.find(x=>x.k===k);if(e){e.v=v;e.t=t}else{rcFeed.push({k,l,v,t});if(rcFeed.length>5)rcFeed.shift()}}
function rBanner(txt,cls,dur){const b=$('rBanner');b.className='rbn '+(cls||'');b.textContent=txt;void b.offsetWidth;b.classList.add('on');rbT=dur||1}
SFX.cd=()=>beep(660,.12,'square',.1);
SFX.go=()=>{beep(990,.3,'square',.13,1320);noiseBurst(.25,.2,500)};
SFX.nm=()=>beep(1250,.07,'sine',.08,1900);
SFX.land=()=>{noiseBurst(.22,.3,260);beep(90,.12,'sine',.12,50)};
SFX.smash=()=>{noiseBurst(.2,.3,500);beep(140,.12,'square',.1,60)};
SFX.perfect=()=>{beep(880,.08,'sine',.12,1320);setTimeout(()=>beep(1320,.14,'sine',.12,1760),70);noiseBurst(.2,.18,900)};
SFX.roll=()=>{beep(520,.1,'triangle',.1,900);setTimeout(()=>beep(780,.12,'triangle',.1,1200),80)};
function initRacing(){
 const L=RLV[rcLv];if(L.city){initCity(L);return}vel=0;thr=0;brk=0;finCount=0;lastPlace=6;rivalDraw=[];
 const lanes=[1,3,2,0,4],offs=[7,9,22,13,16],ks=[1.1,1.06,1.02,.99,.96];
 rivals=RIV.map((rv,i)=>({id:++itemId,kind:'car',rival:true,x:(lanes[i]-2)*2.83,z:3-offs[i],color:rv[2],model:'sport',hx:1.76,hz:2.6,done:false,lane:lanes[i],tl:lanes[i],tx:(lanes[i]-2)*2.83,sp0:.4,sp:.4,ph:Math.random(),lean:0,vx:0,sig:0,sigT:0,sigOff:0,cd:R(.2,.8),wv:0,bk:false,bkp:false,art:true,pax:false,plate:'RACE-'+(70+i*7),brand:rv[0].split(' ')[0].toUpperCase(),pos:offs[i],k:ks[i]*L.k*R(.985,1.015),fin:0,bst:0,bcd:R(3,7),stun:0,name:rv[0],car:rv[1],ft:0,fly:0}));
 rcT=0;raceCD=3.9;cdLast=0;raceDone=false;finT=0;finPlace=0;finTime=0;rbT=0;rhT=0;rKmh=0;rPitch=0;
 air=0;airV=0;airOn=false;airT=0;roll=0;spin=0;rolling=false;spinning=false;rideObj=null;
 crashT=0;camShk=0;driftOn=false;driftYaw=0;pnWin=0;pnArm=false;pnUsed=false;cleanT=0;
 sNM=sRoll=sSpin=sHav=sTD=sPick=sPN=0;sAir=0;sDrift=0;sNitroM=0;rampT=R(2.5,4);propT=R(4,6);finSpawned=false;rcFeed=[];feedHtml='';lastPosN=0;
 $('rBanner').className='rbn';$('raceRes').classList.add('hidden');$('rFeed').innerHTML='';
}
function racePos(){return raceDone?finPlace:1+rivals.filter(r=>r.pos>travel).length}
function launchObj(o,sgn,pw){o.fly=1;o.ft2=0;o.fy=.05;o.fvy=R(7,11)*pw;o.fvx=sgn*R(6,11)*pw;o.fvz=Math.max(10,forwardSpeed*R(.55,.8));o.frx=0;o.frz=0;o.rsx=R(-9,9);o.rsz=R(-9,9)}
function flyStep(o,dt,speed){o.fvy-=22*dt;o.fy=Math.max(0,o.fy+o.fvy*dt);if(o.fy<=0&&o.fvy<0){o.fvy=-o.fvy*.3;if(o.fvy<2)o.fvy=0}o.x+=o.fvx*dt;o.fvx*=Math.pow(.6,dt);o.z+=(speed-o.fvz)*dt;o.frx+=o.rsx*dt;o.frz+=o.rsz*dt;o.ft2+=dt}
function racePressNitro(){
 if(raceCD>0||raceDone)return;
 if(braking&&!driftOn)return;
 if(boost){if(pnArm){pnArm=false;pnUsed=true;nitro=Math.min(100,nitro+30);pnWin=2.4;sPN++;feedAdd('pn','PERFECT NITRO','');rBanner('PERFECT NITRO','pn',.9);SFX.perfect();camShk=.35}return}
 if(nitro>=22){boost=true;pnUsed=false;boostN++;SFX.boostOn()}else toast('NOT ENOUGH NITRO')}
function raceTakedown(r,sgn){raceBump(r,sgn);}
function raceBump(r,sgn){launchObj(r,sgn,.9);r.stun=2.2;}
function spawnRamp(){const L=RLV[rcLv];const free=[0,1,2,3,4].filter(l=>!objects.some(o=>(o.kind==='car'||o.kind==='ramp'||o.kind==='crate')&&!o.done&&Math.abs(o.x-(l-2)*2.83)<2.1&&o.z<-130&&o.z>-215)&&!rivals.some(r=>Math.abs(r.x-(l-2)*2.83)<2.1&&r.z<-140&&r.z>-215));
 if(!free.length)return false;const l=free[Math.floor(R(0,free.length))];objects.push({id:++itemId,kind:'ramp',x:(l-2)*2.83,z:-176,hx:1.5,hz:4,done:false,still:1});
 if(Math.random()<.6){const l2=free.filter(q=>q!==l&&Math.abs(q-l)>1);if(l2.length)objects.push({id:++itemId,kind:'ramp',x:(l2[Math.floor(R(0,l2.length))]-2)*2.83,z:-190,hx:1.5,hz:4,done:false,still:1})}
 return true}
function spawnCrates(){const l=Math.floor(R(0,5)),n=1+(Math.random()<.5?1:0)+(Math.random()<.25?1:0);for(let i=0;i<n;i++){const ln=clamp(l+i,0,4);if(objects.some(o=>(o.kind==='car'||o.kind==='ramp')&&!o.done&&Math.abs(o.x-(ln-2)*2.83)<2.1&&o.z<-130&&o.z>-205))continue;objects.push({id:++itemId,kind:'crate',x:(ln-2)*2.83,z:-172-i*2,hx:1.45,hz:1.6,done:false,still:1})}}
function spawnRaceItems(){
 const lanes=[0,1,2,3,4].filter(l=>!objects.some(o=>(o.kind==='car'||o.kind==='ramp'||o.kind==='crate')&&!o.done&&Math.abs(o.x-(l-2)*2.83)<1.4&&o.z>-195&&o.z<-115));
 const ls=lanes.length?lanes:[0,1,2,3,4],lane=ls[Math.floor(R(0,ls.length))];addCoinTrail(lane,-145,V.cn);
 if(Math.random()<.5&&ls.length>1){const o2=ls.filter(l=>l!==lane);addCoinTrail(o2[Math.floor(R(0,o2.length))],-163,7)}
 if(Math.random()<.5){const l2=Math.floor(R(0,5));objects.push({id:++itemId,kind:'nitro',x:(l2-2)*2.83,z:-156,done:false})}}
function updateRacers(dt,base,L){
 lastBase=base;
 for(const r of rivals){
  if(r.fly){flyStep(r,dt,0);r.z=3-(r.pos-travel);r.x=clamp(r.x,-5.6,5.6);if(r.ft2>1.35){r.fly=0;r.fy=void 0;r.frx=r.frz=0;r.tx=r.x;r.lane=clamp(Math.round(r.x/2.83+2),0,4);r.tl=r.lane}}
  r.bcd-=dt;if(r.bst>0)r.bst-=dt;else if(r.bcd<=0){r.bst=1.8;r.bcd=R(6,10)}
  const gap=travel-r.pos,rb=1+clamp(gap/220,-.1,.38);
  let mul=r.k*rb*(r.bst>0?1.2:1)*(r.slow?.85:1);if(r.stun>0){r.stun-=dt;mul*=.42}
  r.pos+=base*mul*dt;
  if(r.pos>=L.len&&!r.fin){r.fin=++finCount;r.ft=rcT}
  r.z=3-(r.pos-travel);r.ph+=base*r.k*dt*.55;
  if(r.fly){continue}
  const dx=r.tx-r.x;if(Math.abs(dx)>.01){const mv=Math.sign(dx)*Math.min(Math.abs(dx),2.6*dt);r.x+=mv;r.vx=mv/Math.max(dt,.001)}else{r.x=r.tx;r.vx=0}
  r.lean+=(r.vx*.04-r.lean)*Math.min(1,dt*7);
  if(r.sigT>0){r.sigT-=dt;if(r.sigT<=0){r.lane=r.tl;r.tx=(r.tl-2)*2.83;r.sigOff=.6}}else if(r.sigOff>0){r.sigOff-=dt;if(r.sigOff<=0)r.sig=0}
  r.cd-=dt;
  if(r.cd<=0&&r.sigT<=0){r.cd=R(.3,.6);
   const busy=l=>{const lx=(l-2)*2.83;
    if(Math.abs(playerX-lx)<2.2&&3<r.z+9&&3>r.z-30)return true;
    if(objects.some(q=>(q.kind==='car'||q.kind==='crate'||q.kind==='ramp')&&!q.done&&!q.fly&&Math.abs(q.x-lx)<2.2&&q.z<r.z+9&&q.z>r.z-30))return true;
    return rivals.some(o=>o!==r&&!o.fly&&Math.abs(o.x-lx)<2.2&&o.z<r.z+9&&o.z>r.z-26)};
   r.slow=false;
   if(busy(r.lane)){const opts=[r.lane-1,r.lane+1].filter(l=>l>=0&&l<=4&&!busy(l));
    if(opts.length){const nl=opts[Math.floor(R(0,opts.length))];r.sig=nl>r.lane?1:-1;r.sigT=.5;r.tl=nl}else r.slow=true}}
 }
 rivalDraw=rivals.filter(r=>r.z>-300&&r.z<18)}
function updateRace(dt){
 const L=RLV[rcLv];if(L.city){updateCity(dt);return}
 if(toastLeft>0){toastLeft-=dt;if(toastLeft<=0)$('toast').classList.remove('show')}
 flash=Math.max(0,flash-dt);camShk=Math.max(0,camShk-dt*2.2);
 if(rbT>0){rbT-=dt;if(rbT<=0)$('rBanner').classList.remove('on')}
 const rvs=1+(V.spd-1)*.45;
 // ---------- countdown
 if(raceCD>0){
  raceCD-=dt;const n=Math.ceil(raceCD);
  if(raceCD>0&&n!==cdLast&&n>=1&&n<=3){cdLast=n;rBanner(String(n),'cd',.95);SFX.cd()}
  if(raceCD<=0){rBanner('GO!','go',.9);SFX.go();boost=false;vel=0;if(gasIn()){vel=9;nitro=Math.min(100,nitro+12);toast('ROCKET START')}}
  else{vel=0;thr+=(gasIn()-thr)*(1-Math.exp(-dt*6));forwardSpeed=0;curSteer=0;updateEngine(.2+.5*thr*Math.abs(Math.sin(performance.now()/90)),false,true)}
  updateRaceHUD(dt,true);return}
 rcT+=dt;time+=dt;invincible=0;
 // ---------- steering input
 let steer=(keyRight?1:0)-(keyLeft?1:0);if(Math.abs(steerInput)>Math.abs(steer))steer=steerInput;
 const ext=SV.ctl==='wheel'?wheelSteer:SV.ctl==='tilt'?tiltSteerNow(dt):0;if(Math.abs(ext)>Math.abs(steer))steer=ext;
 if(raceDone)steer=0;
 steerS+=(steer-steerS)*(1-Math.exp(-dt*(Math.abs(steer)>=Math.abs(steerS)?13:17)));if(Math.abs(steerS)<.002)steerS=0;curSteer=steerS;
 const drifting=!raceDone&&!airOn&&braking&&Math.abs(steerS)>.3&&forwardSpeed>18;driftOn=drifting;
 const maxV=8.6*V.hnd*(drifting?1.3:1)*(airOn?.4:1),tgt=steerS*maxV;
 velocity+=(tgt-velocity)*(1-Math.exp(-dt*(Math.abs(tgt)>=Math.abs(velocity)?8.5:10)));
 velocity=clamp(velocity,-maxV,maxV);playerX=clamp(playerX+velocity*dt,-5.55,5.55);
 if(Math.abs(playerX)>=5.55){velocity*=.3;playerX=clamp(playerX,-5.55,5.55)}
 // ---------- speed
 const base=(30+rcLv*1.2+Math.min(20,rcT*.3))*rvs;
 if(crashT>0)crashT-=dt;
 thr+=((raceDone?0:gasIn())-thr)*(1-Math.exp(-dt*(gasIn()?4.5:9)));
 brk+=((braking&&!raceDone?1:0)-brk)*(1-Math.exp(-dt*12));
 if(braking&&!drifting)boost=false;
 if(pnWin>0)pnWin-=dt;
 const T0=base*1.18+(boost?(pnWin>0?44:30):0);
 const aE=thr*(boost?36:22)*Math.pow(Math.max(0,1-vel/T0),.8),aD=.0016*vel*vel+.45+(thr<.05&&!raceDone?2.2:0)+(raceDone?5:0),aB=brk*(drifting?12:44);
 vel=Math.max(0,vel+(aE-aD-aB)*dt);if(vel>T0)vel=Math.max(T0,vel-30*dt);
 const speed=vel;forwardSpeed=speed;travel+=speed*dt;
 runWx[SV.wx|0]+=speed*dt*.75;distance+=speed*dt*.75;
 if(boost){nitro=Math.max(0,nitro-17*dt);sNitroM+=speed*dt;feedAdd('nit','METERS ON NITRO',sNitroM.toFixed(2)+' m');if(nitro<=0){boost=false;pnArm=false}}
 else if(!raceDone)nitro=Math.min(100,nitro+1.8*dt);
 pnArm=boost&&!pnUsed&&nitro<=48&&nitro>=28&&!raceDone;
 // ---------- drift
 if(drifting){const m=speed*dt;sDrift+=m;nitro=Math.min(100,nitro+m*.05);feedAdd('drift','METERS DRIFTED',sDrift.toFixed(2)+' m');if(Math.random()<.03)SFX.pass()}
 const fdT=raceDone?(playerX>=0?1:-1)*.8:(drifting?clamp(steerS,-1,1)*.55:0);
 driftYaw+=(fdT-driftYaw)*(1-Math.exp(-dt*(raceDone?3:9)));
 // ---------- ramps / air
 let rd=null;
 if(!airOn)for(const o of objects){if(o.kind!=='ramp'||o.done)continue;const t=(o.z+1)/8;if(t>0&&t<1&&Math.abs(o.x-playerX)<1.55)rd=o}
 if(rd){rideObj=rd;air=1.4*((rd.z+1)/8);rPitch=.17}
 else if(rideObj&&!airOn){
  if(rideObj.z+1>=8-1e-6){airOn=true;airT=0;airV=Math.max(10,speed*.1786*1.6+(boost?3:0));roll=0;spin=0;rolling=false;spinning=false;SFX.boostOn()}else{air=0;rPitch=0}
  rideObj=null}
 if(airOn){
  airT+=dt;air+=airV*dt;airV-=GRAV*dt;rPitch=clamp(Math.atan2(airV,Math.max(20,speed)*.8),-.5,.5);
  if(!rolling&&Math.abs(steerS)>.65&&airT>.1){rolling=true;rollDir=Math.sign(steerS);rollGoal=roll+rollDir*Math.PI*2}
  if(!spinning&&braking&&airT>.1){spinning=true;spinDir=steerS>=0?1:-1;spinGoal=spin+spinDir*Math.PI*2}
  if(rolling){roll+=rollDir*(Math.PI*2/.68)*dt;if((roll-rollGoal)*rollDir>=0){roll=rollGoal;rolling=false;sRoll++;nitro=Math.min(100,nitro+9);feedAdd('roll','BARREL ROLL','x'+sRoll);SFX.roll()}}
  if(spinning){spin+=spinDir*(Math.PI*2/.8)*dt;if((spin-spinGoal)*spinDir>=0){spin=spinGoal;spinning=false;sSpin++;nitro=Math.min(100,nitro+7);feedAdd('spin','FLAT SPIN','x'+sSpin);SFX.roll()}}
  feedAdd('air','AIR TIME',airT.toFixed(2)+' s');
  if(air<=0&&airV<0){
   air=0;airOn=false;sAir+=airT;nitro=Math.min(100,nitro+airT*6);
   if(rolling||spinning){crashT=.8;camShk=1.1;flash=.2;toast('ROUGH LANDING');SFX.hit();cleanT=0;vel*=.7}else{camShk=Math.max(camShk,.55);SFX.land()}
   roll=0;spin=0;rolling=false;spinning=false;rPitch=0}}
 else if(!rd){air=0;rPitch*=.8}
 // ---------- objects
 if(vel>3&&!raceDone){spawnT-=dt;coinT-=dt;rampT-=dt;propT-=dt}
 const remain=L.len-travel;
 if(spawnT<=0&&remain>150){spawn();spawnT=Math.max(.36,(1.45-rcT*.004)/L.tr)}
 if(coinT<=0&&remain>150){spawnRaceItems();coinT=R(.85,1.15)}
 if(rampT<=0){if(remain>300){if(spawnRamp())rampT=R(7,11)/(1+L.diff*.08);else rampT=1}else rampT=99}
 if(propT<=0){if(remain>220)spawnCrates();propT=R(3,6)/L.tr}
 if(!finSpawned&&remain<=215){finSpawned=true;objects.push({id:++itemId,kind:'finish',x:0,z:3-remain,done:false,still:1})}
 for(const o of objects){
  if(o.fly){flyStep(o,dt,speed);if(o.ft2>2.2)o.done=true;continue}
  if(o.kind==='car'&&!o.done)npcAI(o,dt,base);
  o.z+=(o.kind==='car'?speed-o.sp*base:speed)*dt;if(o.done)continue;
  if(o.kind==='car'&&o.z>5&&!o.ps){o.ps=1;passed++}
  if(o.kind==='finish'||o.kind==='ramp')continue;
  const dz=Math.abs(o.z-3),dx=Math.abs(o.x-playerX),hxx=o.hx?o.hx+V.ax:1.35+(o.kind==='coin'?V.mg:0),hzz=o.hz||2;
  if(o.kind==='car'&&!o.nmc&&dz<hzz+.3&&air<.5){o.nmc=1;if(dx>=hxx&&dx<hxx+1.15&&!raceDone){sNM++;nitro=Math.min(100,nitro+4);feedAdd('nm','NEAR MISS','x'+sNM);SFX.nm()}}
  if(dz<hzz&&dx<hxx){
   if(o.kind==='coin'){o.done=true;coins++;distance+=8;SFX.coin();continue}
   if(o.kind==='nitro'){o.done=true;nitro=Math.min(100,nitro+V.nit);sPick++;feedAdd('pk','NITRO PICK-UP','x'+sPick);SFX.nitro();continue}
   if(o.kind==='heal'||o.kind==='bomb'){o.done=true;continue}
   if((o.kind==='car'||o.kind==='crate')&&air<1.0&&!raceDone){
    const sg=o.x>=playerX?1:-1;
    if(boost){sHav++;nitro=Math.min(100,nitro+3);feedAdd('hav','CITY HAVOC','x'+sHav);launchObj(o,sg,1.15);SFX.smash();camShk=Math.max(camShk,.7)}
    else{crashT=.6;camShk=1;flash=.22;cleanT=0;nitro=Math.max(0,nitro-6);vel*=.55;launchObj(o,sg,.8);SFX.hit();velocity+=-sg*3.5;toast('CRASH!')}}
  }}
 objects=objects.filter(o=>!o.done&&o.z<18&&o.z>-310);
 // ---------- rivals
 updateRacers(dt,base,L);
 for(const r of rivals){if(r.fly||air>1.0||raceDone)continue;
  if(Math.abs(r.z-3)<2.5&&Math.abs(r.x-playerX)<1.75){const sg=r.x>=playerX?1:-1;
   if(boost){sTD++;nitro=Math.min(100,nitro+8);feedAdd('td','TAKEDOWN','x'+sTD);SFX.smash();camShk=Math.max(camShk,.7);raceTakedown(r,sg)}
   else{crashT=.45;camShk=.8;flash=.15;cleanT=0;vel*=.8;velocity+=-sg*3.5;SFX.hit();r.stun=.9}}}
 // ---------- perfect run bonus
 if(!raceDone){cleanT+=dt;if(cleanT>=22){cleanT=0;feedAdd('prun','PERFECT RUN','');nitro=Math.min(100,nitro+10)}}
 // ---------- finish
 if(!raceDone&&travel>=L.len){
  raceDone=true;finPlace=++finCount;finTime=rcT;finT=0;boost=false;pnArm=false;
  rBanner(ordS(finPlace),'fin',3.2);finPlace<=3?SFX.win():SFX.lose();toast('🏁 FINISH')}
 if(raceDone){finT+=dt;if(finT>3.5){showRaceResult();return}}
 updateRaceHUD(dt,false);
 const spdN=clamp(speed/80,0,1.4);updateEngine(spdN+(boost?.3:0),boost,true)}
function updateRaceHUD(dt,cd){
 rhT+=dt;if(rhT<.04)return;rhT=0;const L=RLV[rcLv];
 const tk=forwardSpeed*(L.circ?3.6:5.6);rKmh+=(tk-rKmh)*.35;
 const pos=racePos();if(pos!==lastPosN){if(lastPosN&&pos<lastPosN&&!raceDone)$('rPosN').classList.add('up');setTimeout(()=>$('rPosN').classList.remove('up'),500);lastPosN=pos}
 $('rPosN').textContent=pos;$('rPosT').textContent='/6 POS.';
 $('rSpd').textContent=Math.round(rKmh);$('rSpdClip').setAttribute('width',Math.round(clamp(rKmh/(L.circ?420:560),.03,1)*360));{const ge=$('rGear');if(ge){ge.style.display=L.circ?'':'none';if(L.circ){const rv=forwardSpeed<1&&brk>.5&&thr<.05;ge.textContent=rv?'R':(forwardSpeed<.6&&thr<.05?'N':cpGear);ge.classList.toggle('hot',cpRpm>cpParams().red*.93)}}}
 $('rTime').textContent=fmtRT(raceDone?finTime:rcT);
 $('rLapC').textContent=L.city?lapNow:1;$('rLapT').textContent=L.city?lapTot:1;
 if(L.city)cityHud();else{$('rTurn').style.display='none';$('rMap').style.display='none'}
 $('rFin').textContent=raceDone?'FINISHED':Math.max(0,Math.ceil(L.len-travel))+' m TO FINISH';
 $('rNit').style.height=clamp(nitro,0,100)+'%';$('rNitBox').classList.toggle('on',boost);$('rNitBox').classList.toggle('full',nitro>=99);
 $('nitroBtn').classList.toggle('ready',nitro>=22&&!boost);$('nitroBtn').classList.toggle('perfect',pnArm);$('brakeBtn').classList.toggle('active',braking);
 const now=performance.now();rcFeed=rcFeed.filter(e=>now-e.t<2600);
 const h=rcFeed.slice().reverse().map(e=>`<div class="rf"><span>${e.l}</span>${e.v?`<b>${e.v}</b>`:''}</div>`).join('');
 if(h!==feedHtml){feedHtml=h;$('rFeed').innerHTML=h}
 rivalTags()}
// project a world point to screen pixels using the 3D camera
function projW(wx,wy,wz){const c=world3D&&world3D.camera;if(!c)return null;const e=c.matrixWorldInverse.elements,p=c.projectionMatrix.elements;
 const x=e[0]*wx+e[4]*wy+e[8]*wz+e[12],y=e[1]*wx+e[5]*wy+e[9]*wz+e[13],z=e[2]*wx+e[6]*wy+e[10]*wz+e[14],w=e[3]*wx+e[7]*wy+e[11]*wz+e[15];
 const X=p[0]*x+p[4]*y+p[8]*z+p[12]*w,Y=p[1]*x+p[5]*y+p[9]*z+p[13]*w,Wc=p[3]*x+p[7]*y+p[11]*z+p[15]*w;if(Wc<=.1)return null;return[(X/Wc*.5+.5)*W,(1-(Y/Wc*.5+.5))*H]}
function rivalTags(){const box=$('rTags');if(!box)return;const city=RLV[rcLv].city,cand=city?rivals.filter(r=>!raceDone&&Math.hypot(r.wx-pcx,r.wz-pcz)<150).sort((a,b)=>Math.hypot(a.wx-pcx,a.wz-pcz)-Math.hypot(b.wx-pcx,b.wz-pcz)).slice(0,2):rivals.filter(r=>r.z<-6&&r.z>-130&&!raceDone).sort((a,b)=>b.z-a.z).slice(0,2);
 while(box.children.length<2)box.appendChild(document.createElement('div'));
 for(let i=0;i<2;i++){const el=box.children[i],r=cand[i];if(!r){el.style.display='none';continue}
  const p=city?projW(r.wx,2.9+(r.fy||0),r.wz):projW(world3D.offset(r.z)+r.x,2.6+(r.fy||0),r.z);if(!p){el.style.display='none';continue}
  const rk=rivals.filter(q=>q.pos>r.pos).length+(travel>r.pos?2:1);
  el.className='rtag';el.style.display='block';el.style.left=p[0].toFixed(0)+'px';el.style.top=p[1].toFixed(0)+'px';el.innerHTML=`<b>${rk}</b><small>${r.name}</small>`}}
// ---------- screen FX (radial speed streaks + nitro glow)
let fxCv=null,fxG=null,fxS=[],fxLast=0;
function rfxDraw(dt){
 if(!fxCv){fxCv=document.createElement('canvas');fxCv.className='fx-cv';root.insertBefore(fxCv,$('rHud'));fxG=fxCv.getContext('2d');for(let i=0;i<54;i++)fxS.push({a:Math.random()*6.2832,r:Math.random(),v:R(.5,1.3),w:R(1,2.6)})}
 const w=Math.round(W/2),h=Math.round(H/2);if(fxCv.width!==w||fxCv.height!==h){fxCv.width=w;fxCv.height=h}
 const g=fxG;g.clearRect(0,0,w,h);
 if(!(mode==='run'&&raceCD<=0))return;
 const sp=clamp(forwardSpeed/85,0,1.3),it=(boost?1:0)+(pnWin>0?.35:0),k=sp*.3+it*.7;if(k<.05)return;
 const cx2=w*.5,cy2=h*.42,D=Math.hypot(w,h)*.62;
 g.lineCap='round';
 for(const s of fxS){s.r+=dt*s.v*(.35+k*1.9);if(s.r>1){s.r=.1+Math.random()*.15;s.a=Math.random()*6.2832;s.v=R(.5,1.3)}
  const r0=s.r*s.r*D,r1=Math.min(D*1.1,r0+D*(.05+.22*k)*s.r),ca=Math.cos(s.a),sa=Math.sin(s.a);
  if(Math.abs(ca)<.25&&sa>0&&false)continue;
  g.strokeStyle=`rgba(${it>.2?'190,215,255':'255,255,255'},${(.08+.5*k)*Math.min(1,s.r*1.6)})`;g.lineWidth=s.w*(.7+s.r);
  g.beginPath();g.moveTo(cx2+ca*r0,cy2+sa*r0*.8);g.lineTo(cx2+ca*r1,cy2+sa*r1*.8);g.stroke()}
 if(it>.05){const gr=g.createRadialGradient(cx2,cy2,Math.min(w,h)*.3,cx2,cy2,Math.hypot(w,h)*.62);gr.addColorStop(0,'rgba(60,120,255,0)');gr.addColorStop(1,`rgba(70,110,255,${.28*Math.min(1,it)})`);g.fillStyle=gr;g.fillRect(0,0,w,h)}}
function rfx(){const sp=clamp(forwardSpeed/90,0,1.2);const o={pitch:rPitch,roll,spin,drift:-driftYaw,air,flameK:boost?(pnWin>0?2.6:2):0,fovAdd:(boost?9:0)+sp*6+(pnWin>0?5:0),cshake:camShk*.4+(boost?.05:0)+(crashT>0?.2:0),camRoll:-steerS*.018*sp+(airOn?-roll*.08:0),zoom:boost?1.2:0};
 if(RLV[rcLv].city){o.city=true;o.cx=pcx;o.cz=pcz;o.cry=pry;o.camYaw=camYaw;o.cityTrack=NC.tk;o.roll=airOn?roll:rRollG;o.drift=0;o.travel=travel;o.skid=RLV[rcLv].circ?cpSkid:0;o.surf=cpSurf;o.circ=RLV[rcLv].circ?1:0}
 return o}
// ---------- results screen
function showRaceResult(){
 mode='over';boost=false;braking=false;updateEngine(0,false,false);
 const L=RLV[rcLv],place=finPlace,rows=[{n:SV.pname||'PLAYER',c:VEH[SV.sel].n,t:finTime,o:place,me:true}];
 let nxt=finCount;const un=rivals.filter(r=>!r.fin).sort((a,b)=>b.pos-a.pos);
 for(const r of rivals)if(r.fin)rows.push({n:r.name,c:r.car,t:r.ft,o:r.fin});
 for(const r of un)rows.push({n:r.name,c:r.car,t:rcT+Math.max(.2,(L.len-r.pos)/Math.max(20,lastBase*r.k)),o:++nxt});
 rows.sort((a,b)=>a.o-b.o);
 const prize=Math.round(L.rw*(RPRIZE[place-1]||.05)),stunt=sNM*5+sRoll*25+sSpin*20+sHav*12+sTD*40+Math.floor(sAir*30)+Math.floor(sDrift/10)+sPN*30,total=coins+prize+stunt;
 SV.coins+=total;if(!SV.raceBest||place<SV.raceBest)SV.raceBest=place;
 let unlockMsg='';if(place<=3){if(L.city){if(rcLv+1<RLV.length&&SV.rc.cun<rcLv-NC0+2){SV.rc.cun=rcLv-NC0+2;unlockMsg='NEW LEVEL UNLOCKED: '+RLV[rcLv+1].n}}else if(rcLv+1<NC0&&SV.rc.un<rcLv+2){SV.rc.un=rcLv+2;unlockMsg='NEW LEVEL UNLOCKED: '+RLV[rcLv+1].n}}
 const b=SV.rc.b[rcLv];if(!b||place<b.p||(place===b.p&&finTime<b.t))SV.rc.b[rcLv]={p:place,t:+finTime.toFixed(3)};
 const _L=recordRun({kind:'race',place,won:place===1});saveSV();
 root.classList.remove('racing-ui');
 const win=place===1,leadT=rows[0].t;
 $('rResMain').innerHTML=`<div class="rr-view rr-win"><div class="rr-badge${place>3?' lo':''}"><small>${win?'WINNER':'FINISHED'}</small><b>${place}</b></div>
  <div class="rr-car"><b>${VEH[SV.sel].n}</b><span>${L.n} • ${fmtRT(finTime)}</span></div>
  <div class="rr-stats"><div><small>PRIZE</small><b>✦ ${prize}</b></div><div><small>COINS</small><b>✦ ${coins}</b></div><div><small>STUNT BONUS</small><b>✦ ${stunt}</b></div><div class="tot"><small>TOTAL</small><b>✦ ${total}</b></div></div>
  <div class="rr-line">NEAR MISS <b>${sNM}</b> • AIR TIME <b>${sAir.toFixed(1)} s</b> • BARREL ROLL <b>${sRoll}</b> • FLAT SPIN <b>${sSpin}</b> • CITY HAVOC <b>${sHav}</b> • DRIFTED <b>${Math.round(sDrift)} m</b> • NITRO <b>${Math.round(sNitroM)} m</b></div>
  ${unlockMsg?`<div class="rr-unlock">🔓 ${unlockMsg}</div>`:''}</div>
  <div class="rr-view rr-board hidden"><div class="rr-bt">LEADERBOARD • ${L.n}</div>${rows.map(r=>`<div class="rr-row${r.me?' me':''}"><i>${r.o}</i><span>${r.n}</span><em>${r.c}</em><b>${r.o===1?fmtRT(r.t):'+'+(r.t-leadT).toFixed(3)}</b></div>`).join('')}</div>`;
 const canNext=place<=3&&rcLv+1<RLV.length&&(L.city||rcLv+1<NC0);$('rrNext').textContent=canNext?'NEXT':'RETRY';$('rrNext').dataset.go=canNext?'next':'retry';$('rrBoard').textContent='LEADERBOARD';
 $('raceRes').classList.remove('hidden')}
// ---------- level cards
function renderRaceCards(){const el=$('raceCards');if(!el)return;
 if(!!RLV[rcLv].city!==!!rcTab){rcLv=rcTab?NC0:Math.min(SV.rc.un-1,NC0-1)}
 document.querySelectorAll('#rcTabs button').forEach(b=>b.classList.toggle('on',+b.dataset.t===rcTab));
 const base=rcTab?NC0:0,end=rcTab?RLV.length:NC0;
 el.innerHTML=RLV.map((l,i)=>{if(i<base||i>=end)return'';const lock=!rcUnl(i),b=SV.rc.b[i],num=i-base+1;
  return`<div class="rc ${l.th}${i===rcLv?' sel':''}${lock?' lock':''}" data-rc="${i}"><div class="rc-top"><i>${String(num).padStart(2,'0')}</i><span>${l.ic}</span></div><h4>${l.n}</h4><p>${l.s}</p>
  <div class="rc-st"><div><small>${l.city?'LAPS':'DISTANCE'}</small><b>${l.city?l.laps+' × '+(ncTrack(l.trk).Lp/1000).toFixed(2)+' km':(l.len/1000).toFixed(1)+' km'}</b></div><div><small>RACERS</small><b>6</b></div></div>
  <div class="rc-df"><small>DIFFICULTY</small><u>${'★'.repeat(l.diff)}<s>${'★'.repeat(5-l.diff)}</s></u></div>
  <div class="rc-rw">1st prize <b>✦ ${l.rw}</b></div>
  <div class="rc-bst">${b?`BEST <b>${ordS(b.p)}</b> • ${fmtRT(b.t)}`:(lock?'':'NOT RACED YET')}</div>
  ${lock?'<div class="rc-lock"><b>🔒</b><span>Finish top 3 in<br>level '+(num-1)+' to unlock</span></div>':''}${i===rcLv&&!lock?'<em class="rc-tag">SELECTED</em>':''}</div>`}).join('');
 const sel=el.querySelector('.rc.sel');if(sel){setTimeout(()=>sel.scrollIntoView({inline:'center',block:'nearest'}),30)}
 $('mapInfo').innerHTML=''}
function cityHud(){
 const T=NC,mp=$('rMap'),el=$('rTurn');mp.style.display='block';
 const v=Math.hypot(pvx,pvz),s0=T.s[ncIdxP],cc=!!RLV[rcLv].circ;let found=-1,fd=0;
 for(let d=0;d<=(cc?420:320);d+=8){const i=ncIdx(T,s0+d);if(Math.abs(T.ks[i])>(cc?.0085:.02)){found=i;fd=d;break}}
 if(found<0||raceDone)el.style.display='none';
 else{const vc=T.vp[(found+8)%T.N],need=(v*v-vc*vc)/(2*(cc?24:30)),warn=v>vc*(cc?1.06:1.12)&&fd<need*1.15+(cc?30:18),left=T.ks[found]>0;
  el.style.display='flex';el.className='r-turn'+(warn?' warn':'');el.innerHTML=`<i>${left?'⬅':'➡'}</i><b>${Math.max(0,Math.round(fd))} m</b>${warn?'<em>BRAKE</em>':''}`}
 const g=mp.getContext('2d'),m=NC.mm;g.clearRect(0,0,140,140);if(rMapBase)g.drawImage(rMapBase,0,0);
 const dot=(x,z,c,r)=>{g.fillStyle=c;g.beginPath();g.arc(x*m.sc+m.ox,z*m.sc+m.oz,r,0,6.2832);g.fill()};
 for(const r of rivals)dot(r.wx,r.wz,r.color,3.2);
 const X=pcx*m.sc+m.ox,Y=pcz*m.sc+m.oz,fx=-Math.sin(pry),fz=-Math.cos(pry);g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=1.5;g.beginPath();g.moveTo(X+fx*8,Y+fz*8);g.lineTo(X-fx*4-fz*5,Y-fz*4+fx*5);g.lineTo(X-fx*4+fz*5,Y-fz*4-fx*5);g.closePath();g.fill();g.stroke()}
function initRacingUI(){
 document.querySelectorAll('#rcTabs button').forEach(b=>b.addEventListener('click',()=>{resumeAudio();SFX.click();rcTab=+b.dataset.t;renderRaceCards()}));
 $('raceCards').addEventListener('click',e=>{const c=e.target.closest('[data-rc]');if(!c)return;resumeAudio();SFX.click();const i=+c.dataset.rc;if(rcUnl(i)){rcLv=i;renderRaceCards()}else{c.classList.add('shake');setTimeout(()=>c.classList.remove('shake'),400)}});
 $('rrBoard').onclick=()=>{const v=document.querySelectorAll('#rResMain .rr-view');const showB=v[1].classList.contains('hidden');v[0].classList.toggle('hidden',showB);v[1].classList.toggle('hidden',!showB);$('rrBoard').textContent=showB?'RESULT':'LEADERBOARD';SFX.click()};
 $('rrRetry').onclick=()=>{$('raceRes').classList.add('hidden');if(SV.ctl==='tilt')enableTilt();start()};
 $('rrNext').onclick=()=>{$('raceRes').classList.add('hidden');if($('rrNext').dataset.go==='next')rcLv=Math.min(RLV.length-1,rcLv+1);if(SV.ctl==='tilt')enableTilt();start()};
 $('rrMenu').onclick=()=>{$('raceRes').classList.add('hidden');openHub();showView('map')};
 window.__rcDbg={snap:()=>({pcx:Math.round(pcx),pcz:Math.round(pcz),pry:+pry.toFixed(2),sp:Math.round(Math.hypot(pvx,pvz)),lap:lapNow,travel:Math.round(travel),rcLv,rcT,raceCD,raceDone,finPlace,air,airOn,sNM,sRoll,sSpin,sHav,sTD,sPick,sDrift,sNitroM,nitro,boost,travel,pos:racePos(),kmh:Math.round(rKmh),ramps:objects.filter(o=>o.kind==='ramp').length,crates:objects.filter(o=>o.kind==='crate').length,mode,rivals:rivals.map(r=>Math.round(r.pos))}),
  ramp:()=>{objects.push({id:++itemId,kind:'ramp',x:(Math.round(playerX/2.83))*2.83,z:-90,hx:1.5,hz:4,done:false,still:1})},
  set:(k,v)=>{({nitro:()=>nitro=v,travel:()=>travel=v,boost:()=>boost=v,cd:()=>raceCD=v,x:()=>playerX=v,gas:()=>{gasKey=!!v},steer:()=>{keyLeft=v<0;keyRight=v>0;steerInput=v},brake:()=>braking=!!v})[k]()},
  bot:(n,dt)=>{for(let k=0;k<n&&mode==='run';k++){const T=NC,v=Math.hypot(pvx,pvz),la=10+v*.3,a=ncAt(T,T.s[ncIdxP]+la),want=Math.atan2(-(a.x-pcx),-(a.z-pcz)),e=angD(want,pry);steerInput=clamp(-e*2.2,-1,1);keyLeft=false;keyRight=false;const vt=T.vp[ncIdx(T,T.s[ncIdxP]+v*1.1+10)]*1.08+3;gasKey=v<vt;braking=v>vt+7;if(nitro>60&&!boost&&v>25&&Math.abs(steerInput)<.1)racePressNitro();update(dt)}},
  step:(n,dt)=>{for(let i=0;i<n;i++)update(dt)},pause:()=>{mode='pause'},resume:()=>{mode='run'},press:()=>racePressNitro()}}
let gasKey=false,gasBtn=false,thr=0,brk=0,vel=0;const gasIn=()=>(gasKey||gasBtn)?1:0;
// ===== NEON CITY CIRCUIT: free steering, real corners, gas / brake / nitro =====
const NC_S=1.5,NC_HW=10*NC_S,NC_R=1.3,NC_G=i=>(i-1)*70*NC_S,NC_RHO=26;
const NC_ROUTES=[
 [[0,0],[1,0],[2,0],[2,1],[2,2],[1,2],[0,2],[0,1]],
 [[0,0],[1,0],[2,0],[2,1],[1,1],[1,2],[0,2],[0,1]],
 [[0,0],[0,1],[0,2],[1,2],[1,1],[2,1],[2,0],[1,0]],
 [[0,0],[1,0],[1,1],[2,1],[2,2],[1,2],[0,2],[0,1]]];
const NC_TK={};
const angD=(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
function ncTrack(ti){
 if(NC_TK[ti])return NC_TK[ti];
 if(ti>=100)return circTrack(ti);
 const nd=NC_ROUTES[ti],P=nd.map(([i,j])=>[NC_G(i),-NC_G(j)]),n=P.length,seq=[];
 const dir=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);return[dx/l,dz/l]};
 for(let k=0;k<n;k++){const A=P[(k+n-1)%n],B=P[k],Cn=P[(k+1)%n],d1=dir(A,B),d2=dir(B,Cn),cr=d1[0]*d2[1]-d1[1]*d2[0];
  if(Math.abs(cr)>.5){const T1=[B[0]-d1[0]*NC_RHO,B[1]-d1[1]*NC_RHO],T2=[B[0]+d2[0]*NC_RHO,B[1]+d2[1]*NC_RHO],c=[T1[0]+d2[0]*NC_RHO,T1[1]+d2[1]*NC_RHO];
   seq.push({p:T1},{arc:{c,a0:Math.atan2(T1[1]-c[1],T1[0]-c[0]),da:cr>0?Math.PI/2:-Math.PI/2}},{p:T2})}
  else seq.push({p:B})}
 let pts=[],last=seq[seq.length-1].p;
 const line=(a,b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.05)return;const m=Math.max(1,Math.round(l/2.5));for(let i=0;i<m;i++)pts.push([a[0]+(b[0]-a[0])*i/m,a[1]+(b[1]-a[1])*i/m])};
 for(const it of seq){
  if(it.p){line(last,it.p);last=it.p}
  else{const a=it.arc,m=Math.ceil(Math.abs(a.da)*NC_RHO/2.5);for(let i=0;i<m;i++){const t=a.a0+a.da*i/m;pts.push([a.c[0]+Math.cos(t)*NC_RHO,a.c[1]+Math.sin(t)*NC_RHO])}
   const te=a.a0+a.da;last=[a.c[0]+Math.cos(te)*NC_RHO,a.c[1]+Math.sin(te)*NC_RHO]}}
 // start line = middle of the first straight
 const M=[(P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2];let bi=0,bd=1e9;pts.forEach((q,i)=>{const d=Math.hypot(q[0]-M[0],q[1]-M[1]);if(d<bd){bd=d;bi=i}});
 pts=pts.slice(bi).concat(pts.slice(0,bi));
 const N=pts.length,x=new Float32Array(N),z=new Float32Array(N),s=new Float32Array(N+1),ry=new Float32Array(N),ks=new Float32Array(N),vp=new Float32Array(N);
 for(let i=0;i<N;i++){x[i]=pts[i][0];z[i]=pts[i][1]}
 for(let i=0;i<N;i++){const j=(i+1)%N,dx=x[j]-x[i],dz=z[j]-z[i],l=Math.hypot(dx,dz)||1;s[i+1]=s[i]+l;ry[i]=Math.atan2(-dx/l,-dz/l)}
 const Lp=s[N];
 for(let i=0;i<N;i++){const a=(i+3)%N,b=(i-3+N)%N;let ds=s[a]-s[b];if(ds<=0)ds+=Lp;ks[i]=angD(ry[a],ry[b])/ds;vp[i]=Math.min(70,Math.sqrt(21/Math.max(Math.abs(ks[i]),1e-4)))}
 for(let it=0;it<3;it++)for(let i=N-1;i>=0;i--){const j=(i+1)%N,ds=s[i+1]-s[i];vp[i]=Math.min(vp[i],Math.sqrt(vp[j]*vp[j]+2*26*ds))}
 // drivable rectangles + visible barriers
 const H=NC_HW-NC_R,rects=[],edges=[],blocks=[];
 for(let k=0;k<n;k++){const A=P[k],B=P[(k+1)%n];rects.push({x0:Math.min(A[0],B[0])-H,x1:Math.max(A[0],B[0])+H,z0:Math.min(A[1],B[1])-H,z1:Math.max(A[1],B[1])+H});edges.push([A[0],A[1],B[0],B[1]])}
 for(let k=0;k<n;k++){const A=P[(k+n-1)%n],B=P[k],Cn=P[(k+1)%n],used=[dir(B,A),dir(B,Cn)];
  for(const d of[[1,0],[-1,0],[0,1],[0,-1]])if(!used.some(u=>Math.abs(u[0]-d[0])<.01&&Math.abs(u[1]-d[1])<.01))blocks.push([B[0],B[1],d[0],d[1]])}
 // mini-map outline
 let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(let i=0;i<N;i++){mnx=Math.min(mnx,x[i]);mxx=Math.max(mxx,x[i]);mnz=Math.min(mnz,z[i]);mxz=Math.max(mxz,z[i])}
 return NC_TK[ti]={N,x,z,s,ry,ks,vp,Lp,rects,tk:{key:'t'+ti,hw:NC_HW,edges,blocks},bb:[mnx,mxx,mnz,mxz]}}
function ncIdx(T,S){S=((S%T.Lp)+T.Lp)%T.Lp;let lo=0,hi=T.N-1;while(lo<hi){const m=(lo+hi+1)>>1;if(T.s[m]<=S)lo=m;else hi=m-1}return lo}
function ncAt(T,S){const i=ncIdx(T,S),j=(i+1)%T.N,Sm=((S%T.Lp)+T.Lp)%T.Lp,l=T.s[i+1]-T.s[i]||1,t=clamp((Sm-T.s[i])/l,0,1);
 return{x:T.x[i]+(T.x[j]-T.x[i])*t,z:T.z[i]+(T.z[j]-T.z[i])*t,ry:T.ry[i]+angD(T.ry[j],T.ry[i])*t,i}}
function ncClamp(T,px,pz){let best=1e18,bx=0,bz=0;
 for(const r of T.rects){const qx=clamp(px,r.x0,r.x1),qz=clamp(pz,r.z0,r.z1),d=(px-qx)*(px-qx)+(pz-qz)*(pz-qz);if(d===0)return null;if(d<best){best=d;bx=qx;bz=qz}}
 const l=Math.sqrt(best)||1;return{x:bx,z:bz,nx:(px-bx)/l,nz:(pz-bz)/l,pen:l}}
// ---- state
let NC=null,pcx=0,pcz=0,pry=0,pvx=0,pvz=0,camYaw=0,ncIdxP=0,ncLastS=0,lapNow=1,lapTot=1,wrongT=0,stuckT=0,stuckD=0,cityDraw=[],rRollG=0,ncSlip=0,rMapBase=null,rTurnTxt='',ncSpawnLap=0;
let lapStartT=0,bestLapT=0;
const CIRC_PTS={100:[[0,0],[260,0],[520,-10],[700,-110],[750,-290],[650,-430],[470,-450],[370,-360],[270,-410],[170,-530],[-10,-560],[-190,-480],[-270,-330],[-210,-160],[-90,-50]],101:[[0,0],[300,0],[560,-20],[740,-130],[780,-330],[640,-470],[430,-430],[380,-300],[250,-260],[150,-360],[160,-520],[20,-610],[-180,-560],[-300,-400],[-260,-200],[-130,-80]],102:[[0,0],[320,0],[620,-40],[820,-170],[860,-390],[740,-560],[520,-560],[420,-450],[300,-470],[250,-610],[80,-690],[-140,-640],[-300,-500],[-350,-300],[-250,-130],[-100,-40]],103:[[0,0],[350,0],[650,-30],[850,-160],[900,-380],[780,-560],[580,-620],[470,-520],[500,-380],[380,-300],[230,-360],[190,-520],[30,-620],[-170,-580],[-310,-430],[-340,-250],[-230,-100]],104:[[0,0],[380,0],[700,-30],[930,-170],[990,-400],[880,-610],[680,-690],[520,-600],[560,-450],[430,-360],[280,-420],[250,-590],[90,-720],[-150,-700],[-330,-560],[-380,-350],[-280,-170],[-120,-60]]};
const CP_HW=8,CP_KW=1.7,CP_WB=17;
function circTrack(ti){
 if(NC_TK[ti])return NC_TK[ti];
 const P=CIRC_PTS[ti],n=P.length,raw=[];
 for(let i=0;i<n;i++){const p0=P[(i-1+n)%n],p1=P[i],p2=P[(i+1)%n],p3=P[(i+2)%n];
  for(let k=0;k<24;k++){const t=k/24,t2=t*t,t3=t2*t,f=q=>.5*((2*p1[q])+(-p0[q]+p2[q])*t+(2*p0[q]-5*p1[q]+4*p2[q]-p3[q])*t2+(-p0[q]+3*p1[q]-3*p2[q]+p3[q])*t3);raw.push([f(0),f(1)])}}
 const m0=raw.length,cum=new Float64Array(m0+1);
 for(let i=0;i<m0;i++){const j=(i+1)%m0;cum[i+1]=cum[i]+Math.hypot(raw[j][0]-raw[i][0],raw[j][1]-raw[i][1])}
 const tot=cum[m0],N=Math.floor(tot/2.5),pts=[];let k=0;
 for(let i=0;i<N;i++){const sd=i*tot/N;while(cum[k+1]<sd)k++;const j=(k+1)%m0,t=(sd-cum[k])/((cum[k+1]-cum[k])||1);pts.push([raw[k][0]+(raw[j][0]-raw[k][0])*t,raw[k][1]+(raw[j][1]-raw[k][1])*t])}
 // start line 120 m after the first control point (middle of the first straight)
 const st=Math.round(120/(tot/N));const q=pts.slice(st).concat(pts.slice(0,st));
 const x=new Float32Array(N),z=new Float32Array(N),s=new Float32Array(N+1),ry=new Float32Array(N),ks=new Float32Array(N),vp=new Float32Array(N);
 for(let i=0;i<N;i++){x[i]=q[i][0];z[i]=q[i][1]}
 for(let i=0;i<N;i++){const j=(i+1)%N,dx=x[j]-x[i],dz=z[j]-z[i],l=Math.hypot(dx,dz)||1;s[i+1]=s[i]+l;ry[i]=Math.atan2(-dx/l,-dz/l)}
 const Lp=s[N];
 for(let i=0;i<N;i++){const a=(i+4)%N,b=(i-4+N)%N;let ds=s[a]-s[b];if(ds<=0)ds+=Lp;ks[i]=angD(ry[a],ry[b])/ds;vp[i]=Math.min(95,Math.sqrt(17/Math.max(Math.abs(ks[i]),1e-4)))}
 for(let it=0;it<3;it++)for(let i=N-1;i>=0;i--){const j=(i+1)%N,ds=s[i+1]-s[i];vp[i]=Math.min(vp[i],Math.sqrt(vp[j]*vp[j]+2*24*ds))}
 let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(let i=0;i<N;i++){mnx=Math.min(mnx,x[i]);mxx=Math.max(mxx,x[i]);mnz=Math.min(mnz,z[i]);mxz=Math.max(mxz,z[i])}
 const circ={x,z,ry,ks,N,hw:CP_HW,kw:CP_KW,wb:CP_WB,Lp};
 return NC_TK[ti]={N,x,z,s,ry,ks,vp,Lp,rects:[],circ,tk:{key:'c'+ti,hw:CP_HW,edges:[],blocks:[],circ},bb:[mnx,mxx,mnz,mxz]}}
function circNear(T,px,pz,from){let bi=from,bd=1e18;for(let o=-60;o<=60;o++){const j=(from+o+T.N)%T.N,dx=T.x[j]-px,dz=T.z[j]-pz,d=dx*dx+dz*dz;if(d<bd){bd=d;bi=j}}
 const nx=Math.cos(T.ry[bi]),nz=-Math.sin(T.ry[bi]);return{i:bi,d:(px-T.x[bi])*nx+(pz-T.z[bi])*nz,nx,nz}}
function circClamp(T,px,pz){const q=circNear(T,px,pz,ncIdxP),w=T.circ.wb,ad=Math.abs(q.d);if(ad<=w)return null;const sg=Math.sign(q.d),pen=ad-w;return{x:px-sg*pen*q.nx,z:pz-sg*pen*q.nz,nx:sg*q.nx,nz:sg*q.nz,pen}}
// ---------------- realistic vehicle model (dynamic bicycle + tyre friction circle + gearbox)
let cpR=0,cpGear=1,cpRpm=1500,cpShift=0,cpIdx=0,cpD=0,cpSkid=0,cpAx=0,cpAy=0,cpSurf=0,cpPrm=null,cpPrmKey='',cpSqT=0,cpBrkLock=0;
const CP_CLS={
 f1:{m:800,L:3.5,a:1.55,h:.28,mu:2.0,cl:3.2,cd:.95,vt:98,ng:7,red:12000,idle:4200},
 hyper:{m:1350,L:2.8,a:1.25,h:.45,mu:1.8,cl:1.7,cd:.68,vt:92,ng:7,red:9000,idle:2600},
 super:{m:1450,L:2.7,a:1.2,h:.5,mu:1.68,cl:1.2,cd:.7,vt:86,ng:6,red:8600,idle:2400},
 sport:{m:1450,L:2.75,a:1.25,h:.52,mu:1.55,cl:.7,cd:.72,vt:80,ng:6,red:8000,idle:2200},
 muscle:{m:1800,L:2.9,a:1.3,h:.58,mu:1.4,cl:.25,cd:.8,vt:76,ng:6,red:6800,idle:1800},
 bike:{m:270,L:1.45,a:.72,h:.6,mu:1.65,cl:.05,cd:.32,vt:82,ng:6,red:11500,idle:3500,tr:.6}};
const CP_OV={xPulse:{vt:70,m:1550,red:14000,idle:3000},xRidge:{m:2100,vt:66,mu:1.28,h:.75},xSolstice:{vt:83,m:1250},xVelour:{vt:84,m:1700},xTorque:{vt:77},xMtb:{m:105,vt:46,mu:1.25,cd:.5,L:1.1,a:.55,red:6000,idle:2000,ng:6},xMoto:{vt:70,mu:1.45,m:150},xSuperbike:{vt:90}};
const CP_FR={6:[.2,.34,.5,.67,.83,1],7:[.17,.3,.43,.57,.71,.85,1]};
function cpParams(){
 const d=VEH[SV.sel],key=d.id+'|'+V.spd.toFixed(3)+'|'+V.hnd.toFixed(3);
 if(cpPrm&&cpPrmKey===key)return cpPrm;
 const cls=d.mdl==='xF1'?'f1':d.m,p=Object.assign({},CP_CLS[cls]||CP_CLS.sport,CP_OV[d.mdl]||{});
 p.vt*=V.spd/d.s[0];p.mu*=Math.sqrt(V.hnd/d.s[1]);p.b=p.L-p.a;p.h*=.62;p.Iz=p.m*p.L*p.L*.33;p.fr=CP_FR[p.ng];
 p.P=.5*1.2*p.cd*Math.pow(p.vt,3)+.015*p.m*9.81*p.vt;
 cpPrmKey=key;return cpPrm=p}
function cpEng(){const p=cpParams();return clamp((cpRpm-p.idle*.6)/(p.red-p.idle*.6),0,1.05)*1.05+.05+thr*.12+(boost?.2:0)}
function circReset(){cpR=0;cpGear=1;cpRpm=cpParams().idle;cpShift=0;cpSkid=0;cpAx=0;cpAy=0;cpIdx=ncIdxP;cpD=0}
function circPhys(dt,L,gas){
 const p=cpParams(),T=NC,g=9.81,wetK=L.wx>=2?.8:1;
 const q=circNear(T,pcx,pcz,ncIdxP);cpIdx=q.i;cpD=q.d;
 const ad=Math.abs(q.d),HW=T.circ.hw,KW=T.circ.kw;
 let sm=1,rr=0;
 if(ad<=HW){sm=wetK;cpSurf=0}
 else if(ad<=HW+KW){sm=.93*wetK;cpSurf=1}
 else{sm=(L.wx>=2?.36:.5);rr=.2*p.m*g;cpSurf=2}
 const fx=-Math.sin(pry),fz=-Math.cos(pry),rx=Math.cos(pry),rz=-Math.sin(pry);
 let u=pvx*fx+pvz*fz,v=-(pvx*rx+pvz*rz),r=cpR;
 const nsub=Math.max(1,Math.ceil(dt/.0085)),h=dt/nsub;
 let axA=0,ayA=0,skid=0;
 for(let sub=0;sub<nsub;sub++){
  const au=Math.abs(u);
  // ---- gearbox / engine
  if(cpShift>0)cpShift-=h;
  else if(u>0){const vg=p.fr[cpGear-1]*p.vt;
   if(cpGear<p.ng&&u>vg*.965&&gas>.15){cpGear++;cpShift=.15}
   else if(cpGear>1&&u<p.fr[cpGear-2]*p.vt*.8){cpGear--;cpShift=.1}}
  {const vg=p.fr[cpGear-1]*p.vt,tg=p.idle+(Math.max(0,u)/vg)*(p.red-p.idle);cpRpm+=(clamp(tg,p.idle*.9,p.red)-cpRpm)*Math.min(1,h*(cpShift>0?7:14))}
  // ---- vertical load (static + aero downforce + longitudinal transfer)
  const N0=p.m*g,Fdn=.5*1.2*p.cl*u*u,dT=p.m*cpAx*p.h/p.L;
  const Fzf=Math.max(.12*N0,N0*p.b/p.L+Fdn*.42-dT),Fzr=Math.max(.12*N0,N0*p.a/p.L+Fdn*.58+dT);
  const muF=p.mu*sm,capF=muF*Fzf,capR=muF*1.14*Fzr;
  // ---- pedals -> longitudinal forces
  let Fxf=0,Fxr=0;
  const reverse=u<.8&&brk>.5&&gas<.05&&!raceDone;
  if(reverse){Fxr=u>-4?-p.m*3.2:0;Fxf=0}
  else{
   const tq=clamp(1-.9*Math.pow((cpRpm/p.red-.8)/.8,2),.55,1),cut=cpShift>0?.15:1,lim=(cpRpm>=p.red*.995&&cpGear===p.ng)?0:1;
   let Fd=gas*(boost?1.35:1)*p.P*tq*cut*lim/Math.max(6,u);
   const fyr=Math.abs(p.m*cpAy)*p.a/p.L,tcK=Math.sqrt(Math.max(.1,1-Math.pow(Math.min(.97,fyr/capR/.95),2))),cap=capR*.98*(p.tr||1)*tcK;if(Fd>cap){Fd=cap;if(u<18&&gas>.6)skid=Math.max(skid,.5)}
   if(u<0)Fd=Math.max(Fd,0);
   Fxr=Fd;
   if(gas<.05&&u>2)Fxr-=p.m*(.55+.4*Math.min(1,cpRpm/p.red));
   // brakes: 62% front bias, each axle limited by its own grip (ABS-like)
   if(brk>.01&&u>.3){const bf=brk*capF*.95,br=brk*capR*.28;
    if(brk>.85&&u>25)skid=Math.max(skid,.4);
    Fxf-=bf;Fxr-=br}
  }
  // ---- steering lock shrinks with speed
  const dmax=.58/(1+Math.pow(Math.max(0,au)/26,1.5));let delta=-steerS*dmax;
  if(u>3.2){const ds=Math.atan2(v+p.a*r,u),aM=p.mu*sm*(g+Fdn/p.m),dg=Math.atan(aM*p.L/(u*u));delta=clamp(delta,Math.max(ds-.2,-dg-.012),Math.min(ds+.2,dg+.012))}
  const cd_=Math.cos(delta),sd_=Math.sin(delta);
  let Fyf=0,Fyr=0;
  if(u>3.2){
   const fcF=Math.sqrt(Math.max(.06,1-Math.pow(Fxf/capF,2))),fcR=Math.sqrt(Math.max(.06,1-Math.pow(Fxr/capR,2)));
   const aF=Math.atan2(v+p.a*r,u)-delta,aR=Math.atan2(v-p.b*r,u);
   Fyf=-capF*fcF*Math.sin(1.3*Math.atan(16*aF));Fyr=-capR*fcR*Math.sin(1.3*Math.atan(16*aR));
   const sl=Math.max(Math.abs(aF),Math.abs(aR));if(sl>.13&&au>12)skid=Math.max(skid,clamp((sl-.13)*7,0,1));
  }
  const drag=.5*1.2*p.cd*u*Math.abs(u)+(au>.3?.015*p.m*g*Math.sign(u):0)+(au>.3?rr*Math.sign(u):0);
  const Fxb=Fxf*cd_-Fyf*sd_+Fxr-drag,Fyb=Fyf*cd_+Fxf*sd_+Fyr,Mz=p.a*(Fyf*cd_+Fxf*sd_)-p.b*Fyr;
  const be=u>12?Math.atan2(v,u):0,esc=Math.abs(be)>.06?p.Iz*18*(be-Math.sign(be)*.06):0;
  const du=Fxb/p.m+v*r,dv=Fyb/p.m-u*r,dr=(Mz+esc)/p.Iz;
  const w=clamp((u-3)/3,0,1);
  u+=du*h;
  if(w>0){v+=dv*h;r+=dr*h;r-=r*.35*h*(1-.5*w)}
  // low speed: kinematic bicycle takes over (no singular slip angles)
  if(w<1){const rk=u*Math.tan(delta)/p.L;r=r*w+rk*(1-w);v=v*w+rk*p.b*(1-w)}
  if(reverse&&u<-4)u=-4;
  axA=du;ayA=Fyb/p.m;
 }
 cpR=r;cpAx+=(axA-cpAx)*Math.min(1,dt*6);cpAy+=(ayA-cpAy)*Math.min(1,dt*6);
 cpSkid+=(skid-cpSkid)*Math.min(1,dt*(skid>cpSkid?14:5));
 pry+=r*dt;
 const fx2=-Math.sin(pry),fz2=-Math.cos(pry),rx2=Math.cos(pry),rz2=-Math.sin(pry);
 pvx=u*fx2-v*rx2;pvz=u*fz2-v*rz2;
 ncSlip=Math.abs(v);
 if(cpSurf===1&&Math.abs(u)>12)camShk=Math.max(camShk,.08);
 if(cpSurf===2&&Math.abs(u)>8)camShk=Math.max(camShk,.14+Math.min(.2,Math.abs(u)/200));
 cpSqT-=dt;if(cpSkid>.45&&cpSqT<=0&&!muted){cpSqT=.11;noiseBurst(.1,.045*cpSkid,2600)}
}
function circRivalLine(r,T,L,dt){
 const k1=T.ks[ncIdx(T,r.pos+18)],k2=T.ks[ncIdx(T,r.pos+60)],lim=T.circ.hw-2.6;
 let pref=-Math.sign(k1)*clamp(Math.abs(k1)*230,0,5.2);
 if(Math.abs(k2)>Math.abs(k1)*1.3&&Math.abs(k2)>.006)pref+=Math.sign(k2)*clamp(Math.abs(k2)*120,0,3.2);
 pref=clamp(pref,-lim,lim);r.blk=0;
 const field=rivals.concat([{pos:travel,lo:cpD,pl:1}]);
 for(const q of field){if(q===r||q.fly)continue;const dp=q.pos-r.pos;
  if(dp>0&&dp<24&&Math.abs(q.lo-pref)<3.2){const side=(pref>=q.lo?1:-1)*(Math.abs(q.lo)>lim-3?-1:1);pref=clamp(q.lo+side*3.5,-lim,lim);if(dp<9&&Math.abs(q.lo-r.lo)<2.6)r.blk=1}}
 r.tlo=pref}
function ncPopulate(L){
 if(L.circ)return[];
 const T=NC,list=[];let id=0;
 const place=(S,lo,extra)=>{const a=ncAt(T,S),nx=Math.cos(a.ry),nz=-Math.sin(a.ry);return Object.assign({id:++itemId,wx:a.x+nx*lo,wz:a.z+nz*lo,ry:a.ry,x:0,z:0,done:false,still:1,S:((S%T.Lp)+T.Lp)%T.Lp,lo},extra)};
 const straight=S=>{const i=ncIdx(T,S);for(let d=-40;d<=40;d+=10){const j=ncIdx(T,S+d);if(Math.abs(T.ks[j])>.004)return false}return Math.abs(T.ks[i])<.004};
 const spots=[];for(let S=60;S<T.Lp-60;S+=15)if(straight(S))spots.push(S);
 const pick=()=>spots.splice(Math.floor(R(0,spots.length)),1)[0];
 const nR=Math.min(3,Math.floor(spots.length/12)+1);
 for(let i=0;i<nR&&spots.length>6;i++){const S=pick();if(S===void 0)break;list.push(place(S,[-6,0,6][Math.floor(R(0,3))],{kind:'ramp',hx:3.4,hz:4,scx:2.6}));for(let d=-25;d<=25;d+=5)spots.splice(spots.indexOf(S+d),1)}
 const nc=Math.min(8,Math.floor(L.diff*1.2)+4);
 for(let i=0;i<nc&&spots.length;i++){const S=pick();if(S===void 0)break;const lo=[-9,-4.5,0,4.5,9][Math.floor(R(0,5))],n=1+Math.floor(R(0,3));for(let k=0;k<n;k++)list.push(place(S+k*2.2,clamp(lo+(k%2?3:0),-11,11),{kind:'crate',hx:1.5,hz:1.5}))}
 for(let i=0;i<7&&spots.length;i++){const S=pick();if(S===void 0)break;list.push(place(S,[-9,-4.5,0,4.5,9][Math.floor(R(0,5))],{kind:'nitro'}))}
 for(let i=0;i<9&&spots.length;i++){const S=pick();if(S===void 0)break;const lo=[-9,-4.5,0,4.5,9][Math.floor(R(0,5))];for(let k=0;k<8;k++)list.push(place(S+k*4,lo,{kind:'coin'}))}
 return list}
function initCity(L){
 NC=ncTrack(L.trk);finCount=0;lastPlace=6;rivalDraw=[];lapTot=L.laps;lapNow=1;
 L.len=L.laps*NC.Lp;
 const slots=L.circ?[[0,-3.6],[0,3.6],[1,-3.6],[1,3.6],[2,-3.6],[2,3.6]]:[[0,-5],[0,5],[1,-5],[1,5],[2,-5],[2,5]],gap=L.circ?10:9,first=L.circ?14:12,R0=[0,1,2,3,4,5];
 const pc=VEH[SV.sel],pcls=pc.mdl==='xF1'?'f1':pc.m,RM=!L.circ?['sport']:pcls==='f1'?['xF1']:pcls==='bike'?['xSuperbike','xMoto']:['xTorque','xApex','xSolstice','xVelour','xPulse'];
 const mk=(k)=>{const sl=slots[k],S=-(first+sl[0]*gap);const a=ncAt(NC,S);return{S,lo:sl[1],a}};
 const ks=[1.04,1.0,.97,.945,.915];
 rivals=RIV.map((rv,i)=>{const g=mk(i),nx=Math.cos(g.a.ry),nz=-Math.sin(g.a.ry);return{id:++itemId,kind:'car',rival:true,city:true,model:RM[i%RM.length],color:rv[2],hx:1.76,hz:2.6,done:false,x:0,z:0,wx:g.a.x+nx*g.lo,wz:g.a.z+nz*g.lo,ry:g.a.ry,pos:g.S,lo:g.lo,tlo:g.lo,v:0,k:ks[i]*L.k*R(.985,1.015),fin:0,bst:0,bcd:R(3,7),stun:0,fly:0,name:rv[0],car:rv[1],ft:0,vx:0,lean:0,art:true,pax:false,plate:'RACE-'+(70+i*7),brand:rv[0].split(' ')[0].toUpperCase(),bk:false,sig:0,ph:Math.random(),lcd:R(.2,.6)}});
 const pg=mk(5),nx=Math.cos(pg.a.ry),nz=-Math.sin(pg.a.ry);
 pcx=pg.a.x+nx*pg.lo;pcz=pg.a.z+nz*pg.lo;pry=pg.a.ry;pvx=pvz=0;camYaw=pry;ncIdxP=pg.a.i;travel=pg.S;ncLastS=NC.s[ncIdxP];
 wrongT=0;stuckT=0;stuckD=0;rRollG=0;ncSlip=0;thr=0;brk=0;vel=0;lapStartT=0;bestLapT=0;if(L.circ)circReset();
 rcT=0;raceCD=3.9;cdLast=0;raceDone=false;finT=0;finPlace=0;finTime=0;rbT=0;rhT=0;rKmh=0;rPitch=0;
 air=0;airV=0;airOn=false;airT=0;roll=0;spin=0;rolling=false;spinning=false;rideObj=null;
 crashT=0;camShk=0;driftOn=false;driftYaw=0;pnWin=0;pnArm=false;pnUsed=false;cleanT=0;
 sNM=sRoll=sSpin=sHav=sTD=sPick=sPN=0;sAir=0;sDrift=0;sNitroM=0;finSpawned=false;rcFeed=[];feedHtml='';lastPosN=0;ncSpawnLap=0;
 objects=ncPopulate(L);playerX=0;velocity=0;
 // mini-map base
 const c=document.createElement('canvas');c.width=c.height=140;const g=c.getContext('2d'),b=NC.bb,sc=118/Math.max(b[1]-b[0],b[3]-b[2]);
 NC.mm={sc,ox:70-(b[0]+b[1])/2*sc,oz:70-(b[2]+b[3])/2*sc};
 g.lineJoin='round';g.lineCap='round';g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=9;g.beginPath();for(let i=0;i<NC.N;i+=3){const X=NC.x[i]*sc+NC.mm.ox,Y=NC.z[i]*sc+NC.mm.oz;i?g.lineTo(X,Y):g.moveTo(X,Y)}g.closePath();g.stroke();
 g.strokeStyle='#6ff0ef';g.lineWidth=5;g.stroke();rMapBase=c;
 $('rBanner').className='rbn';$('raceRes').classList.add('hidden');$('rFeed').innerHTML='';
 rcLv0=rcLv}
let rcLv0=0;
function ncReset(){const i=ncIdxP,a=ncAt(NC,NC.s[i]);pcx=a.x;pcz=a.z;pry=a.ry;pvx=pvz=0;vel=0;cpR=0;cpGear=1;air=0;airOn=false;rideObj=null;stuckT=0;toast('BACK ON TRACK')}
function ncUpdateRivals(dt,L){
 const T=NC;
 for(const r of rivals){
  if(r.fly){r.fvy-=22*dt;r.fy=Math.max(0,(r.fy||0)+r.fvy*dt);r.frx+=r.rsx*dt;r.frz+=r.rsz*dt;r.lo+=r.fvx*dt*.4;r.lo=clamp(r.lo,-12,12);r.ft2+=dt;if(r.ft2>1.35){r.fly=0;r.fy=void 0;r.frx=r.frz=0;r.tlo=r.lo;r.stun=1.2}}
  r.bcd-=dt;if(r.bst>0)r.bst-=dt;else if(r.bcd<=0){r.bst=1.8;r.bcd=R(6,10)}
  const i=ncIdx(T,r.pos),gap=travel-r.pos,rb=L.circ?1+clamp(gap/500,-.03,.07):1+clamp(gap/260,-.07,.22);
  let vt=Math.min(T.vp[i]*(1+.02*r.k),L.circ?L.vt:56)*r.k*rb*(r.bst>0?(L.circ?1.04:1.15):1);if(L.circ&&r.blk)vt*=.9;if(r.stun>0){r.stun-=dt;vt*=.35}if(r.fly)vt*=.3;
  r.v+=clamp(vt-r.v,-(L.circ?27:32)*dt,(L.circ?Math.max(3.5,11-.085*r.v):15)*dt);r.v=Math.max(0,r.v);r.bk=vt<r.v-2;
  r.pos+=r.v*dt;
  if(r.pos>=L.len&&!r.fin){r.fin=++finCount;r.ft=rcT}
  // lane choice: avoid crates and slower cars right ahead
  r.lcd-=dt;if(L.circ&&!r.fly)circRivalLine(r,T,L,dt);
  if(r.lcd<=0&&!r.fly&&!L.circ){r.lcd=R(.25,.5);
   const blocked=lo=>objects.some(o=>!o.done&&!o.fly&&(o.kind==='crate'||o.kind==='ramp')&&((o.S-(((r.pos%T.Lp)+T.Lp)%T.Lp)+T.Lp)%T.Lp)<46&&Math.abs(o.lo-lo)<4.2)||rivals.some(q=>q!==r&&!q.fly&&q.pos>r.pos&&q.pos-r.pos<22&&Math.abs(q.lo-lo)<3.2);
   if(blocked(r.tlo)){const opts=[-9,-4.5,0,4.5,9].filter(l=>!blocked(l)&&Math.abs(l-r.tlo)<10);if(opts.length)r.tlo=opts[Math.floor(R(0,opts.length))];else r.stun=Math.max(r.stun,.2)}}
  const dl=r.tlo-r.lo,mv=Math.sign(dl)*Math.min(Math.abs(dl),4.2*dt);if(!r.fly){r.lo+=mv;r.vx=mv/Math.max(dt,.001)}
  const a=ncAt(T,r.pos),nx=Math.cos(a.ry),nz=-Math.sin(a.ry);
  r.wx=a.x+nx*r.lo;r.wz=a.z+nz*r.lo;r.ry=a.ry-clamp(r.vx*.012,-.18,.18);r.z=0;r.x=0;r.ph+=r.v*dt*.55;r.lean+=(r.vx*.04-r.lean)*Math.min(1,dt*7)}
}
function cityLaunch(o,sg,pw,vx,vz){o.fly=1;o.ft2=0;o.fy=.05;o.fvy=R(7,11)*pw;o.fvx=sg*R(6,11)*pw;o.wvx=vx;o.wvz=vz;o.frx=0;o.frz=0;o.rsx=R(-9,9);o.rsz=R(-9,9)}
function updateCity(dt){
 const L=RLV[rcLv],T=NC,wet=(L.wx>=2)?.84:1;
 if(toastLeft>0){toastLeft-=dt;if(toastLeft<=0)$('toast').classList.remove('show')}
 flash=Math.max(0,flash-dt);camShk=Math.max(0,camShk-dt*2.2);
 if(rbT>0){rbT-=dt;if(rbT<=0)$('rBanner').classList.remove('on')}
 const rvs=1+(V.spd-1)*.45;
 if(raceCD>0){
  raceCD-=dt;const n=Math.ceil(raceCD);
  if(raceCD>0&&n!==cdLast&&n>=1&&n<=3){cdLast=n;rBanner(String(n),'cd',.95);SFX.cd()}
  thr+=((gasIn())-thr)*(1-Math.exp(-dt*6));
  if(raceCD<=0){rBanner('GO!','go',.9);SFX.go();boost=false;if(gasIn()&&!L.circ){const a=ncAt(T,0);pvx=-Math.sin(pry)*9;pvz=-Math.cos(pry)*9;nitro=Math.min(100,nitro+12);toast('ROCKET START')}}
  else{curSteer=0;forwardSpeed=0;updateEngine(.2+.5*thr*Math.abs(Math.sin(performance.now()/90)),false,true)}
  ncCamera(dt);updateRaceHUD(dt,true);return}
 rcT+=dt;time+=dt;invincible=0;
 // ------------- steering input (keyboard is eased, wheel/tilt are analog)
 let steer=(keyRight?1:0)-(keyLeft?1:0);if(Math.abs(steerInput)>Math.abs(steer))steer=steerInput;
 const ext=SV.ctl==='wheel'?wheelSteer:SV.ctl==='tilt'?tiltSteerNow(dt):0;if(Math.abs(ext)>Math.abs(steer))steer=ext;
 if(raceDone)steer=0;
 const digital=Math.abs(steer)>.99&&(SV.ctl==='arrows');
 steerS+=(steer-steerS)*(1-Math.exp(-dt*(digital?(Math.abs(steer)>=Math.abs(steerS)?5.5:9):14)));if(Math.abs(steerS)<.002)steerS=0;curSteer=steerS;
 // ------------- pedals
 const gas=raceDone?0:gasIn();
 thr+=(gas-thr)*(1-Math.exp(-dt*(gas?4.2:9)));
 brk+=((braking&&!raceDone?1:raceDone?.5:0)-brk)*(1-Math.exp(-dt*11));
 if(pnWin>0)pnWin-=dt;if(crashT>0)crashT-=dt;
 const topV=(52+L.diff*.6)*rvs,T0=topV+(boost?(pnWin>0?32:24):0);
 let fx=-Math.sin(pry),fz=-Math.cos(pry),rx=Math.cos(pry),rz=-Math.sin(pry);
 let vf=pvx*fx+pvz*fz,vr=pvx*rx+pvz*rz;
 const spd=Math.hypot(pvx,pvz);
 let aE=0,aB=0;
 if(L.circ){circPhys(dt,L,gas)}
 else if(!airOn){
  // ---- steering → yaw (speed sensitive lock, limited by tyre slip)
  const dmax=.5/(1+Math.pow(Math.max(0,Math.abs(vf))/24,1.7)),delta=steerS*dmax;
  let yaw=vf/2.9*Math.tan(delta);
  const sl=-vr/Math.max(4,Math.abs(vf)),lim=(brk>.3?.62:.36);
  if(yaw*sl>0&&Math.abs(sl)>lim)yaw*=clamp(1-(Math.abs(sl)-lim)/.3,0,1);
  yaw=clamp(yaw,-2.5,2.5);pry-=yaw*dt;
  fx=-Math.sin(pry);fz=-Math.cos(pry);rx=Math.cos(pry);rz=-Math.sin(pry);
  vf=pvx*fx+pvz*fz;vr=pvx*rx+pvz*rz;
  // ---- longitudinal
  const reverse=brk>.5&&vf<1.2&&thr<.05&&!raceDone;
  aE=thr*(boost?36:23)*Math.pow(Math.max(0,1-Math.max(0,vf)/T0),.8);
  vf+=aE*dt;
  if(reverse){vf=Math.max(-12,vf-11*dt)}
  else{
   const dr=(.0016*vf*vf+.4)*Math.sign(vf);vf-=dr*dt*(Math.abs(vf)>.05?1:0);
   if(thr<.05&&!raceDone&&vf>0)vf=Math.max(0,vf-2.2*dt);
   if(vf>T0)vf=Math.max(T0,vf-26*dt);
   aB=brk*46;const sp2=Math.hypot(vf,vr);if(aB>0&&sp2>.01){const k=Math.max(0,(sp2-aB*dt)/sp2);vf*=k;vr*=k}}
  // ---- lateral grip (friction circle: braking / accelerating costs cornering grip)
  const aLong=Math.abs(aE)+aB,grip=(26+spd*spd*.0035)*wet*Math.sqrt(V.hnd||1),eff=grip*Math.sqrt(Math.max(.12,1-Math.pow(aLong/50,2)))*(brk>.3&&Math.abs(steerS)>.3?.62:1);
  const dv=Math.min(Math.abs(vr),eff*dt);vr-=Math.sign(vr)*dv;
  pvx=vf*fx+vr*rx;pvz=vf*fz+vr*rz;
  ncSlip=Math.abs(vr)}
 else{const k=1-.05*dt;pvx*=k;pvz*=k;vf=pvx*fx+pvz*fz}
 vf=pvx*(-Math.sin(pry))+pvz*(-Math.cos(pry));vel=Math.max(0,Math.hypot(pvx,pvz)*(vf<0?-1:1));const speed=Math.abs(vel);forwardSpeed=speed;
 pcx+=pvx*dt;pcz+=pvz*dt;
 // ------------- barriers / walls
 const hit=L.circ?circClamp(T,pcx,pcz):ncClamp(T,pcx,pcz);
 if(hit){pcx=hit.x;pcz=hit.z;const vn=pvx*hit.nx+pvz*hit.nz;
  if(vn>0){const e=L.circ?1.1:1.22;if(L.circ){cpR*=.65;if(vn>3){pvx*=.94;pvz*=.94}}pvx-=e*vn*hit.nx;pvz-=e*vn*hit.nz;
   if(vn>7){camShk=Math.max(camShk,Math.min(1.3,vn/22));flash=Math.max(flash,.12);SFX.hit();cleanT=0;nitro=Math.max(0,nitro-4)}
   else if(vn>1.5)camShk=Math.max(camShk,.25)}
  const tk=Math.exp(-1.4*dt);pvx*=tk;pvz*=tk}
 // ------------- progress / laps
 {let bi=ncIdxP,bd=1e18;for(let o=-50;o<=50;o++){const j=(ncIdxP+o+T.N)%T.N,d=(T.x[j]-pcx)*(T.x[j]-pcx)+(T.z[j]-pcz)*(T.z[j]-pcz);if(d<bd){bd=d;bi=j}}
  ncIdxP=bi;let ds=T.s[bi]-ncLastS;if(ds<-T.Lp/2)ds+=T.Lp;else if(ds>T.Lp/2)ds-=T.Lp;ncLastS=T.s[bi];travel+=ds;
  if(!raceDone){lapNow=clamp(Math.floor(travel/T.Lp)+1,1,lapTot);if(lapNow!==ncSpawnLap&&lapNow>1){ncSpawnLap=lapNow;objects=ncPopulate(L);const lt=rcT-lapStartT;lapStartT=rcT;const nb=!bestLapT||lt<bestLapT;if(nb)bestLapT=lt;feedAdd('lap',(nb?'BEST LAP':'LAP '+(lapNow-1)),fmtRT(lt));rBanner('LAP '+lapNow+'/'+lapTot,'pn',1.2);SFX.cd()}}
  const dot=(-Math.sin(pry))*(-Math.sin(T.ry[bi]))+(-Math.cos(pry))*(-Math.cos(T.ry[bi]));
  if(!raceDone&&dot<-.3&&speed>6){wrongT+=dt;if(wrongT>1.4&&Math.floor(rcT*2)%2===0){if(!$('rBanner').classList.contains('on')||$('rBanner').textContent!=='WRONG WAY')rBanner('WRONG WAY','wrong',.6)}}else wrongT=Math.max(0,wrongT-dt*2);
  if(!raceDone&&speed<1.2&&gas){stuckT+=dt;if(stuckT>4.5)ncReset()}else stuckT=0}
 // ------------- nitro
 if(braking&&!driftOn&&boost&&brk>.9)boost=false;
 if(boost){nitro=Math.max(0,nitro-17*dt);sNitroM+=speed*dt;feedAdd('nit','METERS ON NITRO',sNitroM.toFixed(2)+' m');if(nitro<=0){boost=false;pnArm=false}}
 else if(!raceDone)nitro=Math.min(100,nitro+(L.circ?.7:1.2)*dt);
 pnArm=boost&&!pnUsed&&nitro<=48&&nitro>=28&&!raceDone;
 runWx[SV.wx|0]+=speed*dt*.75;distance+=speed*dt*.75;
 // ------------- drift
 const fxN=-Math.sin(pry),fzN=-Math.cos(pry),vrN=pvx*Math.cos(pry)+pvz*(-Math.sin(pry));
 const drifting=!airOn&&Math.abs(vrN)>4.2&&speed>16&&!raceDone;driftOn=drifting;
 if(drifting){const m=speed*dt;sDrift+=m;nitro=Math.min(100,nitro+m*.05);feedAdd('drift','METERS DRIFTED',sDrift.toFixed(2)+' m')}
 // ------------- ramps / air
 let rd=null;
 if(!airOn)for(const o of objects){if(o.kind!=='ramp'||o.done)continue;const dx=pcx-o.wx,dz=pcz-o.wz;if(dx*dx+dz*dz>400)continue;
  const of_=[-Math.sin(o.ry),-Math.cos(o.ry)],or_=[Math.cos(o.ry),-Math.sin(o.ry)],a=dx*of_[0]+dz*of_[1],c=dx*or_[0]+dz*or_[1],t=(a+4)/8;
  if(t>0&&t<1&&Math.abs(c)<3.4&&(fxN*of_[0]+fzN*of_[1])>.5){rd=o;o.t=t}}
 if(rd){rideObj=rd;air=1.4*rd.t;rPitch=.17}
 else if(rideObj&&!airOn){
  const o=rideObj,dx=pcx-o.wx,dz=pcz-o.wz,a=dx*(-Math.sin(o.ry))+dz*(-Math.cos(o.ry));
  if(a>=4-1e-6){airOn=true;airT=0;airV=Math.max(10,speed*.1786*1.6+(boost?3:0));roll=0;spin=0;rolling=false;spinning=false;SFX.boostOn()}else{air=0;rPitch=0}
  rideObj=null}
 if(airOn){
  airT+=dt;air+=airV*dt;airV-=GRAV*dt;rPitch=clamp(Math.atan2(airV,Math.max(20,speed)*.8),-.5,.5);
  if(!rolling&&Math.abs(steerS)>.65&&airT>.1){rolling=true;rollDir=Math.sign(steerS);rollGoal=roll+rollDir*Math.PI*2}
  if(!spinning&&braking&&airT>.1){spinning=true;spinDir=steerS>=0?1:-1;spinGoal=spin+spinDir*Math.PI*2}
  if(rolling){roll+=rollDir*(Math.PI*2/.68)*dt;if((roll-rollGoal)*rollDir>=0){roll=rollGoal;rolling=false;sRoll++;nitro=Math.min(100,nitro+9);feedAdd('roll','BARREL ROLL','x'+sRoll);SFX.roll()}}
  if(spinning){spin+=spinDir*(Math.PI*2/.8)*dt;if((spin-spinGoal)*spinDir>=0){spin=spinGoal;spinning=false;sSpin++;nitro=Math.min(100,nitro+7);feedAdd('spin','FLAT SPIN','x'+sSpin);SFX.roll()}}
  feedAdd('air','AIR TIME',airT.toFixed(2)+' s');
  if(air<=0&&airV<0){air=0;airOn=false;sAir+=airT;nitro=Math.min(100,nitro+airT*6);
   if(rolling||spinning){crashT=.8;camShk=1.1;flash=.2;toast('ROUGH LANDING');SFX.hit();cleanT=0;pvx*=.6;pvz*=.6}else{camShk=Math.max(camShk,.55);SFX.land()}
   roll=0;spin=0;rolling=false;spinning=false;rPitch=0}}
 else if(!rd){air=0;rPitch=L.circ?clamp(cpAx>0?cpAx*.0016:cpAx*.0035,-.07,.07):clamp(aE*.0016-aB*.0035,-.07,.07)}
 rRollG+=((L.circ?cpAy*.0042:(-steerS*clamp(vf,0,60)*.0016))-rRollG)*Math.min(1,dt*8);
 // ------------- objects
 for(const o of objects){
  if(o.done)continue;
  if(o.fly){o.wx+=o.wvx*dt;o.wz+=o.wvz*dt;o.fvy-=22*dt;o.fy=Math.max(0,o.fy+o.fvy*dt);o.frx+=o.rsx*dt;o.frz+=o.rsz*dt;o.ft2+=dt;if(o.ft2>2.2)o.done=true;continue}
  const dx=o.wx-pcx,dz=o.wz-pcz,d2=dx*dx+dz*dz;if(d2>900)continue;
  const al=dx*fxN+dz*fzN,sd=Math.abs(dx*Math.cos(pry)+dz*(-Math.sin(pry)));
  if(o.kind==='coin'){if(d2<5.5){o.done=true;coins++;distance+=8;SFX.coin()}continue}
  if(o.kind==='nitro'){if(d2<7){o.done=true;nitro=Math.min(100,nitro+V.nit);sPick++;feedAdd('pk','NITRO PICK-UP','x'+sPick);SFX.nitro()}continue}
  if(o.kind==='crate'){
   if(!o.nmc&&Math.abs(al)<2.4&&sd>2.2&&sd<3.6&&speed>20&&air<.5){o.nmc=1;if(!raceDone){sNM++;nitro=Math.min(100,nitro+4);feedAdd('nm','NEAR MISS','x'+sNM);SFX.nm()}}
   if(d2<5.4&&air<1.0&&!raceDone){const sg=(dx*Math.cos(pry)+dz*(-Math.sin(pry)))>=0?1:-1,vv=boost?1.15:.8;
    if(boost){sHav++;nitro=Math.min(100,nitro+3);feedAdd('hav','CITY HAVOC','x'+sHav);SFX.smash();camShk=Math.max(camShk,.7);cityLaunch(o,sg,1.15,pvx*.85+rx*sg*6,pvz*.85+rz*sg*6)}
    else{crashT=.6;camShk=1;flash=.22;cleanT=0;nitro=Math.max(0,nitro-6);pvx*=.55;pvz*=.55;SFX.hit();toast('CRASH!');cityLaunch(o,sg,.8,pvx*.9+rx*sg*5,pvz*.9+rz*sg*5)}}}}
 // ------------- rivals
 ncUpdateRivals(dt,L);
 for(const r of rivals){if(r.fly||air>1.0||raceDone)continue;
  const dx=r.wx-pcx,dz=r.wz-pcz,d2=dx*dx+dz*dz;
  if(d2<2.9*2.9){const sg=(dx*Math.cos(pry)+dz*(-Math.sin(pry)))>=0?1:-1;
   if(boost&&!L.circ){sTD++;nitro=Math.min(100,nitro+8);feedAdd('td','TAKEDOWN','x'+sTD);SFX.smash();camShk=Math.max(camShk,.7);r.fly=1;r.ft2=0;r.fy=.05;r.fvy=R(7,10);r.fvx=sg*R(8,13);r.frx=0;r.frz=0;r.rsx=R(-9,9);r.rsz=R(-9,9);r.stun=2.2}
   else if(L.circ){camShk=Math.max(camShk,.45);flash=Math.max(flash,.06);SFX.hit();cleanT=0;pvx*=.96;pvz*=.96;pvx-=rx*sg*1.8;pvz-=rz*sg*1.8;r.v*=.95;r.lo+=sg*.3;r.tlo=r.lo}
   else{crashT=.45;camShk=.8;flash=.15;cleanT=0;pvx*=.85;pvz*=.85;pvx-=rx*sg*3;pvz-=rz*sg*3;SFX.hit();r.stun=.9;r.v*=.8}}
  else if(!L.circ&&!r.nmc&&d2<4.4*4.4&&speed>20){const al=dx*fxN+dz*fzN;if(Math.abs(al)<2.2){r.nmc=1;sNM++;nitro=Math.min(100,nitro+4);feedAdd('nm','NEAR MISS','x'+sNM);SFX.nm()}}
  if(d2>14*14)r.nmc=0}
 // ------------- finish
 if(!cleanT&&false){}
 if(!raceDone){cleanT+=dt;if(cleanT>=22){cleanT=0;feedAdd('prun','PERFECT RUN','');nitro=Math.min(100,nitro+10)}}
 if(!raceDone&&travel>=L.len){raceDone=true;finPlace=++finCount;finTime=rcT;finT=0;boost=false;pnArm=false;rBanner(ordS(finPlace),'fin',3.2);finPlace<=3?SFX.win():SFX.lose();toast('🏁 FINISH')}
 if(raceDone){finT+=dt;if(finT>3.8){showRaceResult();return}}
 // list for the renderer
 const near=[];for(const o of objects){if(o.done)continue;const dx=o.wx-pcx,dz=o.wz-pcz;if(dx*dx+dz*dz<230*230)near.push(o)}
 for(const r of rivals){const dx=r.wx-pcx,dz=r.wz-pcz;if(dx*dx+dz*dz<260*260)near.push(r)}
 cityDraw=near;
 ncCamera(dt);
 updateRaceHUD(dt,false);
 lastBase=Math.max(25,speed*.9);
 updateEngine(L.circ?cpEng():clamp(speed/70,0,1.4)+(boost?.25:0)+thr*.15,boost,true)}
function ncCamera(dt){
 const sp=Math.hypot(pvx,pvz),tg=sp>8?Math.atan2(-pvx,-pvz):pry,dif=angD(tg,pry),target=pry+dif*.4;
 camYaw+=angD(target,camYaw)*(1-Math.exp(-dt*(raceCD>0?20:7)))}

// city levels (appended after the highway levels)
RLV.push(
 {n:'NEON DOWNTOWN',s:'Night loop through Neon City',wx:1,city:true,trk:0,laps:3,diff:1,k:1.0,tr:1,rw:500,ic:'🌃',th:'night'},
 {n:'MIDNIGHT CIRCUIT',s:'Tight turns, fountain plaza',wx:1,city:true,trk:1,laps:3,diff:2,k:1.04,tr:1,rw:700,ic:'🌆',th:'night'},
 {n:'RAIN DISTRICT',s:'Wet roads, S-bend chicane',wx:2,city:true,trk:3,laps:3,diff:3,k:1.07,tr:1,rw:900,ic:'🌧️',th:'rain'},
 {n:'NEON STORM CITY',s:'Thunder over the skyline',wx:3,city:true,trk:2,laps:4,diff:3,k:1.1,tr:1,rw:1150,ic:'⛈️',th:'storm'},
 {n:'CITY HAVOC GP',s:'Four laps, no mercy',wx:3,city:true,trk:3,laps:4,diff:4,k:1.13,tr:1,rw:1450,ic:'⚡',th:'storm'},
 {n:'NEON GRAND PRIX',s:'The ultimate city showdown',wx:2,city:true,trk:0,laps:5,diff:5,k:1.16,tr:1,rw:1900,ic:'🏆',th:'rain'});
RLV.forEach(l=>{if(l.city)l.len=l.laps*ncTrack(l.trk).Lp});
const NC0=RLV.findIndex(l=>l.city);
SV.rc.cun=clamp(Math.floor(+SV.rc.cun)||2,1,RLV.length-NC0);
const rcUnl=i=>RLV[i].city?(i-NC0)<SV.rc.cun:i<SV.rc.un;
let rcTab=1;rcLv=NC0;
const VEH=[
{id:0,n:'APEX GT Supercar',p:0,m:'super',c:'#b90819',g:'rgba(225,30,55,.6)',s:[1,1,25]},
{id:1,n:'Formentor Night',p:5000,gm:60,m:'sport',c:'#9fb4c4',str:'#d9843a',g:'rgba(120,200,220,.6)',s:[1.12,1.12,28],img:'cars/formentor.jpg'},
{id:2,n:'Jaecoo J7',p:9000,gm:90,m:'muscle',c:'#e8ecf5',str:'#2b303b',g:'rgba(200,220,255,.6)',s:[1.06,1.0,27],img:'cars/j7.jpg'},
{id:3,n:'G-Class Elite',p:20000,gm:150,m:'muscle',c:'#5b5f66',str:'#a86bff',g:'rgba(170,110,255,.65)',s:[1.12,.96,30],a:30,img:'cars/gclass.jpg'},
{id:4,n:'Chiron Sport',p:40000,gm:250,m:'hyper',c:'#14161c',str:'#5fe0d0',g:'rgba(95,224,208,.75)',s:[1.5,1.3,41],img:'cars/chiron.jpg'},
{id:5,n:'Aspark Owl',p:55000,gm:320,m:'hyper',c:'#f4f4f4',str:'#2b3a8c',g:'rgba(255,190,40,.75)',s:[1.55,1.35,42],img:'cars/owl.jpg'},
{id:6,n:'Pulse City EV',p:7500,gm:74,m:'sport',mdl:'xPulse',c:'#18d6e8',str:'#ffffff',g:'rgba(24,214,232,.65)',s:[1.05,1.1,27]},
{id:7,n:'Solstice Roadster',p:14000,gm:110,m:'sport',mdl:'xSolstice',c:'#ffd21f',str:'#2b303b',g:'rgba(255,210,31,.65)',s:[1.16,1.14,30]},
{id:8,n:'Torque Muscle GT',p:16500,gm:124,m:'muscle',mdl:'xTorque',c:'#e11d3a',str:'#f4f4f4',g:'rgba(225,30,55,.6)',s:[1.2,.98,31]},
{id:9,n:'Ridge Adventure SUV',p:19000,gm:138,m:'muscle',mdl:'xRidge',c:'#5fe333',str:'#2b303b',g:'rgba(95,227,51,.55)',s:[1.1,.95,29],a:35},
{id:10,n:'Velour Fastback',p:24000,gm:165,m:'sport',mdl:'xVelour',c:'#a74edc',str:'#f4f4f4',g:'rgba(167,78,220,.65)',s:[1.26,1.08,33]},
{id:11,n:'Apex R Supercar',p:32000,gm:210,m:'super',mdl:'xApex',c:'#2f7bff',str:'#f4f4f4',g:'rgba(47,123,255,.7)',s:[1.36,1.2,37]},
{id:12,n:'Trail Mountain Bike',p:2500,gm:46,m:'bike',mdl:'xMtb',c:'#ff8a1f',str:'#18d6e8',g:'rgba(255,138,31,.55)',s:[.92,1.3,20]},
{id:13,n:'Dirt Moto X',p:12000,gm:98,m:'bike',mdl:'xMoto',c:'#5fe333',str:'#f4f4f4',g:'rgba(95,227,51,.6)',s:[1.18,1.28,30]},
{id:14,n:'Venom Superbike',p:28000,gm:188,m:'bike',mdl:'xSuperbike',c:'#2f7bff',str:'#f4f4f4',g:'rgba(47,123,255,.7)',s:[1.46,1.32,39]},
{id:15,n:'Formula GP One',p:75000,gm:450,m:'hyper',mdl:'xF1',c:'#e11d3a',str:'#f4f4f4',g:'rgba(225,30,55,.8)',s:[1.8,1.5,46]}];
const PAL=['#e11d3a','#ff8a1f','#ffd21f','#5fe333','#18d6e8','#2f7bff','#a74edc','#f4f4f4','#2b303b'],HW={bike:1.1,truck:2.8};
const UP=id=>{const u=SV.up[id]=SV.up[id]||[];while(u.length<6)u.push(0);return u};
function applyV(){const d=VEH[SV.sel],u=UP(d.id);V={col:SV.paint[d.id]||d.c,model:d.m,mdl:d.mdl,str:d.str,glow:d.g,spd:d.s[0]*(1+u[0]*.04),hnd:d.s[1]*(1+u[1]*.06),nit:d.s[2]+u[2]*3,mg:u[4]*.4,inv:1.25+u[5]*.3,ax:d.m==='bike'?-.45:d.m==='truck'?.5:0,cn:10+Math.floor(lvl/25)};maxHP=Math.max(50,100+(d.a||0)+u[3]*10)}
// Validate saved data (an old / foreign save must never stop the game from starting)
{if(SV.fleet!==2){SV.fleet=2;SV.own=[0];SV.sel=0;for(const k of ['up','paint','pown','cu','cuo'])if(SV[k]&&typeof SV[k]==='object')for(const i of Object.keys(SV[k]))if(i!=='0')delete SV[k][i]}
 const n=VEH.length,ok=i=>Number.isInteger(i)&&i>=0&&i<n,isObj=o=>o&&typeof o==='object'&&!Array.isArray(o);
 SV.own=Array.isArray(SV.own)?Array.from(new Set(SV.own.filter(ok))):[0];if(!SV.own.includes(0))SV.own.unshift(0);
 if(!ok(SV.sel)||!SV.own.includes(SV.sel))SV.sel=0;
 SV.coins=Number.isFinite(+SV.coins)&&+SV.coins>0?Math.floor(+SV.coins):0;
 SV.pname=typeof SV.pname==='string'?SV.pname.slice(0,14):'';SV.pav=typeof SV.pav==='string'?SV.pav.slice(0,4):'';
 SV.gems=Number.isFinite(+SV.gems)&&+SV.gems>=0?Math.floor(+SV.gems):25;
 SV.unlocked=clamp(Math.floor(+SV.unlocked)||1,1,100);
 if(!isObj(SV.up))SV.up={};if(!isObj(SV.paint))SV.paint={};if(!isObj(SV.pown))SV.pown={};
 for(const k of Object.keys(SV.up))if(!Array.isArray(SV.up[k])||!ok(+k))delete SV.up[k];
 for(const k of Object.keys(SV.pown))if(!Array.isArray(SV.pown[k]))delete SV.pown[k];
 lvl=selLv=SV.unlocked;prev=SV.sel}
applyV();
const THM=[{s:['#14265a','#5b5fae','#ef8b86','#ffc088','#ffe4b2'],m:['#a285b0','#6a5a93','#3d3a68'],h:'255,200,150',c1:'rgba(120,90,170,.35)',c2:'rgba(255,176,140,.5)'},
{s:['#2a7fd6','#5aa9ec','#9ed0f5','#cfe8f7','#f4f9fb'],m:['#8fb2cf','#6a91b0','#4a6f82'],h:'230,240,250',c1:'rgba(150,170,200,.3)',c2:'rgba(255,255,255,.6)',d:1},
{s:['#02040f','#07123a','#122552','#2b3d6e','#4a5886'],m:['#1b2650','#121a3d','#0a1029'],h:'80,100,170',c1:'rgba(40,50,100,.4)',c2:'rgba(90,110,180,.3)',n:1},
{s:['#2b2f6e','#7a5ea8','#e58aa0','#ffb88a','#ffe0b0'],m:['#b08ab8','#8a6ba0','#54457a'],h:'255,190,170',c1:'rgba(130,90,170,.35)',c2:'rgba(255,190,170,.5)'}];
const TH=()=>THM[Math.floor(((mode==='hub'?selLv:lvl)-1)/10)%4];
function mkTask(n){const t=n%4!==3?'coins':['pass','nitro','dist','clean'][Math.floor(n/4)%4],T={coins:Math.round(100+150*Math.sqrt(n-1)),pass:15+n,nitro:3+Math.floor(n*.35),dist:600+n*70,clean:500+n*45}[t];
 return{t,T,rw:100+n*25,tx:{dist:`Drive ${T} m`,coins:`Collect ${T} coins`,pass:`Overtake ${T} vehicles`,nitro:`Collect ${T} nitro canisters`,clean:`Drive ${T} m without getting hit`}[t]}}
function checkTask(){if(!task)return;
 if(trial){$('taskTxt').textContent=`TIME TRIAL • ${fmtT(time)} • BEST ${SV.tt?fmtT(SV.tt.best):'—'} • ${Math.max(0,Math.ceil(TT_LEN-travel))} m TO GO`;$('taskFill').style.width=Math.min(100,travel/TT_LEN*100)+'%';if(!finWarn&&travel>TT_LEN-260){finWarn=true;toast('🏁 FINISH LINE AHEAD')}if(travel>=TT_LEN&&mode==='run')endTrial();return}
 if(racing){const pl=1+rivals.filter(r=>r.pos>travel).length;if(pl!==lastPlace){if(mode==='run'&&pl<lastPlace)toast('▲ POSITION '+ord(pl));lastPlace=pl}if(!finWarn&&travel>RACE_LEN-260){finWarn=true;toast('🏁 FINISH LINE AHEAD')}$('taskTxt').textContent=`RACE • POSITION ${pl}/4 • ${Math.max(0,Math.ceil(RACE_LEN-travel))} m TO FINISH`;$('taskFill').style.width=Math.min(100,travel/RACE_LEN*100)+'%';if(travel>=RACE_LEN&&mode==='run')endRace(1+rivals.filter(r=>r.fin).length);return}
 if(endless){lvl=Math.min(100,1+Math.floor(distance/300));$('taskTxt').textContent=`ENDLESS • ${'♥'.repeat(lives)}${'♡'.repeat(3-lives)} • ${Math.floor(distance)} m • SPEED TIER ${lvl}`;$('taskFill').style.width=(distance%300)/3+'%';return}
 const v=Math.min(task.t==='coins'?coins:task.t==='pass'?passed:task.t==='nitro'?gN:distance,task.T);
 $('taskTxt').textContent=`LV ${lvl} · ${task.tx} · ${Math.floor(v)}/${task.T}`;$('taskFill').style.width=v/task.T*100+'%';if(v>=task.T&&mode==='run')end('win')}
// trucks & bikes
const steelG=(x0,x1)=>{const g=ctx.createLinearGradient(x0,0,x1,0);g.addColorStop(0,'#59616d');g.addColorStop(.35,'#e9eef4');g.addColorStop(.7,'#9aa4b0');g.addColorStop(1,'#444b56');return g};
function plateTxt(w,x,y,pw,ph,txt){if(!txt||w<46)return;ctx.save();ctx.fillStyle='#1b2430';ctx.font=`800 ${ph*.78}px 'Barlow Condensed',Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,x+pw/2,y+ph*.54,pw*.9);ctx.restore()}
function plateBox(w,x,y,pw,ph,txt){rr(x,y,pw,ph,ph*.14);ctx.fillStyle='#f4f1e4';ctx.fill();ctx.strokeStyle='#1b2430';ctx.lineWidth=Math.max(1,w*.006);ctx.stroke();plateTxt(w,x,y,pw,ph,txt)}
function rosette(x,y,r){const cols=['#ffd21f','#e11d3a','#18d6e8','#f4f4f4'];ctx.save();ctx.translate(x,y);ctx.fillStyle='#0f2a1a';ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();
 for(let k=0;k<4;k++){const q=r*(1-k*.2);ctx.fillStyle=cols[k];for(let i=0;i<8;i++){const a=i/8*6.283+k*.4;ctx.beginPath();ctx.ellipse(Math.cos(a)*q*.58,Math.sin(a)*q*.58,q*.3,q*.17,a,0,7);ctx.fill()}}
 ctx.fillStyle='#e11d3a';ctx.beginPath();ctx.arc(0,0,r*.2,0,7);ctx.fill();ctx.restore()}
function truckRear(w,col,st,ph,blink,sg,bk){
 const art=!st||st.art,hh=.95*w,bb=-.2*w,t=bb-hh;let g;
 glow(0,0,w*.8,'rgba(255,30,40,.18)');
 // side mirrors
 for(const s of[-1,1]){ctx.fillStyle='#14171d';rr(s>0?.5*w:-.58*w,t+.18*w,.08*w,.26*w,.02*w);ctx.fill();g=ctx.createLinearGradient(0,t+.2*w,0,t+.42*w);g.addColorStop(0,'#7fb2d8');g.addColorStop(1,'#2c4560');ctx.fillStyle=g;rr(s>0?.512*w:-.568*w,t+.2*w,.056*w,.22*w,.012*w);ctx.fill()}
 // cargo box
 g=ctx.createLinearGradient(0,t,0,bb);g.addColorStop(0,sh(col,.45));g.addColorStop(.3,col);g.addColorStop(1,sh(col,-.5));rr(-.5*w,t,w,hh,.03*w);ctx.fillStyle=g;ctx.fill();
 ctx.lineWidth=Math.max(1,w*.006);ctx.strokeStyle='rgba(255,255,255,.07)';ctx.beginPath();for(let i=-9;i<=9;i++){ctx.moveTo(i*.05*w,t+.03*w);ctx.lineTo(i*.05*w,bb-.03*w)}ctx.stroke();
 ctx.strokeStyle='rgba(0,0,0,.12)';ctx.beginPath();for(let i=-9;i<=9;i++){ctx.moveTo(i*.05*w+.006*w,t+.03*w);ctx.lineTo(i*.05*w+.006*w,bb-.03*w)}ctx.stroke();
 if(art){ // colourful truck-art panels
  const by=t+.05*w,bh=.075*w;g=ctx.createLinearGradient(0,by,0,by+bh);g.addColorStop(0,'#e11d3a');g.addColorStop(1,'#7d0f22');ctx.fillStyle=g;ctx.fillRect(-.47*w,by,.94*w,bh);
  for(let i=0;i<16;i++){const dx=-.44*w+i*.0585*w;poly([[dx,by+bh/2],[dx+.025*w,by+.012*w],[dx+.05*w,by+bh/2],[dx+.025*w,by+bh-.012*w]],i%2?'#ffd21f':'#f4f4f4')}
  const b2=bb-.2*w;[['#18a557',0],['#ffd21f',.022],['#e11d3a',.044]].forEach(([c,o])=>{ctx.fillStyle=c;ctx.fillRect(-.47*w,b2+o*w,.94*w,.02*w)});
  for(const s of[-1,1])rosette(s*.25*w,t+hh*.5+.03*w,.15*w);
  for(let i=0;i<14;i++){ctx.fillStyle=i%2?'#ffd21f':'#18a557';ctx.fillRect(-.5*w,t+i*(hh/14),.03*w,hh/14);ctx.fillRect(.47*w,t+i*(hh/14),.03*w,hh/14)}
 }else{
  poly([[-.47*w,bb-.05*w],[.47*w,bb-.05*w],[.47*w,bb-.27*w],[-.47*w,bb-.17*w]],'rgba(255,255,255,.14)');
  if(w>60){ctx.save();ctx.fillStyle='rgba(255,255,255,.92)';ctx.font=`900 ${.17*w}px 'Barlow Condensed',Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((st&&st.brand)||'CARGO',0,t+hh*.4,.84*w);ctx.restore()}
 }
 g=ctx.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'rgba(0,0,0,.4)');g.addColorStop(.3,'rgba(255,255,255,.1)');g.addColorStop(.7,'rgba(255,255,255,.04)');g.addColorStop(1,'rgba(0,0,0,.4)');rr(-.5*w,t,w,hh,.03*w);ctx.fillStyle=g;ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=Math.max(1,w*.008);ctx.beginPath();ctx.moveTo(-.48*w,t+.008*w);ctx.lineTo(.48*w,t+.008*w);ctx.stroke();
 // doors: seam, frame, locking rods, handles, hinges
 ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=Math.max(1,w*.014);ctx.beginPath();ctx.moveTo(0,t+.02*w);ctx.lineTo(0,bb-.02*w);ctx.stroke();
 ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=Math.max(1,w*.008);ctx.strokeRect(-.485*w,t+.015*w,.97*w,hh-.03*w);
 for(const rx of[-.4,-.1,.1,.4]){ctx.fillStyle=steelG(rx*w-.008*w,rx*w+.008*w);ctx.fillRect(rx*w-.008*w,t+.03*w,.016*w,hh-.06*w);ctx.fillStyle='#2a2f38';for(const f of[.08,.5,.9]){rr(rx*w-.022*w,t+hh*f-.012*w,.044*w,.026*w,.008*w);ctx.fill()}}
 ctx.fillStyle='#d3d8df';rr(-.075*w,t+hh*.5+.03*w,.05*w,.014*w,.006*w);ctx.fill();rr(.025*w,t+hh*.5+.03*w,.05*w,.014*w,.006*w);ctx.fill();
 ctx.fillStyle='#191c22';for(const s of[-1,1])for(const f of[.1,.5,.9])ctx.fillRect(s<0?-.5*w:.47*w,t+hh*f-.02*w,.03*w,.04*w);
 // top marker lights
 for(let i=0;i<5;i++){const mx=(i-2)*.2*w;ctx.fillStyle=i===2?'#ffb020':'#ff9a1a';ctx.beginPath();ctx.arc(mx,t+.024*w,.014*w,0,7);ctx.fill();glow(mx,t+.024*w,w*.07,'rgba(255,170,40,.9)',.8)}
 // reflective tape + rail
 for(let i=0;i<19;i++){ctx.fillStyle=i%2?'#e8e8e8':'#d6222e';ctx.fillRect(-.5*w+i*.0526*w,bb-.045*w,.0526*w,.022*w)}
 ctx.fillStyle=sh(col,-.65);ctx.fillRect(-.5*w,bb-.018*w,w,.018*w);
 // underbody + diff
 ctx.fillStyle='#12141a';ctx.fillRect(-.46*w,bb,.92*w,.1*w);
 g=ctx.createRadialGradient(0,bb+.06*w,.01*w,0,bb+.06*w,.12*w);g.addColorStop(0,'#3a424e');g.addColorStop(1,'#14171d');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,bb+.06*w,.1*w,.05*w,0,0,7);ctx.fill();
 // dual rear tyres with scrolling tread
 for(const s of[-1,1])for(let k=0;k<2;k++){const x0=s<0?-.5*w+k*.075*w:.36*w+k*.075*w;ctx.fillStyle='#0b0c10';rr(x0,bb,.065*w,-bb,.018*w);ctx.fill();
  ctx.save();rr(x0,bb,.065*w,-bb,.018*w);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=Math.max(1,w*.007);for(let i=-1;i<6;i++){const yy=bb+(i+ph)*.04*w;ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x0+.065*w,yy+.012*w);ctx.stroke()}
  g=ctx.createLinearGradient(x0,0,x0+.065*w,0);g.addColorStop(0,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=g;ctx.fillRect(x0,bb,.065*w,-bb);ctx.restore()}
 // mud flaps
 for(const s of[-1,1]){ctx.fillStyle='#0d0e11';rr(s<0?-.5*w:.39*w,bb+.02*w,.11*w,.15*w,.012*w);ctx.fill();ctx.fillStyle='#e8e8e8';ctx.fillRect(s<0?-.46*w:.43*w,bb+.045*w,.03*w,.1*w)}
 // ICC underride bumper (red/white)
 g=ctx.createLinearGradient(0,bb,0,bb+.045*w);g.addColorStop(0,'#c9d0d8');g.addColorStop(1,'#59616d');rr(-.47*w,bb,.94*w,.045*w,.01*w);ctx.fillStyle=g;ctx.fill();
 ctx.save();rr(-.47*w,bb,.94*w,.045*w,.01*w);ctx.clip();for(let i=0;i<28;i++){ctx.fillStyle=i%2?'rgba(240,240,240,.85)':'rgba(214,34,46,.85)';ctx.fillRect(-.47*w+i*.0336*w,bb,.0168*w,.045*w)}ctx.restore();
 ctx.fillStyle='#14171d';ctx.fillRect(-.41*w,bb+.03*w,.02*w,.04*w);ctx.fillRect(.39*w,bb+.03*w,.02*w,.04*w);
 if(art){ctx.fillStyle='#d9b44a';for(let i=0;i<14;i++){ctx.beginPath();ctx.arc(-.42*w+i*.065*w,bb+.068*w+Math.sin(i*1.3+pT*4)*.006*w,.011*w,0,7);ctx.fill()}}
 // exhaust pipes
 for(const s of[-1,1]){const ex=s*.3*w,ey=bb+.095*w;g=ctx.createRadialGradient(ex-.008*w,ey-.008*w,0,ex,ey,.03*w);g.addColorStop(0,'#fff');g.addColorStop(.6,'#8d97a3');g.addColorStop(1,'#2a2f38');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ex,ey,.03*w,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.arc(ex,ey,.019*w,0,7);ctx.fill()}
 // number plate
 plateBox(w,-.12*w,-.34*w,.24*w,.075*w,(st&&st.plate)||'HR-3D');
 // tail-light clusters: brake / indicator / reverse
 for(const d of[-1,1]){const x0=d<0?-.5*w:.4*w,cl=x0+.05*w,on=sg===d&&blink;ctx.fillStyle='#0d0f14';rr(x0,-.5*w,.1*w,.21*w,.02*w);ctx.fill();
  ctx.fillStyle=bk?'#ff6a74':'#d81d2c';ctx.beginPath();ctx.arc(cl,-.455*w,.026*w,0,7);ctx.fill();glow(cl,-.455*w,w*(bk?.5:.32),'rgba(255,40,55,.9)',bk?1:.75);
  ctx.fillStyle=on?'#ffb020':'#6e4a10';ctx.beginPath();ctx.arc(cl,-.395*w,.026*w,0,7);ctx.fill();if(on)glow(cl,-.395*w,w*.38,'rgba(255,170,30,.95)');
  ctx.fillStyle='#8e969f';ctx.beginPath();ctx.arc(cl,-.335*w,.022*w,0,7);ctx.fill()}
}
function bikeRear(u,col,hero,st,ph,blink,sg,bk){
 let g;const lw=Math.max(1,u*.012);
 glow(0,-.4*u,u*.8,'rgba(255,40,50,.45)');
 // swingarm + axle nuts
 for(const s of[-1,1]){const x0=s<0?-.155*u:.105*u;g=ctx.createLinearGradient(x0,0,x0+.05*u,0);g.addColorStop(0,'#2b3038');g.addColorStop(.5,'#9aa4b2');g.addColorStop(1,'#2b3038');ctx.fillStyle=g;rr(x0,-.42*u,.05*u,.32*u,.02*u);ctx.fill();
  ctx.fillStyle='#cfd6df';ctx.beginPath();ctx.arc(s*.13*u,-.2*u,.022*u,0,7);ctx.fill();ctx.fillStyle='#333a44';ctx.beginPath();ctx.arc(s*.13*u,-.2*u,.01*u,0,7);ctx.fill()}
 // rear tyre with scrolling chevron tread
 g=ctx.createLinearGradient(-.1*u,0,.1*u,0);g.addColorStop(0,'#050608');g.addColorStop(.5,'#2a2e36');g.addColorStop(1,'#050608');rr(-.1*u,-.42*u,.2*u,.42*u,.09*u);ctx.fillStyle=g;ctx.fill();
 ctx.save();rr(-.1*u,-.42*u,.2*u,.42*u,.09*u);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=lw;for(let i=-1;i<8;i++){const yy=-.42*u+(i+ph)*.06*u;ctx.beginPath();ctx.moveTo(-.1*u,yy+.03*u);ctx.lineTo(0,yy);ctx.lineTo(.1*u,yy+.03*u);ctx.stroke()}ctx.restore();
 // hugger + plate
 poly([[-.12*u,-.42*u],[.12*u,-.42*u],[.1*u,-.5*u],[-.1*u,-.5*u]],'#10131a');
 ctx.fillStyle='#0b0d12';ctx.fillRect(-.012*u,-.5*u,.024*u,.07*u);
 plateBox(u,-.08*u,-.56*u,.16*u,.075*u,(st&&st.plate)||'HR-3D');
 // chrome muffler with heat bands + end cap
 g=ctx.createLinearGradient(.125*u,0,.215*u,0);g.addColorStop(0,'#5a626e');g.addColorStop(.35,'#f4f8ff');g.addColorStop(1,'#59616d');rr(.125*u,-.38*u,.09*u,.3*u,.045*u);ctx.fillStyle=g;ctx.fill();
 ctx.fillStyle='rgba(110,120,255,.35)';ctx.fillRect(.125*u,-.34*u,.09*u,.035*u);ctx.fillStyle='rgba(255,170,60,.28)';ctx.fillRect(.125*u,-.3*u,.09*u,.02*u);
 ctx.fillStyle='#8e98a6';ctx.beginPath();ctx.arc(.17*u,-.1*u,.04*u,0,7);ctx.fill();ctx.fillStyle='#050608';ctx.beginPath();ctx.arc(.17*u,-.1*u,.026*u,0,7);ctx.fill();
 // tail cowl
 g=ctx.createLinearGradient(0,-.8*u,0,-.5*u);g.addColorStop(0,sh(col,.4));g.addColorStop(1,sh(col,-.45));poly([[-.12*u,-.5*u],[.12*u,-.5*u],[.19*u,-.62*u],[.17*u,-.8*u],[-.17*u,-.8*u],[-.19*u,-.62*u]],g);
 ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(-.018*u,-.8*u,.036*u,.3*u);
 ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(-.18*u,-.66*u);ctx.lineTo(.18*u,-.66*u);ctx.stroke();
 poly([[-.15*u,-.78*u],[-.06*u,-.78*u],[-.09*u,-.55*u],[-.15*u,-.6*u]],'rgba(255,255,255,.2)');
 // LED tail light bar
 ctx.fillStyle='#220509';rr(-.14*u,-.74*u,.28*u,.05*u,.02*u);ctx.fill();ctx.fillStyle=bk?'#ff7a84':'#ff2b3a';rr(-.13*u,-.733*u,.26*u,.036*u,.015*u);ctx.fill();
 ctx.fillStyle='rgba(255,230,230,.8)';for(let i=0;i<7;i++){ctx.beginPath();ctx.arc((-.108+i*.036)*u,-.715*u,.006*u,0,7);ctx.fill()}
 glow(0,-.715*u,u*(bk?.55:.35),'rgba(255,40,55,.9)',bk?1:.85);
 // indicators
 for(const d of[-1,1]){const on=sg===d&&blink;ctx.fillStyle=on?'#ffb020':'#7a4a0c';rr(d<0?-.235*u:.2*u,-.66*u,.035*u,.03*u,.008*u);ctx.fill();if(on)glow(d*.218*u,-.645*u,u*.3,'rgba(255,170,30,.95)')}
 // seat
 ctx.fillStyle='#151820';rr(-.17*u,-.84*u,.34*u,.06*u,.03*u);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(-.12*u,-.82*u);ctx.lineTo(.12*u,-.82*u);ctx.stroke();
 // rider legs + boots
 for(const s of[-1,1]){const x0=s<0?-.31*u:.17*u;g=ctx.createLinearGradient(x0,0,x0+.14*u,0);g.addColorStop(0,'#0c1017');g.addColorStop(.45,'#2a3545');g.addColorStop(1,'#0c1017');ctx.fillStyle=g;rr(x0,-.9*u,.14*u,.38*u,.06*u);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x0+.07*u,-.88*u);ctx.lineTo(x0+.07*u,-.56*u);ctx.stroke();
  ctx.fillStyle='#08090c';rr(x0-.01*u,-.6*u,.16*u,.1*u,.03*u);ctx.fill();ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(x0+.01*u,-.6*u,.02*u,.07*u);ctx.fillStyle=col;ctx.fillRect(x0+.03*u,-.53*u,.1*u,.012*u)}
 // arms, handlebar, gloves, mirrors
 ctx.lineCap='round';
 for(const s of[-1,1]){ctx.strokeStyle='#1e2735';ctx.lineWidth=u*.12;ctx.beginPath();ctx.moveTo(s*.25*u,-1*u);ctx.lineTo(s*.46*u,-.8*u);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=u*.025;ctx.beginPath();ctx.moveTo(s*.24*u,-1.04*u);ctx.lineTo(s*.44*u,-.84*u);ctx.stroke();
  ctx.strokeStyle='#1a1d24';ctx.lineWidth=u*.03;ctx.beginPath();ctx.moveTo(s*.4*u,-.8*u);ctx.lineTo(s*.56*u,-.8*u);ctx.stroke();
  g=ctx.createRadialGradient(s*.47*u-.015*u,-.82*u,0,s*.47*u,-.8*u,.07*u);g.addColorStop(0,'#4a5565');g.addColorStop(1,'#0c0e12');ctx.fillStyle=g;rr(s*.47*u-.055*u,-.85*u,.11*u,.1*u,.04*u);ctx.fill();ctx.fillStyle=col;ctx.fillRect(s*.47*u-.04*u,-.86*u,.08*u,.012*u);
  ctx.strokeStyle='#444b56';ctx.lineWidth=u*.015;ctx.beginPath();ctx.moveTo(s*.44*u,-.85*u);ctx.lineTo(s*.5*u,-1.04*u);ctx.stroke();
  ctx.fillStyle='#1c2028';rr(s*.5*u-.065*u,-1.1*u,.13*u,.075*u,.03*u);ctx.fill();g=ctx.createLinearGradient(0,-1.1*u,0,-1.03*u);g.addColorStop(0,'#9ecbe8');g.addColorStop(1,'#3b5870');ctx.fillStyle=g;rr(s*.5*u-.05*u,-1.092*u,.1*u,.058*u,.022*u);ctx.fill()}
 // jacket torso
 g=ctx.createLinearGradient(-.28*u,0,.28*u,0);g.addColorStop(0,'#0e131c');g.addColorStop(.4,'#3c4a60');g.addColorStop(1,'#0e131c');rr(-.28*u,-1.14*u,.56*u,.6*u,.2*u);ctx.fillStyle=g;ctx.fill();
 for(const s of[-1,1]){g=ctx.createRadialGradient(s*.24*u-.02*u,-1.06*u,0,s*.24*u,-1.04*u,.1*u);g.addColorStop(0,sh(col,.5));g.addColorStop(1,sh(col,-.4));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(s*.24*u,-1.04*u,.09*u,.075*u,0,0,7);ctx.fill()}
 ctx.fillStyle='rgba(0,0,0,.35)';for(let i=0;i<5;i++){rr(-.022*u,-1.06*u+i*.07*u,.044*u,.055*u,.014*u);ctx.fill()}ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(-.008*u,-1.06*u,.016*u,.33*u);
 ctx.fillStyle=col;ctx.fillRect(-.28*u,-.86*u,.56*u,.045*u);ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(-.28*u,-.8*u,.56*u,.02*u);
 ctx.fillStyle='#0b0d12';ctx.fillRect(-.22*u,-.64*u,.44*u,.035*u);
 // helmet
 ctx.fillStyle='#0a0c10';ctx.beginPath();ctx.ellipse(0,-1.13*u,.17*u,.05*u,0,0,7);ctx.fill();
 const hg=ctx.createRadialGradient(-.06*u,-1.3*u,.01*u,0,-1.24*u,.2*u);hg.addColorStop(0,sh(col,.7));hg.addColorStop(.6,col);hg.addColorStop(1,sh(col,-.5));ctx.fillStyle=hg;ctx.beginPath();ctx.arc(0,-1.26*u,.19*u,0,7);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(0,-1.26*u,.19*u,0,7);ctx.clip();ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(-.028*u,-1.5*u,.056*u,.5*u);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(-.045*u,-1.5*u,.012*u,.5*u);ctx.fillRect(.033*u,-1.5*u,.012*u,.5*u);
 g=ctx.createLinearGradient(0,-1.45*u,0,-1.07*u);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.4)');ctx.fillStyle=g;ctx.fillRect(-.2*u,-1.45*u,.4*u,.4*u);ctx.restore();
 ctx.fillStyle='rgba(8,10,14,.85)';for(let i=0;i<3;i++){rr(-.065*u,-1.2*u+i*.03*u,.13*u,.016*u,.007*u);ctx.fill()}
 poly([[-.1*u,-1.14*u],[.1*u,-1.14*u],[.075*u,-1.095*u],[-.075*u,-1.095*u]],'#0b0d12');
 ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(-.07*u,-1.34*u,.05*u,.025*u,-.5,0,7);ctx.fill();
}
function big(x,y,w,col,type,al,hero,st){
 const blink=Math.floor(pT*3.6)%2===0,sg=st?st.sig:0,bk=!!(st&&st.bk),ph=(((st&&st.ph!==undefined)?st.ph:travel*.5)%1+1)%1;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=al;ctx.fillStyle='rgba(8,6,20,.55)';ctx.beginPath();ctx.ellipse(0,0,w*.6,w*.07,0,0,7);ctx.fill();
 if(type==='truck')truckRear(w,col,st,ph,blink,sg,bk);else bikeRear(w,col,hero,st,ph,blink,sg,bk);
 if(hero){if(boost){const xs=type==='truck'?[-.3*w,.3*w]:[.17*w],yy=-.1*w,sc=type==='truck'?1:1.3;for(const ex of xs){const L=w*(.35+.25*Math.random())*sc;poly([[ex-.05*w,yy],[ex+.05*w,yy],[ex,yy+L]],'rgba(70,190,255,.85)');glow(ex,yy+.1*w,w*.4,'rgba(60,170,255,.9)')}}glow(0,0,w*.8,V.glow,.5)}
 ctx.restore()}
// showroom (hub)
function showroom(){const d=VEH[prev],mob=W<700,s=mob?Math.min(W*.62,H*.4):Math.min(W*.4,H*.62),x=mob?W*.5:W*.27,y=mob?H*.34:H*.8,k=V,kb=boost;
 const pc=SV.paint[d.id]||d.c;V={col:pc,str:d.str,glow:d.g};boost=false;
 const rw=s*.8,rh=s*.16,py=y+rh*.3;let g;
 // spotlight cone
 ctx.save();g=ctx.createLinearGradient(0,y-s*1.7,0,y);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,.13)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-s*.1,y-s*1.7);ctx.lineTo(x+s*.1,y-s*1.7);ctx.lineTo(x+rw,py);ctx.lineTo(x-rw,py);ctx.closePath();ctx.fill();ctx.restore();
 // turntable
 ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(x,py+rh*.35,rw*1.04,rh*1.05,0,0,7);ctx.fill();
 g=ctx.createLinearGradient(0,py-rh,0,py+rh);g.addColorStop(0,'#2b4a70');g.addColorStop(1,'#0b1730');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,py,rw,rh,0,0,7);ctx.fill();
 ctx.strokeStyle=d.g;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,py,rw*.96,rh*.94,0,0,7);ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,py,rw*.7,rh*.68,0,0,7);ctx.stroke();
 for(let i=0;i<28;i++){const a=pT*.7+i/28*6.283,px=x+Math.cos(a)*rw*.83,qy=py+Math.sin(a)*rh*.8,l=.5+.5*Math.sin(a*2-pT*3);ctx.fillStyle=`rgba(255,255,255,${.15+l*.6})`;ctx.fillRect(px-1.5,qy-1.5,3,3)}
 glow(x,py,s*.95,d.g,.55);
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(pT*.8)*.03);ctx.translate(-x,-y);car(x,y,s*(HW[d.m]||2.1)/2.1*(d.m==='truck'?.68:1),pc,d.m,true,1);ctx.restore();
 V=k;boost=kb}
function showName(){return;const d=VEH[prev],mob=W<700;if(mob)return;const x=W*.27,own=SV.own.includes(d.id),ty=H*.13;ctx.save();ctx.textAlign='center';ctx.textBaseline='alphabetic';
 ctx.fillStyle='#fff';ctx.shadowColor='rgba(5,12,30,.8)';ctx.shadowBlur=16;ctx.font=`900 ${Math.min(58,W*.042)}px 'Barlow Condensed',Impact,sans-serif`;try{ctx.letterSpacing='2px'}catch(e){}ctx.fillText(d.n.toUpperCase(),x,ty);
 ctx.shadowBlur=8;ctx.font=`800 12px 'DM Sans',sans-serif`;try{ctx.letterSpacing='3px'}catch(e){}ctx.fillStyle='#6ff0ef';
 ctx.fillText((d.m==='bike'?'SUPERBIKE':d.m==='truck'?'HEAVY TRUCK':'SPORTS CAR')+'  •  '+(own?(SV.sel===d.id?'EQUIPPED':'OWNED'):'LOCKED'),x,ty+24);ctx.restore()}
// hub UI
const $b=$('tabBody'),upCost=(i,u)=>Math.round(200*(u[i]+1)*(1+SV.sel*.5));
const UI=['⚙️','🎯','⚡','🛡️','🧲','🔰'],TI={coins:'✦',pass:'🏁',nitro:'⚡',dist:'🛣️',clean:'🛡️'};
function renderModal(){$b.dataset.tab=tab;document.querySelectorAll('#mmTabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
 if(tab==='veh'){const bar=(x,a,b)=>`<i><b style="width:${Math.round(clamp((x-a)/(b-a),.05,1)*100)}%"></b></i>`;
  $b.innerHTML='<p class="hint">Bars: speed • handling • nitro. Buy with coins from your runs.</p>'+VEH.map(v=>{const o=SV.own.includes(v.id);return`<div class="vc${v.id===prev?' sel':''}${o?'':' locked'}" data-v="${v.id}"><span class="sw" style="background:linear-gradient(145deg,${v.c},${v.c}99)">${v.m==='bike'?'🏍':v.m==='truck'?'🚚':'🏎'}</span><div class="vi"><b>${v.n}</b> <small>${v.m==='bike'?'BIKE':v.m==='truck'?'TRUCK':'CAR'}</small><div class="bars"><div class="sr"><em>SPD</em>${bar(v.s[0],.9,1.5)}</div><div class="sr"><em>HND</em>${bar(v.s[1],.9,1.35)}</div><div class="sr"><em>NOS</em>${bar(v.s[2],20,40)}</div></div></div>${o?(SV.sel===v.id?'<button disabled>EQUIPPED</button>':`<button data-s="${v.id}">EQUIP</button>`):`<button data-b="${v.id}"${SV.coins<v.p?' disabled':''}>✦ ${v.p.toLocaleString()}</button>`}</div>`}).join('')}
 else if(tab==='daily'){$b.innerHTML=renderDaily()}
 else if(tab==='ach'){$b.innerHTML=renderAch()}
 else if(tab==='cust'){$b.innerHTML=renderCust()}
 else if(tab==='set'){const c=SV.ctl,O=(id,ic,t,s)=>`<button class="opt${c===id?' on':''}" data-c="${id}"><b>${ic}</b><span><em>${t}</em><small>${s}</small></span></button>`;
  $b.innerHTML=`<p class="hint">CONTROLS • choose how you steer (keyboard A / D and arrow keys always work)</p><div class="opts">${O('arrows','◀ ▶','ARROW BUTTONS','Tap the left / right buttons')}${O('wheel','🎡','STEERING WHEEL','Wheel on the left • NITRO and BRAKE on the right')}${O('tilt','📱','SCREEN TILT','Lean the phone left / right • car turns that way • NITRO and BRAKE on the right')}</div>`+(c==='tilt'?`<div class="tiltset"><div class="trow"><b>TILT SENSITIVITY</b><span id="tiltVal">${SV.tiltSens.toFixed(1)}×</span></div><input type="range" id="tiltSens" min="0.6" max="1.6" step="0.1" value="${SV.tiltSens}"><small>Hold your phone in landscape and lean it LEFT or RIGHT: the car goes the way you lean. The straight position is set when a run starts or resumes; tap the bar in-game to re-centre. Needs a phone or tablet with a motion sensor (the game must be opened over https).</small></div>`:'')+ENVB()}
 else{const d=VEH[SV.sel],u=UP(d.id),pw=SV.pown[d.id]=SV.pown[d.id]||[],cur=SV.paint[d.id]||d.c;$b.innerHTML=`<div class="uphead">${d.n}</div><p class="hint">PAINT • ✦150 per new color (owned colors are free)</p><div class="pal">${PAL.map(c=>`<button class="pc${c===cur?' on':''}" data-p="${c}" style="background:${c}"${c!==cur&&c!==d.c&&!pw.includes(c)&&SV.coins<150?' disabled':''}></button>`).join('')}</div>`+['ENGINE • top speed','HANDLING • steering','NITRO • charge per canister','ARMOR • max health','MAGNET • coin pickup range','SHIELD • longer protection after a hit'].map((n,i)=>{const c=upCost(i,u);return`<div class="ur"><div class="ic">${UI[i]}</div><div class="tx"><b>${n.split(' • ')[0]}</b><small>${n.split(' • ')[1]}</small><div class="pips">${[0,1,2,3,4].map(q=>`<u class="${q<u[i]?'f':''}"></u>`).join('')}</div></div><button data-u="${i}"${u[i]>=5||SV.coins<c?' disabled':''}>${u[i]>=5?'MAX':'✦ '+c}</button></div>`}).join('')}}
$b.onclick=e=>{const t=e.target.closest('[data-m],[data-p],[data-b],[data-s],[data-u],[data-l],[data-v],[data-c],[data-w],[data-dl],[data-dm],[data-dmb],[data-ac],[data-cr],[data-cs],[data-cn],#goBtn');if(!t)return;resumeAudio();SFX.click();const d=t.dataset;
 if(t.id==='goBtn'){if(SV.ctl==='tilt')enableTilt();lvl=endless||racing||trial?1:selLv;start();return}
 if(progClick(d)){saveSV();applyV();renderHub();return}
 if(d.m!==undefined){endless=d.m==='endless';racing=d.m==='race'}
 else if(d.p!==undefined){const id=SV.sel,pw=SV.pown[id]=SV.pown[id]||[];if(pw.includes(d.p)||d.p===VEH[id].c||SV.coins>=150){if(!pw.includes(d.p)&&d.p!==VEH[id].c){SV.coins-=150;pw.push(d.p)}SV.paint[id]=d.p}}
 else if(d.b!==undefined){const v=VEH[+d.b];if(SV.coins>=v.p){SV.coins-=v.p;SV.own.push(v.id);SV.sel=prev=v.id}}
 else if(d.s!==undefined)SV.sel=prev=+d.s;
 else if(d.u!==undefined){const i=+d.u,u=UP(SV.sel),c=upCost(i,u);if(u[i]<5&&SV.coins>=c){SV.coins-=c;u[i]++}}
 else if(d.l!==undefined){if(+d.l<=SV.unlocked)selLv=+d.l}
 else if(d.c!==undefined){SV.ctl=d.c;applyCtl();if(d.c==='tilt')enableTilt()}
 else if(d.w!==undefined){SV.wx=+d.w;applyWx()}
 else if(d.v!==undefined)prev=+d.v;
 saveSV();applyV();renderHub()};

// ===== PROGRESS: stats • daily login • missions • achievements • garage styling • time trial =====
{const o=x=>x&&typeof x==='object'&&!Array.isArray(x),n=v=>Math.max(0,Math.floor(+v)||0);
 SV.st=o(SV.st)?SV.st:{};for(const k of['dist','coins','pass','nitro','boost','runs','wins','hits','clean','raceW','trial','night','rain','best','ghostW'])SV.st[k]=n(SV.st[k]);
 SV.dl=o(SV.dl)?SV.dl:{};SV.dl.last=typeof SV.dl.last==='string'?SV.dl.last:'';SV.dl.s=clamp(n(SV.dl.s),0,7);
 SV.dm=o(SV.dm)&&Array.isArray(SV.dm.l)?SV.dm:{d:'',l:[],b:0};
 SV.ach=o(SV.ach)?SV.ach:{};SV.cu=o(SV.cu)?SV.cu:{};SV.cuo=o(SV.cuo)?SV.cuo:{};
 SV.tt=o(SV.tt)&&Array.isArray(SV.tt.rec)&&SV.tt.rec.length>=4&&Number.isFinite(+SV.tt.best)?SV.tt:null}
let trial=false,ttRec=[],ttAcc=0,ttGhost=null,ghostObj=null,boostN=0,runWx=[0,0,0,0],autoDaily=false,custOpen=false;
const TT_LEN=3000;
const fmtT=s=>{s=Math.max(0,+s||0);const m=Math.floor(s/60),r=s-m*60;return String(m).padStart(2,'0')+':'+r.toFixed(1).padStart(4,'0')};
// ---- daily login ----
const dkey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dprev=()=>{const d=new Date();d.setDate(d.getDate()-1);return dkey(d)};
const LOGIN=[100,150,200,300,400,500,1000];
const loginDone=()=>SV.dl.last===dkey()?SV.dl.s:(SV.dl.last===dprev()?SV.dl.s%7:0);
const loginCan=()=>SV.dl.last!==dkey();
function claimLogin(){if(!loginCan())return;const i=loginDone();SV.coins+=LOGIN[i];if(i===6)SV.gems=(SV.gems||0)+10;SV.dl.s=i+1;SV.dl.last=dkey()}
// ---- daily missions ----
const MPOOL=[
 {k:'coins',tx:n=>`Collect ${n} coins`,v:[80,150,250],rw:[120,180,260]},
 {k:'pass',tx:n=>`Overtake ${n} vehicles`,v:[20,35,60],rw:[120,180,260]},
 {k:'dist',tx:n=>`Drive ${n} m`,v:[1500,3000,5000],rw:[120,180,260]},
 {k:'nitro',tx:n=>`Collect ${n} nitro canisters`,v:[4,7,10],rw:[120,180,240]},
 {k:'boost',tx:n=>`Use nitro ${n} times`,v:[3,5,8],rw:[120,180,240]},
 {k:'night',tx:n=>`Drive ${n} m at night`,v:[800,1500],rw:[200,300]},
 {k:'rain',tx:n=>`Drive ${n} m in the rain`,v:[800,1500],rw:[200,300]},
 {k:'clean',tx:n=>`Drive ${n} m in one run without a hit`,v:[800,1500],rw:[220,320]},
 {k:'trial',tx:()=>`Finish a Time Trial`,v:[1],rw:[250]},
 {k:'race',tx:()=>`Finish a Race in the top 3`,v:[1],rw:[250]}];
const MI={coins:'✦',pass:'🚗',dist:'🛣️',nitro:'🔵',boost:'⚡',night:'🌙',rain:'🌧️',clean:'🛡️',trial:'⏱️',race:'🏁'};
const mDef=k=>MPOOL.find(m=>m.k===k),mText=m=>mDef(m.k).tx(m.T);
function seedRand(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%100000)/100000}}
function ensureDaily(){const t=dkey();if(SV.dm.d===t&&SV.dm.l.length===3)return;const r=seedRand('hr3d'+t),pool=MPOOL.slice(),l=[];while(l.length<3){const m=pool.splice(Math.floor(r()*pool.length),1)[0],k=Math.floor(r()*m.v.length);l.push({k:m.k,T:m.v[k],rw:m.rw[k],p:0,c:0})}SV.dm={d:t,l,b:0};saveSV()}
// ---- achievements ----
const ACH=[
 {id:'run1',i:'🏁',n:'First Steps',d:'Finish your first run',T:1,g:()=>SV.st.runs,r:50},
 {id:'dist1',i:'🛣️',n:'Marathon',d:'Drive 10,000 m in total',T:10000,g:()=>SV.st.dist,r:200},
 {id:'dist2',i:'🌍',n:'Long Hauler',d:'Drive 100,000 m in total',T:100000,g:()=>SV.st.dist,r:800},
 {id:'coin1',i:'✦',n:'Coin Collector',d:'Collect 500 coins',T:500,g:()=>SV.st.coins,r:150},
 {id:'coin2',i:'💰',n:'Treasure Hunter',d:'Collect 5,000 coins',T:5000,g:()=>SV.st.coins,r:600},
 {id:'pass1',i:'🚗',n:'Overtaker',d:'Overtake 100 vehicles',T:100,g:()=>SV.st.pass,r:150},
 {id:'pass2',i:'🏎️',n:'Traffic Master',d:'Overtake 1,000 vehicles',T:1000,g:()=>SV.st.pass,r:700},
 {id:'nit1',i:'⚡',n:'Nitro Head',d:'Use nitro 50 times',T:50,g:()=>SV.st.boost,r:150},
 {id:'cln1',i:'🛡️',n:'Clean Driver',d:'Drive 1,500 m without a hit, 3 times',T:3,g:()=>SV.st.clean,r:300},
 {id:'rc1',i:'🥇',n:'Champion',d:'Win a race (1st place)',T:1,g:()=>SV.st.raceW,r:300},
 {id:'rc2',i:'🏆',n:'Race Legend',d:'Win 10 races',T:10,g:()=>SV.st.raceW,r:800},
 {id:'lv1',i:'🗺️',n:'Road Tripper',d:'Reach level 10',T:10,g:()=>SV.unlocked,r:300},
 {id:'lv2',i:'⛰️',n:'Highway Hero',d:'Reach level 25',T:25,g:()=>SV.unlocked,r:800},
 {id:'gar1',i:'🚘',n:'Collector',d:'Own 4 vehicles',T:4,g:()=>SV.own.length,r:400},
 {id:'sty1',i:'🎨',n:'Stylist',d:'Style a car with rims, a spoiler or neon',T:1,g:()=>Object.values(SV.cuo).some(l=>Array.isArray(l)&&l.length)?1:0,r:100},
 {id:'tt1',i:'⏱️',n:'Trial Runner',d:'Finish a Time Trial',T:1,g:()=>SV.st.trial,r:150},
 {id:'tt2',i:'👻',n:'Beat Your Ghost',d:'Beat your own best Time Trial',T:1,g:()=>SV.st.ghostW,r:250},
 {id:'ngt',i:'🌙',n:'Night Driver',d:'Drive 3,000 m at night',T:3000,g:()=>SV.st.night,r:200},
 {id:'rn',i:'🌧️',n:'Storm Chaser',d:'Drive 3,000 m in the rain',T:3000,g:()=>SV.st.rain,r:200}];
function evalAch(){const nw=[];for(const a of ACH)if(!SV.ach[a.id]&&a.g()>=a.T){SV.ach[a.id]=1;nw.push(a)}return nw}
function dots(){ensureDaily();const d=(loginCan()?1:0)+SV.dm.l.filter(m=>m.p>=m.T&&!m.c).length+(SV.dm.l.every(m=>m.c)&&!SV.dm.b?1:0);evalAch();const a=ACH.filter(x=>SV.ach[x.id]===1).length;const b1=$('dailyBtn'),b2=$('goalBtn');if(b1)b1.classList.toggle('dot',d>0);if(b2)b2.classList.toggle('dot',a>0)}
// ---- run bookkeeping (called when a run, race or trial ends) ----
function recordRun(k){ensureDaily();const S=SV.st,d=Math.floor(distance),L=[],wn=Math.floor(runWx[1]+runWx[3]),wr=Math.floor(runWx[2]+runWx[3]);
 S.dist+=d;S.coins+=coins;S.pass+=passed;S.nitro+=gN;S.boost+=boostN;S.runs++;S.hits+=hits;if(!hits&&d>=1500)S.clean++;if(d>S.best)S.best=d;S.night+=wn;S.rain+=wr;
 if(k.won)S.wins++;if(k.kind==='race'&&k.place===1)S.raceW++;if(k.kind==='trial'&&k.fin){S.trial++;if(k.beat)S.ghostW++}
 const add={coins,pass:passed,dist:d,nitro:gN,boost:boostN,night:wn,rain:wr};
 for(const m of SV.dm.l){if(m.p>=m.T)continue;let v=m.p;if(m.k in add)v+=add[m.k];else if(m.k==='clean'){if(!hits)v=Math.max(v,d)}else if(m.k==='trial'){if(k.kind==='trial'&&k.fin)v=1}else if(m.k==='race'){if(k.kind==='race'&&k.place<=3)v=1}
  m.p=Math.min(m.T,v);if(m.p>=m.T)L.push('🎯 Mission complete: '+mText(m))}
 for(const a of evalAch())L.push('🏆 Achievement: '+a.n+' (claim ✦'+a.r+')');
 return L}
function showGains(L){if(L&&L.length)$('menuText').innerHTML+='<br><span class="gain">'+L.join('<br>')+'</span>'}
// ---- time trial ----
function ttTick(dt){ttAcc+=dt;while(ttAcc>=.1){ttAcc-=.1;ttRec.push(Math.round(travel*10),Math.round(playerX*100))}
 if(ttGhost){const rec=ttGhost.rec,n=rec.length/2,fi=time/.1,i=Math.floor(fi);let gt,gx;if(i+1<n){const f=fi-i;gt=(rec[i*2]+(rec[i*2+2]-rec[i*2])*f)/10;gx=(rec[i*2+1]+(rec[i*2+3]-rec[i*2+1])*f)/100}else{gt=rec[(n-1)*2]/10;gx=rec[(n-1)*2+1]/100}
  ghostObj={id:-77,kind:'car',ghost:true,x:gx,z:3-(gt-travel),color:'#6ff0ff',model:'sport',done:false}}}
function trialFail(){braking=false;boost=false;mode='over';updateEngine(0,false,false);SFX.lose();SV.coins+=coins;const _L=recordRun({kind:'trial',fin:false});saveSV();
 $('menuTag').textContent='TIME TRIAL FAILED';$('menuTitle').innerHTML='CRASHED<br><em>OUT</em>';
 $('menuText').innerHTML=`Distance <b>${Math.floor(distance)}m</b> of ${TT_LEN} m • Coins <b>✦${coins}</b><br>Best time: ${SV.tt?fmtT(SV.tt.best):'—'}`;showGains(_L);
 $('playBtn').textContent='RETRY TRIAL →';$('nextBtn').style.display='none';$('overlay').classList.remove('hidden')}
function endTrial(){braking=false;boost=false;mode='over';updateEngine(0,false,false);SFX.win();const t=time,old=SV.tt?SV.tt.best:null,nb=old===null||t<old-.004,rw=150+(nb?200:0);
 SV.coins+=coins+rw;if(nb)SV.tt={best:+t.toFixed(2),rec:ttRec.slice()};const _L=recordRun({kind:'trial',fin:true,beat:nb&&old!==null});saveSV();
 $('menuTag').textContent=nb?'NEW PERSONAL BEST':'TIME TRIAL COMPLETE';$('menuTitle').innerHTML=nb?'NEW<br><em>BEST!</em>':'TRIAL<br><em>DONE</em>';
 $('menuText').innerHTML=`Time <b>${fmtT(t)}</b> • Best <b>${fmtT(SV.tt.best)}</b>${old!==null?` • ${t<old?'−':'+'}${Math.abs(t-old).toFixed(2)}s vs your ghost`:''}<br>Coins <b>✦${coins}</b> • Bonus <b>✦${rw}</b>`;showGains(_L);
 $('playBtn').textContent='RETRY TRIAL →';$('nextBtn').style.display='none';$('overlay').classList.remove('hidden')}
const TTCARD=()=>`<small>TIME TRIAL</small><h3>Race your own ghost</h3><p>Drive ${TT_LEN} m as fast as you can through traffic. Your best run is replayed as a glowing ghost car. Finish ✦150, new best +✦200. Best time: ${SV.tt?fmtT(SV.tt.best):'—'}</p>`;
// ---- garage styling ----
const RIMC=['#e11d3a','#ff8a1f','#ffd21f','#5fe333','#18d6e8','#2f7bff','#a74edc','#14161c','#f4f4f4'],NEOC=['#18d6e8','#ff2a6d','#a74edc','#5fe333','#2f7bff','#ffd21f','#ff8a1f','#f4f4f4'];
const SPN=['STOCK','DUCKTAIL','GT WING','RACE WING'],SPP=[0,150,300,450],RIMP=100,NEOP=250,HEX=/^#[0-9a-f]{6}$/i;
const isCar=d=>d.m!=='bike'&&d.m!=='truck';
function CU(id){const c=SV.cu[id]||{};return{rim:typeof c.rim==='string'&&HEX.test(c.rim)?c.rim:null,sp:Number.isInteger(c.sp)&&c.sp>=0&&c.sp<4?c.sp:0,neon:typeof c.neon==='string'&&HEX.test(c.neon)?c.neon:null}}
const cuOwned=(id,key)=>Array.isArray(SV.cuo[id])&&SV.cuo[id].includes(key);
function renderDaily(){ensureDaily();const lc=loginDone(),can=loginCan();
 let h=`<p class="hint">LOGIN BONUS • come back every day, day 7 pays ✦1000 + ◆10. Missing a day restarts the streak.</p><div class="dl-grid">`+LOGIN.map((v,i)=>{const cl=i<lc,cur=can&&i===lc;return`<div class="dl${cl?' got':''}${cur?' now':''}"><small>DAY ${i+1}</small><b>${i===6?'🎁':'✦'}</b><em>${v}</em>${cl?'<i>✓</i>':''}</div>`}).join('')+`</div>`;
 h+=can?`<button class="claim big" data-dl="1">CLAIM TODAY'S ✦${LOGIN[lc]}</button>`:`<p class="hint">✓ Today's bonus collected. Come back tomorrow!</p>`;
 h+=`<p class="hint" style="margin-top:6px">DAILY MISSIONS • new ones every day, progress counts across all modes</p>`+SV.dm.l.map((m,i)=>{const done=m.p>=m.T;return`<div class="ur ms"><div class="ic">${MI[m.k]}</div><div class="tx"><b>${mText(m)}</b><div class="bar"><i style="width:${Math.min(100,m.p/m.T*100)}%"></i></div><small>${Math.min(m.p,m.T).toLocaleString()} / ${m.T.toLocaleString()}</small></div>${m.c?'<button disabled>✓ DONE</button>':`<button data-dm="${i}"${done?'':' disabled'}>${done?'CLAIM ':''}✦${m.rw}</button>`}</div>`}).join('');
 const all=SV.dm.l.every(m=>m.c);
 h+=`<div class="ur ms"><div class="ic">⭐</div><div class="tx"><b>ALL 3 MISSIONS BONUS</b><small>Claim every mission today for extra coins</small></div>${SV.dm.b?'<button disabled>✓ DONE</button>':`<button data-dmb="1"${all?'':' disabled'}>${all?'CLAIM ':''}✦300</button>`}</div>`;
 return h}
function renderAch(){evalAch();const rdy=ACH.filter(a=>SV.ach[a.id]===1).length,got=ACH.filter(a=>SV.ach[a.id]).length;
 return`<p class="hint">${got}/${ACH.length} unlocked${rdy?` • <b style="color:#ffd86b">${rdy} reward${rdy>1?'s':''} ready to claim</b>`:''}</p>`+ACH.slice().sort((a,b)=>(SV.ach[b.id]===1)-(SV.ach[a.id]===1)||(SV.ach[a.id]===2)-(SV.ach[b.id]===2)).map(a=>{const st=SV.ach[a.id]||0,v=Math.min(a.g(),a.T);return`<div class="ur ms${st?' got':''}"><div class="ic">${a.i}</div><div class="tx"><b>${a.n}</b><small>${a.d}</small><div class="bar"><i style="width:${v/a.T*100}%"></i></div><small>${v.toLocaleString()} / ${a.T.toLocaleString()}</small></div>${st===2?'<button disabled>✓ CLAIMED</button>':st===1?`<button data-ac="${a.id}">CLAIM ✦${a.r}</button>`:`<button disabled>🔒 ✦${a.r}</button>`}</div>`}).join('')}
function renderCust(){const d=VEH[prev],own=SV.own.includes(d.id);if(!own)return`<p class="hint">Buy <b>${d.n}</b> first, then style it here.</p>`;
 const c=CU(d.id),car=isCar(d),sw=(attr,val,key,price,on,cls,col)=>{const ow=!price||cuOwned(d.id,key);return`<button class="cs${on?' on':''}${ow?'':' lk'} ${cls||''}" data-${attr}="${val}" ${col?`style="background:${col}"`:''} ${ow||SV.coins>=price?'':'disabled'} aria-label="${val}"></button>`};
 let h=`<p class="hint">Style <b>${d.n}</b> • new items cost coins, items you own are free to switch. Preview is live on the left.</p>`;
 if(car){h+=`<p class="hint" style="margin-top:4px"><b>RIMS</b> • new colour ✦${RIMP}</p><div class="cs-row">${sw('cr','stock','',0,!c.rim,'stock')}${RIMC.map(x=>sw('cr',x,'r:'+x,RIMP,c.rim===x,'',x)).join('')}</div>`;
  h+=`<p class="hint" style="margin-top:4px"><b>SPOILER</b></p><div class="opts" style="margin:4px 0">${SPN.map((n,i)=>{const key='s:'+i,ow=!SPP[i]||cuOwned(d.id,key);return`<button class="opt${c.sp===i?' on':''}" data-cs="${i}" ${ow||SV.coins>=SPP[i]?'':'disabled'}><b>${['—','🪽','🏎️','🏁'][i]}</b><span><em>${n}</em><small>${i===0?'Factory look':ow?'Owned':'✦'+SPP[i]}</small></span></button>`}).join('')}</div>`}
 else h+=`<p class="hint" style="margin-top:4px">Rims and spoilers fit cars only. Neon underglow works on every vehicle.</p>`;
 h+=`<p class="hint" style="margin-top:4px"><b>NEON UNDERGLOW</b> • new colour ✦${NEOP}</p><div class="cs-row">${sw('cn','off','',0,!c.neon,'off')}${NEOC.map(x=>sw('cn',x,'n:'+x,NEOP,c.neon===x,'',x)).join('')}</div>`;
 return h}
function progClick(d){
 if(d.dl!==undefined){claimLogin();return true}
 if(d.dm!==undefined){const m=SV.dm.l[+d.dm];if(m&&m.p>=m.T&&!m.c){m.c=1;SV.coins+=m.rw}return true}
 if(d.dmb!==undefined){if(SV.dm.l.every(m=>m.c)&&!SV.dm.b){SV.dm.b=1;SV.coins+=300}return true}
 if(d.ac!==undefined){const a=ACH.find(x=>x.id===d.ac);if(a&&SV.ach[a.id]===1){SV.ach[a.id]=2;SV.coins+=a.r}return true}
 if(d.cr!==undefined||d.cs!==undefined||d.cn!==undefined){const id=prev,dv=VEH[id];if(!SV.own.includes(id))return true;const c=SV.cu[id]=SV.cu[id]||{};let key,price,apply;
  if(d.cr!==undefined){if(!isCar(dv))return true;if(d.cr==='stock'){c.rim=null;return true}if(!RIMC.includes(d.cr))return true;key='r:'+d.cr;price=RIMP;apply=()=>{c.rim=d.cr}}
  else if(d.cs!==undefined){if(!isCar(dv))return true;const i=+d.cs;if(!(i>=0&&i<4))return true;if(i===0){c.sp=0;return true}key='s:'+i;price=SPP[i];apply=()=>{c.sp=i}}
  else{if(d.cn==='off'){c.neon=null;return true}if(!NEOC.includes(d.cn))return true;key='n:'+d.cn;price=NEOP;apply=()=>{c.neon=d.cn}}
  const ow=SV.cuo[id]=Array.isArray(SV.cuo[id])?SV.cuo[id]:[];if(!ow.includes(key)){if(SV.coins<price)return true;SV.coins-=price;ow.push(key)}apply();return true}
 return false}

// ===== NEW MAIN MENU + LEVEL MAP =====
let mmView='main';
const MAPW=14400,MAPH=400,NX=i=>120+(i-1)*140,NY=i=>200+88*Math.sin(i*.55)+38*Math.sin(i*1.31+1);
const BIOMES=[['MEADOW VALLEY','#9ed76f',['🌳','🌳','🌼','🌾','🌷']],['PINE FOREST','#62b565',['🌲','🌲','🌳','🍄','🌲']],['DESERT RUN','#ecd08c',['🌵','🌵','🪨','🐪','🌵']],['ROCKY PASS','#bdbba8',['⛰️','🪨','🌲','⛰️','🪨']],['SNOW PEAK','#e6f1f7',['🏔️','🌲','⛄','🏔️','🌲']],['COASTAL ROAD','#8fd3c0',['🌴','🌴','⛵','🏖️','🌴']],['FARMLANDS','#b3d96e',['🌾','🏡','🚜','🌳','🌾']],['GREEN HILLS','#82ad5c',['🌳','⛰️','🌲','🌳','🏕️']],['CANYON','#dcb67c',['🪨','🌵','⛰️','🪨','🌵']],['METRO CITY','#b9c3cc',['🏢','🏬','🏠','🏭','🏢']]];
let mapBG=null,mapDragged=false;
function ropeY(x){const f=(x-120)/140,i=clamp(Math.floor(f),0,98),t=clamp(f-i,0,1),a=NY(i+1),b=NY(i+2);return a+(b-a)*t}
function buildMapBG(){let sd=11;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;
 const stops=BIOMES.map((b,i)=>`<stop offset="${((i+.5)*10).toFixed(1)}%" stop-color="${b[1]}"/>`).join('');
 let s=`<defs><linearGradient id="mgl" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient><linearGradient id="mgv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient></defs><rect width="${MAPW}" height="${MAPH}" fill="url(#mgl)"/>`;
 for(const k of [2,4,6,8]){const x0=1440*k+500+rn()*300;s+=`<path d="M${x0} -10 C${x0+140} 100 ${x0-160} 270 ${x0+40} 410" fill="none" stroke="#4aa3e0" stroke-width="40" stroke-linecap="round"/><path d="M${x0} -10 C${x0+140} 100 ${x0-160} 270 ${x0+40} 410" fill="none" stroke="#86ccf5" stroke-width="26" stroke-linecap="round"/>`}
 for(const [bx,by,rx,ry] of [[1000,340,150,46],[9600,60,170,44],[7800,350,130,40],[6900,50,160,42]])s+=`<ellipse cx="${bx}" cy="${by}" rx="${rx}" ry="${ry}" fill="#4aa3e0"/><ellipse cx="${bx-12}" cy="${by-6}" rx="${rx-16}" ry="${ry-12}" fill="#86ccf5"/>`;
 const items=[];
 for(let b=0;b<10;b++)for(let k=0;k<70;k++){const x=b*1440+rn()*1440,y=26+rn()*350;if(Math.abs(y-ropeY(x))<46)continue;items.push([x,y,BIOMES[b][2][Math.floor(rn()*5)],24+rn()*20])}
 items.sort((p,q)=>p[1]-q[1]);
 s+=`<g text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">`+items.map(t=>`<text x="${t[0].toFixed(0)}" y="${t[1].toFixed(0)}" font-size="${t[3].toFixed(0)}">${t[2]}</text>`).join('')+`</g><rect width="${MAPW}" height="${MAPH}" fill="url(#mgv)"/>`;
 return s}
function pathD(p){let d=`M${p[0][0]} ${p[0][1].toFixed(1)}`;for(let i=0;i<p.length-1;i++){const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2;d+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0]} ${p2[1].toFixed(1)}`}return d}
function buildMap(){selLv=clamp(selLv,1,SV.unlocked);if(!mapBG)mapBG=buildMapBG();
 const pts=Array.from({length:100},(_,i)=>[NX(i+1),NY(i+1)]),all=pathD(pts),done=SV.unlocked>1?pathD(pts.slice(0,SV.unlocked)):'';
 const pc=x=>(x/MAPW*100).toFixed(3)+'%',py=y=>(y/MAPH*100).toFixed(2)+'%';
 $('mapIn').innerHTML=`<svg class="map-svg" viewBox="0 0 ${MAPW} ${MAPH}" preserveAspectRatio="none">${mapBG}</svg>
<svg class="map-svg rope" viewBox="0 0 ${MAPW} ${MAPH}" preserveAspectRatio="none"><path d="${all}" transform="translate(0 5)" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="12" stroke-linecap="round"/><path d="${all}" fill="none" stroke="#fffbe8" stroke-opacity=".92" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 12"/>${done?`<path d="${done}" transform="translate(0 5)" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="11" stroke-linecap="round"/><path d="${done}" fill="none" stroke="#ffcf3d" stroke-width="9" stroke-linecap="round"/><path d="${done}" fill="none" stroke="#a5600c" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="7 9"/>`:''}</svg>`
 +BIOMES.map((b,i)=>`<div class="zone" style="left:${pc(Math.max(40,NX(i*10+1)-70))}">${b[0]}</div>`).join('')
 +Array.from({length:100},(_,i)=>{const n=i+1;return`<button class="lvn" data-l="${n}" style="left:${pc(NX(n))};top:${py(NY(n))}">${n>SV.unlocked?'🔒':n}</button>`}).join('')
 +`<div class="map-car" id="mapCar">🏎️</div>`;
 renderMapUI();requestAnimationFrame(()=>scrollToSel(false))}
function scrollToSel(smooth){const ms=$('mapScroll'),x=NX(selLv)/MAPW*$('mapIn').offsetWidth;ms.scrollTo({left:Math.max(0,x-ms.clientWidth/2),behavior:smooth?'smooth':'auto'})}
function renderMapUI(){const sc=$('mapScreen'),cur=racing?'race':endless?'endless':trial?'trial':'journey';sc.classList.toggle('nolevels',cur!=='journey');sc.classList.toggle('rc-on',cur==='race');
 document.querySelectorAll('#mapSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===cur));
 if(cur==='journey'){const k=mkTask(selLv);
  document.querySelectorAll('#mapIn .lvn').forEach(b=>{const n=+b.dataset.l;b.className='lvn'+(n<SV.unlocked?' done':n===SV.unlocked?' cur':' lock')+(n===selLv?' sel':'')+(n%10===0?' ms':'')});
  const car=$('mapCar');if(car){car.style.left=(NX(selLv)/MAPW*100).toFixed(3)+'%';car.style.top=(NY(selLv)/MAPH*100).toFixed(2)+'%'}
  $('mapInfo').innerHTML=`<small>LEVEL ${selLv} TASK</small><b><span class="ti">${TI[k.t]}</span>${k.tx}</b><em>Reward ✦ ${k.rw} • complete it to unlock the next level</em>`;$('mapGo').textContent='START LEVEL '+selLv;}
 else{$('modeCard').innerHTML=cur==='trial'?TTCARD():cur==='race'?`<small>RACE MODE</small><h3>Beat 3 rivals to the finish line</h3><p>Race ${RACE_LEN} m against 3 AI drivers through traffic. Collect blue nitro canisters to overtake. Prizes: 1st ✦400 • 2nd ✦250 • 3rd ✦120. Best finish: ${SV.raceBest?ord(SV.raceBest):'—'}</p>`:`<small>ENDLESS MODE</small><h3>3 lives • speed never stops rising</h3><p>Drive as far as you can. When health hits zero you lose a life and respawn with full health. Lose all 3 and the run ends. Best: ${SV.endBest||0} m • coins you collect are yours to keep.</p>`;
  $('mapGo').textContent=cur==='trial'?'START TRIAL':cur==='race'?'START RACE':'START ENDLESS';if(cur==='race')renderRaceCards()}}
function showView(v){mmView=v;if(v!=='garage')GD=null;$('garage').classList.toggle('hidden',v!=='garage');root.classList.toggle('in-garage',v==='garage');$('mmMain').classList.toggle('hidden',v!=='main');$('mapScreen').classList.toggle('hidden',v!=='map');root.classList.toggle('view-map',v==='map');closeModal();if(v==='map')buildMap();renderHub()}
function updPhoto(){const d=VEH[prev],im=$('mmPhoto'),pl=$('mmPlay'),own=SV.own.includes(d.id);if(d.img){if(im.getAttribute('src')!==d.img)im.src=d.img;im.alt=d.n;im.hidden=false}else im.hidden=true;pl.textContent=own?'PLAY':'BUY'}
function renderHub(){const c=SV.coins.toLocaleString();$('wallet2').textContent=c;$('mmName').textContent=SV.pname||'PLAYER';$('mmAv').textContent=SV.pav||'🏁';$('gems2').textContent=SV.gems.toLocaleString();renderMM();updPhoto();if(mmView==='map')renderMapUI();if(mmView==='garage')gRender();if(!$('mmModal').classList.contains('hidden'))renderModal()}
const vIcon=d=>d.m==='bike'?'🏍':d.m==='truck'?'🚚':'🏎';
let dockTab='paint';
function renderMM(){const d=VEH[prev],own=SV.own.includes(d.id),u=own?UP(d.id):[0,0,0,0,0,0],bar=(x,a,b)=>`<i><b style="width:${Math.round(clamp((x-a)/(b-a),.05,1)*100)}%"></b></i>`;
 $('mmInfo').innerHTML=`<div class="mm-name"><span>${vIcon(d)}</span><b>${d.n.toUpperCase()}</b></div>${own?'':'<div class="mm-lock">🔒</div>'}<div class="mm-tag">${d.m==='bike'?'SUPERBIKE':d.m==='truck'?'HEAVY TRUCK':'SPORTS CAR'} • ${own?(SV.sel===d.id?'EQUIPPED':'OWNED'):'LOCKED'}</div><div class="mm-stats"><div><span>TOP SPEED</span>${bar(d.s[0]*(1+u[0]*.04),.7,1.7)}</div><div><span>HANDLING</span>${bar(d.s[1]*(1+u[1]*.06),.7,1.6)}</div><div><span>NITRO</span>${bar(d.s[2]+u[2]*3,10,50)}</div></div>${own?'':`<div class="mm-price"><i>✦</i>${d.p.toLocaleString()}</div>`}`;
 const pb=$('mmPlay');pb.innerHTML=own?'PLAY <i>≫</i>':'BUY ✦ '+d.p.toLocaleString();pb.classList.toggle('buy',!own);pb.disabled=!own&&SV.coins<d.p;
 renderStrip();renderDock();dots()}
function renderStrip(){const el=$('vStrip');if(!el)return;el.innerHTML=VEH.map(v=>{const o=SV.own.includes(v.id);return`<button class="vchip${v.id===prev?' on':''}${o?'':' lk'}" data-vv="${v.id}"><span>${vIcon(v)}</span><em>${v.n}</em>${o?(SV.sel===v.id?'<i class="eq">✓</i>':''):'<i>🔒</i>'}</button>`}).join('');
 const on=el.querySelector('.on');if(on)el.scrollTo({left:on.offsetLeft-el.clientWidth/2+on.offsetWidth/2,behavior:'smooth'})}
function renderDock(){if(!$('dkStrip'))return;const d=VEH[prev],own=SV.own.includes(d.id),car=isCar(d),st=$('dkStrip'),keep=st.dataset.k===dockTab+':'+prev?st.scrollLeft:0;
 const cats=[['paint','🎨','PAINT'],['upg','🛠','UPGRADE'],...(car?[['rim','⭕','RIMS'],['spo','🪽','SPOILER']]:[]),['neon','💡','NEON']];
 if(!cats.some(x=>x[0]===dockTab))dockTab='paint';
 $('dkTabs').innerHTML=cats.map(x=>`<button class="dk-tab${x[0]===dockTab?' on':''}" data-dt="${x[0]}"><span>${x[1]}</span><em>${x[2]}</em></button>`).join('')+'<span class="dk-hint" id="dkHint"></span>';
 const swt=(attr,val,col,cls,on,label,dis)=>`<button class="dk-sw${on?' on':''}" data-${attr}="${val}"${dis?' disabled':''}><i class="${cls||''}"${col?` style="background:${col}"`:''}></i><em>${label}</em></button>`;
 let h='',hint='';
 if(!own){h=`<div class="dk-lock"><span>🔒</span><div><b>${d.n}</b> is locked<small>Buy it to paint, upgrade and style it. You can preview it here.</small></div></div>`}
 else if(dockTab==='paint'){const pw=SV.pown[d.id]=SV.pown[d.id]||[],cur=SV.paint[d.id]||d.c;
  h=[d.c,...PAL.filter(x=>x!==d.c)].map(x=>{const ow=x===d.c||pw.includes(x);return swt('gp',x,x,'',x===cur,x===cur?'ON':ow?(x===d.c?'STOCK':'OWNED'):'✦150',!ow&&SV.coins<150)}).join('');hint='PAINT • ✦150 per new colour, owned colours are free'}
 else if(dockTab==='upg'){const u=UP(d.id),nm=[['ENGINE','top speed'],['HANDLING','steering'],['NITRO','charge'],['ARMOR','max health'],['MAGNET','coin range'],['SHIELD','hit protection']];
  h=nm.map((n,i)=>{const cs=upCost(i,u);return`<div class="dk-up"><b>${UI[i]}</b><div class="dk-ut"><strong>${n[0]}</strong><small>${n[1]}</small><div class="pips">${[0,1,2,3,4].map(q=>`<u class="${q<u[i]?'f':''}"></u>`).join('')}</div></div><button data-gu="${i}"${u[i]>=5||SV.coins<cs?' disabled':''}>${u[i]>=5?'MAX':'✦ '+cs}</button></div>`}).join('');hint='UPGRADES • up to level 5'}
 else if(dockTab==='rim'){const cu=CU(d.id);
  h=swt('cr','stock',null,'stock',!cu.rim,!cu.rim?'ON':'STOCK',false)+RIMC.map(x=>{const ow=cuOwned(d.id,'r:'+x);return swt('cr',x,x,'',cu.rim===x,cu.rim===x?'ON':ow?'OWNED':'✦'+RIMP,!ow&&SV.coins<RIMP)}).join('');hint='RIMS • ✦'+RIMP+' per new colour'}
 else if(dockTab==='spo'){const cu=CU(d.id);
  h=SPN.map((n,i)=>{const ow=!SPP[i]||cuOwned(d.id,'s:'+i),on=cu.sp===i;return`<button class="dk-card${on?' on':''}" data-cs="${i}"${ow||SV.coins>=SPP[i]?'':' disabled'}><b>${['—','🪽','🏎️','🏁'][i]}</b><strong>${n}</strong><small>${on?'ON':i===0?'FACTORY':ow?'OWNED':'✦'+SPP[i]}</small></button>`}).join('');hint='SPOILER'}
 else{const cu=CU(d.id);
  h=swt('cn','off',null,'off',!cu.neon,!cu.neon?'ON':'OFF',false)+NEOC.map(x=>{const ow=cuOwned(d.id,'n:'+x);return swt('cn',x,x,'',cu.neon===x,cu.neon===x?'ON':ow?'OWNED':'✦'+NEOP,!ow&&SV.coins<NEOP)}).join('');hint='NEON UNDERGLOW • ✦'+NEOP+' per new colour'}
 st.innerHTML=h;st.dataset.k=dockTab+':'+prev;st.scrollLeft=keep;const hn=$('dkHint');if(hn)hn.textContent=hint}
$('mmMain').addEventListener('click',e=>{const t=e.target.closest('[data-dt],[data-vv],[data-gp],[data-gu],[data-cr],[data-cs],[data-cn]');if(!t||t.disabled)return;resumeAudio();const d=t.dataset;SFX.click();
 if(d.dt){dockTab=d.dt;renderDock();return}
 if(d.vv!==undefined){prev=+d.vv;renderHub();return}
 const id=prev;if(!SV.own.includes(id))return;
 if(d.gp!==undefined){const pw=SV.pown[id]=SV.pown[id]||[];if(PAL.includes(d.gp)||d.gp===VEH[id].c){if(pw.includes(d.gp)||d.gp===VEH[id].c||SV.coins>=150){if(!pw.includes(d.gp)&&d.gp!==VEH[id].c){SV.coins-=150;pw.push(d.gp)}SV.paint[id]=d.gp}}}
 else if(d.gu!==undefined){const i=+d.gu,u=UP(id);if(i>=0&&i<6){const cs=upCost(i,u);if(u[i]<5&&SV.coins>=cs){SV.coins-=cs;u[i]++}}}
 else progClick(d);
 saveSV();applyV();renderHub()});
function openModal(t){tab=t;custOpen=t==='cust';$('mmTitle').textContent={set:'SETTINGS',daily:'DAILY REWARDS',ach:'ACHIEVEMENTS',cust:'STYLE YOUR CAR'}[t]||'SHOP';$('mmTabs').style.display=(t==='veh'||t==='upg')?'':'none';$('mmModal').classList.toggle('side',t==='cust');root.classList.toggle('style-open',t==='cust');$('mmModal').classList.remove('hidden');root.classList.add('modal-open');renderModal()}
function closeModal(){custOpen=false;root.classList.remove('style-open');$('mmModal').classList.remove('side');$('mmModal').classList.add('hidden');root.classList.remove('modal-open')}
$('vPrev').onclick=()=>{resumeAudio();SFX.click();prev=(prev+VEH.length-1)%VEH.length;renderHub()};
$('vNext').onclick=()=>{resumeAudio();SFX.click();prev=(prev+1)%VEH.length;renderHub()};
$('mmPlay').onclick=()=>{resumeAudio();const d=VEH[prev];
 if(SV.own.includes(d.id)){SFX.click();SV.sel=prev;saveSV();applyV();showView('map')}
 else{SFX.click();openBuy(d)}};
// ===== PURCHASE DIALOG (coins or diamonds) =====
let buyId=0;
function openBuy(d){buyId=d.id;const b=(x,a,c)=>`<i><b style="width:${Math.round(clamp((x-a)/(c-a),.05,1)*100)}%"></b></i>`;
 $('buyBody').innerHTML=(d.img?`<img class="buy-img" src="${d.img}" alt="${d.n}">`:'')+`<div class="buy-info"><b class="buy-n">${d.n.toUpperCase()}</b><div class="mm-stats"><div><span>TOP SPEED</span>${b(d.s[0],.7,1.7)}</div><div><span>HANDLING</span>${b(d.s[1],.7,1.6)}</div><div><span>NITRO</span>${b(d.s[2],10,50)}</div></div><div class="buy-btns"><button id="buyCoin"${SV.coins<d.p?' class="no"':''}><i>✦</i> ${d.p.toLocaleString()}<small>BUY WITH COINS</small></button><button id="buyGem" class="g${SV.gems<d.gm?' no':''}"><i>◆</i> ${d.gm}<small>BUY WITH DIAMONDS</small></button></div><em id="buyMsg"></em></div>`;
 $('buyModal').classList.remove('hidden');$('buyCoin').onclick=()=>doBuy('c');$('buyGem').onclick=()=>doBuy('g')}
function doBuy(k){const d=VEH[buyId],m=$('buyMsg');if(SV.own.includes(d.id))return;
 if(k==='c'){if(SV.coins<d.p){m.textContent='Not enough coins — earn more in runs, daily rewards and goals';SFX.click();return}SV.coins-=d.p}
 else{if(SV.gems<d.gm){m.textContent='Not enough diamonds — claim them in Daily Rewards';SFX.click();return}SV.gems-=d.gm}
 SV.own.push(d.id);SV.sel=prev=d.id;saveSV();applyV();$('buyModal').classList.add('hidden');renderHub()}
$('buyX').onclick=()=>{SFX.click();$('buyModal').classList.add('hidden')};
$('buyModal').addEventListener('click',e=>{if(e.target===$('buyModal'))$('buyModal').classList.add('hidden')});
$('setBtn').onclick=()=>{resumeAudio();SFX.click();openModal('set')};
$('dailyBtn').onclick=()=>{resumeAudio();SFX.click();openModal('daily')};$('goalBtn').onclick=()=>{resumeAudio();SFX.click();openModal('ach')};
$('mmClose').onclick=()=>{SFX.click();closeModal();renderHub()};
$('mmModal').addEventListener('click',e=>{if(e.target===$('mmModal')){closeModal();renderHub()}});
$('mmTabs').onclick=e=>{const t=e.target.dataset.t;if(t){tab=t;renderModal()}};
// ===== GARAGE (full customization screen) =====
const GTABS=[['body','🎨','BODY'],['rim','⭕','RIMS'],['spo','🪽','SPOILER'],['exh','💨','EXHAUST',1],['neon','💡','NEON'],['vin','🏁','VINYLS',1],['tint','🕶','WINDOW TINT',1],['perf','⚙️','PERFORMANCE'],['susp','🔩','SUSPENSION']];
const GUPN=[['ENGINE','Top speed','⚙️'],['HANDLING','Steering grip','🎯'],['NITRO','Charge per canister','⚡'],['ARMOR','Max health','🛡️'],['MAGNET','Coin pickup range','🧲'],['SHIELD','Protection after a hit','🔰']];
const GGROUP={perf:[0,2,4],susp:[1,3,5]},SPGEM=[0,0,0,10];
let gTab='body';
const gUpC=(id,lv)=>Math.round(200*(lv+1)*(1+id*.5));
function gInit(){const id=prev,d=VEH[id],c=CU(id);GD={id,paint:SV.paint[id]||d.c,rim:c.rim,sp:c.sp,neon:c.neon,up:UP(id).slice()}}
function gMsg(t){const m=$('gMsg');m.textContent=t;m.classList.add('on');clearTimeout(gMsg.t);gMsg.t=setTimeout(()=>m.classList.remove('on'),2400)}
function gCost(){const id=GD.id,d=VEH[id],pw=SV.pown[id]||[],cu=CU(id),u=UP(id);let c=0,g=0,n=0;
 if(GD.paint!==(SV.paint[id]||d.c)){n++;if(GD.paint!==d.c&&!pw.includes(GD.paint))c+=150}
 if(GD.rim!==cu.rim){n++;if(GD.rim&&!cuOwned(id,'r:'+GD.rim))c+=RIMP}
 if(GD.sp!==cu.sp){n++;if(GD.sp>0&&!cuOwned(id,'s:'+GD.sp)){if(SPGEM[GD.sp])g+=SPGEM[GD.sp];else c+=SPP[GD.sp]}}
 if(GD.neon!==cu.neon){n++;if(GD.neon&&!cuOwned(id,'n:'+GD.neon))c+=NEOP}
 for(let i=0;i<6;i++){if(GD.up[i]!==u[i])n++;for(let l=u[i];l<GD.up[i];l++)c+=gUpC(id,l)}
 return{c,g,n}}
function gStats(u){const d=VEH[GD.id],sc=(x,a,b)=>Math.round(clamp((x-a)/(b-a),.05,1)*1000);
 return[['Speed',sc(d.s[0]*(1+u[0]*.04),.7,1.7)],['Nitro',sc(d.s[2]+u[2]*3,10,50)],['Handling',sc(d.s[1]*(1+u[1]*.06),.7,1.6)],['Armor',sc(100+(d.a||0)+u[3]*10,50,200)]]}
function gRender(){if(!GD||GD.id!==prev)gInit();
 const id=GD.id,d=VEH[id],own=SV.own.includes(id),car=isCar(d);if(!car&&(gTab==='rim'||gTab==='spo'))gTab='body';
 $('gLvl').textContent='Lv. '+SV.unlocked;$('gLvlBar').style.width=Math.min(100,SV.unlocked)+'%';
 $('gCoins').textContent=SV.coins.toLocaleString();$('gGems').textContent=SV.gems.toLocaleString();
 const now=gStats(GD.up),was=gStats(UP(id)),tot=Math.round(now.reduce((a,x)=>a+x[1],0)/4),cl=tot>=650?'S':tot>=520?'A':tot>=420?'B':tot>=320?'C':'D';
 $('gStats').innerHTML=`<div class="gs-head"><span class="gs-logo">${vIcon(d)}</span><div><b>${d.n}</b><small>RANK ${cl} ${tot}</small></div><span class="cls c${cl}" title="Class ${cl}">${cl}</span></div>`+now.map((s,i)=>{const df=s[1]-was[i][1],base=Math.min(s[1],was[i][1]);return`<div class="gs-row"><span>${s[0]}</span><b>${s[1]}${df>0?`<u>+${df}</u>`:''}</b><i><s style="width:${base/10}%"></s>${df>0?`<s class="ad" style="left:${base/10}%;width:${df/10}%"></s>`:''}</i></div>`}).join('');
 $('gCar').innerHTML=`<span>${vIcon(d)}</span><b>${d.n}</b>${own?`<em>${SV.sel===id?'EQUIPPED':'OWNED'}</em>`:`<em class="lk">🔒 ✦${d.p.toLocaleString()}</em>`}`;
 $('gTabs').innerHTML=GTABS.map(t=>{const soon=t[3],dis=!car&&(t[0]==='rim'||t[0]==='spo');return`<button class="gt${t[0]===gTab?' on':''}${soon?' soon':''}${dis?' dis':''}" data-gt="${t[0]}"><span>${t[1]}</span><em>${t[2]}</em>${soon?'<small>SOON</small>':''}</button>`}).join('');
 document.querySelectorAll('#gSide button').forEach(b=>{const k=b.dataset.gs;b.classList.toggle('on',k==='cust'?!GGROUP[gTab]:k==='upg'?gTab==='perf':k==='tune'?gTab==='susp':false)});
 const tile=(k,v,bg,on,lab,cls)=>`<button class="gsw${on?' on':''}${cls?' '+cls:''}" data-gk="${k}" data-gv="${v}"><span class="gtile"${bg?` style="background:${bg}"`:''}>${on?'<b>✓</b>':''}</span><em>${lab}</em></button>`;
 const grad=c=>`linear-gradient(145deg,${c},${c}b0)`;let h='';
 if(!own)h=`<div class="g-lock"><span>🔒</span><div><b>${d.n} is locked</b><small>Buy it for ✦${d.p.toLocaleString()} to paint, upgrade and style it. You can still preview it here.</small></div></div>`;
 else if(gTab==='body'){const pw=SV.pown[id]||[];h=[d.c,...PAL.filter(x=>x!==d.c)].map(x=>{const ow=x===d.c||pw.includes(x);return tile('paint',x,grad(x),x===GD.paint,ow?(x===d.c?'STOCK':'OWNED'):'✦150')}).join('')}
 else if(gTab==='rim')h=tile('rim','stock','',!GD.rim,'STOCK','stock')+RIMC.map(x=>tile('rim',x,grad(x),GD.rim===x,cuOwned(id,'r:'+x)?'OWNED':'✦'+RIMP)).join('');
 else if(gTab==='neon')h=tile('neon','off','',!GD.neon,'OFF','off')+NEOC.map(x=>tile('neon',x,grad(x),GD.neon===x,cuOwned(id,'n:'+x)?'OWNED':'✦'+NEOP)).join('');
 else if(gTab==='spo')h=SPN.map((n,i)=>{const ow=!SPP[i]||cuOwned(id,'s:'+i),pr=SPGEM[i]?'◆'+SPGEM[i]:'✦'+SPP[i];return`<button class="gcard${GD.sp===i?' on':''}" data-gk="sp" data-gv="${i}"><b>${['—','🪽','🏎️','🏁'][i]}</b><strong>${n}</strong><small>${i===0?'FACTORY':ow?'OWNED':pr}</small></button>`}).join('');
 else if(GGROUP[gTab]){const u=UP(id);h=GGROUP[gTab].map(i=>{const n=GUPN[i],lv=GD.up[i],base=u[i];return`<div class="gup"><b>${n[2]}</b><div class="gu-t"><strong>${n[0]}</strong><small>${n[1]}</small><div class="gpips">${[0,1,2,3,4].map(q=>`<u class="${q<base?'f':q<lv?'s':''}"></u>`).join('')}</div></div><div class="gu-b"><button data-gk="up" data-gv="${i}:-1"${lv<=base?' disabled':''}>−</button><button data-gk="up" data-gv="${i}:1"${lv>=5?' disabled':''}>${lv>=5?'MAX':'+ ✦'+gUpC(id,lv)}</button></div></div>`}).join('')}
 const sw=$('gSw');sw.dataset.t=gTab;sw.innerHTML=h;
 const t=gCost(),sv=$('gSave');
 $('gCost').innerHTML=own?`<i>✦</i> ${t.c.toLocaleString()}${t.g?` <i class="gm">◆</i> ${t.g}`:''}`:`<i>✦</i> ${d.p.toLocaleString()}`;
 sv.classList.toggle('idle',own&&!t.n);sv.classList.toggle('poor',own?(SV.coins<t.c||SV.gems<t.g):SV.coins<d.p);
 sv.querySelector('b').textContent=own?'SAVE CHANGES':'BUY CAR';sv.querySelector('span').textContent=own?'🏁':'🔓'}
function gPick(k,v){const id=GD.id,d=VEH[id];if(!SV.own.includes(id)){gMsg('Buy this car first');return}
 if(k==='paint'){if(v===d.c||PAL.includes(v))GD.paint=v}
 else if(k==='rim'){if(!isCar(d))return;if(v==='stock')GD.rim=null;else if(RIMC.includes(v))GD.rim=v}
 else if(k==='neon'){if(v==='off')GD.neon=null;else if(NEOC.includes(v))GD.neon=v}
 else if(k==='sp'){if(!isCar(d))return;const i=+v;if(i>=0&&i<4)GD.sp=i}
 else if(k==='up'){const[i,dl]=v.split(':').map(Number);if(i>=0&&i<6)GD.up[i]=clamp(GD.up[i]+dl,UP(id)[i],5)}
 gRender()}
function gSave(){const id=GD.id,d=VEH[id];
 if(!SV.own.includes(id)){if(SV.coins>=d.p){SV.coins-=d.p;SV.own.push(id);SV.sel=prev=id;saveSV();applyV();gInit();renderHub();gMsg(d.n+' unlocked')}else gMsg('Not enough coins');return}
 const t=gCost();if(!t.n){gMsg('No changes to save');return}
 if(SV.coins<t.c){gMsg('Not enough coins');return}if(SV.gems<t.g){gMsg('Not enough diamonds');return}
 SV.coins-=t.c;SV.gems-=t.g;
 const pw=SV.pown[id]=SV.pown[id]||[];if(GD.paint!==d.c&&!pw.includes(GD.paint))pw.push(GD.paint);SV.paint[id]=GD.paint;
 const c=SV.cu[id]=SV.cu[id]||{},ow=SV.cuo[id]=Array.isArray(SV.cuo[id])?SV.cuo[id]:[],own=k=>{if(!ow.includes(k))ow.push(k)};
 c.rim=GD.rim;if(GD.rim)own('r:'+GD.rim);c.sp=GD.sp;if(GD.sp>0)own('s:'+GD.sp);c.neon=GD.neon;if(GD.neon)own('n:'+GD.neon);
 const u=UP(id);for(let i=0;i<6;i++)u[i]=GD.up[i];
 saveSV();applyV();gInit();renderHub();gMsg('Saved')}
function gLeave(){showView('main')}
function gInfoFill(){const up=Object.values(SV.up).reduce((a,l)=>a+l.reduce((x,y)=>x+y,0),0),sty=Object.values(SV.cuo).reduce((a,l)=>a+(Array.isArray(l)?l.length:0),0);
 $('gInfo').innerHTML=`<div class="gi-card"><div class="gi-h"><b>GARAGE INFO</b><button id="gInfoX" aria-label="Close">✕</button></div><div class="gi-g"><div><small>Vehicles owned</small><b>${SV.own.length} / ${VEH.length}</b></div><div><small>Journey level</small><b>${SV.unlocked} / 100</b></div><div><small>Upgrade levels</small><b>${up}</b></div><div><small>Styles owned</small><b>${sty}</b></div></div><p>Diamonds ◆ come from the day-7 daily reward (+10) and from finishing every 10th journey level (+5). The Race Wing spoiler costs ◆10. Changes only apply when you press Save changes.</p></div>`}
{const gEl=$('garage'),setU=()=>{const r=gEl.getBoundingClientRect();if(r.width)gEl.style.setProperty('--u',Math.min(r.width/100,r.height/56.25).toFixed(3)+'px')};
 if(window.ResizeObserver)new ResizeObserver(setU).observe(gEl);window.addEventListener('resize',setU);setU()}
// ===== PLAYER PROFILE (name + picture, chosen on first start) =====
const PAVS=['🏁','🏎','🚗','🏍','🚚','🦅','🐺','🦁','🔥','⚡','👑','🎯'];
let profAv='🏁',profFirst=false;
function openProfile(first){profFirst=!!first;profAv=SV.pav||'🏁';$('profT').textContent=first?'WELCOME, DRIVER':'YOUR PROFILE';$('profGo').textContent=first?'START':'SAVE';$('profName').value=SV.pname||'';profDraw();$('profSetup').classList.remove('hidden');setTimeout(()=>{try{$('profName').focus()}catch(e){}},50)}
function profDraw(){$('profAv').innerHTML=PAVS.map(a=>`<button type="button" class="${a===profAv?'on':''}" data-pa="${a}" aria-label="Avatar ${a}">${a}</button>`).join('')}
$('profAv').addEventListener('click',e=>{const b=e.target.closest('[data-pa]');if(!b)return;SFX.click();profAv=b.dataset.pa;profDraw()});
function profSave(){const n=$('profName').value.replace(/\s+/g,' ').trim().slice(0,14);if(!n){$('profName').classList.add('bad');$('profName').focus();return}
 $('profName').classList.remove('bad');SV.pname=n;SV.pav=profAv;saveSV();$('profSetup').classList.add('hidden');renderHub();
 if(profFirst&&!autoDaily&&loginCan()){autoDaily=true;openModal('daily')}}
$('profGo').onclick=()=>{resumeAudio();SFX.click();profSave()};
$('profName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();profSave()}e.stopPropagation()});
$('profName').addEventListener('input',()=>$('profName').classList.remove('bad'));
$('mmProfile').addEventListener('click',()=>{resumeAudio();SFX.click();openProfile(false)});
$('mmProfile').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile(false)}});
$('garageBtn').onclick=()=>{resumeAudio();SFX.click();gTab='body';GD=null;showView('garage')};
$('garage').addEventListener('click',e=>{const t=e.target.closest('button');if(!t||t.disabled)return;resumeAudio();const d=t.dataset;SFX.click();
 if(t.id==='gBack'||t.id==='gHome'){gLeave();return}
 if(t.id==='gGear'){openModal('set');return}
 if(t.id==='gPrev'||t.id==='gNext'){prev=(prev+(t.id==='gNext'?1:VEH.length-1))%VEH.length;gInit();renderHub();return}
 if(t.id==='gSave'){gSave();return}
 if(t.id==='gInfoX'){$('gInfo').classList.add('hidden');return}
 if(d.gplus){if(d.gplus==='gems')openModal('daily');else gMsg('Earn coins in runs, daily rewards and goals');return}
 if(d.gs){if(d.gs==='info'){const o=$('gInfo');if(o.classList.contains('hidden')){gInfoFill();o.classList.remove('hidden')}else o.classList.add('hidden')}else{gTab=d.gs==='cust'?'body':d.gs==='upg'?'perf':'susp';gRender()}return}
 if(d.gt){const tb=GTABS.find(x=>x[0]===d.gt);if(tb[3]){gMsg(tb[2]+' is coming soon');return}if(t.classList.contains('dis')){gMsg('Rims and spoilers fit cars only');return}gTab=d.gt;gRender();return}
 if(d.gk)gPick(d.gk,d.gv)});
// level map interactions
$('mapScreen').addEventListener('click',e=>{if(mapDragged){mapDragged=false;return}
 const t=e.target.closest('[data-l],[data-m],#mapGo,#mapBack');if(!t)return;resumeAudio();SFX.click();
 if(t.id==='mapBack'){showView('main');return}
 if(t.id==='mapGo'){if(SV.ctl==='tilt')enableTilt();lvl=endless||racing||trial?1:selLv;start();return}
 if(t.dataset.m){endless=t.dataset.m==='endless';racing=t.dataset.m==='race';trial=t.dataset.m==='trial';renderMapUI();if(!endless&&!racing&&!trial)scrollToSel(false);else $('mapScroll').scrollLeft=0;return}
 if(t.dataset.l){const n=+t.dataset.l;if(n<=SV.unlocked){selLv=n;renderMapUI()}else{t.classList.add('shake');setTimeout(()=>t.classList.remove('shake'),400)}}});
{const ms=$('mapScroll');let dragX=null,dragL=0;
 ms.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||endless||racing||trial)return;dragX=e.clientX;dragL=ms.scrollLeft;mapDragged=false});
 window.addEventListener('pointermove',e=>{if(dragX===null)return;const dx=e.clientX-dragX;if(Math.abs(dx)>6)mapDragged=true;ms.scrollLeft=dragL-dx});
 window.addEventListener('pointerup',()=>{if(dragX!==null){dragX=null;setTimeout(()=>{mapDragged=false},0)}});
 ms.addEventListener('wheel',e=>{if(endless||racing||trial)return;if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){ms.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false})}
$b.oninput=e=>{if(e.target.id==='tiltSens'){SV.tiltSens=+e.target.value;$('tiltVal').textContent=SV.tiltSens.toFixed(1)+'×';saveSV()}};
function openHub(){updateEngine(0,false,false);root.classList.remove('racing-ui');$('raceRes').classList.add('hidden');root.classList.add('in-hub');showGameHud(false);mode='hub';objects=[];rivals=[];rivalDraw=[];sparks=[];boost=false;playerX=0;selLv=Math.min(selLv,SV.unlocked);prev=SV.sel;$('overlay').classList.add('hidden');$('taskHud').style.display='none';$('hub').classList.remove('hidden');showView('main');if(!SV.pname)openProfile(true);else if(!autoDaily&&loginCan()){autoDaily=true;openModal('daily')}}
$('nextBtn').onclick=()=>{lvl=Math.min(100,lvl+1);selLv=lvl;start()};$('menuBtn').onclick=openHub;
function updateHUD(force=false){if(!force&&hudElapsed<.08)return;hudElapsed=0;if(SV.ctl==='tilt')$('tiltDot').style.left=(50+clamp(curSteer,-1,1)*50)+'%'; $('distance').innerHTML=String(Math.floor(distance)).padStart(5,'0')+' <small>m</small>';$('coins').textContent='✦ '+coins;$('speed').textContent=String(Math.round((118+lvl*.47+Math.min(189,time*1.42))*V.spd*driveFactor+(boost?95:0)));$('healthVal').textContent=Math.round(health/maxHP*100)+'%';$('healthFill').style.width=health/maxHP*100+'%';$('nitroVal').textContent=Math.round(nitro)+'%';$('nitroFill').style.width=nitro+'%';const full=nitro>=100;$('nitroState').textContent=boost?'BOOST':full?'FULL':'CHARGING';$('nitroHint').textContent=full?'READY — PRESS NITRO':'COLLECT BLUE CANISTERS';$('nitroBtn').classList.toggle('ready',full);$('brakeBtn').classList.toggle('active',braking&&mode==='run')}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');toastLeft=.7}
function start(){resumeAudio();SFX.start();root.classList.remove('in-hub','view-map','modal-open');root.classList.toggle('racing-ui',!!racing);showGameHud(true);if(endless||racing||trial)lvl=1;lives=3;task=racing?{t:'race',T:RACE_LEN,rw:0,tx:'Finish in the top 3'}:trial?{t:'trial',T:TT_LEN,rw:0,tx:'Time trial'}:endless?{t:'endless',T:1e9,rw:0,tx:'Endless run'}:mkTask(lvl);passed=gN=hits=0;boostN=0;runWx=[0,0,0,0];ttRec=[];ttAcc=0;ttGhost=trial&&SV.tt?SV.tt:null;ghostObj=null;finWarn=false;applyV();$('hub').classList.add('hidden');$('taskHud').style.display='block';$('nextBtn').style.display='none';mode='run';braking=false;driveFactor=1;forwardSpeed=0;time=0;travel=0;distance=0;coins=0;health=maxHP;nitro=0;boost=false;playerX=0;velocity=0;keyLeft=false;keyRight=false;objects=[];sparks=[];skidMarks=[];spawnT=2;coinT=.2;addCoinTrail(2,-22,13);invincible=0;flash=0;steerInput=0;camSmooth=0;if(racing)initRacing();else{rivals=[];rivalDraw=[]}tiltZero=tiltRaw;tiltF=tiltRaw;steerS=0;tiltWarned=false;root.classList.remove('tilt-nosensor');$('overlay').classList.add('hidden');updateHUD(true)}
function end(why){if(trial&&why!=='win'){trialFail();return}braking=false;boost=false;
 const won=why==='win';mode='over';boost=false;updateEngine(0,false,false);won?SFX.win():SFX.lose();const d=Math.floor(distance);let rw=0;
 if(d>best){best=d;try{localStorage.setItem('highway-rush-3d-best',String(best))}catch(e){}}
 if(won){rw=task.rw;if(lvl%10===0&&lvl===SV.unlocked)SV.gems=(SV.gems||0)+5;if(lvl===SV.unlocked&&lvl<100)SV.unlocked++;selLv=Math.min(SV.unlocked,lvl<100?lvl+1:lvl)}
 if(endless&&d>(SV.endBest||0))SV.endBest=d;SV.coins+=coins+rw;const _L=recordRun({kind:endless?'endless':'run',won});saveSV();
 $('best').innerHTML=String(best).padStart(5,'0')+' <small>m</small>';
 $('menuTag').textContent=won?'LEVEL '+lvl+' COMPLETE':why==='clean'?'TASK FAILED — YOU GOT HIT':(endless?'OUT OF LIVES':'CRASHED OUT');
 $('menuTitle').innerHTML=won?'LEVEL<br><em>CLEARED</em>':'GAME<br><em>OVER</em>';
 $('menuText').innerHTML=`Distance <b>${d}m</b> • Coins <b>✦${coins}</b>${won?` • Bonus <b>✦${rw}</b>`:''}<br>${endless?'Best endless: '+Math.max(SV.endBest||0,d)+' m':'Task: '+task.tx}`;
 $('playBtn').textContent=won?'REPLAY LEVEL →':'RETRY →';showGains(_L);$('nextBtn').style.display=won&&lvl<100?'':'none';$('overlay').classList.remove('hidden')}
const TM={sedan:[1.75,1.76,2.65],suv:[1.85,1.82,2.7],sport:[1.75,1.76,2.6],truck:[2.4,2.1,4.2],bike:[.9,1.3,1.8]},CC=['#de4234','#efb83f','#4777f0','#a74edc','#ee8097','#31b2aa','#d4e0ec','#f27d2a'];
const NSP={sedan:[.30,.44],suv:[.26,.38],sport:[.44,.58],truck:[.14,.27],bike:[.40,.54]},NWV={sedan:.30,suv:.22,sport:.45,truck:.10,bike:.50},CITY=['KHI','LHR','ISB','PSH','QTA','MUX'],BRAND=['CARGO','SPEEDEX','TRANS-PK','HAULER','NOOR'];
function mk(lane,z){const r=Math.random(),model=r<.28?'sedan':r<.43?'suv':r<.58?'sport':r<.8?'truck':'bike',t=TM[model],s=R(NSP[model][0],NSP[model][1]);
 objects.push({id:++itemId,kind:'car',x:(lane-2)*2.83,z,color:CC[Math.floor(R(0,CC.length))],model,hx:t[1],hz:t[2],done:false,
  lane,tl:lane,tx:(lane-2)*2.83,sp0:s,sp:s,ph:Math.random(),lean:0,vx:0,sig:0,sigT:0,sigOff:0,cd:R(.2,1.2),wv:NWV[model]*(1+lvl*.01),bk:false,bkp:false,
  art:Math.random()<.6,pax:Math.random()<.3,plate:CITY[Math.floor(R(0,CITY.length))]+'-'+(10+Math.floor(R(0,90))),brand:BRAND[Math.floor(R(0,BRAND.length))]})}
// NPC traffic: own speed, keeps distance to the car ahead, signals then changes lanes
function npcAI(o,dt,base){
 let tg=o.sp0,br=false;
 for(const q of objects){if(q===o||q.kind!=='car'||q.done||q.fly||q.z>=o.z||Math.abs(q.x-o.x)>2.1)continue;const d=o.z-q.z,th=(o.hz+q.hz)*1.1+3;
  if(d<th){tg=Math.min(tg,Math.max(.08,q.sp-.04));if(d<th*.8)br=true}}
 o.sp+=(tg-o.sp)*Math.min(1,dt*3);
 o.ph+=o.sp*base*dt*.55;
 const dx=o.tx-o.x;
 if(Math.abs(dx)>.01){const sp=o.model==='bike'?3.4:o.model==='truck'?1.7:2.5,mv=Math.sign(dx)*Math.min(Math.abs(dx),sp*dt);o.x+=mv;o.vx=mv/Math.max(dt,.001)}else{o.x=o.tx;o.vx=0}
 o.lean+=((o.vx||0)*(o.model==='bike'?.075:.04)-o.lean)*Math.min(1,dt*7);
 if(o.sigT>0){o.sigT-=dt;if(o.sigT<=0){o.lane=o.tl;o.tx=(o.tl-2)*2.83;o.sigOff=.7}}
 else{
  if(o.sigOff>0){o.sigOff-=dt;if(o.sigOff<=0)o.sig=0}
  o.cd-=dt;
  if(o.cd<=0){o.cd=R(.5,.9);
   if(!o.sig&&o.z>-168&&o.z<-95&&Math.random()<o.wv){const d=Math.random()<.5?-1:1,nl=o.lane+d;
    if(nl>=0&&nl<=4&&!objects.some(q=>q!==o&&q.kind==='car'&&!q.done&&(q.tl===nl||q.lane===nl)&&Math.abs(q.z-o.z)<22)){o.sig=d;o.sigT=.9;o.tl=nl;o.bkp=Math.random()<.6}}}}
 o.bk=br||(o.sigT>0&&o.bkp);
}
function spawn(){const lane=Math.floor(R(0,5));mk(lane,-175);if(Math.random()<.35+Math.min(.3,lvl*.004))mk((lane+1+Math.floor(R(0,4)))%5,-193)}
// More collectible trails; hazards have their own capped probability at every level.
function addCoinTrail(lane,z,count=10){
 for(let i=0;i<count;i++)objects.push({id:++itemId,kind:'coin',x:(lane-2)*2.83,z:z-i*5.4,done:false});
}
function spawnPickups(){
 const available=[0,1,2,3,4].filter(l=>!objects.some(o=>o.kind==='car'&&!o.done&&Math.abs(o.x-(l-2)*2.83)<1.4&&o.z>-195&&o.z<-115));
 const lanes=available.length?available:[0,1,2,3,4];const lane=lanes[Math.floor(R(0,lanes.length))];
 addCoinTrail(lane,-145,V.cn);
 if(Math.random()<.55&&lanes.length>1){const others=lanes.filter(l=>l!==lane);addCoinTrail(others[Math.floor(R(0,others.length))],-163,7)}
 const r=Math.random();if(r<.52){const itemLane=Math.floor(R(0,5));const kind=r<.12?'bomb':r<.23&&health<maxHP?'heal':'nitro';objects.push({id:++itemId,kind,x:(itemLane-2)*2.83,z:-156,done:false})}
}
function update(dt){hudElapsed+=dt;taskElapsed+=dt;if(mode!=='run')return;if(racing){updateRace(dt);return}if(braking)boost=false;driveFactor+=( (braking?0:1)-driveFactor)*(1-Math.exp(-dt*(braking?6:3.5)));if(braking&&driveFactor<.01)driveFactor=0;time+=dt;invincible=Math.max(0,invincible-dt);
 // analog steering: buttons = full, touch drag = proportional
 let steer=(keyRight?1:0)-(keyLeft?1:0);if(Math.abs(steerInput)>Math.abs(steer))steer=steerInput;
 const ext=SV.ctl==='wheel'?wheelSteer:SV.ctl==='tilt'?tiltSteerNow(dt):0;if(Math.abs(ext)>Math.abs(steer))steer=ext;
  if(SV.ctl==='tilt'&&!tiltSeen&&!tiltWarned&&time>1.8){tiltWarned=true;root.classList.add('tilt-nosensor');toast(window.isSecureContext?'NO TILT SENSOR • USE ARROWS':'TILT NEEDS HTTPS • USE ARROWS')}
  // smooth steering: the input is eased, and the car's sideways speed follows the eased input
  steerS+=(steer-steerS)*(1-Math.exp(-dt*(Math.abs(steer)>=Math.abs(steerS)?13:17)));if(Math.abs(steerS)<.002)steerS=0;curSteer=steerS;
  const maxV=8.6*V.hnd,tgt=steerS*maxV;
  velocity+=(tgt-velocity)*(1-Math.exp(-dt*(Math.abs(tgt)>=Math.abs(velocity)?8.5:10)));
  if(Math.abs(velocity)>3.5&&Math.abs(steerS)>.6&&skidMarks.length<256&&Math.random()<.08)skidMarks.push({x:playerX+R(-.15,.15),z:2.6,a:.35});
  velocity=clamp(velocity,-maxV,maxV);playerX=clamp(playerX+velocity*dt,-5.55,5.55);
  if(Math.abs(playerX)>=5.55){velocity*=.3;playerX=clamp(playerX,-5.55,5.55)}
const base=(25+lvl*.1+Math.min(40,time*.3))*V.spd,speed=(base+(boost?27:0))*driveFactor;forwardSpeed=speed; travel+=speed*dt;if(racing)updateRivals(dt,base);if(trial)ttTick(dt);runWx[SV.wx|0]+=speed*dt*.75;distance+=speed*dt*.75;if(boost){nitro=Math.max(0,nitro-29*dt);if(nitro<=0)boost=false}
if(driveFactor>.05){spawnT-=dt;coinT-=dt;}if(spawnT<=0){spawn();spawnT=Math.max(.45,1.9-time*.008-lvl*.01)}if(coinT<=0){spawnPickups();coinT=R(.85,1.15)}
for(const o of objects){if(o.kind==='car'&&!o.done)npcAI(o,dt,base);o.z+=(o.kind==='car'?speed-o.sp*base:speed)*dt;if(o.done)continue;if(o.kind==='car'&&o.z>5&&!o.ps){o.ps=1;passed++;if(Math.random()<.35)SFX.pass()}const dz=Math.abs(o.z-3),dx=Math.abs(o.x-playerX);if(dz<(o.hz||2)&&dx<(o.hx?o.hx+V.ax:1.35+(o.kind==='coin'?V.mg:0))){
o.done=true;if(o.kind==='car'||o.kind==='bomb'){if(invincible<=0){health=Math.max(0,health-25);invincible=V.inv;flash=.28;toast('-25 HEALTH');hits++;(o.kind==='bomb'?SFX.bomb:SFX.hit)();fx(pr(playerX,3)[0],pr(playerX,3)[1],18,'debris',280);if(task.t==='clean'){end('clean');break}if(health<=0){if(endless&&lives>1){lives--;health=maxHP;invincible=2.5;toast('LIFE LOST • '+lives+' LEFT');for(const q of objects)if(q.kind==='car'&&q.z>-70)q.done=true}else{end();break}}}}else if(o.kind==='coin'){coins++;distance+=8;toast('✦ +1 COIN');SFX.coin()}else if(o.kind==='heal'){health=Math.min(maxHP,health+25);toast('♥ +25 HEALTH');SFX.heal()}else{const was=nitro;nitro=Math.min(100,nitro+V.nit);gN++;toast(nitro>=100?'⚡ NITRO READY':'+'+V.nit+' NITRO');SFX.nitro();if(was<100&&nitro>=100)SFX.ready()}}}
objects=objects.filter(o=>!o.done&&o.z<18&&o.z>-310);if(toastLeft>0){toastLeft-=dt;if(toastLeft<=0)$('toast').classList.remove('show')}flash=Math.max(0,flash-dt);if(taskElapsed>=.08){checkTask();taskElapsed=0}updateHUD();const spdN=clamp((25+lvl*.1+Math.min(40,time*.3))*V.spd/70,0,1.4);updateEngine(spdN*driveFactor+(boost?.3:0),boost,true)}
function frame(t){const elapsed=clamp((t-last)/1000||0,0,.12);last=t;if(document.hidden){simulationDebt=0;requestAnimationFrame(frame);return}simulationDebt=0;if(elapsed>0){const n=clamp(Math.ceil(elapsed*60-.001),1,8),sdt=elapsed/n;for(let i=0;i<n;i++)update(sdt)}const interval=mode==='pause'?100:mode==='hub'?1000/30:1000/100;if(t-lastDrawTime>=interval-.5){draw();lastDrawTime=t}requestAnimationFrame(frame)}
 document.addEventListener('visibilitychange',()=>{last=performance.now();pT0=last;simulationDebt=0;if(document.hidden&&mode==='run')$('pauseBtn').click()});
$('playBtn').onclick=()=>{if(mode==='pause'){$('overlay').classList.add('hidden');tiltZero=tiltRaw;mode='run'}else start()};$('pauseBtn').onclick=()=>{if(mode==='run'){mode='pause';boost=false;braking=false;updateEngine(0,false,false);$('menuTag').textContent='TAKE A BREAK';$('menuTitle').innerHTML='RACE<br><em>PAUSED</em>';$('menuText').textContent='Your highway is waiting';$('playBtn').textContent='RESUME RACE →';$('overlay').classList.remove('hidden')}else if(mode==='pause'){$('overlay').classList.add('hidden');tiltZero=tiltRaw;mode='run'}};
function hold(id,on,off){let el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);on();el.classList.add('pressed')});const stop=()=>{off();el.classList.remove('pressed')};['pointerup','pointercancel','lostpointercapture'].forEach(event=>el.addEventListener(event,stop))}
function nitroStart(){if(mode!=='run')return;if(racing){racePressNitro();return}if(braking)return;if(nitro>=100||boost){if(!boost){SFX.boostOn();boostN++}boost=true}else toast('COLLECT NITRO FIRST')}
hold('leftBtn',()=>{keyLeft=true;steerInput=-1},()=>{keyLeft=false;if(!keyRight)steerInput=0});hold('rightBtn',()=>{keyRight=true;steerInput=1},()=>{keyRight=false;if(!keyLeft)steerInput=0});hold('nitroBtn',nitroStart,()=>{if(!racing)boost=false});hold('gasBtn',()=>{gasBtn=true},()=>{gasBtn=false});hold('brakeBtn',()=>{if(mode==='run'){braking=true;if(!racing)boost=false}},()=>braking=false);
window.addEventListener('keydown',e=>{let k=e.key.toLowerCase();if(k==='c'&&mode==='run'&&!e.repeat)cycleCam();if(k==='w'&&mode==='run'&&!e.repeat&&!racing)cycleWx();if((k==='w'||k==='arrowup')&&racing)gasKey=true;if(k==='r'&&racing&&mode==='run'&&RLV[rcLv].city&&!e.repeat)ncReset();if(['arrowleft','arrowright',' ','arrowup','arrowdown','s','a','d','w','r'].includes(k)&&mode==='run')e.preventDefault();if(k==='arrowleft'||k==='a'){keyLeft=true;steerInput=-1}if(k==='arrowright'||k==='d'){keyRight=true;steerInput=1}if((k===' '||(k==='arrowup'&&!racing))&&!e.repeat)nitroStart();if((k==='s'||k==='arrowdown')&&mode==='run'){braking=true;if(!racing)boost=false}if(k==='p'&&!e.repeat)$('pauseBtn').click();if(k==='enter'&&!e.repeat&&mode!=='run'&&mode!=='hub')$('playBtn').click()});window.addEventListener('keyup',e=>{let k=e.key.toLowerCase();if(k==='arrowleft'||k==='a'){keyLeft=false;if(!keyRight)steerInput=0}if(k==='arrowright'||k==='d'){keyRight=false;if(!keyLeft)steerInput=0}if(k==='s'||k==='arrowdown')braking=false;if((k===' '||k==='arrowup')&&!racing)boost=false;if(k==='w'||k==='arrowup')gasKey=false});window.addEventListener('blur',()=>{braking=false;boost=false;keyLeft=false;keyRight=false;steerInput=0});let initial=null;canvas.addEventListener('pointerdown',e=>{if(mode!=='run'||SV.ctl!=='arrows')return;initial=e.clientX;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(initial===null)return;const diff=e.clientX-initial;steerInput=clamp(diff/(W*.22),-1,1);keyLeft=steerInput<-.15;keyRight=steerInput>.15});['pointerup','pointercancel'].forEach(x=>canvas.addEventListener(x,()=>{initial=null;keyLeft=false;keyRight=false;steerInput=0}));const WXN=['DAY','NIGHT','RAIN','STORM NIGHT'],WXI=['☀️','🌙','🌧️','⛈️'],WXS=['Clear golden-hour sky','Moon, stars, headlights and street lamps','Overcast sky, wet road and heavy rain','Night, lightning, thunder and rain'];
function applyWx(){const b=$('wxBtn');if(b){b.textContent=WXI[SV.wx|0];b.title='Weather / time ('+WXN[SV.wx|0]+') • W'}}
function cycleWx(){if(racing&&mode==='run'){toast('WEATHER IS SET BY THE LEVEL');return}SV.wx=((SV.wx|0)+1)%WXN.length;saveSV();applyWx();toast('WEATHER • '+WXN[SV.wx]);const b=$('wxBtn');if(b)b.blur()}
$('wxBtn').onclick=cycleWx;applyWx();
function ENVB(){return`<p class="hint" style="margin-top:16px">ENVIRONMENT • time of day and weather (also on the ${WXI[SV.wx|0]} button in the game, key W)</p><div class="opts">${WXN.map((n,i)=>`<button class="opt${(SV.wx|0)===i?' on':''}" data-w="${i}"><b>${WXI[i]}</b><span><em>${n}</em><small>${WXS[i]}</small></span></button>`).join('')}</div>`}
// rain ambience + thunder (Web Audio, procedural)
let rainGain=null,rainSrc=null;
function ensureRain(){if(!ACTX||rainSrc)return;try{const len=ACTX.sampleRate*2,buf=ACTX.createBuffer(1,len,ACTX.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;rainSrc=ACTX.createBufferSource();rainSrc.buffer=buf;rainSrc.loop=true;const bp=ACTX.createBiquadFilter();bp.type='bandpass';bp.frequency.value=2600;bp.Q.value=.3;const hp=ACTX.createBiquadFilter();hp.type='highpass';hp.frequency.value=800;rainGain=ACTX.createGain();rainGain.gain.value=0;rainSrc.connect(bp);bp.connect(hp);hp.connect(rainGain);rainGain.connect(masterGain);rainSrc.start()}catch(e){rainSrc=null}}
function updateRainSnd(a){if(!ACTX||!audioReady)return;if(a>.02)ensureRain();if(!rainGain)return;rainGain.gain.setTargetAtTime(muted?0:.17*a,ACTX.currentTime,.5)}
function thunder(){if(muted||!ACTX||!audioReady)return;const dur=2.8,len=Math.floor(ACTX.sampleRate*dur),buf=ACTX.createBuffer(1,len,ACTX.sampleRate),d=buf.getChannelData(0);let b=0;for(let i=0;i<len;i++){const k=i/len,env=Math.pow(1-k,1.5)*Math.min(1,k*18)*(.65+.35*Math.sin(k*25+Math.sin(k*8)*3));b=(b+(Math.random()*2-1)*.07)*.985;d[i]=b*env*5}const s=ACTX.createBufferSource();s.buffer=buf;const f=ACTX.createBiquadFilter();f.type='lowpass';f.frequency.value=260;const g=ACTX.createGain();g.gain.value=.9;s.connect(f);f.connect(g);g.connect(masterGain);s.start()}
window.addEventListener('hr3d-thunder',thunder);
const CAMN=['CHASE','HIGH','LOW','DRONE'];function cycleCam(){SV.cam=((SV.cam|0)+1)%CAMN.length;saveSV();toast('CAMERA • '+CAMN[SV.cam]);$('camBtn').blur()}$('camBtn').onclick=cycleCam;
$('muteBtn').onclick=()=>{resumeAudio();muted=!muted;$('muteBtn').textContent=muted?'🔇':'🔊';if(muted){updateEngine(0,false,false);if(masterGain)masterGain.gain.value=0}else if(masterGain)masterGain.gain.value=.45};
initRacingUI();applyCtl();if(SV.ctl==='tilt')enableTilt();updateHUD();openHub();
const loading=document.createElement('div');loading.className='asset-loading';loading.textContent='LOADING VEHICLES, PICKUPS & SCENERY…';root.append(loading);
try{
 world3D=await window.createHighwayWorld(root,window.HIGHWAY_ASSETS);
 loading.remove();saveSV();
 const modelName=document.createElement('div');modelName.id='modelName';root.append(modelName);
 const route=document.createElement('div');route.className='route-label';route.textContent='WINDING HIGHWAY • 4 TREE SPECIES';root.append(route);
 // Read-only runtime snapshot for diagnostics and game verification.
 window.__w3d=world3D;window.highwayDebug={snapshot:()=>({mode,travel,distance,playerX,coins,health,nitro,braking,forwardSpeed,driveFactor,boost,selected:VEH[SV.sel].n,coinObjects:objects.filter(o=>o.kind==='coin').length,trees:world3D.stats.trees,treeSpecies:world3D.stats.treeSpecies,render:{...world3D.stats},roadOffsets:[-40,-100,-160].map(z=>world3D.offset(z))})};
 last=performance.now();requestAnimationFrame(frame);
}catch(error){console.error('3D assets failed',error);loading.textContent='3D could not start. Please enable WebGL / hardware acceleration and reopen index.html.';loading.classList.add('failed')}

['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,()=>{resumeAudio()}, {once:true}));
})();
