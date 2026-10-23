import test from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {FlightLesson,cleanTutorial,freshTutorial,needsTutorial} from '../src/onboarding';
import {TUNE} from '../src/config';
import {enemyPoint} from '../src/combat-space';

function advance(r:Race,l:FlightLesson,seconds:number){for(let i=0;i<Math.ceil(seconds*120);i++){l.tick(1/120);r.step(1/120);l.events(r.events);r.events=[];}}
test('new players learn, veterans are not interrupted, malformed progress is safe',()=>{
 assert.ok(needsTutorial(cleanTutorial(undefined,0)));
 assert.equal(needsTutorial(cleanTutorial(undefined,3)),false);
 assert.deepEqual(cleanTutorial({version:1,completed:2,skipped:false},99),{version:1,completed:2,skipped:false});
 for(const completed of [-1,5,NaN,'2',1.5])assert.equal(cleanTutorial({version:1,completed},0).completed,0);
});
test('idle learning has bounded distance, no hazards, rewards or damage',()=>{
 const r=new Race(12),l=new FlightLesson(r,freshTutorial(),()=>{});
 advance(r,l,180);r.damage('test');
 assert.ok(r.z<=60);assert.equal(r.health,3);assert.equal(r.score,0);assert.equal(r.energy,0);
 assert.equal(r.gates.length,0);assert.equal(r.rifts.length,0);assert.equal(r.combat.enemies.some(e=>e.active),false);
 assert.equal(l.step,0);assert.equal(l.progress.completed,0);
});
test('real lane and surface actions persist separately; shooting requires destroying the alien',()=>{
 const r=new Race(20),progress=freshTutorial();let saved=0;const l=new FlightLesson(r,progress,()=>saved++);
 advance(r,l,.6);r.changeLane(1);l.events(r.events);r.events=[];
 assert.equal(progress.completed,1);advance(r,l,2.1);
 // Returning to the centre is not a surface change.
 r.changeLane(-1);l.events(r.events);r.events=[];assert.equal(progress.completed,1);
 advance(r,l,.3);r.changeLane(1);r.events=[];advance(r,l,.3);r.changeLane(1);l.events(r.events);r.events=[];
 assert.equal(progress.completed,2);advance(r,l,2.1);
 l.events([{type:'shot'},{type:'shot'},{type:'shot'}]);assert.equal(progress.completed,2);
 l.aim(.02);l.events([{type:'shot'}]);assert.equal(progress.completed,2);
 l.aim(.4);l.events([{type:'shot'}]);assert.equal(progress.completed,2);
 l.events([{type:'enemyHit',enemyId:-999,value:1}]);assert.equal(progress.completed,2);
 // First hit teaches holding, then a real drag is required before the moving target can die.
 const target=r.combat.enemies.find(e=>e.training)!;
 r.firing=true;
 for(let i=0;i<240&&l.fireStage==='hold';i++){r.combat.aimWorld=enemyPoint(target);advance(r,l,1/120);}
 assert.equal(l.fireStage,'track');assert.equal(target.hp,1);assert.equal(progress.completed,2);
 advance(r,l,.8);assert.equal(target.hp,1);assert.notEqual(target.trainingOffset,0);
 l.aim(.4);
 for(let i=0;i<240&&progress.completed===2;i++){r.combat.aimWorld=enemyPoint(target);advance(r,l,1/120);}
 r.firing=false;
 assert.ok(r.combat.hits>=2);assert.equal(r.combat.enemies.find(e=>e.training)!.hp,0);assert.equal(r.score,0);assert.equal(r.combat.kills,0);assert.equal(progress.completed,3);assert.equal(saved,3);
 advance(r,l,3.5);assert.equal(r.boostCharge,1);assert.equal(r.turboEnergy,TUNE.energyForTurbo);
 r.activateTurbo();l.events(r.events);r.events=[];assert.equal(progress.completed,4);
 advance(r,l,1.6);assert.ok(l.handoff>0);assert.ok(r.training);assert.equal(l.active,true);
 advance(r,l,4.8);assert.equal(l.active,false);assert.equal(r.training,undefined);
 assert.ok(r.gates.length>0);assert.ok(r.gates[0].z-r.z>170);assert.equal(saved,4);
});
test('resuming skips completed lessons; practice scout is harmless and yields no reward',()=>{
 const r=new Race(3),l=new FlightLesson(r,{version:1,completed:2,skipped:false},()=>{});
 advance(r,l,30);assert.equal(l.step,2);
 const scout=r.combat.enemies.find(e=>e.training)!;assert.equal(scout.active,true);assert.equal(scout.volley,0);
 assert.equal(r.combat.bolts.some(b=>b.active&&b.hostile),false);assert.equal(r.combat.kills,0);assert.equal(r.score,0);
 l.skip();assert.equal(r.training,undefined);assert.equal(r.combat.enemies.some(e=>e.active),false);
 assert.ok(l.progress.skipped);
});
test('skipping turbo clears practice charge and restores normal damage after grace',()=>{
 const r=new Race(4),l=new FlightLesson(r,{version:1,completed:3,skipped:false},()=>{});
 advance(r,l,3);assert.equal(r.boostCharge,1);l.skip();assert.equal(r.boostCharge,0);assert.equal(r.turboEnergy,0);
 r.invulnerable=0;r.damage();assert.equal(r.health,2);
});

test('completion handoff remains safe and launches exactly once after its countdown',()=>{
 const r=new Race(8);let launches=0;const l=new FlightLesson(r,{version:1,completed:3,skipped:false},()=>{},()=>launches++);
 advance(r,l,3);r.activateTurbo();l.events(r.events);r.events=[];advance(r,l,1.6);
 assert.ok(l.handoff>4);assert.equal(launches,0);r.damage();assert.equal(r.health,3);
 advance(r,l,3);assert.equal(launches,0);assert.ok(r.training);
 advance(r,l,2);assert.equal(launches,1);assert.equal(r.training,undefined);
 advance(r,l,1);assert.equal(launches,1);
});

test('practice hold is stationary, track requires a drag and real hit; no rewards or duplicate kills',()=>{
 const r=new Race(6),l=new FlightLesson(r,{version:1,completed:2,skipped:false},()=>{});
 advance(r,l,6);const target=r.combat.enemies.find(e=>e.training)!;
 assert.equal(target.trainingOffset,0);assert.equal(target.lane,r.lane);
 l.aim(.5);assert.equal(l.aimed,false);
 r.firing=true;
 for(let i=0;i<240&&l.fireStage==='hold';i++){r.combat.aimWorld=enemyPoint(target);advance(r,l,1/120);}
 assert.equal(l.fireStage,'track');assert.equal(target.hp,1);assert.equal(l.progress.completed,2);
 for(let i=0;i<240;i++){r.combat.aimWorld=enemyPoint(target);advance(r,l,1/120);}
 assert.equal(target.hp,1);assert.ok(Math.abs(target.trainingOffset!)>1);
 l.aim(.02);assert.equal(target.trainingAimReady,false);
 l.aim(.4);assert.equal(target.trainingAimReady,true);
 let kills=0;
 for(let i=0;i<240;i++){r.combat.aimWorld=enemyPoint(target);l.tick(1/120);r.step(1/120);kills+=r.events.filter(e=>e.type==='kill'&&e.training).length;l.events(r.events);r.events=[];}
 r.firing=false;
 assert.equal(target.hp,0);assert.equal(kills,1);assert.equal(l.progress.completed,3);
 assert.equal(r.score,0);assert.equal(r.combat.kills,0);assert.equal(target.active,false);
});

test('skipping either fire substep clears the target and safely returns to the course',()=>{
 for(const track of [false,true]){
  const r=new Race(8),l=new FlightLesson(r,{version:1,completed:2,skipped:false},()=>{});
  advance(r,l,1);const target=r.combat.enemies.find(e=>e.training)!;
  if(track){r.combat.damageEnemy(r,target,1);l.events(r.events);r.events=[];assert.equal(l.fireStage,'track');}
  l.skip();assert.equal(l.active,false);assert.equal(r.training,undefined);assert.equal(r.combat.enemies.some(e=>e.active),false);
  assert.equal(l.progress.completed,2);assert.equal(l.progress.skipped,true);
 }
});
