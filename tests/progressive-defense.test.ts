import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/game';
import {TUNE} from '../src/config';
import {enemyPoint} from '../src/combat-space';
import {updateFlight} from '../src/enemy-flight';
import {updateDefense} from '../src/enemy-defense';

function setup(kind:'drone'|'oracle',distance:number){
 const race=new Race(19);race.z=distance;
 const enemy=race.combat.enemies[0];Object.assign(enemy,{kind,active:true,hp:10,maxHp:10,age:4,pursuing:true,z:distance+70,visualSurface:0,flight:'high'});
 updateFlight(enemy,race,0);return {race,enemy};
}
function incoming({race,enemy}:ReturnType<typeof setup>,wide=false){
 const point=enemyPoint(enemy);
 Object.assign(race.combat.bolts[0],{active:true,hostile:false,wx:point.x+(wide?30:0),wy:point.y,wz:point.z+80,vx:0,vy:0,vz:-170,life:1});
}
test('speed keeps increasing through 30 km and turbo retains a safe cap',()=>{
 const race=new Race();let last=0;
 for(const z of [0,5000,10000,20000,30000,36000]){race.z=z;assert.ok(race.speed>last);last=race.speed;}
 race.z=30000;const cruise=TUNE.speed+(TUNE.maxCruise-TUNE.speed)*30000/TUNE.speedRampDistance;assert.equal(race.speed,cruise);race.boost=3;assert.equal(race.speed,cruise+TUNE.boostExtra);
 race.z=100000;assert.equal(race.speed,TUNE.boostSpeed);
});
test('elites react to real incoming fire sooner, then expose a recovery window',()=>{
 const starter=setup('drone',1000),elite=setup('oracle',30000);
 for(let i=0;i<24;i++){incoming(starter);incoming(elite);updateDefense(starter.enemy,starter.race,1/120);updateDefense(elite.enemy,elite.race,1/120);}
 assert.equal(starter.enemy.defense!.count,0);assert.equal(elite.enemy.defense!.count,1);
 for(let i=0;i<120;i++){incoming(elite);updateDefense(elite.enemy,elite.race,1/120);}
 assert.equal(elite.enemy.defense!.count,1);assert.equal(elite.enemy.defense!.remaining,0);assert.ok(elite.enemy.defense!.cooldown>0);
});
test('wide shots do not trigger defense; elite volleys keep their aim while dodging',()=>{
 const scene=setup('oracle',30000);scene.race.firing=true;
 for(let i=0;i<120;i++){incoming(scene,true);updateDefense(scene.enemy,scene.race,1/120);}
 assert.equal(scene.enemy.defense!.count,0);scene.enemy.volley=2;
 for(let i=0;i<120;i++){incoming(scene);updateDefense(scene.enemy,scene.race,1/120);}
 assert.equal(scene.enemy.defense!.count,1);assert.equal(scene.enemy.volley,2);
});
test('defensive decisions physically move the enemy without changing hit points',()=>{
 const threatened=setup('oracle',30000),idle=setup('oracle',30000);
 for(let i=0;i<90;i++){
  incoming(threatened);
  for(const s of [threatened,idle]){s.enemy.age+=1/120;updateFlight(s.enemy,s.race,1/120);}
 }
 assert.ok(Math.abs(threatened.enemy.motion!.lane-idle.enemy.motion!.lane)>.6);
 assert.equal(threatened.enemy.hp,10);
 threatened.enemy.motion=undefined;threatened.enemy.age=0;updateFlight(threatened.enemy,threatened.race,0);
 assert.equal(threatened.enemy.defense!.count,0);
});
