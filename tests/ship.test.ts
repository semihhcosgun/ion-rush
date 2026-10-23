import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {COMBAT} from '../src/config';
function preview(){const r=new Race(12);r.z=19000;r.gates=[];r.stream.nextZ=1e6;r.rifts=[];r.riftStream.nextZ=1e6;r.ship.core={z:19001,surface:0,lane:0};r.combat.update=()=>{};return r;}
test('flight core requires its lane and face',()=>{for(const wrong of ['lane','surface']){const r=preview();if(wrong==='lane')r.laneX=1;else r.surface=1;r.step(.1);assert.equal(r.ship.active,false);assert.equal(r.ship.core,undefined);}});
test('ship deploys, accelerates, avoids road collisions and lands safely',()=>{
 const r=preview();r.step(.1);assert.ok(r.ship.active);assert.equal(r.ship.lift,0);
 for(let i=0;i<12;i++)r.step(.1);assert.equal(r.ship.lift,1);assert.ok(Math.abs(r.speed/r.cruise-1.35)<1e-8);
 r.gates=[{id:99,z:r.z+1,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false}];r.step(.1);assert.equal(r.health,3);
 r.damage();assert.equal(r.health,2);assert.ok(r.changeLane(1));
 for(let i=0;i<140;i++)r.step(.1);assert.equal(r.ship.active,false);assert.equal(r.ship.lift,0);assert.equal(r.playerHeight,5.2);assert.equal(r.speed,r.cruise);assert.ok(r.gates.every(g=>g.z>r.z+100));
});
test('core scheduling is seeded and rare',()=>{for(let seed=0;seed<100;seed++){const a=new Race(seed),b=new Race(seed);assert.equal(a.ship.nextZ,b.ship.nextZ);assert.ok(a.ship.nextZ>=18000&&a.ship.nextZ<=22000);}});
test('landing extends wheels before touchdown and folds wings afterwards',()=>{
 const r=preview();r.ship.active=true;let previous=1;
 for(let t=11;t<=14;t+=.01){r.ship.elapsed=t;assert.ok(r.ship.lift<=previous+1e-6);previous=r.ship.lift;if(t<13.5)assert.equal(r.ship.deployment,1);}
 r.ship.elapsed=13;assert.equal(r.ship.wheelFold,0);assert.ok(r.ship.lift>0);assert.ok(r.ship.landingPitch>0);
 r.ship.elapsed=13.5;assert.equal(r.ship.lift,0);assert.equal(r.ship.deployment,1);
 r.ship.elapsed=13.75;assert.ok(r.ship.suspension<0);assert.ok(r.ship.deployment<1);
});
test('fresh pursuers warn then shoot at a flying player without a road gate',()=>{
 const r=new Race(2);r.z=19000;r.gates=[];r.stream.nextZ=1e6;r.rifts=[];r.riftStream.nextZ=1e6;r.ship.active=true;r.ship.elapsed=2;
 const e=r.combat.enemies[0];Object.assign(e,{active:true,hp:10,maxHp:10,age:3,z:r.z+60,pursuing:true,flight:'high',kind:'drone'});
 for(let i=0;i<Math.floor(COMBAT.telegraph*120)-2;i++)r.step(1/120);
 assert.ok(r.events.some(v=>v.type==='incoming'));assert.ok(!r.events.some(v=>v.type==='enemyShot'));
 for(let i=0;i<300;i++)r.step(1/120);
 assert.ok(r.events.some(v=>v.type==='enemyShot'));assert.ok(r.hits>0,'airborne player remains hittable');
});
