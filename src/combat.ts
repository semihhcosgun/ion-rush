import {chooseEnemy,enemyChoices,pursuitPressure,pursuitLimit} from './enemy-progression';
import {ALIEN_LORE} from './alien-catalog';
import {expeditionPressure} from './event-horizon';
import {updateFlight,type FlightState} from './enemy-flight';
import {reactToHit} from './enemy-defense';
import {weaponBatteryProfile} from './weapon-battery';
import {IGNITION,IgnitionVent} from './ignition';
import {HUNTER,HunterTargetLock} from './hunter';
import {VANGUARD,OrbitalGuard,vanguardEnabled} from './vanguard';
import {TITAN,SiegeBeam,titanEnabled} from './titan';
import {SINGULARITY,Singularity,SingularityPull,singularityFalloff,singularityEnabled} from './singularity';
import {phaseActive} from './phantom';
import * as THREE from 'three';
import {trackPoint,enemyPoint,enemyBasePoint,enemyTrackZ} from './combat-space';
import {COMBAT,AIM,ENCOUNTERS,PURSUIT,ENEMY_TYPES,ENEMY_ENTRY,type EnemyKind} from './config';
import type {Race} from './game';
import {marketingCaptureMode} from './dev-flags';
export interface Enemy {gravity?:SingularityPull;training?:boolean;trainingOffset?:number;trainingAimReady?:boolean;defense?:import('./enemy-defense').DefenseState;hunting?:boolean;warpLane?:number;warpHeight?:number;motion?:FlightState;pursuing:boolean;visualSurface:number;attackCooldown:number;flight:"level"|"high"|"upperLeft"|"upperRight";kind:EnemyKind;charge:number;volley:number;nextShot:number;active:boolean;id:number;gateId:number;z:number;surface:number;lane:number;hp:number;maxHp:number;age:number;fired:boolean;dead:number;flash:number;}
export interface Bolt {supportIndex?:number;targetSupport?:number;enemyId?:number;power?:number;wx:number;wy:number;wz:number;vx:number;vy:number;vz:number;kind:EnemyKind;active:boolean;hostile:boolean;z:number;surface:number;lane:number;startLane:number;targetLane:number;startZ:number;targetZ:number;life:number;}
export class Combat {
 enemies:Enemy[]=Array.from({length:COMBAT.enemies},()=>({gravity:new SingularityPull(),pursuing:false,visualSurface:0,attackCooldown:0,flight:"level",kind:"drone",charge:0,volley:0,nextShot:0,active:false,id:0,gateId:0,z:0,surface:0,lane:0,hp:0,maxHp:0,age:0,fired:false,dead:0,flash:0}));
 bolts:Bolt[]=Array.from({length:COMBAT.bolts},()=>({wx:NaN,wy:0,wz:0,vx:0,vy:0,vz:0,kind:"drone",active:false,hostile:false,z:0,surface:0,lane:0,startLane:0,targetLane:0,startZ:0,targetZ:0,life:0}));
 readonly ignition=new IgnitionVent();
 readonly hunter=new HunterTargetLock();
 readonly vanguard=new OrbitalGuard();
 readonly titan=new SiegeBeam();
 readonly singularity=new Singularity();
 private playerPower=1;
 private gravityPoint=new THREE.Vector3();private gravityDelta=new THREE.Vector3();
 private boltPrevious=new THREE.Vector3();private boltEnd=new THREE.Vector3();private playerPoint=new THREE.Vector3();
 private enemyPoints=Array.from({length:COMBAT.enemies},()=>new THREE.Vector3());
 private pointReady=new Uint8Array(COMBAT.enemies);
 private lastArrival=0;private attackStagger=0;
 introduced=new Set<EnemyKind>();spawned=new Set<number>();nextId=0;heat=0;locked=false;cooldown=0;kills=0;shots=0;hits=0;
 tapShot:{from:THREE.Vector3;direction:THREE.Vector3}|undefined;
 requestTap(){if(!this.locked&&this.cooldown===0&&this.muzzleWorld&&this.aimDirection)this.tapShot={from:this.muzzleWorld.clone(),direction:this.aimDirection.clone()};}
 aimWorld:THREE.Vector3|undefined;muzzleWorld:THREE.Vector3|undefined;aimDirection:THREE.Vector3|undefined;
 get target(){return this.enemies.find(e=>e.active&&e.hp>0);}
 /** The rider enters transit; the outside encounter keeps simulating until occluded. */
 beginTransit(){this.singularity.cancel();this.titan.cancel();this.hunter.clearFlight();this.vanguard.clearShots();this.tapShot=undefined;this.attackStagger=0;}
 clearTransit(preserveEnemies=false){this.beginTransit();if(!preserveEnemies)for(const enemy of this.enemies)enemy.active=false;for(const bolt of this.bolts)bolt.active=false;}
 private ignitionRechargeEnabled(r:Race){return r.bikeTier===IGNITION.tier&&!r.training&&!r.ship.active&&!r.riftTransit;}
 rearmSeconds(r:Race){const battery=weaponBatteryProfile(r.training?0:r.z),heat=Math.max(0,this.heat-battery.rearm);return this.ignitionRechargeEnabled(r)?this.ignition.timeToCool(heat,battery.cooling):heat/battery.cooling;}
 update(r:Race,dt:number){
  this.playerPower=r.ship.active?2:1;const battery=weaponBatteryProfile(r.training?0:r.z);
  this.attackStagger=Math.max(0,this.attackStagger-dt);
  const pressure=pursuitPressure(r.z,Math.max(0,...this.enemies.filter(e=>e.active&&e.hp>0).map(e=>e.age)));
  const cooling=(((!r.riftTransit&&r.firing&&!phaseActive(r))||this.titan.active)&&!this.locked?battery.activeCooling:battery.cooling);
  this.heat=Math.max(0,this.heat-(this.ignitionRechargeEnabled(r)?this.ignition.coolingAmount(cooling,dt):cooling*dt));this.cooldown=Math.max(0,this.cooldown-dt);if(this.locked&&this.heat<=battery.rearm)this.locked=false;
  this.ignition.update(dt);this.hunter.update(dt);
  if(!this.hunterEnabled(r))this.hunter.clearFlight();
  else if(this.locked)this.hunter.clearStreak();
  else if(this.hunter.targetId!==undefined&&!this.enemies.some(e=>e.active&&e.hp>0&&e.id===this.hunter.targetId))this.hunter.clearStreak();
  for(const id of this.spawned)if(!r.gates.some(g=>g.id===id))this.spawned.delete(id);
  for(const g of r.gates){const capture=marketingCaptureMode();if((!capture&&r.z<ENCOUNTERS.firstEnemyDistance)||g.id<3||(!capture&&!g.wave&&!(pressure>0&&r.time-this.lastArrival>=PURSUIT.reinforceInterval))||g.z-r.z>200||g.z-r.z<130||this.spawned.has(g.id))continue;this.spawned.add(g.id);
   const roll=(salt:number)=>encounterRoll(r.seed,g.id,salt);const count=pressure>0?1:1+Math.floor(roll(0)*(r.z<1400?1:r.z<3200?2:3));const faces=g.blocked.includes(r.surface)?[r.surface,...g.blocked.filter(s=>s!==r.surface)]:g.blocked;
   for(let i=0;i<count;i++){if(this.enemies.filter(e=>e.active&&e.hp>0).length>=pursuitLimit(r.z,pressure))break;const e=this.enemies.find(e=>!e.active);if(!e)break;const surface=faces[i%faces.length];if(surface===undefined)continue;const alive=this.enemies.filter(e=>e.active&&e.hp>0).map(e=>e.kind);const debut=r.time>5?enemyChoices(r.z,alive,pressure).map(c=>c.kind).reverse().find(k=>!this.introduced.has(k)&&r.z>=ENEMY_TYPES[k].unlock+600):undefined;const kind=debut??chooseEnemy(r.z,alive,roll(11+i),pressure);if(!kind)break;const def=ENEMY_TYPES[kind];Object.assign(e,{training:false,hunting:false,motion:undefined,pursuing:true,visualSurface:r.surface+(roll(71+i)-.5)*.5,warpLane:(roll(81+i)-.5)*Math.min(15,(42+roll(91+i)*108)*.18),warpHeight:13+roll(101+i)*Math.min(23,(42+roll(91+i)*108)*.24),attackCooldown:0,flight:(["level","upperRight","high","upperLeft"] as const)[Math.floor(roll(31+i)*4)],kind,charge:0,volley:0,nextShot:0,active:true,id:this.nextId++,gateId:g.id,z:r.z+42+roll(91+i)*108,surface,lane:Math.floor(roll(51+i)*3)-1,hp:def.hp,maxHp:def.hp,age:0,fired:false,dead:0,flash:0});this.introduced.add(kind);r.events.push({type:'encounter',kind,enemyId:e.id});this.lastArrival=r.time;if(i===0)r.events.push({type:'warp'});}
  }
  for(const e of this.enemies){if(!e.active)continue;e.age+=dt;const approachGate=r.gates.find(g=>g.id===e.gateId);if(e.hp>0&&e.pursuing)updateFlight(e,r,dt);else if(e.hp>0&&approachGate)e.z=Math.min(approachGate.z-30,r.z+50);e.flash=Math.max(0,e.flash-dt);if(e.hp<=0){e.dead+=dt;if(e.dead>.55)e.active=false;continue;}if(!e.pursuing&&enemyTrackZ(e)<r.z-18){e.active=false;continue;}
   if(e.training){e.z=r.z+AIM.distance;e.surface=r.surface;e.visualSurface=r.surface;e.lane=r.lane+(e.trainingOffset??0);continue;}
   e.attackCooldown=Math.max(0,e.attackCooldown-dt);
   const veteran=e.pursuing&&((r.ship.active&&e.age>=ENEMY_ENTRY+.5)||(r.z>=PURSUIT.huntDistance&&e.age>=Math.max(3,PURSUIT.huntAge-ENEMY_TYPES[e.kind].rank*.7)));
   // Commit to a telegraphed lane and face. Dodging after the warning really works.
   if(veteran&&e.volley===0&&e.attackCooldown===0&&(e.fired||e.charge===0)){
    const nearGate=!r.ship.active&&r.gates.some(g=>g.z-r.z>=-8&&g.z-r.z<45);
    const warnings=this.enemies.filter(other=>other.active&&other.hp>0&&((other.charge>0&&!other.fired)||other.volley>0)).length;
    if(!nearGate&&!r.shiftLeft&&this.attackStagger===0&&warnings<PURSUIT.maxWarnings){
     e.hunting=true;e.surface=r.surface;e.lane=r.lane;e.charge=0;e.fired=false;
     this.attackStagger=PURSUIT.attackStagger;
    }else if(!e.hunting){e.fired=true;}
   }
   if(!veteran&&!e.hunting&&e.pursuing&&e.volley===0&&e.attackCooldown===0&&(e.fired||!approachGate||approachGate.z-r.z<35)){
    const next=r.gates.find(g=>g.z-r.z>60&&g.z-r.z<140);
    if(next){e.gateId=next.id;e.surface=next.blocked.includes(r.surface)?r.surface:next.blocked[0]??e.surface;e.lane=r.lane;e.charge=0;e.fired=false;}
   }
   const g=r.gates.find(g=>g.id===e.gateId),def=ENEMY_TYPES[e.kind];
   if((e.hunting||(g&&g.z-r.z<110))&&e.age>=ENEMY_ENTRY&&!e.fired){
    if(e.charge===0)r.events.push({type:'incoming'});
    e.charge=Math.min(1,e.charge+dt/COMBAT.telegraph);
   }
   if((e.hunting||(g&&g.z-r.z<75))&&e.charge>=1&&!e.fired){
    e.fired=true;
    const aggression=pursuitPressure(r.z,e.age);
    e.attackCooldown=def.attackCooldown*(1-aggression*PURSUIT.cooldownReduction)*(1-expeditionPressure(r.z)*.2)+(e.motion?.phase??0)*.06;
    e.volley=def.shots;e.nextShot=0;
   }
   if(e.volley>0){e.nextShot-=dt;if(e.nextShot<=0){
    const lane=enemyShotLane(e,def.shots-e.volley);
    const escorts=r.support.active&&r.support.elapsed>2.2&&Math.abs(((e.visualSurface-r.surface+6)%4+4)%4-2)<.8?r.support.wings.map((w,i)=>w.hp>0?i:-1).filter(i=>i>=0):[];
    const escort=escorts.length&&(e.id+e.volley)%2===0?escorts[(e.id+e.volley)%escorts.length]:undefined;
    const aim=escort===undefined?this.hostileTarget(r,e,lane):r.support.point(r,escort);
    if(escort!==undefined){const travel=enemyPoint(e).distanceTo(aim)/(COMBAT.enemyBoltSpeed+r.speed);aim.z-=r.speed*travel;}
    if((e.hunting||(g&&g.z-r.z>35))&&this.bolt(true,e.z,e.surface,e.lane,lane,r.z,e.kind,enemyPoint(e),aim,e.id,undefined,escort))r.events.push({type:'enemyShot'});
    e.volley--;e.nextShot=def.interval;
   }}

  }
  this.updateSingularity(r,dt);
  if(phaseActive(r))this.tapShot=undefined;
  const beamReplacesFire=this.updateSiegeBeam(r,dt);
  if(!r.riftTransit&&!phaseActive(r)&&!beamReplacesFire&&(r.firing||this.tapShot)&&!r.shiftLeft&&!this.locked&&this.cooldown===0){
   const from=this.tapShot?.from??this.muzzleWorld??trackPoint(r.z+2,r.surface,r.laneX,r.playerHeight),direction=this.tapShot?.direction??this.aimDirection,to=direction?from.clone().addScaledVector(direction,COMBAT.range):this.aimWorld??trackPoint(r.z+AIM.distance,r.surface,r.laneX,7);
   if(this.bolt(false,r.z+2,r.surface,r.laneX,r.laneX,r.z+AIM.distance,'drone',from,to)){this.tapShot=undefined;this.cooldown=COMBAT.fireInterval;this.heat=Math.min(100,this.heat+battery.shotHeat);this.shots++;if(this.heat>=100-1e-8){this.heat=100;this.locked=true;}r.events.push({type:'shot',value:1});}
  }
  this.pointReady.fill(0);let playerPointReady=false;
  for(const b of this.bolts){if(!b.active)continue;
   if(!Number.isFinite(b.wx)){const start=trackPoint(b.z,b.surface,b.lane,5.2),end=trackPoint(b.z-80,b.surface,b.lane,5.2);this.vector(b,start,end);}
   const prev=this.boltPrevious.set(b.wx,b.wy,b.wz);
   if(b.hostile&&this.singularity.active)this.pullBullet(b,this.singularity.fieldStep);
   b.wx+=b.vx*dt;b.wy+=b.vy*dt;b.wz+=b.vz*dt;b.z=-b.wz;b.life-=dt;const end=this.boltEnd.set(b.wx,b.wy,b.wz);
   if(b.hostile&&this.singularity.active&&segmentDistance(this.singularity.center,prev,end)<=SINGULARITY.bulletRadius&&this.singularity.absorb()){b.active=false;r.events.push({type:'singularityAbsorb',enemyId:b.enemyId});continue;}
   // Keep outside shots moving, but the locked transit animation cannot receive hits or award kills.
   if(!r.riftTransit){
   if(b.hostile&&b.targetSupport!==undefined){
    const wing=r.support.wings[b.targetSupport];
    if(r.support.active&&wing.hp>0&&segmentDistance(r.support.point(r,b.targetSupport),prev,end)<2.5){b.active=false;r.support.hit(r,b.targetSupport);}
   }
   else if(b.hostile){if(!playerPointReady){trackPoint(r.z,r.surface,r.laneX,r.playerHeight,this.playerPoint);playerPointReady=true;}if(Math.abs(b.z-r.z)<6&&(r.surface===b.surface||(r.shiftLeft>0&&r.from===b.surface))&&segmentDistance(this.playerPoint,prev,end)<AIM.playerRadius){b.active=false;if(vanguardEnabled(r)&&r.invulnerable<=0&&this.vanguard.intercept()){
    const shot=this.vanguard.counters.find(s=>!s.active)!;shot.position.copy(this.playerPoint);shot.previous.copy(this.playerPoint);const attacker=this.enemies.find(e=>e.active&&e.hp>0&&!e.training&&e.id===b.enemyId);
    if(attacker)shot.velocity.copy(enemyPoint(attacker)).sub(shot.position);else shot.velocity.set(-b.vx,-b.vy,-b.vz);
    shot.velocity.normalize().multiplyScalar(COMBAT.boltSpeed);shot.life=VANGUARD.shotLife;shot.active=true;r.events.push({type:'guardBlock',enemyId:b.enemyId,value:1});
   }else r.damage('enemy',b.kind,b.enemyId);}}
   else for(let index=0;index<this.enemies.length;index++){const e=this.enemies[index];if(b.supportIndex!==undefined&&Math.abs(((e.visualSurface-b.surface+6)%4+4)%4-2)>=.8)continue;if(e.active&&e.hp>0&&e.age>=.5&&Math.abs(enemyTrackZ(e)-b.z)<25&&segmentDistance(this.cachedEnemyPoint(e,index),prev,end)<AIM.enemyRadius){b.active=false;this.damageEnemy(r,e,b.power??1,b.supportIndex!==undefined);break;}}
   }
   if(b.life<=0||Math.abs(b.z-r.z)>230)b.active=false;
  }
  this.updateHunterMissiles(r,dt);this.updateGuardCounters(r,dt);
 }
 private cachedEnemyPoint(e:Enemy,index:number){if(!this.pointReady[index]){enemyPoint(e,this.enemyPoints[index]);this.pointReady[index]=1;}return this.enemyPoints[index];}
 supportShot(r:Race,index:number,e:Enemy){
  if(this.bolts.filter(b=>b.active).length>=COMBAT.bolts-8)return false;
  return this.bolt(false,r.z,r.surface,0,0,enemyTrackZ(e),'drone',r.support.point(r,index),enemyPoint(e),undefined,index);
 }
 damageEnemy(r:Race,e:Enemy,power:number,support=false,source:'shot'|'hunter'|'vanguard'|'titan'|'singularity'='shot'){
  if(!e.active||e.hp<=0||(e.training&&e.trainingAimReady===false))return;
  const applied=Math.min(e.hp,power);e.hp-=applied;e.flash=.12;if(e.hp>0&&!e.training)reactToHit(e,r);
  if(!support&&source==='shot')this.hits++;
  r.events.push({type:'enemyHit',enemyId:e.id,value:applied});
  if(!support&&source==='shot'&&!e.training&&this.hunterEligible(r)){
   if(this.hunter.hit(e.id,e.hp>0)){
    for(let i=0;i<HUNTER.missiles;i++){const missile=this.hunter.missiles[i],side=i===0?-1:1;const start=trackPoint(r.z+2,r.surface,r.laneX+side*.3,r.playerHeight+.25);missile.position.copy(start);missile.previous.copy(start);missile.velocity.set(side*25,25,-HUNTER.speed).normalize().multiplyScalar(HUNTER.speed);missile.targetId=e.id;missile.life=HUNTER.lifetime;missile.active=true;}
    r.events.push({type:'targetLock',enemyId:e.id,value:HUNTER.missiles});
   }
  }
  if(e.hp!==0)return;
  if(!e.training&&this.singularity.active&&enemyPoint(e,this.gravityPoint).distanceToSquared(this.singularity.center)<SINGULARITY.pullRadius**2){
   const pull=this.enemyPull(e);pull.deathScale=Math.max(.01,1-pull.compression);pull.captured=true;pull.captureCenter.copy(this.singularity.center);
  }
  if(this.hunter.targetId===e.id)this.hunter.clearStreak();
  if(e.training){r.events.push({type:'kill',training:true,kind:e.kind,enemyId:e.id});return;}
  this.kills++;const points=ENEMY_TYPES[e.kind].points*r.multiplier;r.score+=points;
  r.events.push({type:'kill',value:points,kind:e.kind,enemyId:e.id});
  if(!support&&r.bikeTier===IGNITION.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.failed){
   const removed=this.ignition.trigger(this.heat);
   if(removed>0){this.heat=Math.max(0,this.heat-removed);r.events.push({type:'heatVent',value:removed});}
  }
 }
 private enemyPull(e:Enemy){const pull=e.gravity??(e.gravity=new SingularityPull());if(pull.id!==e.id)pull.reset(e.id);return pull;}
 private updateSingularity(r:Race,dt:number){
  const s=this.singularity;
  if(!singularityEnabled(r))s.cancel();
  else{
   if(s.advance(dt))r.events.push({type:'singularityOpen'});
   if(s.active)dt=s.fieldStep;
   // One reused core follows the bike: a short airborne throw, then the full field.
   const t=s.launching?Math.min(1,s.launchElapsed/SINGULARITY.launchDuration):1;
   trackPoint(r.z+2+(SINGULARITY.forward-2)*t,r.surface,r.laneX,r.playerHeight+.4+.6*t+Math.sin(Math.PI*t)*4,s.center);
  }
  // At most nine existing actors. Position is shared by rendering, aiming and collisions.
  for(const e of this.enemies){
   if(!e.active||e.training||e.age<.5)continue;
   let pull=e.gravity;if(pull&&pull.id!==e.id){pull.reset(e.id);}
   // Dormant abilities do not evaluate flight poses or allocate temporary points.
   if(!s.active&&!pull?.captured&&(!pull||(pull.offset.lengthSq()<1e-8&&pull.velocity.lengthSq()<1e-8&&pull.compression<1e-5))){if(pull){pull.offset.set(0,0,0);pull.velocity.set(0,0,0);}continue;}
   const point=enemyPoint(e,this.gravityPoint),delta=this.gravityDelta.copy(s.center).sub(point),distance=delta.length();
   const strength=s.active?singularityFalloff(distance):0;
   if(strength>0&&!pull)pull=this.enemyPull(e);
   if(!pull)continue;
   if(pull.captured){
    if(s.active)pull.captureCenter.copy(s.center);
    // Keep the existing model for the existing .55s death window; no debris burst.
    delta.copy(pull.captureCenter).sub(point);pull.offset.addScaledVector(delta,1-Math.exp(-12*dt));pull.velocity.set(0,0,0);
   }else if(e.hp>0&&strength>0){
    // A bounded inward step prevents orbiting or overshooting the mouth.
    const step=Math.min(distance,SINGULARITY.enemySpeed*strength*dt);
    if(distance>1e-5)pull.offset.addScaledVector(delta,step/distance);
    const remaining=distance-step,t=Math.max(0,Math.min(1,(remaining-1.6)/16));pull.compression=1-t*t*(3-2*t);
    if(remaining<=1.6){
     pull.offset.copy(s.center).sub(enemyBasePoint(e,this.gravityPoint));
     // Entering the event horizon is terminal, whatever the alien's remaining HP.
     if(s.claim(e.id)){s.flash=.16;this.damageEnemy(r,e,e.hp,false,'singularity');}
    }
   }else if(e.hp>0){
    pull.compression*=Math.exp(-8*dt);pull.velocity.set(0,0,0);pull.offset.multiplyScalar(Math.exp(-3*dt));
   }
  }
 }
 private pullBullet(b:Bolt,dt:number){
  const delta=this.gravityDelta.copy(this.singularity.center).sub(this.gravityPoint.set(b.wx,b.wy,b.wz)),distance=delta.length(),strength=singularityFalloff(distance);
  if(strength<=0||distance<1e-5)return;
  const maxSpeed=Math.max(SINGULARITY.bulletSpeed,Math.hypot(b.vx,b.vy,b.vz)),a=SINGULARITY.bulletAcceleration*strength*dt/distance;
  b.vx+=delta.x*a;b.vy+=delta.y*a;b.vz+=delta.z*a;
  const speed=Math.hypot(b.vx,b.vy,b.vz);if(speed>maxSpeed){const ratio=maxSpeed/speed;b.vx*=ratio;b.vy*=ratio;b.vz*=ratio;}
 }
 private updateSiegeBeam(r:Race,dt:number){
  const beam=this.titan;
  if(!titanEnabled(r)||r.shiftLeft>0){beam.cancel();return false;}
  if(!beam.active&&(r.firing||this.tapShot)&&!this.locked&&this.cooldown===0&&beam.ready){
   beam.start();this.heat=Math.min(100,this.heat+TITAN.heat);if(this.heat>=100-1e-8){this.heat=100;this.locked=true;}
   this.cooldown=COMBAT.fireInterval;r.events.push({type:'siegeBeam'});
  }
  if(!beam.active)return false;
  beam.from.copy(this.tapShot?.from??this.muzzleWorld??trackPoint(r.z+2,r.surface,r.laneX,r.playerHeight));
  const direction=this.tapShot?.direction??this.aimDirection;
  beam.direction.copy(direction??(this.aimWorld??trackPoint(r.z+AIM.distance,r.surface,r.laneX,7)).clone().sub(beam.from)).normalize();
  beam.to.copy(beam.from).addScaledVector(beam.direction,TITAN.range);this.tapShot=undefined;
  const pulses=beam.advance(dt);
  for(let pulse=0;pulse<pulses;pulse++){
   const aligned=this.enemies.filter(e=>{if(!e.active||e.hp<=0||e.training||e.age<.5)return false;const point=enemyPoint(e),along=point.clone().sub(beam.from).dot(beam.direction);return along>=0&&along<=TITAN.range&&segmentDistance(point,beam.from,beam.to)<TITAN.radius;}).sort((a,b)=>enemyPoint(a).distanceToSquared(beam.from)-enemyPoint(b).distanceToSquared(beam.from));
   for(const enemy of aligned)if(beam.claim(enemy.id))this.damageEnemy(r,enemy,1,false,'titan');
  }
  return true;
 }
 private hunterEnabled(r:Race){return r.bikeTier===HUNTER.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.failed;}
 private hunterEligible(r:Race){return this.hunterEnabled(r)&&!this.locked;}
 private updateHunterMissiles(r:Race,dt:number){
  // Already-launched missiles may finish while the gun cools, but never in flight/training/transit.
  if(r.bikeTier!==HUNTER.tier||r.training||r.ship.active||r.riftTransit||r.failed){this.hunter.clearFlight();return;}
  for(const missile of this.hunter.missiles){
   if(!missile.active)continue;
   const target=this.enemies.find(e=>e.active&&e.hp>0&&!e.training&&e.id===missile.targetId);
   if(!target||missile.life<=0||Math.abs(enemyTrackZ(target)-r.z)>230){missile.active=false;continue;}
   missile.previous.copy(missile.position);const point=enemyPoint(target),desired=point.clone().sub(missile.position).normalize().multiplyScalar(HUNTER.speed);
   missile.velocity.lerp(desired,1-Math.exp(-12*dt)).normalize().multiplyScalar(HUNTER.speed);missile.position.addScaledVector(missile.velocity,dt);missile.life=Math.max(0,missile.life-dt);
   if(segmentDistance(point,missile.previous,missile.position)<HUNTER.hitRadius){missile.active=false;this.damageEnemy(r,target,HUNTER.damage,false,'hunter');}
   if(missile.life===0)missile.active=false;
  }
 }
 private updateGuardCounters(r:Race,dt:number){
  if(!vanguardEnabled(r)){this.vanguard.clearShots();return;}
  for(const shot of this.vanguard.counters){
   if(!shot.active)continue;shot.previous.copy(shot.position);shot.position.addScaledVector(shot.velocity,dt);shot.life=Math.max(0,shot.life-dt);
   for(const enemy of this.enemies){if(enemy.active&&enemy.hp>0&&!enemy.training&&enemy.age>=.5&&segmentDistance(enemyPoint(enemy),shot.previous,shot.position)<AIM.enemyRadius){shot.active=false;this.damageEnemy(r,enemy,VANGUARD.damage,false,'vanguard');break;}}
   if(shot.life===0||Math.abs(-shot.position.z-r.z)>230)shot.active=false;
  }
 }
 private hostileTarget(r:Race,e:Enemy,lane:number){const start=enemyPoint(e);let t=Math.max(.2,(enemyTrackZ(e)-r.z)/(COMBAT.enemyBoltSpeed+r.speed));for(let i=0;i<3;i++)t=start.distanceTo(trackPoint(r.z+r.speed*t,e.surface,lane,r.playerHeight))/COMBAT.enemyBoltSpeed;return trackPoint(r.z+r.speed*t,e.surface,lane,r.playerHeight);}
 private vector(b:Bolt,start:THREE.Vector3,end:THREE.Vector3){const v=end.clone().sub(start).normalize().multiplyScalar(b.hostile?COMBAT.enemyBoltSpeed:COMBAT.boltSpeed);Object.assign(b,{wx:start.x,wy:start.y,wz:start.z,vx:v.x,vy:v.y,vz:v.z});}

 private bolt(hostile:boolean,z:number,surface:number,lane:number,targetLane:number,targetZ:number,kind:EnemyKind="drone",start?:THREE.Vector3,end?:THREE.Vector3,enemyId?:number,supportIndex?:number,targetSupport?:number){// Reserve eight slots for the player's weapon even under maximum pursuit.
  if(hostile&&this.bolts.filter(b=>b.active&&b.hostile).length>=COMBAT.bolts-8)return false;
  const b=this.bolts.find(b=>!b.active);if(!b)return false;Object.assign(b,{enemyId,supportIndex,targetSupport,power:hostile||supportIndex!==undefined?1:this.playerPower,kind,active:true,hostile,z,surface,lane,startLane:lane,targetLane,startZ:z,targetZ,life:3,wx:NaN});this.vector(b,start??trackPoint(z,surface,lane,7),end??trackPoint(targetZ,surface,targetLane,5.2));return true;}
}



export function enemyShotLane(e:Enemy,shot:number){const pattern=ALIEN_LORE[e.kind].pattern;return pattern==='fan'?[-1,0,1][shot%3]:pattern==='split'?(shot%2===0?e.lane:(e.lane+2)%3-1):e.hunting?e.lane:e.kind==='sentinel'?[-1,0,1][shot%3]:e.kind==='manta'?(shot===0?-1:1):e.lane;}
export function enemyWarningLanes(e:Enemy){return [...new Set(Array.from({length:ENEMY_TYPES[e.kind].shots},(_,i)=>enemyShotLane(e,i)))];}

function segmentDistance(p:THREE.Vector3,a:THREE.Vector3,b:THREE.Vector3){
 const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/Math.max(.00001,x*x+y*y+z*z)));
 const dx=p.x-(x*t+a.x),dy=p.y-(y*t+a.y),dz=p.z-(z*t+a.z);
 return Math.sqrt(dx*dx+dy*dy+dz*dz);
}

/** Per-encounter samples are stable across frame rates but different each run. */
export function encounterRoll(seed:number,id:number,salt:number){let x=Math.imul(seed^Math.imul(id+1,374761393)^Math.imul(salt+1,668265263),1274126177);x=Math.imul(x^(x>>>16),2246822519);return ((x^(x>>>13))>>>0)/4294967296;}
