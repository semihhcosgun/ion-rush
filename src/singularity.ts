import * as THREE from 'three';
import type {Race} from './game';
export const SINGULARITY=Object.freeze({tier:7,energy:12,cooldown:40,duration:2,launchDuration:.3,forward:24,bulletRadius:4,enemyRadius:55,pullRadius:55,fullPullRadius:12,enemySpeed:120,bulletAcceleration:650,bulletSpeed:200});
export const singularityEnabled=(r:Race)=>r.bikeTier===SINGULARITY.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.riftChallenge&&!r.riftCapture&&!r.shiftLeft&&!r.failed;
/** One banked charge; the first use also waits forty simulation seconds. */
export class Singularity {
 energy=0;remaining:number=SINGULARITY.cooldown;active=false;launching=false;launchElapsed=0;fieldStep=0;elapsed=0;absorbed=0;flash=0;
 readonly targets=new Set<number>();readonly center=new THREE.Vector3();private announced=false;
 get busy(){return this.active||this.launching;}
 get ready(){return !this.busy&&this.energy===SINGULARITY.energy&&this.remaining<=1e-8;}
 update(dt:number,enabled:boolean){this.remaining=Math.max(0,this.remaining-dt);return this.notify(enabled);}
 collect(enabled:boolean){if(!enabled||this.busy)return false;this.energy=Math.min(SINGULARITY.energy,this.energy+1);return this.notify(true);}
 private notify(enabled:boolean){if(enabled&&this.ready&&!this.announced){this.announced=true;return true;}return false;}
 start(){if(!this.ready)return false;this.energy=0;this.remaining=SINGULARITY.cooldown;this.launching=true;this.launchElapsed=0;this.elapsed=0;this.absorbed=0;this.flash=0;this.targets.clear();this.announced=false;return true;}
 advance(dt:number){
  let opened=false;this.fieldStep=0;
  if(this.launching){this.launchElapsed+=dt;if(this.launchElapsed<SINGULARITY.launchDuration-1e-8)return false;dt=Math.max(0,this.launchElapsed-SINGULARITY.launchDuration);this.launchElapsed=SINGULARITY.launchDuration;this.launching=false;this.active=true;opened=true;}
  if(!this.active)return false;this.fieldStep=Math.min(dt,SINGULARITY.duration-this.elapsed);this.elapsed=Math.min(SINGULARITY.duration,this.elapsed+dt);this.flash=Math.max(0,this.flash-dt);if(this.elapsed>=SINGULARITY.duration-1e-8)this.cancel();return opened;}
 claim(id:number){if(!this.active||this.targets.has(id))return false;this.targets.add(id);return true;}
 absorb(){if(!this.active)return false;this.absorbed++;this.flash=.16;return true;}
 cancel(){this.active=false;this.launching=false;this.flash=0;}
}

/** Smooth finite sphere: no force at/beyond the boundary, full force in the core. */
export function singularityFalloff(distance:number){
 if(distance>=SINGULARITY.pullRadius)return 0;
 const t=Math.max(0,(distance-SINGULARITY.fullPullRadius)/(SINGULARITY.pullRadius-SINGULARITY.fullPullRadius));
 return 1-t*t*(3-2*t);
}
/** Reused per enemy slot; an id guard prevents a recycled slot inheriting displacement. */
export class SingularityPull {
 id=-1;captured=false;compression=0;deathScale=1;readonly offset=new THREE.Vector3();readonly velocity=new THREE.Vector3();readonly captureCenter=new THREE.Vector3();
 reset(id:number){this.id=id;this.captured=false;this.compression=0;this.deathScale=1;this.offset.set(0,0,0);this.velocity.set(0,0,0);}
}
