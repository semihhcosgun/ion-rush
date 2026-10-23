import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {Capacitor} from '@capacitor/core';
import {Race} from '../src/game';
import {Sound} from '../src/audio';
import {loadSoundAsset} from '../src/sfx-assets';
import type {MusicModeNative} from '../src/music-mode';

test('a locked trigger press gives one jam, consumes no shot and does not repeat while held',()=>{
 const r=new Race();r.gates=[];r.stream.nextZ=100000;r.combat.heat=100;r.combat.locked=true;
 const before=[r.combat.shots,r.combat.cooldown,r.combat.heat];
 r.pressFire();assert.deepEqual(r.events,[{type:'weaponJammed'}]);assert.equal(r.firing,true);
 assert.deepEqual([r.combat.shots,r.combat.cooldown,r.combat.heat],before);assert.equal(r.combat.tapShot,undefined);
 r.events=[];for(let i=0;i<120;i++)r.step(1/120);
 assert.equal(r.events.some(e=>e.type==='weaponJammed'||e.type==='shot'),false);
 r.firing=false;r.pressFire();assert.equal(r.events.filter(e=>e.type==='weaponJammed').length,1);
 r.events=[];for(let i=0;i<700;i++)r.step(1/120);
 assert.ok(r.combat.shots>0,'Held trigger resumes shooting after cooling');
 assert.equal(r.events.some(e=>e.type==='weaponJammed'),false);
});

test('rapid re-taps share a 500 ms limit; cooling and ready fire are never delayed by it',()=>{
 const r=new Race();r.combat.locked=true;r.combat.heat=100;
 for(const at of [0,.01,.05,.10,.249,.25,.30,.499,.50,.51,.749,.75,.80,.999]){r.elapsed=at;r.firing=false;r.pressFire();}
 assert.equal(r.events.filter(e=>e.type==='weaponJammed').length,2);
 r.combat.locked=false;r.combat.cooldown=0;r.combat.muzzleWorld=new Vector3(0,0,0);r.combat.aimDirection=new Vector3(0,0,-1);
 r.elapsed=1;r.pressFire();assert.ok(r.combat.tapShot,'Feedback limit cannot block a rearmed shot');
});

test('a ready trigger keeps quick-tap aim and ordinary shot cooldown silent; failed races ignore presses',()=>{
 const r=new Race();r.combat.muzzleWorld=new Vector3(1,2,3);r.combat.aimDirection=new Vector3(0,0,-1);
 r.pressFire();assert.deepEqual(r.combat.tapShot?.from,new Vector3(1,2,3));assert.deepEqual(r.events,[]);
 r.combat.tapShot=undefined;r.combat.cooldown=.1;r.pressFire();assert.deepEqual(r.events,[]);assert.equal(r.combat.tapShot,undefined);
 r.failed=true;r.firing=false;r.pressFire();assert.equal(r.firing,false);assert.deepEqual(r.events,[]);
});

test('both native banks contain the exact approved single effect, without shortening or synthesis',()=>{
 const approved=readFileSync(new URL('../assets/audio/weaponJammed.wav',import.meta.url));
 for(const folder of ['game-effects','music-mode'])assert.deepEqual(readFileSync(new URL(`../public/audio/${folder}/weaponJammed.wav`,import.meta.url)),approved);
 assert.equal(approved.readUInt32LE(24),48000);assert.equal(approved.readUInt16LE(22),1);
 assert.equal((approved.length-44)/2/48000,.245);
});

test('the approved asset accepts bundled iOS media, rejects missing files and decodes intact',async t=>{
 const wav=readFileSync(new URL('../assets/audio/weaponJammed.wav',import.meta.url));let status=0,platform='ios',decodes=0;
 t.mock.method(Capacitor,'getPlatform',()=>platform);
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(url,'/audio/game-effects/weaponJammed.wav');return {ok:status===200,status,arrayBuffer:async()=>wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength)} as Response;});
 const ctx={decodeAudioData:async(data:ArrayBuffer)=>{assert.deepEqual(Buffer.from(data),wav);decodes++;return {duration:.245};}} as unknown as AudioContext;
 assert.equal((await loadSoundAsset(ctx,'weaponJammed')).duration,.245);
 platform='web';await assert.rejects(loadSoundAsset(ctx,'weaponJammed'),/unavailable \(0\)/);
 status=404;platform='ios';await assert.rejects(loadSoundAsset(ctx,'weaponJammed'),/unavailable \(404\)/);
 assert.equal(decodes,1);
});

test('native jam playback respects sound mute, music-mode volume and background suspension',async()=>{
 const calls:{kind:string;volume:number;musicMode:boolean}[]=[];
 const native={configure:async()=>{},play:async o=>{calls.push(o);},engine:async()=>{},stop:async()=>{},getStatus:async()=>({supported:true,playing:false}),addListener:async()=>({remove:async()=>{}})} satisfies MusicModeNative;
 const s=new Sound(native,()=>true),flush=()=>new Promise(resolve=>setImmediate(resolve));
 await s.setMusicMode(false);s.play('weaponJammed');await flush();assert.deepEqual(calls,[{kind:'weaponJammed',volume:1,musicMode:false}]);
 s.enabled=false;s.play('weaponJammed');await flush();assert.equal(calls.length,1);
 s.enabled=true;await s.setMusicMode(true,.4);s.play('weaponJammed');await flush();assert.deepEqual(calls.at(-1),{kind:'weaponJammed',volume:.4,musicMode:true});
 s.setEffectsVolume(0);s.play('weaponJammed');await flush();assert.equal(calls.length,2);
 s.setEffectsVolume(.4);s.play('weaponJammed');s.suspend();await flush();assert.equal(calls.length,2);
});
