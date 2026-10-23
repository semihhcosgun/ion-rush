import {test} from 'node:test';import assert from 'node:assert/strict';
import {enemyChoices} from '../src/enemy-progression';
import {CourseStream,Race} from '../src/game';import {ENEMY_TYPES,TUNE} from '../src/config';
test('encounters vary across seeds without fixed third-gate waves or pickup spacing',()=>{
 const signatures=new Set<string>(),waveSlots=new Set<number>(),pickupGaps=new Set<number>(),kinds=new Set<string>();
 for(let seed=0;seed<100;seed++){const stream=new CourseStream(seed);let last=-1;const rows=[];for(let i=0;i<80;i++){const g=stream.next();rows.push([g.kind,g.safe,g.lane,g.z,g.wave,g.pickup]);if(g.wave)waveSlots.add(g.id%3);if(g.pickup){if(last>=0){pickupGaps.add(g.id-last);assert.ok(g.id-last>=4&&g.id-last<=6);}last=g.id;}}
 signatures.add(JSON.stringify(rows));const r=new Race(seed);r.z=6000;r.gates=[{id:90,z:6170,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,wave:true}];r.combat.update(r,1/120);for(const e of r.combat.enemies)if(e.active){kinds.add(e.kind);assert.notEqual(e.surface,1);}}
 assert.equal(signatures.size,100);assert.equal(waveSlots.size,3);assert.equal(pickupGaps.size,3);assert.equal(kinds.size,enemyChoices(6000,[]).length);
});
test('first kilometre introduces mixed hazards and earlier randomized encounters',()=>{
 let totalGates=0,totalWaves=0;const kinds=new Set<string>();
 for(let seed=0;seed<200;seed++){const stream=new CourseStream(seed);let count=0;for(let g=stream.next();g.z<1000;g=stream.next()){count++;kinds.add(g.kind);if(g.wave)totalWaves++;if(g.id<3)assert.equal(g.kind,'barrier');else assert.equal(g.blocked.length,3);}assert.ok(count>=5);totalGates+=count;}
 assert.equal(kinds.size,3);assert.ok(totalWaves/200>.5&&totalWaves/200<1.8);console.log('First 1 km averages:',{gates:totalGates/200,encounterOpportunities:totalWaves/200});
});

test('encounters respect all fifteen unlock distances and debut the new archetype',()=>{
 for(const [kind,def] of Object.entries(ENEMY_TYPES)){for(const offset of [-1,700]){const r=new Race(42);r.z=def.unlock+offset;r.time=10;r.gates=[{id:90,z:r.z+170,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,wave:true}];r.combat.update(r,1/120);const alive=r.combat.enemies.filter(e=>e.active);for(const e of alive)assert.ok(r.z>=ENEMY_TYPES[e.kind].unlock);if(offset<0)assert.ok(!alive.some(e=>e.kind===kind));else assert.ok(alive.some(e=>e.kind===kind),kind+' debut');}}
});

test('opening gives steering time and does not stack pursuing enemies on Earth',()=>{
 for(let seed=0;seed<100;seed++){
  const r=new Race(seed);r.z=449;r.gates=[{id:8,z:619,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,wave:true}];r.combat.update(r,1/120);assert.equal(r.combat.enemies.filter(e=>e.active).length,0);
  r.z=600;for(let id=8;id<12;id++){r.gates=[{id,z:770,safe:1,blocked:[0,2,3],kind:'barrier',phase:0,cluster:0,checkpoint:false,wave:true}];r.combat.update(r,1/120);}assert.equal(r.combat.enemies.filter(e=>e.active&&e.hp>0).length,1);
 }
});

test('cruise pacing bounds rests and sudden changes across 1000 randomized journeys',()=>{
 let min=Infinity,max=0,maxChange=0;
 for(let seed=0;seed<1000;seed++){
  const stream=new CourseStream(seed);let g=stream.next(),previousTime=0;const history:string[]=[];
  for(let i=0;i<120;i++){
   const next=stream.next();let time=0;
   for(let z=g.z;z<next.z;z+=1)time+=1/(TUNE.speed+(TUNE.maxCruise-TUNE.speed)*Math.min(1,z/TUNE.speedRampDistance));
   min=Math.min(min,time);max=Math.max(max,time);assert.ok(time>=3.3&&time<=6.2,`rest ${time}, seed ${seed}`);
   if(previousTime){maxChange=Math.max(maxChange,Math.abs(time-previousTime));assert.ok(Math.abs(time-previousTime)<1.1);}previousTime=time;
   if(g.id>=3&&history.length===2)assert.ok(!(history[0]===g.kind&&history[1]===g.kind));
   history.push(g.kind);if(history.length>2)history.shift();g=next;
  }
 }
 console.log('Cruise obstacle interval seconds:',{min,max,maxChange});
});
