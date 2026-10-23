import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {Sound} from '../src/audio';
import {Race} from '../src/game';
import {createNovaRecovery} from '../src/nova-recovery';
import type {MusicModeNative} from '../src/music-mode';

// Execute the app's real recovery completion without constructing its WebGL UI.
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const completion=main.match(/(?:async )?function finishRestore\([\s\S]*?(?=async function restoreRun\()/)![0];
const compiled=ts.transpile(completion, {target:ts.ScriptTarget.ES2022});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(music=true,effects=true){
 const engines:{running:boolean;music:boolean}[]=[],sounds:string[]=[];
 const native:MusicModeNative={configure:async()=>{},engine:async e=>{engines.push(e);},play:async e=>{sounds.push(e.kind);},stop:async()=>{},getStatus:async()=>({supported:true,playing:false}),addListener:async()=>({remove:async()=>{}})};
 const sound=new Sound(native,()=>true);sound.enabled=effects;sound.musicEnabled=music;await sound.setMusicMode(false);await sound.unlock();
 const race=new Race(42);race.z=1275;race.failed=true;race.health=0;
 const env={sound,race,screen:'revive',appActive:true,document:{hidden:false},save:{vibration:false},resumeAfterBackground:false,
  setScreen:(screen:string)=>{env.screen=screen;},drawHud:()=>{},updateHud:()=>{},
  dispatchEvents:()=>{for(const event of race.events)sound.play(event.type);race.events=[];},
  pause:()=>{env.screen='pause';sound.update(false,0);},toast:()=>{},t:(s:string)=>s};
 const finish=runInNewContext(compiled+'\nfinishRestore;',env) as ()=>Promise<void>;
 return {env,sound,race,engines,sounds,finish};
}

test('Buy & Continue reopens music, engine and effects after payment suspended all audio',async()=>{
 const f=await fixture(),wallet={journey:{nova:0}};
 const recovery=createNovaRecovery({wallet:()=>wallet,canRestore:r=>r.failed,restore:r=>r.revive(),persist:async()=>{},prepare:()=>f.sound.unlock(),
  purchase:async()=>{f.sound.suspend();await flush();return {purchased:true};},deliver:async()=>{wallet.journey.nova+=5;}});
 assert.equal((await recovery.continue(f.race,'example_nova_5')).status,'restored');
 f.sound.update(true,f.race.speed);f.sound.play('shot');await flush();
 assert.equal(f.engines.some(e=>e.running||e.music),false,'Suspension reproduces the reported silence before completion');
 assert.equal(f.sounds.length,0);
 await f.finish();f.sound.play('shot');await flush();
 assert.equal(f.env.screen,'race');assert.equal(f.env.resumeAfterBackground,false);
 assert.ok(f.engines.some(e=>e.running&&e.music));assert.ok(f.sounds.includes('revive'));assert.ok(f.sounds.includes('shot'));
 assert.equal(wallet.journey.nova,4);assert.equal(f.race.z,1275);assert.equal(f.race.revives,1);f.sound.suspend();
});
test('a purchase completing in the background stays silent and pauses for foreground recovery',async()=>{
 const f=await fixture();f.sound.suspend();f.env.appActive=false;f.env.document.hidden=true;f.race.revive();
 await f.finish();await flush();assert.equal(f.env.screen,'pause');assert.equal(f.env.resumeAfterBackground,true);
 assert.equal(f.engines.some(e=>e.running||e.music),false);assert.equal(f.sounds.length,0);
 // Existing foreground countdown unlocks sound before play resumes.
 f.env.appActive=true;f.env.document.hidden=false;await f.sound.unlock();f.sound.update(true,f.race.speed);f.sound.play('shot');await flush();
 assert.ok(f.engines.some(e=>e.running&&e.music));assert.ok(f.sounds.includes('shot'));f.sound.suspend();
});
test('recovery preserves music/effects mute settings instead of forcing either on',async()=>{
 for(const [music,effects] of [[false,true],[true,false],[false,false]]){
  const f=await fixture(music,effects);f.sound.suspend();f.race.revive();await f.finish();f.sound.play('shot');await flush();
  assert.equal(f.engines.at(-1)?.music,music);assert.equal(f.engines.at(-1)?.running,effects);assert.equal(f.sounds.includes('shot'),effects);f.sound.suspend();
 }
});
test('leaving the recovery screen while audio resumes cannot reopen an abandoned run',async t=>{
 const f=await fixture();f.sound.suspend();f.race.revive();
 const unlock=f.sound.unlock.bind(f.sound);t.mock.method(f.sound,'unlock',async()=>{await unlock();f.env.screen='home';});
 await f.finish();await flush();assert.equal(f.env.screen,'home');assert.equal(f.engines.length,0);f.sound.suspend();
});
