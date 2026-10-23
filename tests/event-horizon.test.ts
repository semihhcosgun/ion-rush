import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unlockEventHorizon,distantPressure,deepRespite,expeditionPressure,type HorizonReward} from '../src/event-horizon';
import {threatBudget,pursuitLimit} from '../src/enemy-progression';
import {COMBAT,PURSUIT,ENEMY_PROGRESSION,stageAt,stageProgress} from '../src/config';
import {makeVesper} from '../src/vehicle';
import {Race} from '../src/game';

test('Event Horizon unlocks exactly once at 50 km and persists through a saved snapshot',()=>{
 const save:HorizonReward={eventHorizonUnlocked:false,livery:'classic',journey:{distance:12000}};
 for(const z of [0,49999.99,NaN,Infinity])assert.equal(unlockEventHorizon(save,z),false);
 assert.equal(unlockEventHorizon(save,50000),true);assert.equal(save.livery,'event-horizon');assert.equal(save.journey.distance,50000);
 const restored=JSON.parse(JSON.stringify(save));restored.livery='classic';assert.equal(unlockEventHorizon(restored,55000),false);assert.equal(restored.livery,'classic');
});
test('deep expedition raises bounded pressure and retains recovery windows and warning limits',()=>{
 assert.equal(distantPressure(20400),0);assert.equal(distantPressure(50000),1);assert.equal(distantPressure(1e8),1);
 assert.ok(threatBudget(47000)>threatBudget(35000));assert.ok(threatBudget(35000)>threatBudget(20000));
 assert.equal(deepRespite(31000),true);assert.ok(expeditionPressure(31000)<expeditionPressure(30999));assert.equal(deepRespite(31400),false);
 for(let z=20400;z<100000;z+=100){assert.ok(threatBudget(z)<=ENEMY_PROGRESSION.deepBudget+4);assert.ok(pursuitLimit(z,1)<=PURSUIT.maxEnemies);}
 assert.ok(COMBAT.telegraph>=1.3&&COMBAT.telegraph<1.6);assert.equal(PURSUIT.maxWarnings,2);
});
test('beyond-Neptune stages join continuously and continue after the reward',()=>{
 for(const [z,id] of [[20400,'kuiper'],[28000,'void'],[42000,'horizon'],[50000,'singularity']] as const){assert.equal(stageAt(z).id,id);assert.equal(stageProgress(z),0);assert.ok(stageProgress(z-1)<1);}
 assert.equal(stageAt(1e8).id,'singularity');assert.ok(Number.isFinite(stageProgress(1e8)));
});
test('livery changes reuse vehicle geometry and can restore the classic colours',()=>{
 const bike=makeVesper();const count=bike.children.length;bike.userData.setLivery(true);assert.equal(bike.userData.livery,'event-horizon');bike.userData.setLivery(false);assert.equal(bike.userData.livery,'classic');assert.equal(bike.children.length,count);
});

test('late hunters actually fire more often while keeping full warnings and usable player shots',()=>{
 const simulate=(distance:number)=>{const r=new Race(44);r.z=distance;r.gates=[];r.stream.nextZ=100000;r.damage=()=>{};
  Object.assign(r.combat.enemies[0],{active:true,id:17,kind:'sentinel',pursuing:true,visualSurface:0,surface:0,lane:0,z:r.z+50,age:90,hp:7,maxHp:7,fired:true});
  let shots=0,warningStart=-1;for(let i=0;i<7200;i++){r.step(1/120);for(const e of r.events){if(e.type==='incoming')warningStart=r.time;if(e.type==='enemyShot'){shots++;if(warningStart>=0){assert.ok(r.time-warningStart>=COMBAT.telegraph-1/60);warningStart=-1;}}}r.events=[];}return shots;};
 assert.ok(simulate(47000)>simulate(10000));
 const r=new Race(44);r.z=47000;r.gates=[];r.stream.nextZ=100000;r.damage=()=>{};r.firing=true;
 for(let i=0;i<6;i++)Object.assign(r.combat.enemies[i],{active:true,id:i,kind:'sentinel',pursuing:true,visualSurface:0,surface:0,lane:0,z:r.z+50,age:90,hp:7,maxHp:7,fired:true});
 for(let i=0;i<2400;i++){r.step(1/120);assert.ok(r.combat.enemies.filter(e=>e.active&&e.hp>0&&((e.charge>0&&!e.fired)||e.volley>0)).length<=PURSUIT.maxWarnings);r.events=[];}assert.ok(r.combat.shots>=30&&r.combat.shots<=60);
});
