import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Race} from '../src/game';
import {CombatView} from '../src/combat-view';
import {trackPoint,enemyPoint,enemyBasePoint,enemyTrackZ} from '../src/combat-space';
import {pathAt} from '../src/path';
import {SINGULARITY,singularityFalloff} from '../src/singularity';
function run(){const r=new Race(2249,7);r.gates=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;const s=r.combat.singularity;s.energy=12;s.remaining=0;r.activateSingularity();r.combat.update(r,SINGULARITY.launchDuration);trackPoint(r.z+SINGULARITY.forward,0,0,r.playerHeight+1,s.center);return r;}
function bullet(r:Race,i:number,d:number,hostile=true){const p=r.combat.singularity.center;const b=r.combat.bolts[i];Object.assign(b,{active:true,hostile,wx:p.x+d,wy:p.y,wz:p.z,vx:0,vy:0,vz:0,z:-p.z,surface:0,life:3,kind:'drone'});return b;}
function enemy(r:Race,i=0,hp=10){const e=r.combat.enemies[i];Object.assign(e,{active:true,pursuing:false,training:false,age:3,gravity:undefined,id:100+i,z:r.z+40,surface:0,visualSurface:0,lane:2,kind:'manta',hp,maxHp:hp,fired:true,volley:0,charge:0,gateId:-1,dead:0,motion:undefined,defense:undefined});return e;}
function steps(r:Race,n:number){for(let i=0;i<n;i++)r.combat.update(r,1/120);}
test('finite smooth falloff: full inner field, decreasing middle, exact zero beyond 55',()=>{
 assert.equal(singularityFalloff(0),1);assert.equal(singularityFalloff(12),1);
 assert.ok(singularityFalloff(20)>singularityFalloff(35));assert.ok(singularityFalloff(35)>singularityFalloff(50));
 assert.equal(singularityFalloff(55),0);assert.equal(singularityFalloff(100),0);
 assert.ok(singularityFalloff(54.999)<1e-8);assert.ok(singularityFalloff(12.001)>.999999);
});
test('hostile bullets accelerate by distance; outside and friendly bullets retain exact trajectory',()=>{
 const r=run(),near=bullet(r,0,15),mid=bullet(r,1,35),edge=bullet(r,2,50),outside=bullet(r,3,56),friend=bullet(r,4,15,false);r.combat.update(r,1/120);
 assert.ok(near.vx<mid.vx&&mid.vx<edge.vx&&edge.vx<0);assert.equal(outside.vx,0);assert.equal(friend.vx,0);
 assert.ok(Math.hypot(near.vx,near.vy,near.vz)<=SINGULARITY.bulletSpeed);
});
test('bullets visibly curve before entering the core; all entering bullets disappear, including the fifth',()=>{
 const r=run(),b=bullet(r,0,20);r.combat.update(r,1/120);assert.equal(b.active,true);assert.equal(r.combat.singularity.absorbed,0);steps(r,90);assert.equal(b.active,false);assert.equal(r.combat.singularity.absorbed,1);
 for(let i=1;i<6;i++)bullet(r,i,1);r.combat.update(r,1/120);assert.equal(r.combat.singularity.absorbed,6);assert.ok(r.combat.bolts.slice(0,6).every(b=>!b.active));assert.equal(r.health,3);
});
test('aliens stay unharmed at a distance, then all nine are destroyed permanently only on entering the core',()=>{
 const r=run(),enemies=Array.from({length:9},(_,i)=>enemy(r,i,10000)),before=enemies.map(e=>enemyPoint(e));steps(r,8);
 assert.ok(enemies.every(e=>e.hp===10000));assert.equal(r.combat.kills,0);assert.equal(r.combat.singularity.targets.size,0);
 enemies.forEach((e,i)=>{assert.ok(enemyPoint(e).distanceTo(r.combat.singularity.center)<before[i].distanceTo(r.combat.singularity.center));assert.ok(e.gravity!.offset.length()>1);assert.equal(enemyTrackZ(e),-enemyPoint(e).z);});
 const v=new CombatView();v.render(r,false);const p=pathAt(r.z);enemies.forEach((e,i)=>assert.ok(v.ships[i].position.distanceTo(enemyPoint(e).sub(new THREE.Vector3(p.x,p.y,-r.z)))<1e-9));
 steps(r,150);assert.ok(enemies.every(e=>e.hp===0&&!e.active));assert.equal(r.combat.kills,9);assert.equal(r.combat.singularity.targets.size,9);const score=r.score;steps(r,300);assert.equal(r.score,score);assert.equal(r.combat.kills,9);assert.ok(enemies.every(e=>!e.active));v.disposeGeometry();
});
test('outside enemies are unchanged; remaining outside the core allows gentle release, and recycled slots are clean',()=>{
 const r=run(),e=enemy(r),far=enemy(r,1);e.z=r.z+65;far.z=200;const original=enemyPoint(far);steps(r,15);assert.ok(enemyPoint(far).distanceTo(original)<1e-9);
 r.combat.singularity.cancel();const offset=e.gravity!.offset.length();steps(r,180);assert.ok(e.gravity!.offset.length()<offset*.1);assert.equal(e.hp,10);
 e.id=999;e.z=100;e.age=3;r.combat.update(r,1/120);assert.equal(e.gravity!.offset.length(),0);assert.ok(enemyPoint(e).distanceTo(enemyBasePoint(e))<1e-9);
});
test('collision follows the rendered world point instead of the original flight position',()=>{
 const r=run(),e=enemy(r);steps(r,16);const actual=enemyPoint(e),base=enemyBasePoint(e);assert.ok(actual.distanceTo(base)>10);
 r.combat.singularity.cancel();const b=bullet(r,0,100,false);Object.assign(b,{wx:base.x,wy:base.y,wz:base.z,z:-base.z});const hp=e.hp;r.combat.update(r,1/120);assert.equal(e.hp,hp);
 const p=enemyPoint(e);Object.assign(b,{active:true,wx:p.x,wy:p.y,wz:p.z,z:-p.z,life:2});r.combat.update(r,1/120);assert.equal(e.hp,hp-1);
});
test('an entering alien is at the real core when it dies, with no distant explosion, duplicate reward or return',()=>{
 const r=run(),e=enemy(r,0,1000),v=new CombatView();let frames=0;while(e.hp>0&&frames++<120)steps(r,1);
 assert.equal(e.hp,0);assert.equal(e.gravity!.captured,true);assert.ok(enemyPoint(e).distanceTo(r.combat.singularity.center)<1e-8);v.render(r,false);const model=v.models[0].find(m=>m.visible)!;assert.ok(model&&model.scale.x<.02);assert.equal(r.combat.kills,1);
 steps(r,100);v.render(r,false);assert.equal(v.ships[0].visible,false);steps(r,300);assert.equal(e.active,false);assert.equal(e.hp,0);assert.equal(r.combat.kills,1);v.disposeGeometry();
});
test('pause freezes suction and normal fixed step rates give consistent displacement',()=>{
 const a=run(),b=run(),ea=enemy(a),eb=enemy(b);steps(a,10);for(let i=0;i<5;i++)b.combat.update(b,1/60);assert.ok(enemyPoint(ea).distanceTo(enemyPoint(eb))<.5);
 const p=enemyPoint(ea);a.failed=true;a.step(1);assert.ok(enemyPoint(ea).distanceTo(p)<1e-9);a.combat.clearTransit();assert.equal(ea.active,false);assert.equal(a.combat.singularity.active,false);
});
test('real moving practice vacuum pulls into the moving hole and entering aliens never return after expiry',()=>{
 const r=run();r.z=6000;const s=r.combat.singularity;s.active=false;s.energy=12;s.remaining=0;
 const enemies=[0,1,2,3].map(i=>{const e=enemy(r,i,10000);e.z=r.z+[210,226,250,285][i];e.lane=(i%3)-1;return e;});let terminal=false;
 for(let i=0;i<900;i++){if(i===490){assert.equal(s.ready,true);assert.equal(s.busy,false);assert.equal(r.activateSingularity(),true);}r.step(1/120);for(const e of enemies)if(e.active&&e.hp===0&&e.dead<1/60){assert.ok(enemyPoint(e).distanceTo(s.center)<1);terminal=true;}}
 assert.ok(terminal);assert.equal(s.active,false);assert.ok(enemies.some(e=>e.hp===0&&!e.active));assert.ok(enemies.filter(e=>e.hp===0).every(e=>!e.active));
});
