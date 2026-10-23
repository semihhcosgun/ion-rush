import type {Race} from './game';
export const PHANTOM=Object.freeze({tier:6,duration:1});
export const phantomEnabled=(r:Race)=>r.bikeTier===PHANTOM.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.failed;
export const phaseActive=(r:Race)=>!!phantomEnabled(r)&&r.boost>0&&r.phase.remaining>1e-8;
export const phaseBlocks=(r:Race,source:string)=>phaseActive(r)&&(source==='obstacle'||source==='enemy');
/** A successful turbo starts one fixed window. Holding turbo cannot refresh it. */
export class PhaseDrive {
 remaining=0;
 start(){this.remaining=PHANTOM.duration;}
 cancel(){this.remaining=0;}
 update(dt:number,enabled:boolean){const was=this.remaining>1e-8;this.remaining=enabled?Math.max(0,this.remaining-dt):0;if(this.remaining<1e-8)this.remaining=0;return was&&this.remaining===0;}
}
