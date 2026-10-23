import {BODIES} from './config';
import type {Race} from './game';
export const SHIP_DURATION=14;
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export class ShipMode{
 elapsed=0;active=false;core?:{z:number;surface:number;lane:number};nextZ:number;private seed:number;notice='';
 constructor(seed:number){this.seed=seed^0x53484950;this.nextZ=18000+this.roll()*4000;}
 private roll(){this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;return (this.seed>>>0)/4294967296;}
 get lift(){if(!this.active)return 0;if(this.elapsed<11)return smooth(this.elapsed);const t=this.elapsed-11;return t<1.5?1-.82*smooth(t/1.5):.18*(1-smooth((t-1.5)/1));}
 get deployment(){return this.active?Math.min(smooth(this.elapsed),1-smooth((this.elapsed-13.5)/.5)):0;}
 get wheelFold(){return this.active?Math.min(smooth(this.elapsed),1-smooth((this.elapsed-11.8)/1.2)):0;}
 get landingPitch(){if(!this.active||this.elapsed<11)return 0;const t=this.elapsed-11;return t<1.5?-.035*Math.sin(t/1.5*Math.PI):t<2.5?.1*Math.sin((t-1.5)*Math.PI):0;}
 get suspension(){const t=this.elapsed-13.5;return this.active&&t>0?-Math.sin(Math.min(1,t/.5)*Math.PI)*.12:0;}
 step(r:Race,dt:number,prev:number){
  if(this.active){this.elapsed+=dt;if(this.elapsed>=SHIP_DURATION){this.active=false;this.elapsed=0;r.gates=r.gates.filter(g=>g.z>r.z+150);this.notice='VESPER RESTORED';}else if(this.elapsed>=11){r.gates=r.gates.filter(g=>g.z>r.z+150);}return;}
  if(!this.core&&this.nextZ<r.z+500){
   const z=Math.max(this.nextZ,r.z+180);
   const conflict=r.riftTransit||r.riftChallenge||r.rifts.some(v=>Math.abs(v.z-z)<1600)||BODIES.some(v=>Math.abs(v.passAt-z)<850);
   if(conflict){this.nextZ=z+900;return;}
   this.core={z,surface:Math.floor(this.roll()*4),lane:Math.floor(this.roll()*3)-1};
  }
  if(!this.core)return;
  const core=this.core;
  r.gates=r.gates.filter(g=>Math.abs(g.z-core.z)>90);
  if(prev<core.z&&r.z>=core.z){
   this.core=undefined;this.nextZ=core.z+8000+this.roll()*4000;if(this.roll()<.25)this.nextZ+=8000+this.roll()*4000;
   if(r.surface===core.surface&&!r.shiftLeft&&Math.abs(r.laneX-core.lane)<.48&&!r.riftTransit&&!r.riftChallenge){this.active=true;this.elapsed=0;this.notice='FLIGHT CORE · VESPER ASCENDING';}
  }
 }
}
