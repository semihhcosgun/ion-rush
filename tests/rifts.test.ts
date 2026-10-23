import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {BODIES,RUN_GOALS} from '../src/config';
import {RiftStream,type Rift} from '../src/rifts';

test('rift stream starts safely, remains deterministic and protects planet flybys',()=>{
 for(let seed=0;seed<200;seed++){
  const a=new RiftStream(seed),b=new RiftStream(seed);let previous=0,lastBlack=-Infinity;
  for(let i=0;i<18;i++){
   const r=a.next();assert.deepEqual(r,b.next());
   if(i===0){assert.equal(r.kind,'blue');assert.ok(r.z>=6500&&r.z<=7200);}
   if(previous)assert.ok(r.z-previous>=3000&&r.z-previous<=7000,`${seed}: ${previous} -> ${r.z}`);
   assert.ok(BODIES.every(body=>Math.abs(r.z-body.passAt)>=700));
   if(r.kind==='black'){assert.ok(r.z>=28000);assert.ok(r.z-lastBlack>=8000);lastBlack=r.z;}
   previous=r.z;
  }
 }
});

function isolatedRace(rift:Rift){const race=new Race(7);race.combat.update=()=>{};race.gates=[];race.stream.nextZ=100000;race.rifts=[rift];race.riftStream.nextZ=100000;race.z=rift.z-.2;race.surface=rift.surface;race.lane=race.laneX=rift.lane;race.goals=new Set(RUN_GOALS.map(goal=>goal.id));return race;}

test('suction starts before arrival and the entrance stays fixed even at turbo speed',()=>{
 for(const boosted of [false,true]){
  const rift:Rift={id:9,z:30000,kind:'violet',surface:0,lane:0,jump:1200,points:900},race=isolatedRace(rift);
  race.z=rift.z-150;if(boosted)race.boost=5;
  while(!race.riftTransit)race.step(1/120);
  assert.ok(rift.z-race.z>race.speed*.75);
  while(race.riftTransit!.elapsed<.79){
   race.step(1/120);assert.equal(race.riftTransit!.portalZ,rift.z);assert.ok(race.z<rift.z);
  }
  while(!race.riftTransit!.jumped)race.step(1/120);
  const exitZ=race.riftTransit!.portalZ;
  race.step(.1);assert.equal(race.riftTransit!.portalZ,exitZ);
 }
});

test('entering a wormhole skips distance once, pays once and preserves skipped gate safety',()=>{
 const rift:Rift={id:1,z:1000,kind:'violet',surface:2,lane:-1,jump:1200,points:900},race=isolatedRace(rift);race.step(.02);
 assert.ok(race.riftTransit);assert.ok(race.z<2200);assert.equal(race.score,0);assert.equal(race.events.filter(e=>e.type==='riftEnter').length,1);
 for(let i=0;i<19;i++)race.step(.1);
 assert.ok(race.z>=2200);assert.equal(race.score,900);assert.ok(race.riftBonus>0);
 const z=race.z;race.step(.02);assert.ok(race.z>z);assert.equal(race.score,900);
});

test('the road keeps moving through suction and release without a stationary frame',()=>{
 const race=isolatedRace({id:8,z:1000,kind:'violet',surface:0,lane:0,jump:1200,points:900});race.step(.02);
 for(let i=0;i<108;i++){const before=race.z;race.step(1/60);assert.ok(race.z>before);}
 assert.equal(race.events.filter(e=>e.type==='riftJump').length,1);
});

test('passing a different rift lane grants no distance or points',()=>{
 const rift:Rift={id:2,z:1000,kind:'blue',surface:0,lane:1,jump:600,points:400},race=isolatedRace(rift);race.lane=race.laneX=-1;race.step(.02);
 assert.ok(race.z<1001);assert.equal(race.score,0);assert.equal(race.events.filter(e=>e.type==='riftMiss').length,1);
});

test('a rift remains bound to its generated track surface',()=>{
 const rift:Rift={id:4,z:1000,kind:'blue',surface:2,lane:0,jump:600,points:400},race=isolatedRace(rift);race.surface=1;race.step(.02);
 assert.ok(race.z<1001);assert.equal(race.score,0);assert.ok(race.events.some(e=>e.type==='riftMiss'));
});

test('all three rift kinds use one direct transit without a lane trial or lingering portal',()=>{
 for(const kind of ['blue','violet','black'] as const)for(const fps of [30,60,120])for(const boost of [0,5]){
  const rift:Rift={id:3,z:30000,kind,surface:0,lane:0,jump:1800,points:2000},race=isolatedRace(rift);
  race.ship.nextZ=race.meteors.nextZ=1e9;race.z=rift.z-race.speed*.82-9;race.boost=boost;
  const view=new RiftView();let frames=0;
  while(!race.events.some(e=>e.type==='riftComplete')&&frames++<fps*4){
   race.step(1/fps);assert.equal(race.riftChallenge,undefined);
  }
  assert.ok(frames<fps*4);assert.equal(race.failed,false);assert.equal(race.score,2000);
  for(const type of ['riftEnter','riftJump','riftComplete'])assert.equal(race.events.filter(e=>e.type===type).length,1);
  assert.equal(race.events.some(e=>e.type==='riftChallenge'||e.type==='riftShift'),false);
  assert.equal(race.riftTransit,undefined);assert.ok(race.z>=rift.z+rift.jump);
  view.render(race,pathAt(race.z),race.time);assert.equal(view.root.visible,false);
 }
});

test('suction locks steering until direct black-hole transit completes',()=>{
 for(const boost of [0,5])for(const direction of [-1,1]){
  const rift:Rift={id:11,z:44000,kind:'black',surface:0,lane:0,jump:2000,points:2000},race=isolatedRace(rift);
  race.ship.nextZ=race.meteors.nextZ=1e9;race.boost=boost;race.z=rift.z-(race.speed*.82+80);
  assert.equal(race.changeLane(direction),false);assert.equal(race.shift(direction),false);
  assert.equal(race.riftCapture?.id,rift.id);race.boostCharge=1;assert.equal(race.activateTurbo(),false);
  for(let i=0;i<600&&!race.events.some(e=>e.type==='riftComplete');i++){
   race.step(1/120);if(!race.events.some(e=>e.type==='riftComplete')){assert.equal(race.changeLane(direction),false);assert.equal(race.shift(direction),false);}
  }
  assert.ok(race.events.some(e=>e.type==='riftComplete'));assert.equal(race.riftChallenge,undefined);assert.equal(race.changeLane(direction),true);
 }
});
test('before suction and on another lane the pilot remains free to avoid the hole',()=>{
 const rift:Rift={id:12,z:44000,kind:'black',surface:0,lane:0,jump:2000,points:2000};
 const race=isolatedRace(rift);race.z=rift.z-race.speed*.82-150;assert.equal(race.changeLane(-1),true);
 for(let i=0;i<600;i++)race.step(1/120);
 assert.equal(race.riftCapture,undefined);assert.equal(race.riftTransit,undefined);assert.equal(race.riftChallenge,undefined);
});


test('last-moment lane entry pulls the ship toward the fixed portal, never the reverse',()=>{
 for(const direction of [-1,1]){
  const rift:Rift={id:13,z:44000,kind:'black',surface:0,lane:0,jump:2000,points:2000},race=isolatedRace(rift);
  race.z=rift.z-12;race.lane=race.laneX=direction;
  assert.equal(race.changeLane(-direction),true);
  while(!race.riftTransit)race.step(1/120);
  assert.equal(race.riftTransit.portalLane,0);assert.equal(race.riftTransit.portalSurface,0);
  assert.ok(Math.abs(race.laneX)>.1);
  const offset=Math.abs(race.laneX);
  race.step(.1);assert.ok(Math.abs(race.laneX)<offset);
  assert.equal(race.riftTransit.portalLane,0);assert.equal(race.riftTransit.portalZ,race.riftTransit.jumped?race.z+9:rift.z);
  for(let i=0;i<30;i++)race.step(1/120);
  assert.equal(race.laneX,0);assert.equal(race.laneLeft,0);
 }
});
import {RiftView} from '../src/rift-view';
import {LiquidTransit} from '../src/liquid-transit';
import {trackPoint} from '../src/combat-space';
import {pathAt} from '../src/path';
import * as THREE from 'three';

test('portal mesh and suction destination stay at the original lane during late entry',()=>{
 const rift:Rift={id:14,z:44000,kind:'black',surface:0,lane:0,jump:2000,points:2000},race=isolatedRace(rift);
 race.z=rift.z-12;race.lane=race.laneX=1;race.changeLane(-1);
 while(!race.riftTransit)race.step(1/120);
 const view=new RiftView(),anchor=new THREE.Group(),liquid=new LiquidTransit(anchor);
 for(let i=0;i<20&&!race.riftTransit!.jumped;i++){
  const origin=pathAt(race.z),expected=trackPoint(rift.z,rift.surface,rift.lane,7.55).sub(new THREE.Vector3(origin.x,origin.y,-race.z));
  view.render(race,origin,race.time);liquid.update(race);
  assert.ok(view.root.position.distanceTo(expected)<1e-8);
  const throat=(liquid as unknown as {uniforms:{liquidThroat:{value:THREE.Vector3}}}).uniforms.liquidThroat.value;
  assert.ok(throat.distanceTo(expected)<1e-8);
  race.step(1/120);
 }
});

import {CombatView} from '../src/combat-view';
import {enemyPoint} from '../src/combat-space';

import {Combat} from '../src/combat';
function liveApproach(kind:'black'|'blue'|'violet'='black',boosted=false){
 const rift:Rift={id:21,z:30000,kind,surface:0,lane:0,jump:1800,points:2000},r=isolatedRace(rift);
 r.combat.update=Combat.prototype.update;r.ship.nextZ=r.meteors.nextZ=1e6;if(boosted)r.boost=5;
 r.z=rift.z-r.speed*.82-9-.001;
 const e=r.combat.enemies[0];Object.assign(e,{active:true,training:false,pursuing:true,hunting:false,id:501,kind:'manta',z:r.z+75,surface:0,visualSurface:0,lane:-1,hp:3,maxHp:3,age:3,flight:'upperLeft',fired:true,attackCooldown:10});
 return r;
}

test('portal approach runs the same enemy flight as normal play until the rider enters',()=>{
 for(const kind of ['black','blue','violet'] as const)for(const boosted of [false,true]){
  const r=liveApproach(kind,boosted),e=r.combat.enemies[0],control=liveApproach(kind,boosted),ordinary=control.combat.enemies[0],view=new CombatView();
  const first=enemyPoint(e);let frames=0;
  while(!r.riftTransit&&frames++<10)r.step(1/120);assert.ok(r.riftTransit);assert.ok(r.riftTransit.elapsed<.05);
  control.z=r.z;control.time=r.time;control.combat.update(control,1/120);
  let approachFrames=0,changedFrames=0;const initialAge=e.age;
  while(r.riftTransit!.elapsed<.82){
   assert.equal(e.active,true,kind+' disappeared before entry');assert.equal(e.hp,3);assert.deepEqual(e.motion,ordinary.motion);
   view.render(r,false);assert.equal(view.ships[0].visible,true);assert.ok(view.models[0].some(m=>m.visible));approachFrames++;
   const before=enemyPoint(e);r.step(1/120);
   if(r.riftTransit!.elapsed<.82){control.z=r.z;control.time=r.time;control.combat.update(control,1/120);if(enemyPoint(e).distanceTo(before)>1e-6)changedFrames++;}
  }
  assert.ok(approachFrames>80);assert.ok(changedFrames>75);assert.ok(e.age-initialAge>.6);assert.ok(enemyPoint(e).distanceTo(first)>10);
  assert.equal(e.active,false);view.render(r,false);assert.equal(view.ships[0].visible,false);
  assert.equal(r.health,3);assert.equal(r.combat.kills,0);assert.equal(r.score,0);assert.ok(!r.events.some(e=>e.type==='kill'||e.type==='hit'));
  r.step(.2);assert.equal(e.active,false);view.disposeGeometry();
 }
});

test('outside bolts cross the rider and enemy while transit stays protected and held fire stays off',()=>{
 const r=liveApproach();r.step(1/120);assert.ok(r.riftTransit);const e=r.combat.enemies[0],start=trackPoint(r.z,r.surface,r.laneX,r.playerHeight),target=enemyPoint(e);
 const hostile=r.combat.bolts[0],friendly=r.combat.bolts[1];
 for(const [bolt,point,isHostile] of [[hostile,start,true],[friendly,target,false]] as const)Object.assign(bolt,{active:true,hostile:isHostile,wx:point.x,wy:point.y,wz:point.z,z:-point.z,vx:.1,vy:0,vz:0,life:3,surface:r.surface,enemyId:e.id});
 r.firing=true;r.combat.heat=50;const shots=r.combat.shots,heat=r.combat.heat;
 r.step(1/120);
 assert.equal(hostile.active,true);assert.equal(friendly.active,true);assert.ok(Math.abs(hostile.wx-start.x-.1/120)<1e-8);assert.ok(Math.abs(friendly.wx-target.x-.1/120)<1e-8);assert.ok(hostile.life<3);
 assert.equal(r.health,3);assert.equal(e.hp,3);assert.equal(r.combat.shots,shots);assert.ok(r.combat.heat<heat);assert.equal(r.combat.hits,0);assert.equal(r.combat.kills,0);
 assert.ok(!r.events.some(e=>e.type==='shot'||e.type==='hit'||e.type==='enemyHit'||e.type==='kill'));
 while(r.riftTransit!.elapsed<.82)r.step(1/120);assert.ok(r.combat.bolts.every(b=>!b.active));
});

test('enemy attack timers, volleys and projectile motion keep advancing during suction',()=>{
 const r=liveApproach(),e=r.combat.enemies[0];Object.assign(e,{hunting:true,volley:2,nextShot:.2,fired:true,charge:1});
 r.combat.singularity.active=true;r.combat.titan.active=true;
 const existing=r.combat.bolts[0];Object.assign(existing,{active:true,hostile:true,wx:0,wy:40,wz:-r.z-100,vx:1,vy:0,vz:0,life:4,z:r.z+100});const x=existing.wx;
 r.step(1/120);assert.ok(r.riftTransit);assert.equal(existing.active,true);assert.ok(existing.wx>x);assert.equal(r.combat.singularity.active,false);assert.equal(r.combat.titan.active,false);
 while(r.riftTransit!.elapsed<.3)r.step(1/120);
 assert.ok(e.nextShot>0);assert.ok(e.volley<2);assert.ok(r.events.some(e=>e.type==='enemyShot'));
 const shot=r.combat.bolts.find(b=>b.active&&b.enemyId===e.id)!;assert.ok(shot);const position=new THREE.Vector3(shot.wx,shot.wy,shot.wz);r.step(1/120);assert.ok(new THREE.Vector3(shot.wx,shot.wy,shot.wz).distanceTo(position)>0);
 assert.equal(r.health,3);assert.equal(r.score,0);
});

test('existing death animation finishes during approach instead of freezing debris in the world',()=>{
 const r=liveApproach(),e=r.combat.enemies[0];e.hp=0;e.dead=.1;r.step(1/120);const death=e.dead;
 for(let i=0;i<60;i++)r.step(1/120);assert.ok(r.riftTransit!.elapsed<.82);assert.ok(e.dead>death);assert.equal(e.active,false);assert.equal(r.combat.kills,0);
});

test('ordinary transit cleanup still removes enemies immediately',()=>{
 const r=new Race(7),e=r.combat.enemies[0];e.active=true;r.combat.clearTransit();assert.equal(e.active,false);
});
