import {Capacitor} from '@capacitor/core';
/** The evolving 112 BPM Starlane score, rendered once by scripts/render-race-music.mjs. */
export class OriginalRaceMusic {
 private bus:GainNode;
 private buffer?:AudioBuffer;
 private preparation?:Promise<void>;
 private active=false;
 private offset=0;
 private duckUntil=0;
 private ducked=false;
 private voice?:MusicVoice;
 private voices=new Set<MusicVoice>();
 constructor(private ctx:AudioContext,private url='/audio/ion-race-loop.wav',private volume=.24){this.bus=ctx.createGain();this.bus.gain.value=volume;this.bus.connect(ctx.destination);}
 prepare(){return this.preparation??=this.load();}
 private async load(){
  const response=await fetch(this.url);
  // Capacitor's iOS media handler returns URLResponse rather than
  // HTTPURLResponse for bundled WAVs, so a successful local load has status 0.
  const nativeMedia=response.status===0&&Capacitor.getPlatform()==='ios';
  if(!response.ok&&!nativeMedia)throw new Error(`Race music unavailable (${response.status})`);
  this.buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());
 }
 duck(duration=.38){
  if(!this.voice)return;
  this.duckUntil=Math.max(this.duckUntil,this.ctx.currentTime+duration);
  if(!this.ducked){this.ducked=true;this.bus.gain.setTargetAtTime(.09,this.ctx.currentTime,.015);}
 }
 update(active:boolean){
  this.active=active;
  if(!active){this.stop(false);return;}
  if(!this.buffer){
   if(!this.preparation)void this.prepare().then(()=>{if(this.active)this.update(true);}).catch(error=>console.warn('Race music preparation failed',error));
   return;
  }
  const now=this.ctx.currentTime;
  if(!this.voice){
   // Bound fading voices even if music is toggled repeatedly within one fade.
   if(this.voices.size>=2)this.dispose(this.voices.values().next().value!,true);
   const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
   source.buffer=this.buffer;source.loop=true;gain.gain.value=0;
   source.connect(gain).connect(this.bus);
   const voice={source,gain,start:Math.ceil((now+.025)*this.ctx.sampleRate)/this.ctx.sampleRate,offset:this.offset};
   this.voice=voice;this.voices.add(voice);source.onended=()=>this.dispose(voice);
   gain.gain.setTargetAtTime(1,now,.12);source.start(voice.start,voice.offset);
  }
  if(this.ducked&&now>=this.duckUntil){this.ducked=false;this.bus.gain.setTargetAtTime(this.volume,now,.12);}
 }
 stop(immediate=true){
  const now=this.ctx.currentTime,voice=this.voice;
  if(voice){
   this.offset=(voice.offset+Math.max(0,now-voice.start))%this.buffer!.duration;
   this.voice=undefined;
   if(!immediate){voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.03);voice.source.stop(now+.18);}
  }
  if(immediate){this.active=false;for(const item of this.voices)this.dispose(item,true);}
  if(this.ducked){this.ducked=false;this.bus.gain.setTargetAtTime(this.volume,now,.12);}
  this.duckUntil=0;
 }
 private dispose(voice:MusicVoice,stop=false){
  if(!this.voices.delete(voice))return;
  if(stop)voice.source.stop();voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();
 }
}
type MusicVoice={source:AudioBufferSourceNode;gain:GainNode;start:number;offset:number};
