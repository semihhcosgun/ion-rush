import {OVERDRIVE} from './overdrive';
import {DEFAULT_MENU_TRACK,cleanMenuTrack,menuTrackUrl,type MenuTrackId} from './menu-music';
import {OriginalRaceMusic} from './original-race-music';
import {SFX_DURATION,synthEffect,type SfxKind} from './sfx-bank';
import {SFX_ASSETS,isSoundEffect,loadSoundAsset,type AssetSfxKind,type SoundEffectKind} from './sfx-assets';
import {cleanAudioSettings,musicModeGain,musicModeSamples,nativeMusicAudio,usesNativeMusicAudio,type MusicModeNative} from './music-mode';
export class Sound {
 context?:AudioContext;engine?:OscillatorNode;gain?:GainNode;enabled=true;musicEnabled=true;evolution=0;
 private raceMusic?:OriginalRaceMusic;
 private menuTrack:MenuTrackId=DEFAULT_MENU_TRACK;private menuTracks=new Map<MenuTrackId,OriginalRaceMusic>();private menuMusic?:OriginalRaceMusic;private menu=false;private nativeMenuRunning=false;
 private effects?:DynamicsCompressorNode;private bank=new Map<SoundEffectKind,AudioBuffer[]>();private assetBuffers=new Map<AssetSfxKind,AudioBuffer>();private voices=new Set<AudioBufferSourceNode>();private variation=0;
 private preparation?:Promise<void>;
 private running=false;private blocked=false;
 private engineNodes?:{source:OscillatorNode;gain:GainNode;filter:BiquadFilterNode};
 private engineVoices=new Set<NonNullable<typeof this.engineNodes>>();
 private nextEngineUpdate=0;private engineFrequency=0;
 private idleTimer?:ReturnType<typeof setTimeout>;
 private idleSuspension?:Promise<void>;private resumeRequest?:Promise<void>;
 musicMode=false;effectsVolume=.65;
 private nativeMode=false;private nativeReady?:Promise<void>;private modeRevision=0;
 private voiceGains=new Map<AudioBufferSourceNode,GainNode>();
 private nativeEngineRunning=false;private nativeEngineAt=0;private nativeMusicRunning=false;private engineVolume=0;
 constructor(private native:MusicModeNative=nativeMusicAudio,private nativePlatform=usesNativeMusicAudio){}
 private get hasMusic(){return this.musicEnabled&&!this.musicMode;}
 async setMusicMode(enabled:boolean,volume=this.effectsVolume){
  this.effectsVolume=cleanAudioSettings({effectsVolume:volume}).effectsVolume;
  if(this.nativePlatform()){
   this.nativeMode=true;this.nativeReady??=this.native.configure({enabled:true});
   const changed=this.musicMode!==enabled;this.musicMode=enabled;this.modeRevision++;this.nativeEngineAt=0;
   await this.nativeReady;if(changed)await this.native.stop();return;
  }
  if(this.musicMode===enabled)return;
  this.musicMode=enabled;this.modeRevision++;this.raceMusic?.stop();for(const music of this.menuTracks.values())music.stop();
  for(const source of this.voices)this.disposeVoice(source,true);
  if(this.context){this.bank.clear();this.preparation=undefined;await this.prepare();}
 }
 setEffectsVolume(volume:number){this.effectsVolume=cleanAudioSettings({effectsVolume:volume}).effectsVolume;this.nativeEngineAt=0;}
 setMenuTrack(value:unknown){
  const track=cleanMenuTrack(value);if(track===this.menuTrack)return;
  this.menuMusic?.update(false);this.menuTrack=track;this.menuMusic=this.menuTracks.get(track);
  this.nativeEngineAt=0;this.update(this.running,0);
 }
 setMenu(active:boolean){this.menu=active;this.update(this.running,0);}
 prepare(){
  if(this.nativeMode)return this.nativeReady??Promise.resolve();
  if(!this.context)return Promise.resolve();
  const bank=this.preparation??=this.buildBank();
  if(!this.hasMusic)return bank;
  this.raceMusic??=new OriginalRaceMusic(this.context);
  return Promise.all([bank,this.raceMusic.prepare().catch(error=>console.warn('Race music preparation failed',error))]).then(()=>{});
 }
 private async buildBank(){
  const ctx=this.context!,mode=this.musicMode,revision=this.modeRevision;
  for(const kind of Object.keys(SFX_DURATION) as SfxKind[]){
   const variants:AudioBuffer[]=[];
   for(let n=0;n<(kind==='shot'||kind==='enemyHit'?4:1);n++){
    // Yield before synthesis so navigation and loading feedback can paint.
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    if(revision!==this.modeRevision)return;
    const samples=mode?musicModeSamples(kind,ctx.sampleRate,n):synthEffect(kind,ctx.sampleRate,n),buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);
    buffer.copyToChannel(samples,0);variants.push(buffer);
   }
   this.bank.set(kind,variants);
  }
  for(const kind of Object.keys(SFX_ASSETS) as AssetSfxKind[]){
   const buffer=this.assetBuffers.get(kind)??await loadSoundAsset(ctx,kind);
   this.assetBuffers.set(kind,buffer);
   if(revision!==this.modeRevision)return;
   this.bank.set(kind,[buffer]);
  }
 }
 private output(){const ctx=this.context!;if(!this.effects){this.effects=ctx.createDynamicsCompressor();this.effects.threshold.value=-14;this.effects.knee.value=10;this.effects.ratio.value=8;this.effects.attack.value=.002;this.effects.release.value=.14;this.effects.connect(ctx.destination);}return this.effects;}
 async unlock(){this.blocked=false;this.cancelIdle();if(this.nativeMode){await this.nativeReady;return;}this.context??=new AudioContext();await this.resumeContext();}
 uiClick(){
  if(!this.enabled){if(this.menu)void this.unlock().then(()=>this.update(this.running,0)).catch(()=>{});return;}
  if(this.nativeMode){this.blocked=false;this.play('uiClick');return;}
  const ready=this.unlock(),ctx=this.context;
  if(!ctx){void ready.catch(()=>{});return;}
  // The first menu tap works before the race's sound bank is prepared.
  if(!this.bank.has('uiClick')){
   const samples=synthEffect('uiClick',ctx.sampleRate),buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);
   buffer.copyToChannel(samples,0);this.bank.set('uiClick',[buffer]);
  }
  void ready.then(()=>{this.play('uiClick');if(this.menu)this.update(this.running,0);}).catch(()=>{});
 }
 update(running:boolean,speed:number){
  if(this.nativeMode){
   this.running=running;const active=running&&!this.blocked&&this.enabled&&(!this.musicMode||this.effectsVolume>0),music=running&&!this.blocked&&this.hasMusic,menu=this.menu&&!running&&!this.blocked&&this.hasMusic,now=performance.now();
   if(active!==this.nativeEngineRunning||music!==this.nativeMusicRunning||menu!==this.nativeMenuRunning||now>=this.nativeEngineAt){
    this.nativeEngineRunning=active;this.nativeMusicRunning=music;this.nativeMenuRunning=menu;this.nativeEngineAt=now+250;
    const revision=this.modeRevision,track=this.menuTrack;
    void (this.nativeReady??Promise.resolve()).then(()=>{if(revision===this.modeRevision&&track===this.menuTrack&&!this.blocked)return this.native.engine({running:active,music,menu,menuTrack:this.menuTrack,volume:this.musicMode?.0028*this.effectsVolume:.031,rate:Math.max(.6,Math.min(2,(42+speed*1.6)*(1-.025*this.evolution)/100))});}).catch(()=>{});
   }return;
  }
  this.running=running;const ctx=this.context;if(!ctx)return;
  const menu=this.menu&&!running&&!this.blocked&&this.hasMusic;
  if(menu){
   this.cancelIdle();this.raceMusic?.update(false);
   if(ctx.state!=='running'||this.idleSuspension){void this.resumeContext().then(()=>{if(this.menu&&!this.running&&!this.blocked)this.update(false,0);}).catch(()=>{});return;}
   if(!this.menuMusic){this.menuMusic=new OriginalRaceMusic(ctx,menuTrackUrl(this.menuTrack),.2);this.menuTracks.set(this.menuTrack,this.menuMusic);}
   this.menuMusic.update(true);this.stopEngine();return;
  }
  this.menuMusic?.update(false);
  if(!running||this.blocked||(!this.enabled&&!this.hasMusic)){
   this.stopEngine();this.raceMusic?.update(false);this.queueIdle();return;
  }
  this.cancelIdle();
  if(ctx.state!=='running'||this.idleSuspension){void this.resumeContext().catch(()=>{});return;}
  if(this.enabled){
   const frequency=(42+speed*1.6)*(1-.025*this.evolution),now=ctx.currentTime;
   if(!this.engineNodes){
    if(this.engineVoices.size>=2)this.disposeEngine(this.engineVoices.values().next().value!,true);
    const source=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.type='triangle';source.frequency.value=frequency;filter.type='lowpass';filter.frequency.value=180;gain.gain.value=0;
    source.connect(filter).connect(gain).connect(ctx.destination);this.engineVolume=.014*(this.musicMode?.1*this.effectsVolume:1);gain.gain.setTargetAtTime(this.engineVolume,now,.15);source.start();
    this.engine=source;this.gain=gain;this.engineNodes={source,filter,gain};this.engineFrequency=frequency;this.nextEngineUpdate=now+.05;
    this.engineVoices.add(this.engineNodes);
   }else if(now>=this.nextEngineUpdate){
    this.nextEngineUpdate=now+.05;
    if(Math.abs(frequency-this.engineFrequency)>=.5){this.engineNodes.source.frequency.setTargetAtTime(frequency,now,.1);this.engineFrequency=frequency;}
    const volume=.014*(this.musicMode?.1*this.effectsVolume:1);if(this.engineVolume!==volume){this.engineVolume=volume;this.engineNodes.gain.gain.setTargetAtTime(volume,now,.04);}
   }
  }else this.stopEngine();
  if(this.hasMusic)this.raceMusic??=new OriginalRaceMusic(ctx);
  this.raceMusic?.update(this.hasMusic);
 }
 private stopEngine(immediate=false){
  const nodes=this.engineNodes;this.engineNodes=undefined;this.engine=undefined;this.gain=undefined;
  if(immediate||this.context?.state!=='running'){for(const item of this.engineVoices)this.disposeEngine(item,true);}
  else if(nodes){const now=this.context.currentTime;nodes.gain.gain.cancelScheduledValues(now);nodes.gain.gain.setTargetAtTime(0,now,.025);nodes.source.onended=()=>this.disposeEngine(nodes);nodes.source.stop(now+.15);}
 }
 private disposeEngine(nodes:NonNullable<typeof this.engineNodes>,stop=false){if(!this.engineVoices.delete(nodes))return;if(stop)nodes.source.stop();nodes.source.onended=null;nodes.source.disconnect();nodes.filter.disconnect();nodes.gain.disconnect();}
 private cancelIdle(){if(this.idleTimer!==undefined){clearTimeout(this.idleTimer);this.idleTimer=undefined;}}
 private needsContinuousAudio(){return !this.blocked&&(this.running&&(this.enabled||this.hasMusic)||this.menu&&this.hasMusic);}
 private queueIdle(){
  if(this.idleTimer!==undefined||this.idleSuspension||!this.context||this.context.state!=='running'||this.needsContinuousAudio()||this.voices.size)return;
  this.idleTimer=setTimeout(()=>{
   this.idleTimer=undefined;const ctx=this.context!;
   if(this.needsContinuousAudio()||this.voices.size||ctx.state!=='running')return;
   this.idleSuspension=ctx.suspend().catch(()=>{}).finally(()=>{this.idleSuspension=undefined;if(this.needsContinuousAudio())void this.resumeContext().catch(()=>{});});
  },300);
 }
 private resumeContext(){
  if(!this.context||this.blocked)return Promise.resolve();
  return this.resumeRequest??=(async()=>{await this.idleSuspension;if(!this.blocked&&this.context?.state==='suspended')await this.context.resume();})().finally(()=>{this.resumeRequest=undefined;});
 }
 play(type:string,earnedThrust=0){
  const intensity=type==='overdrive'?.65+.35*Math.max(0,Math.min(1,(Number.isFinite(earnedThrust)?earnedThrust:0)/OVERDRIVE.maxExtra)):1;
  if(this.nativeMode){
   if(this.blocked||!this.enabled||!isSoundEffect(type))return;
   const revision=this.modeRevision,volume=(this.musicMode?musicModeGain(type,this.effectsVolume):1)*intensity;
   if(volume===0)return;
   void (this.nativeReady??Promise.resolve()).then(()=>{if(this.nativeMode&&revision===this.modeRevision&&!this.blocked&&this.enabled)return this.native.play({kind:type,volume,musicMode:this.musicMode});}).catch(()=>{});return;
  }
  const ctx=this.context;if(!ctx||this.blocked||!this.enabled||!isSoundEffect(type))return;
  if(ctx.state!=='running'||this.idleSuspension){this.cancelIdle();void this.resumeContext().then(()=>{if(ctx.state==='running')this.play(type,earnedThrust);}).catch(()=>{});return;}
  const clips=this.bank.get(type as SoundEffectKind);if(!clips)return;this.cancelIdle();const source=ctx.createBufferSource();source.buffer=clips[this.variation++%clips.length];
  if(this.voices.size>=24)this.disposeVoice(this.voices.values().next().value!,true);
  const gain=ctx.createGain();gain.gain.value=(this.musicMode?musicModeGain(type,this.effectsVolume):1)*intensity;
  source.connect(gain).connect(this.output());this.voiceGains.set(source,gain);this.voices.add(source);
  source.onended=()=>{this.disposeVoice(source);this.queueIdle();};source.start();if(this.hasMusic&&(type==='kill'||type==='revive'||type==='lessonStep'||type==='lessonComplete'||type==='supportCalled'||type==='supportEnded'||type==='supportReady'||type==='supportBlocked'))this.raceMusic?.duck(type==='supportCalled'?.8:type==='supportEnded'?.4:type==='supportReady'?.6:type==='revive'?.85:type==='lessonComplete'?.75:type==='lessonStep'?.42:.38);
 }
 private disposeVoice(source:AudioBufferSourceNode,stop=false){source.onended=null;if(stop)source.stop();source.disconnect();this.voiceGains.get(source)?.disconnect();this.voiceGains.delete(source);this.voices.delete(source);}
 suspend(){this.blocked=true;this.running=false;this.cancelIdle();this.stopEngine(true);this.raceMusic?.stop();for(const music of this.menuTracks.values())music.stop();for(const source of this.voices)this.disposeVoice(source,true);this.context?.suspend().catch(()=>{});if(this.nativeMode){this.modeRevision++;this.nativeEngineRunning=false;this.nativeMusicRunning=false;this.nativeMenuRunning=false;this.nativeEngineAt=0;void this.native.stop().catch(()=>{});}}
}
