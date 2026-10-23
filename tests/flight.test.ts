import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {updateFlight} from '../src/enemy-flight';
import {FLIGHT} from '../src/config';

function squad(seed=7){const r=new Race(seed);r.gates=[];r.stream.nextZ=100000;const enemies=r.combat.enemies.slice(0,3);enemies.forEach((e,id)=>Object.assign(e,{active:true,id,pursuing:true,visualSurface:0,surface:0,flight:'level',lane:0,z:46,age:4,motion:undefined}));return {r,enemies};}
test('identical entry positions develop independent flight and delayed surface reactions',()=>{
 const {r,enemies}=squad();enemies.forEach(e=>updateFlight(e,r,1/120));r.surface=1;
 const reactions=new Map<number,number>();
 for(let i=0;i<720;i++){for(const e of enemies){e.age+=1/120;updateFlight(e,r,1/120);if(e.motion!.followedSurface===1&&!reactions.has(e.id))reactions.set(e.id,i);}}
 assert.equal(reactions.size,3);assert.equal(new Set(reactions.values()).size,3);
 for(const key of ['lane','height','gap','orbit'] as const)assert.equal(new Set(enemies.map(e=>e.motion![key].toFixed(2))).size,3,key);
 for(const e of enemies)assert.ok(Math.abs(e.motion!.orbit-1)<.3,'eventually follows the player');
});
test('rapid surface changes never teleport or snap flight velocity',()=>{
 const {r,enemies}=squad();
 for(let i=0;i<2400;i++){if(i%83===0)r.surface=(r.surface+1)%4;r.z+=24/120;for(const e of enemies){const before=e.motion?{...e.motion}:undefined;e.age+=1/120;updateFlight(e,r,1/120);const m=e.motion!;if(before){assert.ok(Math.abs(m.orbit-before.orbit)<=FLIGHT.turnSpeed*1.15/120+1e-8);assert.ok(Math.abs(m.orbitVelocity-before.orbitVelocity)<=FLIGHT.turnAcceleration/120+1e-8);assert.ok(Math.abs(m.lane-before.lane)<=FLIGHT.laneSpeed/120+1e-8);assert.ok(Math.abs(m.height-before.height)<=FLIGHT.heightSpeed/120+1e-8);}assert.ok(Number.isFinite(m.orbit)&&m.gap>=28);}}
});
test('flight remains reproducible across retries and resets on pooled spawn',()=>{
 const a=squad(),b=squad();for(let i=0;i<600;i++){for(const s of [a,b]){s.r.surface=Math.floor(i/170)%4;for(const e of s.enemies){e.age+=1/120;updateFlight(e,s.r,1/120);}}}assert.deepEqual(a.enemies.map(e=>e.motion),b.enemies.map(e=>e.motion));
 const e=a.enemies[0];e.motion=undefined;e.visualSurface=2;e.surface=2;e.age=0;updateFlight(e,a.r,1/120);assert.equal(e.motion!.orbit,2);assert.equal(e.motion!.decisions,0);
});
test('alien sorties alternate stable aiming windows, distinct attacks and retreat',()=>{
 const signatures=[];
 for(const kind of ['drone','saucer','manta','wraith','sentinel'] as const){const {r,enemies}=squad();const e=enemies[0];e.kind=kind;e.flight='upperRight';const modes=new Set<string>();let settled=0,peak=0,minGap=Infinity,maxGap=0;const trace=[];
  for(let i=0;i<4800;i++){e.age+=1/120;updateFlight(e,r,1/120);const m=e.motion!;modes.add(m.mode);peak=Math.max(peak,Math.abs(m.laneVelocity));minGap=Math.min(minGap,m.gap);maxGap=Math.max(maxGap,m.gap);if(m.mode==='hover'&&e.age-m.modeStart>1&&Math.abs(m.laneVelocity)<.6)settled++;if(i%120===0)trace.push(m.lane.toFixed(2));assert.ok(m.height>4,'stays clear of road');}
  assert.equal(modes.size,3);assert.ok(settled>120,'readable aiming windows');assert.ok(peak>2,'committed maneuver');assert.ok(maxGap-minGap>15,'approaches and retreats');signatures.push(trace.join(','));
 }assert.equal(new Set(signatures).size,5,'archetypes do not share the same flight');
});
