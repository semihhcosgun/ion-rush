import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';
import {Race,CourseStream,BonusEnergyStream,type Gate} from '../src/game';import {TUNE} from '../src/config';
function road(tier=0){const r=new Race(2249,tier);r.gates=[];r.bonusEnergy=[];r.rifts=[];r.stream.nextZ=r.riftStream.nextZ=r.ship.nextZ=r.meteors.nextZ=1e6;return r;}
function gate(id:number,z:number):Gate{return {id,z,safe:0,blocked:[1,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,energyLane:0};}
test('bonus energy orbs collect once on all bikes',()=>{

 for(let tier=0;tier<8;tier++){const r=road(tier);r.gates=[gate(3,30)];r.bonusEnergy=[{id:3,z:2,surface:0,lane:0}];r.step(.08);assert.equal(r.energy,1);assert.equal(r.bonusCollected.has(3),true);r.step(.02);assert.equal(r.energy,1);r.z=17;r.step(.06);assert.equal(r.energy,2);assert.equal(r.collected.has(3),true);assert.equal(r.turboEnergy,2);}
});
test('extra orb requires its safe face and lane, respects turbo cap and charges abilities once',()=>{
 for(const wrong of ['face','lane'] as const){const r=road();r.gates=[gate(3,30)];r.bonusEnergy=[{id:3,z:2,surface:0,lane:0}];if(wrong==='face')r.surface=1;else r.laneX=1;r.step(.08);assert.equal(r.energy,0);}
 const r=road(4);r.turboEnergy=4;r.gates=[gate(3,30)];r.bonusEnergy=[{id:3,z:2,surface:0,lane:0}];r.step(.08);assert.equal(r.boostCharge,1);assert.equal(r.turboEnergy,5);assert.equal(r.combat.vanguard.energy,1);r.z=17;r.step(.06);assert.equal(r.energy,2);assert.equal(r.combat.vanguard.energy,2);assert.equal(r.turboEnergy,5);assert.equal(r.boosts,1);
});
test('Momentum rewards only clean actual obstacle passes, once, on equipped Runner',()=>{
 for(let tier=0;tier<8;tier++){const r=road(tier);r.z=12;r.gates=[gate(1,10)];r.step(.1);assert.equal(r.turboEnergy,tier===2?1:0);assert.equal(r.energy,0);r.step(.1);assert.equal(r.turboEnergy,tier===2?1:0);assert.equal(r.overdrive.earned,0);}
 const hit=road(2);hit.z=7;hit.surface=1;hit.angle=hit.targetAngle=-Math.PI/2;hit.gates=[gate(2,10)];hit.step(.2);hit.z=15;hit.step(.1);assert.equal(hit.turboEnergy,0);assert.equal(hit.health,2);
 const training=road(2);training.training={step:0,limit:100};training.z=12;training.gates=[gate(3,10)];training.step(.3);assert.equal(training.turboEnergy,0);
});
test('Momentum fills the next turbo during a current turbo without extending or stacking it',()=>{
 const r=road(2);r.boostCharge=1;r.activateTurbo();r.turboEnergy=4;r.z=12;r.gates=[gate(1,10)];r.step(.1);assert.equal(r.boostCharge,1);assert.equal(r.turboEnergy,5);assert.equal(r.boost,2.9);assert.equal(r.overdrive.earned,0);const energy=r.energy;r.gates=[gate(2,r.z-4)];r.step(.1);assert.equal(r.turboEnergy,5);assert.equal(r.boosts,1);assert.equal(r.energy,energy);assert.equal(r.activateTurbo(),false);
});
test('all bikes preserve reaction room for the maximum shared Overdrive speed',()=>{
 const required=TUNE.recharge+TUNE.shiftDuration+TUNE.reactionTime;
 for(let tier=0;tier<8;tier++){const r=new Race(2249,tier);r.z=100000;r.boost=3;r.overdrive.earned=2;assert.equal(r.speed,82);let prev=0;for(let n=0;n<300;n++){const g=r.stream.next();assert.ok((g.z-prev-8)/82>=required);prev=g.z;}}
});

test('independent bonus stream preserves density and obstacle layout without pairing or clusters',()=>{
 const sample=(seed:number,count:number)=>{const course=new CourseStream(seed,82),stream=new BonusEnergyStream(seed),gates=Array.from({length:count},()=>course.next());return {gates,bonuses:gates.flatMap((g,i)=>i?[stream.between(gates[i-1],g)].filter(Boolean):[]) as NonNullable<ReturnType<BonusEnergyStream['between']>>[]};};
 const a=sample(2249,400),b=sample(2249,400),c=sample(2250,400);assert.deepEqual(a,b);assert.notDeepEqual(a.bonuses,c.bonuses);
 assert.ok(a.bonuses.every(b=>!('extraEnergy' in b)));assert.ok(new Set(a.bonuses.map(b=>b.lane)).size===3);
 const offsets=new Set<number>();
 for(let i=0;i<a.bonuses.length;i++){const b=a.bonuses[i],next=a.gates.find(g=>g.z>b.z)!,previous=a.gates.find(g=>g.id===next.id-1)!;
  assert.ok(b.z>=previous.z+88&&b.z<=next.z-64);assert.equal(b.surface,next.safe);assert.ok(Math.abs(b.lane)<=1);
  assert.ok(a.gates.every(g=>Math.abs(g.z-12-b.z)>=52));offsets.add(Math.round(next.z-b.z));
  if(i)assert.ok(b.z-a.bonuses[i-1].z>350);
 }
 assert.ok(offsets.size>10,'not a fixed offset from an obstacle');
 let count=0;for(let seed=0;seed<100;seed++)count+=sample(seed,400).bonuses.length;assert.ok(count/40000>.24&&count/40000<.26,String(count));
 const originalCourse=new CourseStream(2249);const gates=Array.from({length:40},()=>originalCourse.next());assert.equal(createHash('sha256').update(JSON.stringify(gates)).digest('hex'),'4c359f5bbf56bfb490f57987aa1dd8a37d8dd28f981870a2a9e55656b361191a');
});
test('bonus generation is stable across repeated streaming and avoids rift and revive clearance',()=>{
 const r=new Race();const original=structuredClone(r.bonusEnergy);r.ensureCourse();r.ensureCourse();assert.deepEqual(r.bonusEnergy,original);
 assert.ok(r.bonusEnergy.every(b=>!r.rifts.some(f=>b.z>f.z-105&&b.z<f.z+(f.kind==='black'?TUNE.boostSpeed*8+80:125))));
 r.failed=true;r.bonusEnergy.push({id:999,z:r.z+20,surface:0,lane:0});r.revive();assert.ok(r.bonusEnergy.every(b=>b.z>r.z+120));
});
test('independent pickup and following main orb remain reachable at maximum turbo speed',()=>{
 for(const surface of [1,3])for(const lane of [-1,0,1])for(const target of [-1,0,1])for(const z of [88,100,112]){
  const r=road();r.gates=[{...gate(8,176),safe:surface,blocked:[0,1,2,3].filter(s=>s!==surface),energyLane:target}];r.bonusEnergy=[{id:8,z,surface,lane}];r.z=0;
  while(r.z<181&&!r.failed){r.boost=3;r.overdrive.earned=2;
   const desiredLane=r.z<z?lane:target;
   if(!r.shiftLeft&&!r.laneLeft){if(r.surface!==surface)r.changeLane(surface===1?1:-1);else if(r.lane!==desiredLane)r.changeLane(desiredLane>r.lane?1:-1);}
   r.step(1/120);
  }
  assert.equal(r.hits,0);assert.equal(r.energy,2,JSON.stringify({surface,lane,target,z}));
 }
});

test('leaving the tutorial resets the independent bonus stream without stale pickups',()=>{const r=road();r.training={step:1,limit:100};r.bonusEnergy=[{id:999,z:12,surface:0,lane:0}];r.bonusCollected.add(999);r.endTraining();assert.ok(!r.bonusEnergy.some(b=>b.id===999));assert.equal(r.bonusCollected.size,0);const b=structuredClone(r.bonusEnergy);r.ensureCourse();assert.deepEqual(r.bonusEnergy,b);});
