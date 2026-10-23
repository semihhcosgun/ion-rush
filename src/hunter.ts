import * as THREE from 'three';

export const HUNTER=Object.freeze({tier:3,hits:2,missiles:2,damage:1,cooldown:12,flashDuration:.6,speed:145,lifetime:3,hitRadius:2});
export class HunterMissile {
 active=false;targetId=-1;life=0;
 readonly position=new THREE.Vector3();
 readonly previous=new THREE.Vector3();
 readonly velocity=new THREE.Vector3();
}
/** Only normal player hits after cooldown can build a fresh same-target lock. */
export class HunterTargetLock {
 remaining=0;flash=0;targetId:number|undefined;focusId:number|undefined;hits=0;
 readonly missiles=Array.from({length:HUNTER.missiles},()=>new HunterMissile());
 get ready(){return this.remaining<=1e-8;}
 update(dt:number){this.remaining=Math.max(0,this.remaining-dt);this.flash=Math.max(0,this.flash-dt);if(this.flash===0)this.focusId=undefined;}
 clearStreak(){this.targetId=undefined;this.hits=0;}
 clearFlight(){this.clearStreak();this.focusId=undefined;this.flash=0;for(const missile of this.missiles)missile.active=false;}
 hit(id:number,survived:boolean){
  if(!this.ready)return false;
  if(!survived){this.clearStreak();return false;}
  if(this.targetId!==id){this.targetId=id;this.hits=0;}
  this.hits++;
  if(this.hits<HUNTER.hits)return false;
  this.clearStreak();this.focusId=id;this.remaining=HUNTER.cooldown;this.flash=HUNTER.flashDuration;return true;
 }
}
