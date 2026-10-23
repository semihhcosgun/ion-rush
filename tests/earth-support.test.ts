import test from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {EARTH_SUPPORT as S,supportUnlocked} from '../src/earth-support';
import {ENEMY_TYPES} from '../src/config';

function flight(){const r=new Race(33);r.gates=[];r.stream.nextZ=r.riftStream.nextZ=r.meteors.nextZ=r.ship.nextZ=1e9;return r;}
function tick(r:Race,seconds:number){for(let i=0;i<Math.ceil(seconds*120);i++){r.support.step(r,1/120);r.combat.update(r,1/120);}}
function ready(){const r=flight();r.support.unlocked=true;r.support.charge=1;return r;}
function enemy(r:Race,hp=12,index=0){const e=r.combat.enemies[index];Object.assign(e,{active:true,id:index+10,kind:'apex',age:5,hp,maxHp:hp,z:r.z+45+index*10,surface:0,visualSurface:0,training:false,dead:0});return e;}

test('support unlocks at 10 km with one immediate call; later calls recharge normally',()=>{
 const r=flight();r.z=S.unlockDistance-.01;r.support.step(r,.01);assert.equal(r.support.unlocked,false);
 r.z=S.unlockDistance;r.support.step(r,1/120);assert.equal(r.support.unlocked,true);assert.equal(r.support.charge,1);assert.equal(r.support.ready,true);assert.equal(r.support.activate(r),true);assert.equal(r.support.charge,0);assert.equal(r.support.activate(r),false);
 assert.equal(r.events.filter(e=>e.type==='supportUnlocked').length,1);r.support.step(r,.1);assert.equal(r.events.filter(e=>e.type==='supportUnlocked').length,1);
 assert.equal(supportUnlocked(false,9999),false);assert.equal(supportUnlocked(undefined,10000),true);assert.equal(supportUnlocked(true,0),true);assert.equal(supportUnlocked(false,NaN),false);
 tick(r,S.duration+.1);assert.equal(r.support.ready,false);tick(r,S.rechargeSeconds);assert.equal(r.support.ready,true);
 assert.equal(r.events.filter(e=>e.type==='supportUnlocked').length,1);assert.equal(r.events.filter(e=>e.type==='supportReady').length,2);
});
test('charge needs four live minutes, holds exactly one call and announces readiness once',()=>{
 const r=flight();r.support.unlocked=true;tick(r,239);assert.equal(r.support.ready,false);tick(r,1.02);assert.equal(r.support.ready,true);
 tick(r,240);assert.equal(r.support.charge,1);assert.equal(r.events.filter(e=>e.type==='supportReady').length,1);
 assert.equal(r.support.activate(r),true);assert.equal(r.support.activate(r),false);tick(r,S.duration+.02);assert.equal(r.support.active,false);assert.ok(r.support.charge<.001);assert.equal(r.support.used,1);
});
test('training, death and rift transit do not recharge; retries start empty',()=>{
 const r=ready();r.support.charge=.4;r.training={step:0,limit:10};tick(r,10);assert.equal(r.support.charge,.4);
 r.training=undefined;r.failed=true;tick(r,10);assert.equal(r.support.charge,.4);r.failed=false;
 r.riftChallenge={rift:{id:1,z:0,surface:0,lane:0,kind:'black',jump:2000,points:2000},remaining:6,nextCheck:1.5,targetLane:0};tick(r,10);assert.equal(r.support.charge,.4);
 assert.equal(new Race().support.charge,0);
});
test('support absorbs three hits without healing or replacing an existing shield',()=>{
 const r=ready();r.health=1;r.shield=2;r.shieldTime=12;r.support.activate(r);for(let i=0;i<S.guards;i++){r.invulnerable=0;r.damage('meteor','impact',undefined,3);}
 assert.equal(r.health,1);assert.equal(r.shield,2);assert.equal(r.shieldTime,12);assert.equal(r.support.guard,0);assert.equal(r.events.filter(e=>e.type==='supportBlocked').length,S.guards);
 r.invulnerable=0;r.damage();assert.equal(r.shield,1);assert.equal(r.health,1);
 r.shield=0;r.invulnerable=0;r.damage();assert.equal(r.failed,true);
});
test('team delivers ten two-round salvos, leaves a high-health target alive and does not inflate player accuracy',()=>{
 const r=ready(),e=enemy(r,60);r.support.activate(r);tick(r,S.duration+.1);
 assert.equal(e.hp,60-S.salvos*S.damage);assert.equal(r.events.filter(e=>e.type==='supportShot').length,S.salvos*S.damage);assert.equal(r.combat.shots,0);assert.equal(r.combat.hits,0);assert.equal(r.combat.kills,0);
});
test('support kills award once and target selection cannot shoot through the road',()=>{
 const r=ready(),e=enemy(r,2),opposite=enemy(r,12,1);opposite.visualSurface=2;r.support.activate(r);tick(r,S.duration+.1);
 assert.equal(e.hp,0);assert.equal(opposite.hp,12);assert.equal(r.combat.kills,1);assert.equal(r.score,ENEMY_TYPES.apex.points);assert.equal(r.events.filter(e=>e.type==='kill').length,1);
});
test('no enemy means no stored volley: late arrivals cannot receive a burst of missed salvos',()=>{
 const r=ready();r.support.activate(r);tick(r,9.5);const e=enemy(r,60);tick(r,4.6);assert.equal(e.hp,60-3*S.damage);
});
test('rift capture cancels escort without refund; recovery does not mint a new charge',()=>{
 const r=ready();r.support.activate(r);r.riftCapture={id:1,z:10,surface:0,lane:0,kind:'blue',jump:600,points:400};r.support.step(r,.01);
 assert.equal(r.support.active,false);assert.equal(r.support.guard,0);assert.equal(r.support.charge,0);
 r.failed=true;assert.equal(r.revive(),true);assert.equal(r.support.charge,0);assert.equal(r.support.active,false);
});
test('expired escort provides no protection and cannot be summoned during special transit',()=>{
 const r=ready();r.support.activate(r);tick(r,S.duration+.1);r.damage();assert.equal(r.health,2);
 r.support.charge=1;r.riftCapture={id:1,z:10,surface:0,lane:0,kind:'blue',jump:600,points:400};assert.equal(r.support.activate(r),false);assert.equal(r.support.charge,1);
});
test('normal Race steps advance charge and a fatal run stops recharge',()=>{
 const r=ready();r.support.charge=0;for(let i=0;i<120;i++)r.step(1/120);assert.ok(Math.abs(r.support.charge-1/240)<1e-9);
 const before=r.support.charge;r.failed=true;r.step(1);assert.equal(r.support.charge,before);
});

test('support fires separated physical rounds and damage waits for impact',()=>{
 const r=ready(),e=enemy(r,60);r.support.activate(r);r.support.step(r,S.firstShot+.01);
 assert.equal(e.hp,60);r.support.step(r,.01);
 assert.equal(e.hp,60);assert.equal(r.combat.bolts.filter(b=>b.active&&b.supportIndex!==undefined).length,1);
 r.support.step(r,.05);assert.equal(r.combat.bolts.filter(b=>b.active).length,1);
 r.support.step(r,.08);assert.equal(r.combat.bolts.filter(b=>b.active).length,2);
 for(let i=0;i<120;i++)r.combat.update(r,1/120);
 assert.equal(e.hp,58);assert.equal(r.combat.hits,0);
});

test('enemies shoot escorts, hits reduce their own hull and disabled escorts retreat',()=>{
 const r=ready(),e=enemy(r,100);Object.defineProperty(r,'speed',{get:()=>0});r.support.activate(r);r.support.remaining=10;
 Object.assign(e,{id:1,hunting:true,fired:true,attackCooldown:100,volley:1,nextShot:0});
 r.combat.update(r,.001);const shot=r.combat.bolts.find(b=>b.active&&b.targetSupport!==undefined)!;
 assert.ok(shot);const index=shot.targetSupport!;
 for(let i=0;i<120;i++)r.combat.update(r,1/120);
 assert.equal(r.support.wings[index].hp,2);assert.equal(r.health,3);
 for(let hit=0;hit<2;hit++)r.support.hit(r,index);
 assert.equal(r.support.wings[index].hp,0);assert.equal(r.support.wings[index].retreat,1.2);assert.equal(r.support.guard,2);
 for(const w of r.support.wings)w.hp=0;
 r.support.step(r,1);r.support.step(r,.01);
 assert.equal(r.combat.bolts.filter(b=>b.active&&b.supportIndex!==undefined).length,0);
 r.support.cancel();r.support.charge=1;r.support.activate(r);assert.ok(r.support.wings.every(w=>w.hp===3&&!w.posed));
});

test('every new run stays locked below 10 km regardless of time and gets one ready call at 10 km',()=>{
 for(let run=0;run<3;run++){
  const r=flight();r.z=9999;tick(r,300);
  assert.equal(r.support.unlocked,false);assert.equal(r.support.charge,0);assert.equal(r.support.activate(r),false);
  r.z=10000;r.support.step(r,1/120);assert.equal(r.support.ready,true);assert.equal(r.support.charge,1);
  r.support.activate(r);tick(r,S.duration+.01);assert.equal(r.support.ready,false);assert.ok(r.support.charge<.001);
  r.support.step(r,1);assert.ok(r.support.charge>0&&r.support.charge<.01);
 }
});


test('escort prioritizes an attacking enemy over a nearer idle target',()=>{
 const r=ready(),near=enemy(r,12),attacking=enemy(r,12,1);attacking.charge=.5;
 r.support.activate(r);r.support.step(r,S.firstShot+.01);
 assert.equal(r.support.targetId,attacking.id);assert.notEqual(r.support.targetId,near.id);
});

test('escort redirects the next burst round when its target dies',()=>{
 const r=ready(),first=enemy(r,1),next=enemy(r,12,1);r.support.activate(r);
 r.support.step(r,S.firstShot+.01);r.support.step(r,.01);
 first.hp=0;r.support.step(r,.13);
 assert.equal(r.support.targetId,next.id);
 assert.equal(r.events.filter(e=>e.type==='supportShot').length,2);
});


test('departure cue fires once at the start of the short teleport before support ends',()=>{
 const r=ready();r.support.activate(r);r.support.step(r,13.69);
 assert.equal(r.events.filter(e=>e.type==='supportDeparting').length,1);assert.equal(r.support.active,true);
 r.support.step(r,.1);assert.equal(r.events.filter(e=>e.type==='supportDeparting').length,1);
 r.support.step(r,.3);assert.equal(r.events.filter(e=>e.type==='supportEnded').length,1);
});
