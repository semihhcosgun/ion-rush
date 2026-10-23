import * as THREE from 'three';
import type {Race} from './game';
import {COMBAT,AIM} from './config';
export const TITAN=Object.freeze({tier:5,energy:8,cooldown:25,duration:2,heat:30,targets:3,damage:3,range:COMBAT.range,radius:AIM.enemyRadius});
export const titanEnabled=(r:Race)=>r.bikeTier===TITAN.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.failed;
/** One stored beam. Three spaced damage pulses; target IDs remain reserved for the whole burst. */
export class SiegeBeam {
 energy=0;remaining=0;active=false;elapsed=0;private pulses=0;private announced=false;
 readonly damage=new Map<number,number>();
 readonly from=new THREE.Vector3();readonly to=new THREE.Vector3();readonly direction=new THREE.Vector3(0,0,-1);
 get ready(){return !this.active&&this.energy===TITAN.energy&&this.remaining<=1e-8;}
 update(dt:number,enabled:boolean){this.remaining=Math.max(0,this.remaining-dt);return this.notify(enabled);}
 collect(enabled:boolean){if(!enabled||this.active)return false;this.energy=Math.min(TITAN.energy,this.energy+1);return this.notify(true);}
 private notify(enabled:boolean){if(enabled&&this.ready&&!this.announced){this.announced=true;return true;}return false;}
 start(){if(!this.ready)return false;this.energy=0;this.remaining=TITAN.cooldown;this.active=true;this.elapsed=0;this.pulses=0;this.announced=false;this.damage.clear();return true;}
 advance(dt:number){this.elapsed=Math.min(TITAN.duration,this.elapsed+dt);const due=Math.min(TITAN.damage,Math.floor(this.elapsed/TITAN.duration*TITAN.damage+1e-8)),count=due-this.pulses;this.pulses=due;if(this.elapsed>=TITAN.duration-1e-8)this.active=false;return count;}
 claim(id:number){const hits=this.damage.get(id)??0;if(hits>=TITAN.damage||(!this.damage.has(id)&&this.damage.size>=TITAN.targets))return false;this.damage.set(id,hits+1);return true;}
 cancel(){this.active=false;this.elapsed=0;this.pulses=0;this.damage.clear();}
}
