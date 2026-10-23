import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Sound} from '../src/audio';
import {ExternalMusicMonitor,MusicOfferSession,MUSIC_OFFER_DURATION_MS,cleanAudioSettings,musicOfferEligible,musicModeGain,musicModeSamples,musicModeSwitchVisible,type MusicModeNative,type ExternalMusicStatus} from '../src/music-mode';
import {SFX_DURATION,synthEffect} from '../src/sfx-bank';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('rejecting an offer leaves the preference on and the next run offers again with continuous music',()=>{
 const settings=cleanAudioSettings({});const offer=new MusicOfferSession();
 offer.beginRun();assert.equal(offer.remaining('race',musicOfferEligible(settings,true),0),8000);
 offer.dismiss();assert.equal(offer.remaining('race',musicOfferEligible(settings,true),100),0);
 assert.equal(settings.musicSuggestions,true);
 offer.beginRun();assert.equal(offer.remaining('race',musicOfferEligible(settings,true),200),8000);
 assert.equal(settings.musicSuggestions,true);
});
test('ignoring an offer leaves the preference on and every subsequent run offers again',()=>{
 const settings=cleanAudioSettings({});const offer=new MusicOfferSession();
 for(let run=0;run<4;run++){
  offer.beginRun();const start=run*20000;
  assert.equal(offer.remaining('race',musicOfferEligible(settings,true),start),8000);
  assert.equal(offer.remaining('race',musicOfferEligible(settings,true),start+8000),0);
  assert.equal(settings.musicSuggestions,true);
 }
});
test('only a settings opt-out suppresses offers across new runs and restarts',()=>{
 const settings=cleanAudioSettings({musicSuggestions:false});const offer=new MusicOfferSession();
 for(let run=0;run<4;run++){
  offer.beginRun();assert.equal(offer.remaining('race',musicOfferEligible(settings,true),run*20000),0);
  assert.equal(settings.musicSuggestions,false);
 }
 assert.equal(cleanAudioSettings(JSON.parse(JSON.stringify(settings))).musicSuggestions,false);
});
test('the suggestion preference alone controls offers, even with an old active-mode value',()=>{
 assert.equal(musicOfferEligible({musicMode:true,musicSuggestions:true},true),true);
 assert.equal(musicOfferEligible({musicMode:false},true),true);
 assert.equal(musicOfferEligible({musicMode:true,musicSuggestions:false},true),false);
 assert.equal(musicOfferEligible({musicSuggestions:true},false),false);
});
test('saved active music mode never bypasses a new offer or the suggestion opt-out',()=>{
 assert.equal(cleanAudioSettings({musicMode:true}).musicMode,false);
 assert.equal(cleanAudioSettings({musicMode:true,musicSuggestions:false}).musicMode,false);
 assert.equal(cleanAudioSettings({musicMode:true,musicSuggestions:false}).musicSuggestions,false);
});
test('music offer waits for gameplay and expires without restarting on navigation or detection updates',()=>{
 const offer=new MusicOfferSession();
 assert.equal(offer.remaining('home',true,0),0);
 assert.equal(offer.remaining('countdown',true,9000),0);
 assert.equal(offer.remaining('race',false,10000),0);
 assert.equal(offer.remaining('race',true,10000),MUSIC_OFFER_DURATION_MS);
 assert.equal(offer.remaining('race',true,11000),7000);
 assert.equal(offer.remaining('pause',true,12000),0);
 assert.equal(offer.remaining('race',true,13000),5000);
 assert.equal(offer.remaining('race',true,18000),0);
 assert.equal(offer.remaining('race',false,19000),0);
 assert.equal(offer.remaining('race',true,20000),0);
});
test('closed music offer stays closed until a new listening session',()=>{
 const offer=new MusicOfferSession();offer.remaining('race',true,0);offer.dismiss();
 assert.equal(offer.remaining('race',true,1),0);
 assert.equal(offer.remaining('race',true,100000),0);
 offer.reset();assert.equal(offer.remaining('race',true,100001),MUSIC_OFFER_DURATION_MS);
});
test('timing out a suggestion never opts out of later listening sessions',()=>{
 const offer=new MusicOfferSession();offer.remaining('race',true,0);
 assert.equal(offer.remaining('race',true,8000),0);
 offer.reset();assert.equal(offer.remaining('home',true,9000),0);
 assert.equal(offer.remaining('race',true,10000),8000);
 assert.equal(cleanAudioSettings({}).musicSuggestions,true);
});
test('music mode brings combat effects forward while preserving warning priority and silence',()=>{
 assert.ok(musicModeGain('shot',.65)>.5);
 assert.ok(musicModeGain('enemyHit',.65)>.5);
 assert.ok(musicModeGain('hit',.65)>musicModeGain('shot',.65));
 assert.ok(musicModeGain('uiClick',.65)<musicModeGain('shot',.65));
 for(const kind of Object.keys(SFX_DURATION)){
  assert.equal(musicModeGain(kind,0),0);assert.ok(musicModeGain(kind,1)<=1);
 }
});
function bridge(){
 const effects:{kind:string;volume:number;musicMode:boolean}[]=[],engines:{running:boolean;volume:number;rate:number;music:boolean;menu?:boolean}[]=[];
 let stops=0,configures=0;
 const plugin:MusicModeNative={configure:async()=>{configures++;},play:async o=>{effects.push(o);},engine:async o=>{engines.push(o);},stop:async()=>{stops++;},getStatus:async()=>({supported:true,playing:false}),addListener:async()=>({remove:async()=>{}})};
 return {plugin,effects,engines,get stops(){return stops;},get configures(){return configures;}};
}
test('external music detection offers the switch without enabling the mode',async()=>{
 let listener!:(status:ExternalMusicStatus)=>void;const seen:ExternalMusicStatus[]=[];
 const plugin={getStatus:async()=>({supported:true,playing:false}),addListener:async(_event:'externalMusicChanged',changed:typeof listener)=>{listener=changed;return {remove:async()=>{}};}};
 const audio=bridge(),sound=new Sound(audio.plugin,()=>true);await sound.setMusicMode(false);
 const monitor=new ExternalMusicMonitor(status=>seen.push(status),plugin);await monitor.start();listener({supported:true,playing:true});
 assert.equal(seen.at(-1)?.playing,true);assert.equal(sound.musicMode,false);assert.equal(musicModeSwitchVisible(true,false,true),true);
 assert.equal(musicModeSwitchVisible(false,false,true),false);assert.equal(musicModeSwitchVisible(false,true,true),true);assert.equal(musicModeSwitchVisible(false,false,false),true);
 await monitor.stop();
});
test('a newer detection event wins over a stale initial status read',async()=>{
 let listener!:(status:ExternalMusicStatus)=>void,resolve!:(status:ExternalMusicStatus)=>void;let removed=0;const seen:ExternalMusicStatus[]=[];
 const pending=new Promise<ExternalMusicStatus>(r=>resolve=r);
 const monitor=new ExternalMusicMonitor(status=>seen.push(status),{getStatus:()=>pending,addListener:async(_e,fn)=>{listener=fn;return {remove:async()=>{removed++;}};}});
 const start=monitor.start();await flush();listener({supported:true,playing:true});resolve({supported:true,playing:false});await start;
 assert.deepEqual(seen,[{supported:true,playing:true}]);await monitor.stop();listener({supported:true,playing:false});assert.equal(seen.length,1);assert.equal(removed,1);
});
test('suggestions default on for existing saves and an explicit opt-out survives sanitization',()=>{
 assert.equal(cleanAudioSettings({}).musicSuggestions,true);assert.equal(cleanAudioSettings({musicSuggestions:false}).musicSuggestions,false);
 assert.equal(cleanAudioSettings({effectsVolume:0}).effectsVolume,0);assert.equal(cleanAudioSettings({effectsVolume:NaN}).effectsVolume,.65);assert.equal(cleanAudioSettings({effectsVolume:2}).effectsVolume,1);
});
test('native normal and music mode playback coexist with other audio without WebAudio',async()=>{
 const b=bridge(),sound=new Sound(b.plugin,()=>true);await sound.setMusicMode(false);await sound.unlock();sound.uiClick();sound.update(true,50);await flush();
 assert.equal(sound.context,undefined);assert.equal(b.effects[0].musicMode,false);assert.equal(b.effects[0].volume,1);assert.equal(b.engines.at(-1)?.music,true);
 await sound.setMusicMode(true,.65);sound.play('shot');sound.play('meteorWarning');sound.update(true,50);await flush();
 assert.equal(b.effects.at(-2)?.volume,musicModeGain('shot',.65));assert.ok(b.effects.at(-1)!.volume>b.effects.at(-2)!.volume);assert.equal(b.engines.at(-1)?.music,false);
 await sound.setMusicMode(false);sound.update(true,50);await flush();assert.equal(b.engines.at(-1)?.music,true);assert.equal(b.configures,1);
 sound.suspend();
});
test('native menu music follows music mute, external music mode and background without engine playback',async()=>{
 const b=bridge(),sound=new Sound(b.plugin,()=>true);await sound.setMusicMode(false);sound.enabled=false;
 sound.setMenu(true);await flush();assert.equal((b.engines.at(-1) as {menuTrack:string}).menuTrack,'ion-heart');assert.equal(b.engines.at(-1)?.menu,true);assert.equal(b.engines.at(-1)?.music,false);assert.equal(b.engines.at(-1)?.running,false);assert.equal(sound.context,undefined);
 sound.musicEnabled=false;sound.setMenu(true);await flush();assert.equal(b.engines.at(-1)?.menu,false);
 sound.musicEnabled=true;await sound.setMusicMode(true);sound.setMenu(true);await flush();assert.equal(b.engines.at(-1)?.menu,false);
 await sound.setMusicMode(false);sound.setMenu(true);await flush();assert.equal(b.engines.at(-1)?.menu,true);
 sound.setMenu(false);sound.update(true,40);await flush();assert.equal(b.engines.at(-1)?.music,true);assert.equal(b.engines.at(-1)?.menu,false);
 sound.suspend();const count=b.engines.length;sound.setMenu(true);await flush();assert.equal(b.engines.length,count);
 await sound.unlock();sound.setMenu(true);await flush();assert.equal(b.engines.at(-1)?.menu,true);sound.suspend();
});
test('mode changes keep mute preferences and backgrounding cancels queued native playback',async()=>{
 const b=bridge(),sound=new Sound(b.plugin,()=>true);await sound.setMusicMode(true,0);sound.play('shot');sound.update(true,40);await flush();assert.equal(b.effects.length,0);assert.equal(b.engines.at(-1)?.running,false);
 sound.setEffectsVolume(.65);sound.enabled=false;sound.play('hit');sound.update(true,40);await flush();assert.equal(b.effects.length,0);
 sound.enabled=true;sound.play('hit');sound.suspend();await flush();assert.equal(b.effects.length,0);assert.ok(b.stops>=1);
 await sound.unlock();sound.musicEnabled=false;await sound.setMusicMode(false);sound.update(true,40);await flush();assert.equal(b.engines.at(-1)?.music,false);sound.suspend();
});
test('music mode shortens decorative effects and preserves warning durations without clicks',()=>{
 for(const kind of Object.keys(SFX_DURATION) as (keyof typeof SFX_DURATION)[]){const samples=musicModeSamples(kind,8000);assert.ok(samples.every(Number.isFinite));assert.ok(Math.abs(samples.at(-1)!)<.001);assert.ok(samples.length<=synthEffect(kind,8000).length);}
 assert.equal(musicModeSamples('meteorWarning',8000).length,synthEffect('meteorWarning',8000).length);
 assert.ok(musicModeSamples('supportCalled',8000).length<synthEffect('supportCalled',8000).length);
});

test('native track selection reaches the bridge without unmuting music or changing the race soundtrack',async()=>{
 const b=bridge(),sound=new Sound(b.plugin,()=>true);await sound.setMusicMode(false);sound.setMenu(true);await flush();
 sound.setMenuTrack('afterglow-station');await flush();assert.equal((b.engines.at(-1) as {menuTrack:string}).menuTrack,'afterglow-station');assert.equal(b.engines.at(-1)?.menu,true);
 sound.musicEnabled=false;sound.setMenu(true);sound.setMenuTrack('before-the-jump');await flush();assert.equal(b.engines.at(-1)?.menu,false);
 sound.setMenu(false);sound.musicEnabled=true;sound.update(true,40);await flush();assert.equal(b.engines.at(-1)?.music,true);assert.equal(b.engines.at(-1)?.menu,false);sound.suspend();
});

test('Runner reuses turbo at growing native volume while respecting mute, music-mode gain and background',async()=>{
 const b=bridge(),sound=new Sound(b.plugin,()=>true);await sound.setMusicMode(false);sound.play('boost');for(const earned of [.5,1,1.5,2])sound.play('overdrive',earned);await flush();assert.equal(b.effects[0].kind,'boost');assert.equal(b.effects[0].volume,1);const steps=b.effects.slice(1);assert.equal(steps.length,4);for(let i=0;i<4;i++){assert.equal(steps[i].kind,'overdrive');assert.ok(steps[i].volume<=1);if(i)assert.ok(steps[i].volume>steps[i-1].volume);}assert.equal(steps[3].volume,1);
 await sound.setMusicMode(true,.4);sound.play('overdrive',2);await flush();assert.equal(b.effects.at(-1)?.volume,musicModeGain('overdrive',.4));const count=b.effects.length;sound.enabled=false;sound.play('overdrive',2);await flush();assert.equal(b.effects.length,count);sound.enabled=true;sound.play('overdrive',2);sound.suspend();await flush();assert.equal(b.effects.length,count);
});
