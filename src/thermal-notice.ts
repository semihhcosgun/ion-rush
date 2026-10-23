import type {AdaptivePerformance} from './adaptive-performance';

/** Only visible limits count; Automatic does not use real-time shadow maps. */
export function thermalBudget(p:AdaptivePerformance){
 return {ratio:p.ratio,effects:p.effects,bloom:p.bloom,fps:p.targetFps,
  roadEconomy:p.effectiveLevel>=1,stars:p.effectiveLevel>=3?400:700};
}
export function budgetReduced(before:ReturnType<typeof thermalBudget>,after:ReturnType<typeof thermalBudget>){
 return after.ratio<before.ratio||after.effects>before.effects||
  before.bloom&&!after.bloom||after.fps<before.fps||
  !before.roadEconomy&&after.roadEconomy||after.stars<before.stars;
}

/** In-memory app lifetime: neither a race restart nor backgrounding resets it. */
export class ThermalNoticeSession {
 private pending=false;
 private shown=false;
 request(){if(!this.shown)this.pending=true;}
 take(visible:boolean){
  if(!visible||!this.pending||this.shown)return false;
  this.pending=false;this.shown=true;return true;
 }
}
