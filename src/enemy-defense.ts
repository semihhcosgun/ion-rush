import * as THREE from 'three';
import {AIM,ENEMY_ENTRY,ENEMY_TYPES} from './config';
import {enemyPoint,trackPoint} from './combat-space';
import type {Enemy} from './combat';
import type {Race} from './game';

export interface DefenseState{exposure:number;cooldown:number;remaining:number;side:number;count:number;}
export function defenseProfile(rank:number,distance:number){
 const skill=Math.min(1,Math.max(0,(rank-1)/9)*.8+Math.min(1,distance/50000)*.2);
 return {reaction:.3-.2*skill,cooldown:3.8-2*skill,width:1.8+3*skill,duration:.75};
}
// Observe real incoming projectiles, never future player input. Recovery leaves an aiming window.
export function updateDefense(e:Enemy,r:Race,dt:number){
 const state=e.defense??(e.defense={exposure:0,cooldown:0,remaining:0,side:1,count:0});
 state.cooldown=Math.max(0,state.cooldown-dt);state.remaining=Math.max(0,state.remaining-dt);
 const profile=defenseProfile(ENEMY_TYPES[e.kind].rank,r.z);
 if(e.age<ENEMY_ENTRY||state.cooldown>0||(e.volley>0&&ENEMY_TYPES[e.kind].rank<4)){state.exposure=0;return;}
 const position=enemyPoint(e);let threat:THREE.Vector3|undefined,soonest=1;
 for(const bolt of r.combat.bolts){
  if(!bolt.active||bolt.hostile||!Number.isFinite(bolt.wx))continue;
  const start=new THREE.Vector3(bolt.wx,bolt.wy,bolt.wz),velocity=new THREE.Vector3(bolt.vx,bolt.vy,bolt.vz);
  const t=position.clone().sub(start).dot(velocity)/Math.max(1,velocity.lengthSq());
  if(t<=0||t>soonest||t>bolt.life)continue;
  const closest=start.addScaledVector(velocity,t);
  if(closest.distanceTo(position)>AIM.enemyRadius+1.5)continue;
  threat=closest;soonest=t;
 }
 if(!threat){state.exposure=Math.max(0,state.exposure-dt*2);return;}
 state.exposure+=dt;if(state.exposure<profile.reaction&&soonest>profile.reaction)return;
 const right=trackPoint(e.z,e.visualSurface,1,7).sub(trackPoint(e.z,e.visualSurface,0,7)).normalize();
 const side=position.clone().sub(threat).dot(right);
 state.side=Math.abs(side)>.15?Math.sign(side):((e.id+state.count)%2===0?1:-1);
 // Do not flee indefinitely off-screen.
 if(Math.abs(e.motion?.lane??0)>5)state.side=-Math.sign(e.motion!.lane);
 state.exposure=0;state.remaining=profile.duration;state.cooldown=profile.cooldown;state.count++;
}

/** A hit triggers an escape, never a motion reset. Cooldown prevents repeated hits
 * from restarting the escape and pinning the enemy at its initial position. */
export function reactToHit(e:Enemy,r:Race){
 const state=e.defense??(e.defense={exposure:0,cooldown:0,remaining:0,side:1,count:0});
 if(state.cooldown>0||state.remaining>0||e.age<ENEMY_ENTRY)return;
 const profile=defenseProfile(ENEMY_TYPES[e.kind].rank,r.z);
 state.side=Math.abs(e.motion?.lane??0)>5?-Math.sign(e.motion!.lane):((e.id+state.count)%2===0?1:-1);
 state.exposure=0;state.remaining=profile.duration;state.cooldown=profile.cooldown;state.count++;
}
