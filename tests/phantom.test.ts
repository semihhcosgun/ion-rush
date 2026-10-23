import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {Race,type Gate} from '../src/game';
import {TUNE,COMBAT} from '../src/config';
import {trackPoint,enemyPoint} from '../src/combat-space';
import {PHANTOM,phaseActive} from '../src/phantom';
import {PhaseFX} from '../src/phase-fx';
import {phantomHud,phantomStatus} from '../src/phantom-ui';
import {garageMarkup} from '../src/garage';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {setLocale,t} from '../src/i18n';
import {synthEffect} from '../src/sfx-bank';
function run(tier=6){const r=new Race(2249,tier);r.gates=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;return r;}
function start(r:Race){r.boostCharge=1;assert.equal(r.activateTurbo(),true);}
function tick(r:Race,seconds:number){for(let i=0;i<Math.round(seconds*120);i++)r.step(1/120);}
function bullet(r:Race,index=0){const p=trackPoint(r.z,r.surface,r.laneX,r.playerHeight);Object.assign(r.combat.bolts[index],{active:true,hostile:true,z:r.z,surface:r.surface,lane:r.laneX,wx:p.x,wy:p.y,wz:p.z-.2,vx:0,vy:0,vz:24,life:1,enemyId:100,kind:'manta',targetSupport:undefined});}
function barrier(r:Race,id=1):Gate{return {id,z:r.z+1,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false};}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('a successful Phantom turbo starts exactly one second, with ordinary charge, speed and duration',()=>{
 const r=run(),base=run(0);start(r);start(base);assert.equal(r.phase.remaining,1);assert.equal(r.boost,TUNE.boostDuration);assert.equal(r.boostCharge,0);assert.equal(r.events.filter(e=>e.type==='phaseStart').length,1);
 tick(r,119/120);tick(base,119/120);assert.equal(phaseActive(r),true);near(r.speed,base.speed);near(r.z,base.z);near(r.boost,base.boost);r.step(1/120);assert.equal(phaseActive(r),false);assert.equal(r.phase.remaining,0);assert.equal(r.events.filter(e=>e.type==='phaseEnd').length,1);r.step(1/120);assert.equal(r.events.filter(e=>e.type==='phaseEnd').length,1);near(r.boost,TUNE.boostDuration-1-1/120);
});
test('unavailable or repeated turbo cannot start, extend or bank the phase; next turbo gets a fresh window',()=>{
 const r=run();assert.equal(r.activateTurbo(),false);assert.equal(r.phase.remaining,0);start(r);tick(r,.3);const left=r.phase.remaining;r.boostCharge=1;assert.equal(r.activateTurbo(),false);assert.equal(r.phase.remaining,left);tick(r,.71);assert.equal(r.activateTurbo(),false);assert.equal(r.phase.remaining,0);tick(r,2);assert.equal(r.activateTurbo(),true);assert.equal(r.phase.remaining,1);assert.equal(r.events.filter(e=>e.type==='phaseStart').length,2);
});
test('real barrier collision and multiple hostile bullets pass through with no health, shield, support or combo loss',()=>{
 const r=run();start(r);r.shield=2;r.shieldTime=12;r.support.remaining=14;r.support.guard=3;r.combo=4;r.gates=[barrier(r)];bullet(r);bullet(r,1);r.step(1/120);assert.equal(r.health,3);assert.equal(r.shield,2);assert.equal(r.support.guard,3);assert.equal(r.combo,4);assert.equal(r.invulnerable,0);assert.equal(r.hits,0);assert.ok(r.processed.has(1));assert.ok(r.combat.bolts.slice(0,2).every(b=>!b.active));assert.equal(r.events.some(e=>['hit','shieldHit','supportBlocked'].includes(e.type)),false);r.gates=[];tick(r,1.01);r.damage('enemy');assert.equal(r.support.guard,2);assert.equal(r.combo,0);
});
test('the same obstacle and bullet are damaging on other bikes and immediately after the phase ends',()=>{
 for(const tier of [0,5,6,7]){const r=run(tier);start(r);if(tier===6)tick(r,1);r.gates=[barrier(r)];r.step(1/120);assert.equal(r.health,2,`tier ${tier}`);}
 const r=run();start(r);tick(r,1);bullet(r);r.combat.update(r,1/120);assert.equal(r.health,2);assert.equal(r.invulnerable>0,true);
});
test('the added 0.6–1.0s window protects real barrier and hostile bullet contacts, then ends without grace',()=>{
 const r=run();start(r);tick(r,.8);r.gates=[barrier(r,45)];bullet(r);r.step(1/120);assert.equal(r.health,3);assert.equal(r.hits,0);assert.equal(r.processed.has(45),true);assert.equal(r.combat.bolts[0].active,false);assert.equal(r.invulnerable,0);assert.equal(r.combat.shots,0);
 r.gates=[];tick(r,.2);assert.equal(phaseActive(r),false);bullet(r);r.combat.update(r,1/120);assert.equal(r.health,2);assert.equal(r.hits,1);
});
test('phased obstacles cannot farm clean-pass score and do not grant invulnerability beyond the window',()=>{
 const r=run();start(r);r.gates=[barrier(r)];tick(r,.4);assert.equal(r.health,3);assert.equal(r.cleared,0);assert.equal(r.score,0);assert.equal(r.invulnerable,0);tick(r,.6);r.damage('obstacle');assert.equal(r.health,2);
});
test('meteor, rift challenge and unknown damage remain dangerous while phased',()=>{
 for(const source of ['meteor','rift','unknown']){const r=run();start(r);r.damage(source);assert.equal(r.health,2,source);assert.equal(r.hits,1,source);}
});
test('player firing, quick taps, stale taps and jam sounds are suppressed; held fire resumes after phase',()=>{
 const r=run();r.combat.muzzleWorld=new THREE.Vector3(0,5,-2);r.combat.aimDirection=new THREE.Vector3(0,0,-1);r.pressFire();assert.ok(r.combat.tapShot);start(r);assert.equal(r.combat.tapShot,undefined);r.combat.heat=80;r.combat.locked=true;r.pressFire();tick(r,.5);assert.equal(r.combat.shots,0);assert.equal(r.events.some(e=>e.type==='weaponJammed'),false);near(r.combat.heat,80-.5*COMBAT.cooling);r.combat.locked=false;tick(r,.52);assert.ok(r.combat.shots>0);
 const tap=run();start(tap);tap.combat.muzzleWorld=new THREE.Vector3();tap.combat.aimDirection=new THREE.Vector3(0,0,-1);tap.pressFire();tap.firing=false;assert.equal(tap.combat.tapShot,undefined);tick(tap,1.2);assert.equal(tap.combat.shots,0);
});
test('already-airborne projectiles and allied fire can finish while the rider phases',()=>{
 const r=run(),e=r.combat.enemies[0];Object.assign(e,{active:true,pursuing:false,training:false,kind:'manta',flight:'level',id:100,gateId:-1,z:60,surface:0,visualSurface:0,lane:0,hp:1,maxHp:1,age:3,fired:true});const p=enemyPoint(e);Object.assign(r.combat.bolts[0],{active:true,hostile:false,wx:p.x,wy:p.y,wz:p.z+1,vx:0,vy:0,vz:-120,z:e.z-1,life:1,power:1});start(r);r.combat.update(r,1/60);assert.equal(e.hp,0);assert.equal(r.combat.kills,1);assert.equal(r.combat.shots,0);assert.equal(r.combat.hits,1);assert.equal(phaseActive(r),true);
});
test('only equipped Phantom activates outside training, flight, portals and failed runs',()=>{
 for(let tier=0;tier<8;tier++){const r=run(tier);start(r);assert.equal(phaseActive(r),tier===6);}
 for(const mode of ['training','ship','transit','failed'] as const){const r=run();if(mode==='training')r.training={step:0,limit:100};if(mode==='ship')r.ship.active=true;if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};if(mode==='failed')r.failed=true;r.boostCharge=1;const activated=r.activateTurbo();assert.equal(activated,mode==='training');assert.equal(r.phase.remaining,0);assert.equal(phaseActive(r),false);}
});
test('flight, portals and expired turbo cancel the window; revive cannot restore a used phase',()=>{
 for(const mode of ['ship','transit','expired'] as const){const r=run();start(r);if(mode==='ship')r.ship.active=true;if(mode==='expired')r.boost=0;if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};assert.equal(phaseActive(r),false);r.step(1/120);assert.equal(r.phase.remaining,0,mode);}
 const r=run();start(r);tick(r,.2);const left=r.phase.remaining;r.failed=true;r.health=0;r.step(1);assert.equal(r.phase.remaining,left);assert.equal(r.revive(),true);assert.equal(r.phase.remaining,0);assert.equal(phaseActive(r),false);assert.equal(run().phase.remaining,0);
});
test('energy collected while phased preserves ordinary scoring and next-turbo charging without extending phase',()=>{
 const r=run(),base=run(0);start(r);start(base);for(let i=0;i<5;i++){for(const x of [r,base]){x.gates=[{...barrier(x,100+i),z:x.z+13,safe:0,blocked:[1,2,3],energyLane:0}];x.step(.06);}}
 near(r.phase.remaining,.7);near(r.boost,base.boost);assert.equal(r.energy,5);assert.equal(r.score,base.score);assert.equal(r.boostCharge,base.boostCharge);assert.equal(r.turboEnergy,base.turboEnergy);assert.equal(r.overdrive.earned,2);
});
test('Phantom unlocked mid-run applies on next run only',()=>{
 const r=run(5),p=cleanBikeProgress({version:1,legacyXp:9000,best:14000,unlocked:5,selected:5}),tracker=new BikeProgressTracker();tracker.start(r);r.z=26000;assert.equal(tracker.record(p,r).unlocked,true);assert.equal(p.selected,6);start(r);assert.equal(r.phase.remaining,0);const next=run(p.selected);start(next);assert.equal(next.phase.remaining,1);
});
test('six locale Garage, read-only locked preview and compact turbo HUD show phase state',()=>{
 const r=run(),p=cleanBikeProgress({version:1,legacyXp:9000,best:26000,unlocked:6,selected:6});for(const locale of ['en','tr','de','es','fr','pt-BR']){setLocale(locale);const html=garageMarkup(p,6);assert.match(html,/phantom-ability/);assert.ok(html.includes(t('ability.phantom.short')));assert.doesNotMatch(t('ability.phantom.duration',{seconds:1}),/\{/);}setLocale('en');assert.equal(phantomStatus(r),'Phase · CHARGE TURBO');assert.match(phantomHud(r),/phantom-status/);assert.equal(phantomHud(run(5)),'');r.boostCharge=1;assert.equal(phantomStatus(r),'Phase · TURBO TO USE');assert.equal(r.activateTurbo(),true);assert.equal(phantomStatus(r),'Phase · 1.0s · NO FIRE');tick(r,1);assert.equal(phantomStatus(r),'Phase · USED THIS TURBO');const locked=garageMarkup(cleanBikeProgress({version:1,unlocked:5,selected:5}),6);assert.match(locked,/Phase Drive/);assert.match(locked,/data-action="garageEquip" data-tier="6" disabled/);
});
test('ghost materials affect only the bike and gun, preserve shaders and restore exact arrays and shadows',()=>{
 const fx=new PhaseFX(),bike=new THREE.Group(),gun=new THREE.Group(),shared=new THREE.MeshStandardMaterial({color:0x123456}),shader=(s:any)=>{s.custom=true;};shared.onBeforeCompile=shader;shared.customProgramCacheKey=()=> 'preserved-liquid';const mesh=new THREE.Mesh(new THREE.BoxGeometry(),shared),other=new THREE.Mesh(mesh.geometry,shared),multi=new THREE.Mesh(mesh.geometry,[shared,new THREE.MeshBasicMaterial({color:0xabcdef})]);mesh.castShadow=true;bike.add(mesh,fx.root);gun.add(multi);const array=multi.material;
 fx.update(true,PHANTOM.duration,1,bike,gun);assert.equal(fx.root.visible,true);assert.equal(fx.root.children.length,5);assert.notEqual(mesh.material,shared);assert.equal(other.material,shared);assert.equal(shared.transparent,false);assert.equal(shared.opacity,1);assert.equal((mesh.material as THREE.Material).opacity,.32);assert.equal((mesh.material as THREE.Material).onBeforeCompile,shader);assert.equal((mesh.material as THREE.Material).customProgramCacheKey(),'preserved-liquid');assert.equal(mesh.castShadow,false);const clone=mesh.material;fx.update(true,.3,1.3,bike,gun);assert.equal(mesh.material,clone);fx.update(false,0,2,bike,gun);assert.equal(mesh.material,shared);assert.equal(multi.material,array);assert.equal(mesh.castShadow,true);assert.equal(fx.root.visible,false);fx.update(true,PHANTOM.duration,3,bike,gun);assert.equal(mesh.material,clone);fx.reset();assert.equal(mesh.material,shared);fx.dispose();
});
test('phase start and return sounds are finite, fade cleanly and ship in both native audio banks',()=>{
 for(const kind of ['phaseStart','phaseEnd'] as const){const samples=synthEffect(kind,44100);assert.ok(samples.every(Number.isFinite));assert.ok(samples.some(x=>Math.abs(x)>.05));assert.ok(Math.abs(samples.at(-1)!)<1e-5);for(const mode of ['game-effects','music-mode']){const wav=readFileSync(new URL(`../public/audio/${mode}/${kind}.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.length-44,wav.readUInt32LE(40));assert.ok(wav.length>10000);}}
});
