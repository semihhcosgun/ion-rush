import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Sound} from '../src/audio';
import {OriginalRaceMusic} from '../src/original-race-music';
import {Capacitor} from '@capacitor/core';

class Param {
 value=0;targets:{value:number;time:number}[]=[];
 setTargetAtTime(value:number,time:number){this.targets.push({value,time});}
 cancelScheduledValues(){}
}
class Node {
 gain=new Param();frequency=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();
 onended:(()=>void)|null=null;loop=false;buffer?:unknown;type='';connected=false;
 startCalls:number[][]=[];stopCalls:number[]=[];
 connect(node:Node){this.connected=true;return node;}
 disconnect(){this.connected=false;}
 start(...args:number[]){this.startCalls.push(args);}
 stop(time=0){this.stopCalls.push(time);}
}
class Context {
 currentTime=0;sampleRate=8000;state='running';destination=new Node();resumes=0;suspends=0;decodes=0;
 oscillators:Node[]=[];sources:Node[]=[];gains:Node[]=[];filters:Node[]=[];
 createOscillator(){const n=new Node();this.oscillators.push(n);return n;}
 createBufferSource(){const n=new Node();this.sources.push(n);return n;}
 createGain(){const n=new Node();this.gains.push(n);return n;}
 createBiquadFilter(){const n=new Node();this.filters.push(n);return n;}
 createDynamicsCompressor(){return new Node();}
 createBuffer(_channels:number,length:number){return {copyToChannel:()=>{},duration:length/this.sampleRate};}
 async decodeAudioData(){this.decodes++;return {duration:120/7};}
 async suspend(){this.suspends++;this.state='suspended';}
 async resume(){this.resumes++;this.state='running';}
 endStopped(){for(const n of [...this.oscillators,...this.sources])if(n.stopCalls.some(t=>t<=this.currentTime))n.onended?.();}
}
const audio=(ctx:Context)=>ctx as unknown as AudioContext;
const ready=async()=>{await new Promise(resolve=>setImmediate(resolve));};

test('first menu click is immediate without preparing music and returns audio to idle',async()=>{
 const ctx=new Context(),sound=new Sound();sound.context=audio(ctx);
 sound.uiClick();await ready();
 assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].startCalls.length,1);
 assert.equal(ctx.decodes,0);assert.equal(ctx.oscillators.length,0);
 assert.ok((ctx.sources[0].buffer as {duration:number}).duration<=.1);
 ctx.sources[0].onended?.();await new Promise(resolve=>setTimeout(resolve,340));
 assert.equal(ctx.state,'suspended');
 sound.uiClick();await ready();assert.equal(ctx.state,'running');assert.equal(ctx.sources.length,2);
 sound.suspend();
});

test('menu clicks respect mute and do not play if backgrounding interrupts their resume',async()=>{
 const ctx=new Context(),sound=new Sound();sound.context=audio(ctx);sound.enabled=false;
 sound.uiClick();await ready();assert.equal(ctx.sources.length,0);
 sound.enabled=true;sound.uiClick();sound.suspend();await ready();assert.equal(ctx.sources.length,0);
 sound.uiClick();await ready();assert.equal(ctx.sources.length,1);sound.suspend();
});

test('iOS bundled media with URLResponse status zero still decodes and starts music',async t=>{
 t.mock.method(Capacitor,'getPlatform',()=> 'ios');
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status:0,arrayBuffer:async()=>new ArrayBuffer(4)} as Response));
 const ctx=new Context(),music=new OriginalRaceMusic(audio(ctx));await music.prepare();music.update(true);
 assert.equal(ctx.decodes,1);assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].loop,true);music.stop();
});

test('browser status zero and native HTTP failures do not become successful music loads',async t=>{
 let platform='web',status=0;t.mock.method(Capacitor,'getPlatform',()=>platform);
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status,arrayBuffer:async()=>new ArrayBuffer(4)} as Response));
 const ctx=new Context();await assert.rejects(new OriginalRaceMusic(audio(ctx)).prepare(),/unavailable \(0\)/);
 platform='ios';status=404;await assert.rejects(new OriginalRaceMusic(audio(ctx)).prepare(),/unavailable \(404\)/);assert.equal(ctx.decodes,0);
});

test('ten minutes of music use one decoded loop with no live synth and bounded engine automation',async t=>{
 let fetches=0;t.mock.method(globalThis,'fetch',async()=>{fetches++;return new Response(new ArrayBuffer(4));});
 const ctx=new Context(),sound=new Sound();sound.context=audio(ctx);await sound.prepare();
 for(let i=0;i<600*120;i++){ctx.currentTime=i/120;sound.update(true,40+10*Math.sin(ctx.currentTime));}
 assert.equal(fetches,2);assert.equal(ctx.decodes,2,'One music loop and one approved static effect, cached for the whole run');assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].loop,true);
 assert.equal(ctx.oscillators.length,1,'Only the engine remains a live oscillator');assert.equal(ctx.filters.length,1);
 assert.ok(ctx.oscillators[0].frequency.targets.length<600*20);
 assert.equal(ctx.gains[0].gain.targets.length,0,'Steady music volume must not schedule automation each frame');
 sound.suspend();assert.ok(ctx.oscillators.every(n=>!n.connected));assert.ok(ctx.sources.every(n=>!n.connected));
});

test('pause retains music position, overlapping ducks recover once, repeated toggles bound fading sources',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(new ArrayBuffer(4)));
 const ctx=new Context(),music=new OriginalRaceMusic(audio(ctx));await music.prepare();music.update(true);
 ctx.currentTime=5;music.duck(.8);music.duck(.1);assert.equal(ctx.gains[0].gain.targets.length,1);
 ctx.currentTime=5.2;music.update(true);assert.equal(ctx.gains[0].gain.targets.length,1);
 ctx.currentTime=5.81;music.update(true);assert.deepEqual(ctx.gains[0].gain.targets.map(t=>t.value),[.09,.24]);
 ctx.currentTime=7;music.update(false);ctx.currentTime=20;music.update(true);
 assert.ok(Math.abs(ctx.sources[1].startCalls[0][1]-6.975)<1e-9);
 for(let i=0;i<50;i++){music.update(false);music.update(true);assert.ok(ctx.sources.filter(n=>n.connected).length<=2);}
 music.stop();assert.ok(ctx.sources.every(n=>!n.connected));
});

test('idle audio suspends, menu effects wake it, and background interrupts stay blocked until unlock',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(new ArrayBuffer(4)));
 const ctx=new Context(),sound=new Sound();sound.context=audio(ctx);await sound.prepare();
 sound.update(true,40);sound.update(false,0);ctx.currentTime=1;ctx.endStopped();
 await new Promise(resolve=>setTimeout(resolve,340));assert.equal(ctx.state,'suspended');
 sound.play('goal');await ready();assert.equal(ctx.state,'running');assert.equal(ctx.oscillators.length,1,'A menu effect must not restart the engine');
 sound.suspend();sound.update(true,40);sound.play('goal');await ready();assert.equal(ctx.state,'suspended');
 await sound.unlock();sound.update(true,40);assert.equal(ctx.state,'running');assert.equal(ctx.oscillators.length,2);
 sound.enabled=false;sound.musicEnabled=false;sound.update(true,40);ctx.currentTime=2;ctx.endStopped();
 await new Promise(resolve=>setTimeout(resolve,340));assert.equal(ctx.state,'suspended');
 sound.update(true,40);await ready();assert.equal(ctx.state,'suspended','Both disabled settings must leave hardware asleep');
 sound.suspend();
});

test('a pending idle suspension cannot swallow a resume',async()=>{
 const ctx=new Context(),sound=new Sound();sound.musicEnabled=false;sound.context=audio(ctx);
 let finish!:()=>void;ctx.suspend=()=>new Promise<void>(resolve=>{finish=()=>{ctx.state='suspended';resolve();};});
 sound.update(false,0);await new Promise(resolve=>setTimeout(resolve,320));
 sound.update(true,40);finish();await ready();sound.update(true,40);assert.equal(ctx.state,'running');assert.equal(ctx.oscillators.length,1);
 ctx.suspend=async()=>{ctx.state='suspended';};sound.suspend();
});

test('backgrounding before the loop finishes decoding cannot start music later',async t=>{
 const ctx=new Context();let finish!:()=>void;ctx.decodeAudioData=async()=>{await new Promise<void>(resolve=>{finish=resolve;});return {duration:120/7};};
 t.mock.method(globalThis,'fetch',async()=>new Response(new ArrayBuffer(4)));
 const sound=new Sound();sound.enabled=false;sound.context=audio(ctx);sound.update(true,40);await ready();sound.suspend();finish();await ready();
 assert.equal(ctx.sources.length,0);
});

test('bundled PCM loop has an exact twenty-four-bar 112 BPM duration, audible samples, no clipping or loop gap',()=>{
 const wav=readFileSync(new URL('../public/audio/ion-race-loop.wav',import.meta.url));
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt32LE(24),44100);
 assert.equal(wav.readUInt16LE(34),16);assert.equal(wav.readUInt32LE(40),2268000*2);assert.equal(wav.length,44+2268000*2);
 let peak=0,sum=0;for(let offset=44;offset<wav.length;offset+=2){const v=wav.readInt16LE(offset)/32767;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
 assert.ok(peak<.99);assert.ok(Math.sqrt(sum/2268000)>.05);assert.ok(Math.abs(wav.readInt16LE(44)-wav.readInt16LE(wav.length-2))/32767<.01);
});

test('menu music plays with effects muted, remains awake, switches to the race loop, and stops on background',async t=>{
 const urls:string[]=[];t.mock.method(globalThis,'fetch',async url=>{urls.push(String(url));return new Response(new ArrayBuffer(4));});
 const ctx=new Context(),sound=new Sound();sound.enabled=false;sound.context=audio(ctx);
 sound.setMenu(true);await ready();
 assert.deepEqual(urls,['/audio/ion-menu-ion-heart.wav']);assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].loop,true);
 assert.equal(ctx.oscillators.length,0,'Menu playback must not start the engine');
 await new Promise(resolve=>setTimeout(resolve,340));assert.equal(ctx.state,'running');
 sound.setMenu(false);sound.update(true,40);await ready();
 assert.deepEqual(urls,['/audio/ion-menu-ion-heart.wav','/audio/ion-race-loop.wav']);assert.equal(ctx.sources.length,2);
 ctx.currentTime=1;ctx.endStopped();assert.equal(ctx.sources[0].connected,false);
 sound.musicEnabled=false;sound.setMenu(true);sound.update(false,0);ctx.currentTime=2;ctx.endStopped();
 await new Promise(resolve=>setTimeout(resolve,340));assert.equal(ctx.state,'suspended');
 sound.musicEnabled=true;await sound.unlock();sound.setMenu(true);await ready();assert.equal(ctx.sources.length,3);
 sound.suspend();sound.setMenu(true);await ready();assert.ok(ctx.sources.every(n=>!n.connected));
});

test('backgrounding during menu decoding cannot start the menu later',async t=>{
 const ctx=new Context();let finish!:()=>void;ctx.decodeAudioData=async()=>{await new Promise<void>(resolve=>{finish=resolve;});return {duration:48};};
 t.mock.method(globalThis,'fetch',async()=>new Response(new ArrayBuffer(4)));
 const sound=new Sound();sound.context=audio(ctx);sound.setMenu(true);await ready();sound.suspend();finish();await ready();
 assert.equal(ctx.sources.length,0);
});

test('original menu PCM is a stereo twenty-four-bar 100 BPM loop with a clean seam',()=>{
 const wav=readFileSync(new URL('../public/audio/ion-menu-loop.wav',import.meta.url));
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),44100);assert.equal(wav.readUInt16LE(34),16);
 const frames=24*4*60/100*44100;assert.equal(wav.length,44+frames*4);assert.equal(wav.readUInt32LE(40),frames*4);
 let peak=0,sum=0;for(let i=44;i<wav.length;i+=2){const v=wav.readInt16LE(i)/32767;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
 assert.ok(peak<.99);assert.ok(Math.sqrt(sum/(frames*2))>.05);
 for(let channel=0;channel<2;channel++)assert.ok(Math.abs(wav.readInt16LE(44+channel*2)-wav.readInt16LE(wav.length-4+channel*2))/32767<.01);
});

test('switching menu tracks while decoding, muted and backgrounded cannot restart a stale selection',async t=>{
 const urls:string[]=[];t.mock.method(globalThis,'fetch',async url=>{urls.push(String(url));return new Response(new ArrayBuffer(4));});
 const ctx=new Context();let finish!:()=>void;
 ctx.decodeAudioData=async()=>{ctx.decodes++;if(ctx.decodes===1)await new Promise<void>(resolve=>{finish=resolve;});return {duration:ctx.decodes===1?57.6:48};};
 const sound=new Sound();sound.context=audio(ctx);sound.setMenu(true);await ready();
 sound.setMenuTrack('afterglow-station');await ready();assert.equal(ctx.sources.length,1);
 finish();await ready();assert.equal(ctx.sources.length,1,'Old pending decode must stay stopped');
 sound.musicEnabled=false;sound.setMenu(true);sound.setMenuTrack('ion-heart');await ready();assert.equal(ctx.sources.length,1);
 sound.musicEnabled=true;sound.setMenu(true);await ready();assert.equal(ctx.sources.length,2);assert.equal(ctx.decodes,2,'Only two cached tracks');
 sound.suspend();sound.setMenuTrack('afterglow-station');await ready();assert.equal(ctx.sources.length,2);
 await sound.unlock();sound.setMenu(true);await ready();assert.equal(ctx.sources.length,3);assert.deepEqual(urls,['/audio/ion-menu-ion-heart.wav','/audio/ion-menu-afterglow.wav']);sound.suspend();
});

test('ION HEART menu PCM preserves a 32-bar 116 BPM period and has no click or silent gap at the wrap',()=>{
 const wav=readFileSync(new URL('../public/audio/ion-menu-ion-heart.wav',import.meta.url));
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),48000);assert.equal(wav.readUInt16LE(34),16);
 const frames=Math.round(32*4*60/116*48000);assert.equal(wav.length,44+frames*4);
 for(let channel=0;channel<2;channel++)assert.ok(Math.abs(wav.readInt16LE(44+channel*2)-wav.readInt16LE(wav.length-4+channel*2))/32767<.002);
 let max=0,minRMS=1;
 for(let start=44;start+4800*4<wav.length;start+=4800*4){let sum=0;for(let offset=start;offset<start+4800*4;offset+=2){const v=wav.readInt16LE(offset)/32767;max=Math.max(max,Math.abs(v));sum+=v*v;}minRMS=Math.min(minRMS,Math.sqrt(sum/9600));}
 assert.ok(max<.99);assert.ok(minRMS>.015,'No silent 100ms patch in the repeating menu');
});
