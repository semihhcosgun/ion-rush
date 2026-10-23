import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {MeteorField,METEOR,meteorTuning,meteorImpactDamage} from '../src/meteors';
function race(){const r=new Race(22);r.z=6000;r.gates=[];r.stream.nextZ=1e8;r.rifts=[];r.riftStream.nextZ=1e8;r.ship.nextZ=1e8;r.combat.update=()=>{};r.meteors.nextZ=1e8;return r;}
function hot(r:Race){r.meteors.items=[{id:1,z:r.z,end:r.z+180,surface:0,lane:0,age:METEOR.warning,impact:true}];}
test('distance ramps fall speed and heat damage with bounded reaction time',()=>{let previous=meteorTuning(5000);for(let z=5000;z<=100000;z+=100){const p=meteorTuning(z);assert.ok(p.warning<=previous.warning&&p.warning>=1.14);assert.ok(p.heatSeconds<=previous.heatSeconds&&p.heatSeconds>=.64);previous=p;}assert.equal(meteorTuning(29999).impactDamage,1);assert.equal(meteorTuning(30000).impactDamage,2);assert.deepEqual(meteorTuning(50000),meteorTuning(100000));});
test('doubled late impact is lethal, shields absorb it, telemetry matches',()=>{for(const shield of [0,1]){const r=race();r.z=35000;r.shield=shield;r.shieldTime=12;const p=meteorTuning(r.z);r.meteors.items=[{id:1,z:r.z+1,end:r.z+180,surface:0,lane:0,age:p.warning-.01,impact:false,tuning:p}];assert.equal(meteorImpactDamage(r.meteors.items[0]),4);const reports:any[]=[];r.telemetry=(name,params)=>{if(name==='damage_taken')reports.push(params);};r.step(.02);assert.equal(r.health,shield?3:0);assert.equal(r.failed,!shield);assert.equal(r.shield,0);assert.equal(reports.length,1);assert.equal(reports[0].health_after,shield?3:0);for(let j=0;j<75;j++)r.step(1/120);assert.equal(r.health,shield?3:0);}});
test('late hot trail reaches its next damage tick sooner',()=>{for(const z of [6000,50000]){const r=race();r.z=z;hot(r);r.meteors.items[0].age=meteorTuning(z).warning;for(let j=0;j<90;j++)r.step(1/120);assert.equal(r.health,z===6000?3:2);}});
test('meteor scheduling starts after 5km, is seeded and varies between runs',()=>{const values=new Set<number>();for(let seed=0;seed<100;seed++){const a=new MeteorField(seed);assert.equal(a.nextZ,new MeteorField(seed).nextZ);assert.ok(a.nextZ>=5000&&a.nextZ<6300);values.add(a.nextZ);}assert.equal(values.size,100);});
test('meteor lane is fixed while existing gates stay present',()=>{const r=race();r.meteors.spawn(r);const m={...r.meteors.items[0]};r.lane=1;r.surface=2;r.gates=[{id:9,z:m.z+20,safe:0,blocked:[1,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false}];r.step(.01);assert.equal(r.meteors.items[0].lane,m.lane);assert.equal(r.meteors.items[0].surface,m.surface);assert.equal(r.gates.length,1);});
test('heat accumulates before damage and changing lane cools it',()=>{const r=race();hot(r);for(let i=0;i<60;i++)r.step(1/120);assert.equal(r.health,3);assert.ok(r.meteors.heat>.4);r.lane=r.laneX=1;for(let i=0;i<50;i++)r.step(1/120);assert.equal(r.meteors.heat,0);assert.equal(r.health,3);});
test('direct impact removes two health once and recovery prevents stacked heat damage',()=>{const r=race();r.meteors.items=[{id:1,z:r.z+1,end:r.z+180,surface:0,lane:0,age:METEOR.warning-.01,impact:false}];r.step(.02);assert.equal(r.health,1);for(let i=0;i<84;i++)r.step(1/120);assert.equal(r.health,1);assert.equal(r.hits,1);assert.equal(r.meteors.heat,0);});
test('burn uses shield and reports meteor damage source',()=>{const r=race();hot(r);r.shield=2;r.shieldTime=12;const reports:unknown[]=[];r.telemetry=(name,p)=>{if(name==='damage_taken')reports.push(p);};for(let i=0;i<130;i++)r.step(1/120);assert.equal(r.health,3);assert.equal(r.shield,1);assert.ok(reports.some((p:any)=>p.source==='meteor'&&p.source_detail==='heated_trail'));});
test('cooled trails, airborne riders and special transit cannot burn',()=>{for(const mode of ['cold','ship','rift']){const r=race();hot(r);if(mode==='cold')r.meteors.items[0].age=METEOR.warning+METEOR.cooling;if(mode==='ship'){r.ship.active=true;r.ship.elapsed=2;}if(mode==='rift')r.riftChallenge={rift:{id:1,z:r.z,surface:0,lane:0,kind:'black',jump:2000,points:2000},remaining:6,nextCheck:5,targetLane:0};r.step(.1);assert.equal(r.meteors.heat,0);assert.equal(r.health,3);}});
test('late paired meteors never block both escape lanes',()=>{for(let seed=0;seed<100;seed++){const r=race();r.z=35000;r.meteors=new MeteorField(seed);r.meteors.spawn(r);assert.ok(r.meteors.items.length<=2);assert.equal(new Set(r.meteors.items.map(m=>m.lane)).size,1);if(r.meteors.items.length===2)assert.ok(r.meteors.items[1].age< -2);}});
test('a reaction after 0.8 seconds leaves a safe lane at every cruise speed and boost',()=>{for(const z of [6000,15000,35000,50000])for(let seed=0;seed<20;seed++){const r=race();r.z=z;r.boost=3;r.meteors=new MeteorField(seed);r.meteors.nextZ=Infinity;r.meteors.spawn(r);for(let frame=0;frame<1100;frame++){if(frame===96){const m=r.meteors.items[0];if(m.lane===r.lane)r.changeLane(r.lane===1?-1:1);}r.step(1/120);}assert.equal(r.hits,0,`${z}/${seed}`);assert.ok(r.meteors.items.length<=2);}});

test('seeded encounters mix direct strikes and ahead-of-rider landings',()=>{
 let direct=0;
 for(let seed=0;seed<400;seed++){
  const a=race(),b=race();a.meteors=new MeteorField(seed);b.meteors=new MeteorField(seed);
  a.meteors.spawn(a);b.meteors.spawn(b);assert.deepEqual(a.meteors.items,b.meteors.items);
  const m=a.meteors.items[0];if(m.targeted){direct++;assert.equal(m.lane,a.lane);assert.equal(m.surface,a.surface);}
  else assert.ok(m.z-a.z>a.speed*meteorTuning(a.z).warning+8);
 }
 assert.ok(Math.abs(direct/400-meteorTuning(6000).directChance)<.06,`direct strikes: ${direct}/400`);
});

test('direct strikes become more likely with distance while every road lane remains possible',()=>{
 let previousChance=0,previousCount=0;
 for(const z of [5000,10000,20000,30000,40000,50000,100000]){
  const chance=meteorTuning(z).directChance;assert.ok(chance>=previousChance&&chance>=.2&&chance<=.65);
  let direct=0;const roadLanes=new Set<number>();
  for(let seed=0;seed<1000;seed++){
   const r=race();r.z=z;r.lane=r.laneX=seed%3-1;r.meteors=new MeteorField(seed);r.meteors.spawn(r);
   const m=r.meteors.items[0];
   if(m.targeted){direct++;assert.equal(m.lane,r.lane);}
   else {roadLanes.add(m.lane);assert.ok(m.z>r.z+r.speed*meteorTuning(z).warning+8);}
  }
  assert.ok(direct>=previousCount);assert.ok(Math.abs(direct/1000-chance)<.04,`${z}: ${direct}/1000`);
  assert.deepEqual([...roadLanes].sort(),[-1,0,1]);previousChance=chance;previousCount=direct;
 }
 assert.equal(meteorTuning(5000).directChance,.2);assert.equal(meteorTuning(50000).directChance,.65);
});

test('generated direct strikes hit a stationary lane at all speeds, including turbo expiry',()=>{
 for(const z of [6000,15000,29999,35000,50000])for(const boost of [0,.1,.8,3])for(const dt of [1/120,1/60]){
  const r=race();r.z=z;r.boost=boost;
  for(let seed=0;seed<100;seed++){r.meteors=new MeteorField(seed);r.meteors.spawn(r);if(r.meteors.items[0].targeted)break;}
  const m=r.meteors.items[0];assert.ok(m.targeted);r.meteors.nextZ=Infinity;
  const locked={z:m.z,lane:m.lane,surface:m.surface};
  while(!m.impact&&!r.failed)r.step(dt);
  assert.deepEqual({z:m.z,lane:m.lane,surface:m.surface},locked);
  assert.ok(Math.abs(r.z-m.z)<8,`${z}/${boost}/${dt}: landing missed`);
  assert.equal(r.hits,1);assert.equal(r.health,Math.max(0,3-meteorImpactDamage(m)));
 }
});

test('direct warning fixes the landing point and a surface dodge avoids the strike and hot trail',()=>{
 const r=race();
 for(let seed=0;seed<100;seed++){r.meteors=new MeteorField(seed);r.meteors.spawn(r);if(r.meteors.items[0].targeted)break;}
 const m=r.meteors.items[0];assert.ok(m.targeted);const landing=m.z;r.meteors.nextZ=Infinity;
 for(let frame=0;frame<720;frame++){if(frame===96)assert.ok(r.shift(1));r.step(1/120);}
 assert.equal(m.z,landing);assert.equal(m.surface,0);assert.equal(r.surface,1);assert.equal(r.health,3);assert.equal(r.hits,0);
});
