import * as THREE from 'three';
import {trackPoint,enemyTrackZ} from './combat-space';
import type {Race} from './game';

export const SUPPORT_DEPARTURE_SECONDS=.32;
export const EARTH_SUPPORT=Object.freeze({unlockDistance:10000,rechargeSeconds:240,duration:14,firstShot:1.6,shotInterval:1.2,salvos:10,damage:2,range:210,guards:3});
export function supportUnlocked(saved:boolean|undefined,best:number){return saved===true||Number.isFinite(best)&&best>=EARTH_SUPPORT.unlockDistance;}

/** One run-local charge. Only live flight advances the radio link. */
export class EarthSupport {
 unlocked=false;charge=0;remaining=0;guard=0;used=0;salvos=0;
 wings=Array.from({length:3},()=>({hp:3,flash:0,retreat:0,position:new THREE.Vector3(),posed:false}));
 private burst=0;private burstTime=0;private shooter=0;
 point(r:Race,i:number){const w=this.wings[i];return w.posed?w.position.clone():trackPoint(r.z+12,r.surface,(i-1)*2,10);}
 hit(r:Race,i:number){const w=this.wings[i];if(!this.active||!w||w.hp<=0)return;w.hp--;w.flash=.5;if(w.hp===0){w.retreat=1.2;this.guard=Math.min(this.guard,this.wings.filter(x=>x.hp>0).length);}r.events.push({type:'supportBlocked'});}
 beam=0;guardPulse=0;targetId:number|undefined;
 get active(){return this.remaining>0;}
 get ready(){return this.unlocked&&this.charge>=1&&!this.active;}
 get elapsed(){return EARTH_SUPPORT.duration-this.remaining;}
 available(r:Race){return this.ready&&!r.failed&&!r.training&&!r.riftTransit&&!r.riftChallenge&&!r.riftCapture;}
 activate(r:Race){
  if(!this.available(r))return false;
  this.charge=0;this.remaining=EARTH_SUPPORT.duration;this.guard=EARTH_SUPPORT.guards;this.salvos=0;this.beam=0;this.targetId=undefined;this.used++;
  for(const w of this.wings){w.hp=3;w.flash=0;w.retreat=0;w.posed=false;}this.burst=0;
  r.events.push({type:'supportCalled'});
  r.telemetry?.('support_used',{health:r.health,active_enemies:r.combat.enemies.filter(e=>e.active&&e.hp>0).length,use_number:this.used});
  return true;
 }
 absorb(){if(!this.active||!this.guard)return false;this.guard--;this.guardPulse=.45;return true;}
 cancel(){this.remaining=0;this.guard=0;this.beam=0;this.guardPulse=0;this.targetId=undefined;this.burst=0;}
 private canTarget(r:Race,e:Race['combat']['enemies'][number]){return e.active&&e.hp>0&&!e.training&&e.age>=2.2&&enemyTrackZ(e)>r.z+5&&enemyTrackZ(e)-r.z<=EARTH_SUPPORT.range&&Math.abs(((e.visualSurface-r.surface+6)%4+4)%4-2)<.8;}
 private pickTarget(r:Race){
  // Interrupt immediate threats first, then finish wounded enemies.
  const threat=(e:Race['combat']['enemies'][number])=>e.volley>0||e.charge>0&&!e.fired?1:0;
  return r.combat.enemies.filter(e=>this.canTarget(r,e)).sort((a,b)=>threat(b)-threat(a)||a.hp-b.hp||enemyTrackZ(a)-enemyTrackZ(b)||a.id-b.id)[0];
 }
 step(r:Race,dt:number){
  if(r.failed||r.training||dt<=0)return;
  if(!this.unlocked&&r.z>=EARTH_SUPPORT.unlockDistance){this.unlocked=true;this.charge=1;r.events.push({type:'supportUnlocked'},{type:'supportReady'});}
  if(r.riftTransit||r.riftChallenge||r.riftCapture){this.cancel();return;}
  this.beam=Math.max(0,this.beam-dt);
  this.guardPulse=Math.max(0,this.guardPulse-dt);
  if(this.active){
   const previousRemaining=this.remaining;this.remaining=Math.max(0,this.remaining-dt);
   if(previousRemaining>SUPPORT_DEPARTURE_SECONDS&&this.remaining<=SUPPORT_DEPARTURE_SECONDS)r.events.push({type:'supportDeparting'});
   for(const w of this.wings){w.flash=Math.max(0,w.flash-dt);w.retreat=Math.max(0,w.retreat-dt);}
   if(this.burst>0){this.burstTime-=dt;if(this.burstTime<=0){
    const target=r.combat.enemies.find(e=>e.id===this.targetId&&this.canTarget(r,e))??this.pickTarget(r);
    this.targetId=target?.id;
    if(target&&this.wings[this.shooter].hp>0&&r.combat.supportShot(r,this.shooter,target)){r.events.push({type:'supportShot'});}
    this.burst--;this.burstTime=.12;
   }}
   while(this.salvos<EARTH_SUPPORT.salvos&&this.elapsed>=EARTH_SUPPORT.firstShot+this.salvos*EARTH_SUPPORT.shotInterval){
    this.salvos++;
    // The escort only covers the pilot's side; no shots through the solid road.
    const target=this.pickTarget(r);
    const shooter=this.wings.findIndex((_,i)=>this.wings[(i+this.salvos-1)%3].hp>0);
    if(target&&shooter>=0){this.shooter=(shooter+this.salvos-1)%3;this.targetId=target.id;this.burst=EARTH_SUPPORT.damage;this.burstTime=0;}
   }
   if(!this.active){this.cancel();r.events.push({type:'supportEnded'});}
   return;
  }
  if(this.unlocked&&!this.ready){this.charge=Math.min(1,this.charge+dt/EARTH_SUPPORT.rechargeSeconds);if(this.charge>=1)r.events.push({type:'supportReady'});}
 }
}
