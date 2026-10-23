import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Race} from '../src/game';
import {COMBAT,ENEMY_TYPES} from '../src/config';
import {enemyPoint} from '../src/combat-space';
import {HUNTER} from '../src/hunter';
import {HunterView} from '../src/hunter-view';
import {hunterStatus,hunterHud} from '../src/hunter-ui';
import {garageMarkup} from '../src/garage';
import {BikeProgressTracker,cleanBikeProgress} from '../src/bike-progress';
import {setLocale,t} from '../src/i18n';
import {synthEffect} from '../src/sfx-bank';
function run(tier=3){const r=new Race(2249,tier);r.gates=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;return r;}
function target(r:Race,hp=10,index=0){const e=r.combat.enemies[index];Object.assign(e,{active:true,training:false,pursuing:false,kind:'manta',flight:'level',motion:undefined,defense:undefined,id:100+index,gateId:-1,z:70,surface:0,visualSurface:0,lane:index,hp,maxHp:hp,age:3,fired:true,dead:0});return e;}
function tick(r:Race,seconds:number){for(let i=0;i<Math.round(seconds*120);i++)r.combat.update(r,1/120);}
function shot(r:Race,e=target(r)){r.combat.aimWorld=enemyPoint(e);r.firing=true;r.combat.update(r,1/120);r.firing=false;}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('two real projectile hits launch two homing missiles; each deals one damage with one normal kill award',()=>{
 const r=run(),e=target(r,4);shot(r,e);tick(r,.5);assert.equal(e.hp,3);assert.equal(r.combat.hunter.hits,1);assert.equal(r.combat.hunter.remaining,0);
 shot(r,e);tick(r,.9);assert.equal(e.hp,0);assert.equal(r.combat.shots,2);assert.equal(r.combat.hits,2);assert.equal(r.combat.kills,1);assert.equal(r.score,ENEMY_TYPES.manta.points);
 const launch=r.events.filter(e=>e.type==='targetLock');assert.equal(launch.length,1);assert.equal(launch[0].value,2);assert.equal(r.events.filter(e=>e.type==='kill').length,1);
 assert.equal(r.events.filter(e=>e.type==='enemyHit').length,4);assert.ok(r.combat.hunter.remaining>10);assert.equal(r.combat.hunter.missiles.some(m=>m.active),false);
});
test('normal firing and heat stay unchanged for every bike; misses never build lock',()=>{
 for(let tier=0;tier<8;tier++){const r=run(tier);r.firing=true;r.combat.update(r,1/120);r.firing=false;assert.equal(r.combat.shots,1);assert.equal(r.combat.bolts.filter(b=>b.active&&!b.hostile).length,1);assert.equal(r.combat.bolts.find(b=>b.active)?.power,1);assert.equal(r.combat.heat,COMBAT.shotHeat);tick(r,.4);assert.equal(r.combat.hunter.hits,0);assert.equal(r.combat.hunter.remaining,0);}
});
test('a changed target starts a new counter; lethal first or second shots do not spend cooldown',()=>{
 const r=run(),a=target(r),b=target(r,10,1);
 r.combat.damageEnemy(r,a,1);r.combat.damageEnemy(r,b,1);assert.equal(r.combat.hunter.targetId,b.id);assert.equal(r.combat.hunter.hits,1);
 r.combat.damageEnemy(r,a,1);assert.equal(r.combat.hunter.hits,1);r.combat.damageEnemy(r,a,1);assert.equal(r.events.filter(e=>e.type==='targetLock').length,1);assert.ok(r.combat.hunter.missiles.every(m=>m.active&&m.targetId===a.id));
 for(const hp of [1,2]){const x=run(),e=target(x,hp);for(let i=0;i<hp;i++)x.combat.damageEnemy(x,e,1);assert.equal(x.combat.hunter.remaining,0);assert.equal(x.combat.hunter.hits,0);assert.equal(x.events.some(e=>e.type==='targetLock'),false);}
});
test('cooldown hits are discarded and two fresh hits are required after twelve simulation seconds',()=>{
 const r=run(),e=target(r,40);r.combat.damageEnemy(r,e,1);r.combat.damageEnemy(r,e,1);near(r.combat.hunter.remaining,12);tick(r,1);
 for(let i=0;i<6;i++)r.combat.damageEnemy(r,e,1);assert.equal(r.combat.hunter.hits,0);tick(r,10.9);r.combat.damageEnemy(r,e,1);assert.equal(r.combat.hunter.hits,0);
 tick(r,.1);assert.equal(r.combat.hunter.ready,true);assert.equal(r.events.filter(e=>e.type==='targetLock').length,1);r.combat.damageEnemy(r,e,1);assert.equal(r.combat.hunter.hits,1);r.combat.damageEnemy(r,e,1);assert.equal(r.events.filter(e=>e.type==='targetLock').length,2);near(r.combat.hunter.remaining,12);
});
test('allied and missile hits, other bikes, training, flight, transit and failed runs cannot activate it',()=>{
 for(const mode of ['support','missile','trainingEnemy','training','ship','transit','failed','locked','rookie','ignition','runner','vanguard'] as const){
  const tier=mode==='rookie'?0:mode==='ignition'?1:mode==='runner'?2:mode==='vanguard'?4:3,r=run(tier),e=target(r);
  if(mode==='trainingEnemy')e.training=true;if(mode==='training')r.training={step:0,limit:100};if(mode==='ship')r.ship.active=true;if(mode==='failed')r.failed=true;if(mode==='locked')r.combat.locked=true;
  if(mode==='transit')r.riftTransit={rift:{id:1,z:100,kind:'blue',surface:0,lane:0,jump:650,points:400},elapsed:0,jumped:false,mode:'enter'};
  for(let i=0;i<3;i++)r.combat.damageEnemy(r,e,1,mode==='support',mode==='missile'?'hunter':'shot');assert.equal(r.combat.hunter.remaining,0,mode);assert.equal(r.combat.hunter.hits,0,mode);assert.equal(r.events.some(e=>e.type==='targetLock'),false,mode);
 }
});
test('gun lock clears partial progress but already-launched missiles can finish while cooling',()=>{
 const r=run(),e=target(r,10);r.combat.damageEnemy(r,e,1);r.combat.locked=true;r.combat.heat=100;tick(r,.01);assert.equal(r.combat.hunter.hits,0);
 r.combat.locked=false;r.combat.heat=0;r.combat.damageEnemy(r,e,1);assert.equal(r.combat.hunter.hits,1);r.combat.damageEnemy(r,e,1);r.combat.locked=true;r.combat.heat=100;tick(r,1);assert.equal(e.hp,5);assert.equal(r.combat.locked,true);assert.equal(r.combat.hunter.remaining>10,true);
});
test('missiles follow a moving target and cannot retarget a bystander or a reused pool slot',()=>{
 const r=run(),e=target(r,10),other=target(r,10,1);r.combat.damageEnemy(r,e,1);r.combat.damageEnemy(r,e,1);e.flight='upperRight';e.lane=2;tick(r,1.5);assert.equal(e.hp,6);assert.equal(other.hp,10);
 const lost=run(),victim=target(lost,10);lost.combat.damageEnemy(lost,victim,1);lost.combat.damageEnemy(lost,victim,1);victim.id=999;tick(lost,.1);assert.equal(victim.hp,8);assert.ok(lost.combat.hunter.missiles.every(m=>!m.active));assert.ok(lost.combat.hunter.remaining>11);
});
test('target death removes a partial lock, reserved ordinary bolt slots stay available',()=>{
 const r=run(),e=target(r);r.combat.damageEnemy(r,e,1);r.combat.damageEnemy(r,e,20,true);assert.equal(r.combat.hunter.hits,0);
 const x=run(),a=target(x);for(const b of x.combat.bolts)b.active=true;x.combat.damageEnemy(x,a,1);x.combat.damageEnemy(x,a,1);assert.equal(x.combat.bolts.length,COMBAT.bolts);assert.equal(x.combat.hunter.missiles.filter(m=>m.active).length,2);assert.equal(x.combat.shots,0);assert.equal(x.combat.heat,0);
});
test('pause/failed steps freeze missiles and cooldown, revive/transit cancel missiles without resetting cooldown',()=>{
 const r=run(),e=target(r);r.combat.damageEnemy(r,e,1);r.combat.damageEnemy(r,e,1);const missile=r.combat.hunter.missiles[0],position=missile.position.clone();r.failed=true;r.health=0;r.step(2);assert.equal(r.combat.hunter.remaining,12);assert.deepEqual(missile.position,position);assert.equal(r.revive(),true);assert.equal(r.combat.hunter.remaining,12);assert.ok(r.combat.hunter.missiles.every(m=>!m.active));assert.equal(run().combat.hunter.remaining,0);
 const x=run(),a=target(x);x.combat.damageEnemy(x,a,1);x.combat.damageEnemy(x,a,1);x.combat.clearTransit();assert.equal(x.combat.hunter.remaining,12);assert.equal(x.combat.hunter.missiles.some(m=>m.active),false);
});
test('a Hunter unlock in a Runner run activates only in the next run',()=>{
 const r=run(2),p=cleanBikeProgress({version:1,legacyXp:1100,best:1500,unlocked:2,selected:2}),tracker=new BikeProgressTracker();tracker.start(r);r.z=3500;assert.equal(tracker.record(p,r).unlocked,true);assert.equal(p.selected,3);assert.equal(r.bikeTier,2);const e=target(r);r.combat.damageEnemy(r,e,1);r.combat.damageEnemy(r,e,1);assert.equal(r.combat.hunter.remaining,0);
 const next=run(p.selected),a=target(next);next.combat.damageEnemy(next,a,1);next.combat.damageEnemy(next,a,1);assert.equal(next.combat.hunter.remaining,12);
});
test('six-language Garage/HUD descriptions and bounded 3D models reflect actual lock state',()=>{
 const r=run(),e=target(r),p=cleanBikeProgress({version:1,legacyXp:1100,best:3500,unlocked:3,selected:3});
 for(const locale of ['en','tr','de','es','fr','pt-BR']){setLocale(locale);const html=garageMarkup(p,3);assert.match(html,/Target Lock/);assert.match(html,/hunter-ability/);assert.ok(html.includes(t('ability.hunter.short')));assert.doesNotMatch(t('ability.hunter.damage',{count:2,damage:1}),/\{/);}
 setLocale('en');assert.equal(hunterStatus(r),'Target Lock · 0/2 HITS');assert.match(hunterHud(r),/hunter-status/);assert.equal(hunterHud(run(2)),'');const view=new HunterView(),origin={x:1,y:2,z:-3},camera=new THREE.Quaternion();
 r.combat.damageEnemy(r,e,1);assert.equal(hunterStatus(r),'Target Lock · 1/2 HITS');view.render(r,origin,camera);assert.equal(view.reticle.visible,true);assert.equal(view.missiles.filter(m=>m.visible).length,0);
 r.combat.damageEnemy(r,e,1);assert.equal(hunterStatus(r),'Target Lock · MISSILES AWAY');view.render(r,origin,camera);assert.equal(view.missiles.filter(m=>m.visible).length,2);near(view.missiles[0].position.x,r.combat.hunter.missiles[0].position.x-1);tick(r,.7);assert.match(hunterStatus(r),/Target Lock · 12s/);r.ship.active=true;view.render(r,origin,camera);assert.equal(view.root.visible,false);
 const locked=garageMarkup(cleanBikeProgress({version:1,unlocked:2,selected:2}),3);assert.match(locked,/Target Lock/);assert.match(locked,/data-action="garageEquip" data-tier="3" disabled/);
});
test('the launch cue is finite, ends cleanly and ships in both native sound banks',()=>{
 const samples=synthEffect('targetLock',44100);assert.ok(samples.every(Number.isFinite));assert.ok(samples.some(x=>Math.abs(x)>.05));assert.ok(Math.abs(samples.at(-1)!)<1e-5);
 for(const mode of ['game-effects','music-mode']){const wav=readFileSync(new URL(`../public/audio/${mode}/targetLock.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.length-44,wav.readUInt32LE(40));assert.ok(wav.length>10000);}
});

test('missile exhaust uses a bounded curved history, stays fixed on pause and clears on impact or a new launch',()=>{
 const r=run(),e=target(r,10),view=new HunterView(),origin={x:10,y:20,z:30},camera=new THREE.Quaternion();
 r.combat.damageEnemy(r,e,1);r.combat.damageEnemy(r,e,1);view.render(r,origin,camera);
 const objects=view.root.children.length,trail=view.trails[0],state=r.combat.hunter.missiles[0];assert.equal(view.trails.length,2);assert.equal(trail.length,6);assert.ok(trail.every(s=>!s.visible));assert.equal(view.missiles[0].scale.x,1.7);
 for(let i=1;i<=8;i++){state.previous.copy(state.position);state.position.add(new THREE.Vector3(i*.08,.2,-2));state.life-=.02;r.time+=.02;view.render(r,origin,camera);}
 assert.ok(trail.every(s=>s.visible));assert.ok(trail.every(s=>s.scale.y>0&&Number.isFinite(s.position.x)));assert.equal(view.root.children.length,objects);
 const positions=trail.map(s=>s.position.clone());view.render(r,origin,camera);trail.forEach((s,i)=>assert.deepEqual(s.position,positions[i]));
 view.render(r,{x:11,y:20,z:30},camera);trail.forEach((s,i)=>near(s.position.x,positions[i].x-1));
 state.active=false;view.render(r,origin,camera);assert.ok(trail.every(s=>!s.visible));assert.equal(view.missiles[0].visible,false);
 state.active=true;state.life=HUNTER.lifetime;state.position.set(100,200,300);view.render(r,origin,camera);assert.ok(trail.every(s=>!s.visible));
 state.previous.copy(state.position);state.position.z-=2;state.life-=.02;r.time+=.02;view.render(r,origin,camera);assert.ok(trail.some(s=>s.visible));
 state.life=HUNTER.lifetime;state.position.set(-100,-200,-300);view.render(r,origin,camera);assert.ok(trail.every(s=>!s.visible),'a relaunch never connects to the old missile path');
 r.ship.active=true;view.render(r,origin,camera);assert.equal(view.root.visible,false);assert.ok(view.trails.flat().every(s=>!s.visible));
});
