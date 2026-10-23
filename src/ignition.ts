/** Ignition rewards a player kill without changing ordinary shots or lock rules. */
export const IGNITION=Object.freeze({tier:1,heat:20,cooldown:6,rechargeDuration:2,rechargeBonus:.6,flashDuration:.42});
export class IgnitionVent {
 remaining=0;
 flash=0;
 removed=0;
 rechargeRemaining=0;
 /** Integrate across expiry so a long frame never grants extra recharge. */
 coolingAmount(base:number,dt:number){return base*(dt+IGNITION.rechargeBonus*Math.min(dt,this.rechargeRemaining));}
 /** Predict the ordinary rearm threshold, including the remaining burst. */
 timeToCool(heat:number,base:number){
  const needed=Math.max(0,heat),boosted=base*(1+IGNITION.rechargeBonus);
  return needed<=boosted*this.rechargeRemaining?needed/boosted:this.rechargeRemaining+(needed-boosted*this.rechargeRemaining)/base;
 }
 get ready(){return this.remaining<=1e-8;}
 update(dt:number){this.rechargeRemaining=Math.max(0,this.rechargeRemaining-dt);this.remaining=Math.max(0,this.remaining-dt);this.flash=Math.max(0,this.flash-dt);}
 trigger(heat:number){
  // An already-cold weapon does not waste the ability's cooldown.
  if(!this.ready||heat<=1e-8)return 0;
  this.rechargeRemaining=IGNITION.rechargeDuration;this.removed=Math.min(IGNITION.heat,heat);this.remaining=IGNITION.cooldown;this.flash=IGNITION.flashDuration;
  return this.removed;
 }
}
