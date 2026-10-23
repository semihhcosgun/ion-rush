import type {Race} from './game';

export const METEOR={warning:1.9,cooling:6,heatSeconds:1.05,unlock:5000,directChanceMin:.2,directChanceMax:.65,directRampEnd:50000,directMultiplier:2} as const;
export function meteorTuning(distance:number){const progress=Math.max(0,Math.min(1,(distance-10000)/40000)),aimProgress=Math.max(0,Math.min(1,(distance-METEOR.unlock)/(METEOR.directRampEnd-METEOR.unlock)));return {warning:METEOR.warning-.75*progress,heatSeconds:METEOR.heatSeconds-.4*progress,impactDamage:distance>=30000?2:1,directChance:METEOR.directChanceMin+(METEOR.directChanceMax-METEOR.directChanceMin)*aimProgress};}
export interface Meteor {id:number;z:number;end:number;surface:number;lane:number;age:number;impact:boolean;targeted?:boolean;tuning?:ReturnType<typeof meteorTuning>;}
export function meteorProfile(m:Meteor){return m.tuning??meteorTuning(m.z);}
export function meteorImpactDamage(m:Meteor){return meteorProfile(m).impactDamage*METEOR.directMultiplier;}
/** Distance-seeded encounters; the chosen face and lane never follow the rider. */
export class MeteorField {
 items:Meteor[]=[];heat=0;nextZ:number;impactPulse=0;warningPulse=false;private seed:number;private id=0;
 constructor(seed:number){this.seed=seed^0x4d455445;this.nextZ=METEOR.unlock+this.roll()*1300;}
 private roll(){this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;return (this.seed>>>0)/4294967296;}
 get warning(){return this.items.find(m=>m.age>=0&&m.age<meteorProfile(m).warning);}
 clear(){this.items=[];this.heat=0;this.impactPulse=0;this.warningPulse=false;}
 spawn(r:Race){
  const tuning=meteorTuning(r.z),length=r.speed*(r.z>=15000?2.7:2.1);
  const targeted=this.roll()<tuning.directChance;
  const lane=targeted?r.lane:Math.floor(this.roll()*3)-1;
  // Lock the landing point at warning time. Include turbo expiry in the projected
  // travel, but never follow later steering or turbo input: a dodge stays a dodge.
  const travel=r.cruise*tuning.warning+Math.max(0,r.speed-r.cruise)*Math.min(r.boost,tuning.warning);
  const z=r.z+(targeted?travel:(r.speed+6)*(tuning.warning+.35));
  this.items.push({id:this.id++,z,end:z+length,surface:r.surface,lane,age:0,impact:false,targeted,tuning});
  // Late pairs share a lane, so the first escape remains safe through both impacts.
  if(r.z>=30000&&this.roll()<.4){const second=z+r.speed*2.6;this.items.push({id:this.id++,z:second,end:second+length,surface:r.surface,lane,age:-2.6,impact:false,tuning});}
  this.warningPulse=true;
 }
 step(r:Race,dt:number,prev:number){
  this.impactPulse=Math.max(0,this.impactPulse-dt);
  if(r.riftTransit||r.riftChallenge||r.ship.active){this.clear();this.nextZ=Math.max(this.nextZ,r.z+600);return;}
  if(!this.items.length&&r.z>=this.nextZ){
   const conflict=r.rifts.some(v=>!r.resolvedRifts.has(v.id)&&v.z>r.z-250&&v.z<r.z+1100)||!!r.ship.core;
   if(conflict)this.nextZ=r.z+600;
   else {this.spawn(r);this.nextZ=r.z+(r.z<15000?1800:r.z<30000?1400:1100)+this.roll()*1300;}
  }
  let exposure=0;
  for(const m of this.items){
   const old=m.age,profile=meteorProfile(m);m.age+=dt;
   const onLane=r.surface===m.surface&&r.shiftLeft===0&&Math.abs(r.laneX-m.lane)<.43;
   if(!m.impact&&m.age>=profile.warning){
    m.impact=true;this.impactPulse=.55;
    const fraction=Math.max(0,Math.min(1,(profile.warning-old)/dt)),impactZ=prev+(r.z-prev)*fraction;
    if(onLane&&Math.abs(impactZ-m.z)<8){r.damage('meteor','impact',undefined,meteorImpactDamage(m));this.heat=0;}
   }
   if(m.impact&&m.age<profile.warning+METEOR.cooling&&onLane&&r.invulnerable<=0){
    const travel=r.z-prev,overlap=Math.max(0,Math.min(r.z,m.end)-Math.max(prev,m.z-8));
    const fraction=travel>0?overlap/travel:0;
    const cooling=Math.max(0,Math.min(1,(profile.warning+METEOR.cooling-m.age)/2));
    exposure=Math.max(exposure,dt*fraction*cooling/profile.heatSeconds);
   }
  }
  this.heat=exposure>0?Math.min(1,this.heat+exposure):Math.max(0,this.heat-dt*2.5);
  if(this.heat>=1){r.damage('meteor','heated_trail');this.heat=0;}
  this.items=this.items.filter(m=>m.age<meteorProfile(m).warning+METEOR.cooling+2&&m.end>r.z-100);
 }
}
