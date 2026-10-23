/**
 * Original 106 BPM cosmic-groove score. The menu theme stays understated; a
 * separate two-bar race hook fades in with rhythm and bass when the run starts.
 */
const BPM=128;
const STEP=60/BPM/4;
const THEME_ROOTS=[42,42,38,40];
const THEME_CHORDS=[[0,3,7],[0,3,7],[0,4,7],[0,4,7]];
// The menu teaches the same six-note identity in a spacious, cinematic form.
const MENU_THEME:Array<number|null>=[
 73,null,73,null,null,69,71,null,73,null,null,66,null,null,69,null,
 73,null,73,null,null,69,71,null,76,null,73,null,71,null,69,null,
 73,null,73,null,null,69,71,null,73,null,null,66,null,null,69,null,
 71,null,71,null,null,68,69,null,71,null,69,null,68,null,66,null,
];
// Four bars: a one-bar identity, a short answer, the identity again, then a
// conclusive response. The repeated 3-3-2 rhythm makes the theme recognisable
// before the listener has learned every pitch.
const RACE_HOOK:Array<number|null>=[
 ...MENU_THEME,
];

export class Music {
 private bus:GainNode;private toneFilter:BiquadFilterNode;private compressor:DynamicsCompressorNode;
 private room:ConvolverNode;private roomReturn:GainNode;private echo:DelayNode;private echoReturn:GainNode;
 private noise:AudioBuffer;private next=0;private step=0;private playing=false;private duckUntil=0;
 private racing=false;private raceMix=0;private energy=0;private lastUpdate=0;

 constructor(private ctx:AudioContext){
  this.bus=ctx.createGain();this.bus.gain.value=0;
  this.toneFilter=ctx.createBiquadFilter();this.toneFilter.type='lowpass';this.toneFilter.frequency.value=12800;this.toneFilter.Q.value=.35;
  this.compressor=ctx.createDynamicsCompressor();this.compressor.threshold.value=-16;this.compressor.knee.value=16;this.compressor.ratio.value=3.4;this.compressor.attack.value=.012;this.compressor.release.value=.24;
  this.bus.connect(this.toneFilter).connect(this.compressor).connect(ctx.destination);

  this.room=ctx.createConvolver();this.room.buffer=this.impulse(1.65,2.5);
  this.roomReturn=ctx.createGain();this.roomReturn.gain.value=.09;this.room.connect(this.roomReturn).connect(this.bus);
  this.echo=ctx.createDelay(1);this.echo.delayTime.value=STEP*3;
  const echoFilter=ctx.createBiquadFilter(),feedback=ctx.createGain();echoFilter.type='lowpass';echoFilter.frequency.value=3100;feedback.gain.value=.24;
  this.echoReturn=ctx.createGain();this.echoReturn.gain.value=.1;this.echo.connect(echoFilter);echoFilter.connect(this.echoReturn).connect(this.bus);echoFilter.connect(feedback).connect(this.echo);

  this.noise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.42),ctx.sampleRate);
  const data=this.noise.getChannelData(0);let seed=0x494f4e;
  for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*(1-i/data.length*.32);}
 }

 private impulse(seconds:number,decay:number){
  const buffer=this.ctx.createBuffer(2,Math.floor(this.ctx.sampleRate*seconds),this.ctx.sampleRate);
  let seed=0x4e4f5641;
  for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;const envelope=(1-i/data.length)**decay;data[i]=(seed/4294967296*2-1)*envelope*(channel?.72:.75);}}
  return buffer;
 }

 private route(node:AudioNode,room=.12,echo=.04){
  node.connect(this.bus);if(room)node.connect(this.room);if(echo)node.connect(this.echo);
 }

 private tone(midi:number,time:number,duration:number,volume:number,type:OscillatorType='triangle',cutoff=4200,pan=0,room=.12,echo=.04,attack=.012){
  const oscillator=this.ctx.createOscillator(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain(),panner=this.ctx.createStereoPanner();
  oscillator.type=type;oscillator.frequency.value=440*2**((midi-69)/12);filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=type==='sawtooth'?1.1:.55;panner.pan.value=pan;
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),time+attack);gain.gain.setValueAtTime(Math.max(.0002,volume*.82),Math.max(time+attack,time+duration*.52));gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  oscillator.connect(filter).connect(gain).connect(panner);this.route(panner,room,echo);oscillator.start(time);oscillator.stop(time+duration+.03);
  oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
 }

 private pad(root:number,chord:number[],time:number,scale=1){
  const length=STEP*15.75;
  chord.forEach((interval,index)=>{
   const pan=(index-(chord.length-1)/2)*.24;
   this.tone(root+interval,time,length,.014*scale,index%2?'triangle':'sawtooth',index%2?1700:1050,pan,.42,0,.34);
   this.tone(root+interval+12,time+.015,length*.96,.006*scale,'sine',2400,-pan,.28,0,.42);
  });
 }

 private anthemPad(root:number,chord:number[],time:number,scale:number){
  const length=STEP*15.8;
  chord.forEach((interval,index)=>{
   const pan=(index-(chord.length-1)/2)*.28;
   this.tone(root+interval,time,length,.018*scale,'sawtooth',1280,pan,.5,0,.22);
   this.tone(root+interval+12,time+.012,length*.98,.008*scale,'triangle',2600,-pan,.38,.06,.28);
  });
 }

 private pluck(midi:number,time:number,accent=false,scale=1){
  const volume=(.041+this.raceMix*.015)*(accent?1.18:1)*scale;
  this.tone(midi,time,STEP*1.62,volume,'triangle',4700,accent?.18:-.16,.24,.34,.008);
  this.tone(midi+12,time+.006,STEP*.82,volume*.23,'sine',6200,accent?-.22:.2,.3,.25,.006);
 }

 private bass(midi:number,time:number,accent=false,scale=1){
  const volume=(.055+this.raceMix*.075)*(accent?1.08:1)*scale;
  this.tone(midi,time,STEP*(accent?2.8:1.9),volume,'sine',520,0,.05,0,.008);
  this.tone(midi+12,time,STEP*1.35,volume*.28,'triangle',720,0,.04,0,.006);
 }

 private anthemLead(midi:number,time:number,accent=false,scale=1){
  const volume=(accent?.071:.058)*scale;
  this.tone(midi,time,STEP*(accent?3.15:2.65),volume,'sawtooth',3650,-.08,.3,.2,.012);
  this.tone(midi,time+.008,STEP*(accent?3:2.5),volume*.48,'square',2450,.12,.24,.16,.01);
  this.tone(midi+12,time+.012,STEP*1.7,volume*.2,'triangle',6100,.22,.34,.28,.009);
 }

 private menuLead(midi:number,time:number,accent=false,scale=1){
  const volume=(accent?.095:.079)*scale;
  this.tone(midi,time,STEP*1.8,volume,'square',2400,-.08,.12,.2,.005);
  this.tone(midi+12,time+.004,STEP*.65,volume*.27,'sine',5400,.12,.1,.16,.004);
  this.tone(midi-12,time,STEP*1.65,volume*.25,'triangle',1200,0,0,0,.006);
 }

 private anthemPulse(midi:number,time:number,scale:number,pan:number){
  this.tone(midi,time,STEP*1.15,.022*scale,'square',1350,pan,.12,.06,.006);
  this.tone(midi+12,time+.004,STEP*.82,.008*scale,'triangle',3600,-pan,.16,.08,.005);
 }

 private noiseHit(time:number,duration:number,volume:number,highpass:number,pan=0,room=.06){
  const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain(),panner=this.ctx.createStereoPanner();source.buffer=this.noise;filter.type='highpass';filter.frequency.value=highpass;panner.pan.value=pan;
  gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);source.connect(filter).connect(gain).connect(panner);this.route(panner,room,0);source.start(time);source.stop(time+duration+.01);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
 }

 private kick(time:number,volume:number){
  const oscillator=this.ctx.createOscillator(),gain=this.ctx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(122,time);oscillator.frequency.exponentialRampToValueAtTime(44,time+.16);gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.23);oscillator.connect(gain);this.route(gain,.035,0);oscillator.start(time);oscillator.stop(time+.24);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 }

 private taiko(time:number,volume:number){
  this.kick(time,volume);
  this.tone(38,time,STEP*2.1,volume*.42,'triangle',420,-.12,.2,0,.006);
  this.noiseHit(time,.13,volume*.12,430,.14,.28);
 }

 private snare(time:number,volume:number){
  this.noiseHit(time,.17,volume,1250,.08,.16);this.noiseHit(time+.018,.11,volume*.38,2400,-.14,.12);
  this.tone(50,time,.09,volume*.16,'triangle',900,0,.08,0,.004);
 }

 private shimmer(root:number,time:number){
  this.tone(root+31,time,STEP*7.5,.014,'sine',7600,-.5,.55,.32,.08);
  this.tone(root+38,time+STEP*.55,STEP*6.7,.011,'triangle',6900,.55,.55,.3,.08);
 }

 private schedule(time:number,absoluteStep:number){
  const n=absoluteStep%16,bar=Math.floor(absoluteStep/16)%4,phrase=absoluteStep%64;
  const root=THEME_ROOTS[bar],race=this.raceMix;
  // Shared clock and hook: gameplay adds weight without restarting the phrase.
  if(n===0)this.pad(root+12,THEME_CHORDS[bar],time,.32);
  const note=MENU_THEME[phrase];
  if(note!==null)this.menuLead(note,time,n===0||n===8,.9+race*.22);
  if(n===0||n===6||n===10){
   this.kick(time,.24+race*.08);
   this.bass(root,time,n===0,1.35);
  }
  if(n===14)this.bass(root+(bar===3?7:0),time,false,.9);
  if(n===4||n===12)this.snare(time,.073+race*.035);
  if(n%2===0)this.noiseHit(time+(n%4?STEP*.06:0),.032,.019+race*.008,7500,n%4?.24:-.24,0);
  if(n===3||n===11)this.tone(root+24,time,STEP*.55,.023+race*.009,'triangle',2200,n===3?-.25:.25,0,0,.003);
  if(race>.05&&(n===7||n===15))this.noiseHit(time,.055,.016*race,4200,.15,0);
 }
 duck(){this.duckUntil=this.ctx.currentTime+.34;this.bus.gain.setTargetAtTime(.055,this.ctx.currentTime,.012);}

 update(active:boolean,racing=false,speed=0){
  const now=this.ctx.currentTime,dt=this.lastUpdate?Math.min(.1,Math.max(0,now-this.lastUpdate)):0;this.lastUpdate=now;
  if(racing!==this.racing){this.racing=racing;}
  const target=racing?1:0,tau=racing?1.15:1.1;
  if(dt)this.raceMix+=(target-this.raceMix)*(1-Math.exp(-dt/tau));
  this.energy=Math.max(0,Math.min(1,(speed-18)/34));
  const level=active?(now<this.duckUntil?.055:.145+this.raceMix*.06):0;this.bus.gain.setTargetAtTime(level,now,active?.18:.09);
  this.toneFilter.frequency.setTargetAtTime(7000+this.raceMix*5800,now,.7);
  if(!active){this.playing=false;return;}
  if(!this.playing){this.next=now+.035;this.playing=true;}
  if(this.next<now-.2)this.next=now+.035;
  while(this.next<now+.16){this.schedule(this.next,this.step++);this.next+=STEP;}
 }
}

function minMax(value:number,min:number,max:number){return Math.max(0,Math.min(1,(value-min)/(max-min)));}

