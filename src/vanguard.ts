import * as THREE from 'three';
import type {Race} from './game';
export const VANGUARD=Object.freeze({tier:4,energy:5,cooldown:20,max:2,damage:1,shotLife:2.5,flashDuration:.45});
export const vanguardEnabled=(r:Race)=>r.bikeTier===VANGUARD.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.failed;
export class GuardCountershot {
 active=false;life=0;
 readonly position=new THREE.Vector3();readonly previous=new THREE.Vector3();readonly velocity=new THREE.Vector3();
}
/** Charge is capped at one deployment; a full guard cannot bank a third satellite. */
export class OrbitalGuard {
 energy=0;remaining=0;deployFlash=0;
 readonly satellites=[false,false];readonly flashes=[0,0];
 readonly counters=Array.from({length:VANGUARD.max},()=>new GuardCountershot());
 get count(){return this.satellites.filter(Boolean).length;}
 update(dt:number,enabled:boolean){this.remaining=Math.max(0,this.remaining-dt);this.deployFlash=Math.max(0,this.deployFlash-dt);for(let i=0;i<2;i++)this.flashes[i]=Math.max(0,this.flashes[i]-dt);return enabled&&this.create();}
 collect(enabled:boolean){if(!enabled||this.count===VANGUARD.max)return false;this.energy=Math.min(VANGUARD.energy,this.energy+1);return this.create();}
 private create(){if(this.count===VANGUARD.max||this.energy<VANGUARD.energy||this.remaining>1e-8)return false;this.satellites[this.satellites.indexOf(false)]=true;this.energy=0;this.remaining=VANGUARD.cooldown;this.deployFlash=.55;return true;}
 intercept(){const i=this.satellites.indexOf(true);if(i<0||this.counters.every(s=>s.active))return false;this.satellites[i]=false;this.flashes[i]=VANGUARD.flashDuration;return true;}
 clearShots(){for(const shot of this.counters)shot.active=false;this.flashes.fill(0);this.deployFlash=0;}
}
