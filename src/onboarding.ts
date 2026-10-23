import type {Race,GameEvent} from './game';
import {AIM,TUNE} from './config';

export type TutorialProgress={version:1;completed:number;skipped:boolean};
export function cleanTutorial(value:unknown,previousRuns=0):TutorialProgress{
 const p=value as Partial<TutorialProgress>|undefined;
 if(p?.version===1&&Number.isInteger(p.completed)&&p.completed!>=0&&p.completed!<=4)
  return {version:1,completed:p.completed!,skipped:p.skipped===true};
 return {version:1,completed:0,skipped:previousRuns>0};
}
export const freshTutorial=():TutorialProgress=>({version:1,completed:0,skipped:false});
export const needsTutorial=(p:TutorialProgress)=>!p.skipped&&p.completed<4;

/** A bounded, safe introduction inside the opening stretch of a real run. */
export class FlightLesson{
 step:number;age=0;success=0;active=true;aimed=false;shots=0;handoff=0;
 fireStage:'hold'|'track'='hold';private trackingAge=0;
 private startZ:number;private charged=false;
 constructor(readonly race:Race,readonly progress:TutorialProgress,private save:()=>void,private onLaunch:()=>void=()=>{}){
  this.step=progress.completed;this.startZ=race.z;
  race.training={step:this.step,limit:race.z+60};
  race.gates=[];race.rifts=[];race.combat.clearTransit();race.meteors.clear();
  this.enter();
 }
 private enter(){
  this.age=0;this.aimed=false;this.shots=0;this.fireStage='hold';this.trackingAge=0;this.startZ=this.race.z;
  this.race.training={step:this.step,limit:this.startZ+60};
  this.race.combat.clearTransit();
  if(this.step===2){
   this.race.touchAim=undefined;this.race.aimX=0;this.race.aimY=0;
   const e=this.race.combat.enemies[0];
   Object.assign(e,{training:true,trainingOffset:0,trainingAimReady:true,pursuing:false,motion:undefined,hunting:false,active:true,
    id:this.race.combat.nextId++,gateId:-1,kind:'drone',flight:'level',z:this.race.z+AIM.distance,
    surface:this.race.surface,visualSurface:this.race.surface,lane:0,hp:2,maxHp:2,
    age:0,dead:0,flash:0,fired:true,charge:0,volley:0,attackCooldown:999});
  }
 }
 aim(distance:number){if(this.active&&!this.success&&this.step===2&&this.fireStage==='track'&&distance>=.12){this.aimed=true;const target=this.race.combat.enemies.find(e=>e.training&&e.active);if(target)target.trainingAimReady=true;}}
 events(events:readonly GameEvent[]){
  if(!this.active||this.success||this.handoff||this.age<.45)return false;
  for(const e of events){
   if(this.step===2&&e.type==='shot')this.shots++;
   if(this.step===2&&this.fireStage==='hold'&&e.type==='enemyHit'&&this.race.combat.enemies.some(target=>target.training&&target.id===e.enemyId)){
    this.fireStage='track';this.trackingAge=0;this.aimed=false;
    const target=this.race.combat.enemies.find(target=>target.training&&target.id===e.enemyId)!;target.trainingAimReady=false;
    for(const bolt of this.race.combat.bolts)if(!bolt.hostile)bolt.active=false;
   }
   if((this.step===0&&e.type==='lane')||(this.step===1&&e.type==='shift')||
     (this.step===2&&this.fireStage==='track'&&this.aimed&&e.type==='kill'&&this.race.combat.enemies.some(target=>target.training&&target.id===e.enemyId))||(this.step===3&&e.type==='boost')){
    this.progress.completed=this.step+1;this.save();this.success=1.45;return true;
   }
  }
  return false;
 }
 tick(dt:number){
  if(!this.active)return;
  this.age+=dt;
  if(this.handoff){this.handoff=Math.max(0,this.handoff-dt);if(!this.handoff){this.finish();this.onLaunch();}return;}
  if(this.success){this.success=Math.max(0,this.success-dt);if(!this.success){
   if(this.progress.completed===4){this.handoff=4.6;this.race.training!.limit=this.race.z+90;this.race.combat.clearTransit();return;}
   this.step=this.progress.completed;this.enter();
  }return;}
  if(this.step===2&&this.fireStage==='track'){
   this.trackingAge+=dt;
   const target=this.race.combat.enemies.find(e=>e.training&&e.active&&e.hp>0);
   if(target)target.trainingOffset=2.2*Math.sin(this.trackingAge*.65);
  }
  if(this.step===3){
   this.race.turboEnergy=Math.min(TUNE.energyForTurbo,Math.floor(this.age/.4));
   if(this.race.turboEnergy===TUNE.energyForTurbo&&!this.charged){
    this.charged=true;this.race.boostCharge=1;this.race.events.push({type:'turboReady'});
   }
  }
 }
 skip(){if(!this.active)return;this.progress.skipped=true;this.save();this.finish();}
 private finish(){
  if(this.step===3&&!this.race.boost){this.race.boostCharge=0;this.race.turboEnergy=0;}
  this.active=false;this.race.endTraining();
 }
}
