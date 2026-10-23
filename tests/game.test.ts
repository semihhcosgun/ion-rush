import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race,CourseStream,wrap,isDangerous,type Gate} from '../src/game';
import {TUNE,RUN_GOALS,stageAt,stageProgress} from '../src/config';
const barrier=(z=10):Gate=>({id:0,z,safe:1,blocked:[0],kind:'barrier',phase:0,cluster:0,checkpoint:false});
// Isolate road geometry/economy; combat and meteor escape are tested separately.
function roadRace(seed:number){const r=new Race(seed);r.combat.update=()=>{};r.meteors.nextZ=Infinity;return r;}
test('1000 seeds: every streamed gate has a reachable path at boost speed',()=>{
 for(let seed=0;seed<1000;seed++){const stream=new CourseStream(seed);let last=0,safe=0;for(let n=0;n<300;n++){const g=stream.next();assert.ok(!g.blocked.includes(g.safe));assert.ok([1,3].includes(wrap(g.safe-safe)));assert.ok((g.z-last-8)/TUNE.boostSpeed>=TUNE.recharge+TUNE.shiftDuration+TUNE.reactionTime);assert.equal(g.z%8,0);assert.ok(TUNE.visibility/TUNE.boostSpeed>TUNE.reactionTime+TUNE.shiftDuration*2);last=g.z;safe=g.safe;}}
});
test('30 full journeys pass Earth, Moon, Mars and continue with bounded memory and rewards',()=>{
 for(let seed=0;seed<30;seed++){const r=roadRace(seed),shield:number[]=[],boost:number[]=[];while(r.z<12000&&!r.failed){const g=r.gates.find(g=>g.z+TUNE.collisionHalfWidth>=r.z);if(g&&g.z-r.z<95&&r.surface!==g.safe&&!r.shiftLeft)r.shift(wrap(g.safe-r.surface)===1?1:-1);r.step(1/120);if(r.boostCharge)r.activateTurbo();for(const e of r.events){if(e.type==='shield'&&e.value)shield.push(r.time);if(e.type==='boost')boost.push(r.time);}r.events=[];assert.ok(r.gates.length<=12);assert.ok(r.processed.size<=2);assert.ok(r.collected.size<=3);}assert.equal(r.failed,false,`seed ${seed}`);assert.equal(r.route.id,'saturn');assert.equal(r.hits,0);assert.ok(r.score<=((r.cleared+1)*TUNE.gatePoints+r.energy*TUNE.energyPoints)*3+RUN_GOALS.reduce((sum,g)=>sum+g.points,0));assert.ok(boost.length<=Math.floor(r.energy/TUNE.energyForTurbo));assert.ok(shield.length<=Math.ceil((r.cleared+1)/4));assert.ok(r.cleared>=60&&r.cleared<=105);}
});
test('last health collision ends the run, stops physics, restart restores health',()=>{const r=new Race(4);r.health=1;r.gates=[barrier()];for(let i=0;i<200;i++)r.step(1/120);assert.ok(r.failed);assert.equal(r.hits,1);const z=r.z;r.step(4);assert.equal(r.z,z);assert.equal(r.shift(1),false);const fresh=new Race(5);assert.equal(fresh.z,0);assert.equal(fresh.route.id,'earth');assert.equal(fresh.shield,0);assert.notDeepEqual(fresh.gates,new Race(4).gates);});
test('two charges, no mid-transition spam, time-based regeneration',()=>{const r=new Race();assert.ok(r.shift(1));assert.equal(r.shift(1),false);for(let i=0;i<31;i++)r.step(1/120);assert.ok(r.shift(1));for(let i=0;i<31;i++)r.step(1/120);assert.equal(r.charges,0);assert.equal(r.shift(1),false);for(let i=0;i<78;i++)r.step(1/120);assert.equal(r.charges,1);});
test('shield absorbs once, no points or combo for the collision',()=>{const r=new Race();r.shield=1;r.combo=8;r.gates=[barrier()];for(let i=0;i<100;i++)r.step(1/120);assert.equal(r.failed,false);assert.equal(r.shield,0);assert.equal(r.combo,0);assert.equal(r.score,0);});
test('transition across a blocked face costs health',()=>{const r=new Race();r.gates=[barrier()];r.z=7.5;r.shift(1);r.step(.05);assert.equal(r.health,2);assert.equal(r.failed,false);});
test('deterministic stream and dynamic hazards retain safe faces at every timing',()=>{const a=new CourseStream(3),b=new CourseStream(3);for(let i=0;i<400;i++)assert.deepEqual(a.next(),b.next());for(const kind of ['arm','laser','block'] as const){const g={...barrier(),kind};assert.equal(new Set(Array.from({length:100},(_,i)=>isDangerous(g,0,i*.1))).size,2);for(let i=0;i<100;i++)assert.equal(isDangerous(g,1,i*.1),false);}});
test('stage boundaries are continuous and cover the complete solar journey',()=>{const ids=['earth','luna','mercury','venus','mars','jupiter','saturn','uranus','neptune','kuiper','void','horizon','singularity'];const starts=[0,1400,3200,5200,6800,9000,12000,15000,17600,20400,28000,42000,50000];starts.forEach((z,i)=>{assert.equal(stageAt(z).id,ids[i]);assert.equal(stageProgress(z),0);if(i)assert.equal(stageAt(z-1).id,ids[i-1]);assert.ok(stageProgress(z+1)>=0&&stageProgress(z+1)<1);});assert.ok(Number.isFinite(stageProgress(100000000)));});

test('goals pay once, earned turbo is usable and cruise stays bounded',()=>{const r=roadRace(42),paid=new Set<number>();let firstReward=0,boostCount=0;while(r.z<7200&&!r.failed){const g=r.gates.find(g=>g.z+4>=r.z);if(g&&g.z-r.z<95&&r.surface!==g.safe&&!r.shiftLeft)r.shift(wrap(g.safe-r.surface)===1?1:-1);r.step(1/120);if(r.boostCharge)r.activateTurbo();assert.ok(r.speed>=TUNE.speed&&r.speed<=TUNE.boostSpeed);for(const e of r.events){if(e.type==='goal'){assert.ok(!paid.has(e.value!));paid.add(e.value!);if(!firstReward)firstReward=r.time;}if(e.type==='boost'){boostCount++;const next=r.gates.find(g=>g.z>r.z);assert.ok(next);assert.ok(r.speed<=TUNE.boostSpeed);}}r.events=[];}assert.equal(r.failed,false);assert.equal(paid.size,5);assert.equal(r.goalPoints,2000);assert.ok(firstReward>8&&firstReward<30);assert.ok(boostCount>0);});
test('lane taps cross only at edges, land on the opposite edge, and respect charges',()=>{
 const r=new Race();r.gates=[];r.stream.nextZ=100000;const settle=()=>{for(let i=0;i<32;i++)r.step(1/120);};
 assert.ok(r.changeLane(1));assert.equal(r.changeLane(1),false);settle();assert.equal(r.lane,1);assert.equal(r.surface,0);
 assert.ok(r.changeLane(1));assert.equal(r.surface,1);assert.equal(r.lane,-1);assert.equal(r.changeLane(-1),false);settle();assert.equal(r.laneX,-1);assert.equal(r.charges,1);
 assert.ok(r.changeLane(-1));settle();assert.equal(r.surface,0);assert.equal(r.laneX,1);r.charges=0;assert.equal(r.changeLane(1),false);assert.equal(r.surface,0);assert.equal(r.lane,1);
 assert.ok(r.changeLane(-1));settle();assert.equal(r.lane,0);
 const left=new Race();left.gates=[];left.stream.nextZ=100000;left.lane=left.laneX=-1;assert.ok(left.changeLane(-1));assert.equal(left.surface,3);assert.equal(left.lane,1);
});

test('narrow barrier can be dodged within the same face; a late lane input cannot teleport through it',()=>{const r=new Race();r.gates=[{...barrier(60),lane:0}];r.changeLane(-1);while(r.z<70&&!r.failed)r.step(1/120);assert.equal(r.failed,false);assert.equal(r.surface,0);assert.equal(r.cleared,1);const late=new Race();late.gates=[{...barrier(),lane:0}];late.z=8;late.changeLane(1);late.step(1/120);assert.equal(late.health,2);assert.equal(late.hits,1);});
test('energy requires its actual lane and is collected once',()=>{for(const collect of [false,true]){const r=new Race();r.gates=[{...barrier(60),safe:0,blocked:[1,2,3],energyLane:1}];if(collect)r.changeLane(1);while(r.z<85)r.step(1/120);assert.equal(r.energy,collect?1:0);}});

function energyGate(r:Race,id:number,lane=0){r.gates=[{...barrier(r.z+13),id,safe:0,blocked:[1,2,3],energyLane:lane}];r.stream.nextZ=100000;r.step(.06);}
test('energy awards combo points and fills one manually activated turbo per five pickups',()=>{
 const r=new Race();r.combo=3;assert.equal(r.activateTurbo(),false);
 for(let i=0;i<TUNE.energyForTurbo;i++){const before=r.score;energyGate(r,i);assert.equal(r.score-before,TUNE.energyPoints*2);assert.equal(r.turboEnergy,i+1);assert.equal(r.boostCharge,i===TUNE.energyForTurbo-1?1:0);}
 assert.equal(r.boost,0);assert.equal(r.events.filter(e=>e.type==='turboReady').length,1);
 energyGate(r,20);assert.equal(r.boostCharge,1);assert.equal(r.boosts,1);assert.equal(r.turboEnergy,TUNE.energyForTurbo);
 assert.ok(r.activateTurbo());assert.equal(r.turboEnergy,0);assert.equal(r.boostCharge,0);assert.equal(r.boost,TUNE.boostDuration);assert.equal(r.activateTurbo(),false);
 energyGate(r,21);assert.equal(r.turboEnergy,1);assert.equal(r.energy,7);
 r.damage();assert.equal(r.turboEnergy,1);r.gates=[];for(let i=0;i<760;i++)r.step(1/120);assert.equal(r.boost,0);assert.equal(r.boostCharge,0);
 const fresh=new Race();assert.equal(fresh.turboEnergy,0);assert.equal(fresh.boostCharge,0);
});
test('missed and repeated pickups cannot charge turbo; clean gates alone do not charge',()=>{
 const r=new Race();energyGate(r,0,1);assert.equal(r.turboEnergy,0);energyGate(r,1);assert.equal(r.turboEnergy,1);energyGate(r,1);assert.equal(r.turboEnergy,1);
 r.combo=8;r.gates=[{...barrier(r.z+5),id:99,safe:0,blocked:[1,2,3]}];for(let i=0;i<90;i++)r.step(1/120);assert.equal(r.combo,9);assert.equal(r.boostCharge,0);assert.equal(r.turboEnergy,1);
});

test('lane-only navigation reaches safe energy lanes through full journeys',()=>{
 for(let seed=0;seed<10;seed++){const r=roadRace(seed);while(r.z<6000&&!r.failed){const g=r.gates.find(g=>g.z+4>=r.z);if(g&&g.z-r.z<100&&!r.shiftLeft&&!r.laneLeft){if(r.surface!==g.safe)r.changeLane(wrap(g.safe-r.surface)===1?1:-1);else if(r.lane!==(g.energyLane??0))r.changeLane((g.energyLane??0)>r.lane?1:-1);}r.step(1/120);if(r.boostCharge)r.activateTurbo();r.events=[];}assert.equal(r.failed,false,`seed ${seed}`);assert.equal(r.hits,0);assert.ok(r.energy>20);}
});
