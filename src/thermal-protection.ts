export type ThermalState='nominal'|'fair'|'serious'|'critical';
const states:ThermalState[]=['nominal','fair','serious','critical'];

/** OS thermal pressure is independent of frame delivery. Cooldown counts only
 * active frames, never background time or a wall-clock jump. */
export class ThermalProtection {
 private requested=0;
 private held=0;
 private coolSeconds=0;
 get state(){return states[this.held];}
 get levelFloor(){return this.held>=2?6:this.held===1?3:0;}
 get ratioCap(){return [Infinity,1.25,1,.85][this.held];}
 get shadowSize(){return this.held?512:1024;}
 get maxFps():30|60{return this.held>=2?30:60;}
 setState(state:ThermalState){
  const next=states.indexOf(state);if(next<0||next===this.requested)return false;
  this.requested=next;this.coolSeconds=0;
  if(next<=this.held)return false;
  this.held=next;return true;
 }
 advance(seconds:number){
  if(!Number.isFinite(seconds)||seconds<=0||seconds>1||this.held<=this.requested)return false;
  this.coolSeconds+=seconds;
  if(this.coolSeconds+1e-9<30)return false;
  this.coolSeconds=0;this.held--;return true;
 }
}
