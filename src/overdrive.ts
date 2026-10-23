import type {Race} from './game';
/** Fractional extra turbo thrust, earned and capped independently for each activation. */
export const OVERDRIVE=Object.freeze({perEnergy:.5,maxExtra:2,flashDuration:.45,perEnergyDuration:.75,maxExtension:3});
export class TurboOverdrive {
 earned=0;
 extended=0;
 flash=0;
 reset(){this.earned=0;this.extended=0;this.flash=0;}
 update(dt:number){this.flash=Math.max(0,this.flash-dt);}
 collect(remaining:number){
  if(remaining<=0)return 0;
  const extra=Math.min(OVERDRIVE.perEnergy,OVERDRIVE.maxExtra-this.earned);
  const duration=Math.min(OVERDRIVE.perEnergyDuration,OVERDRIVE.maxExtension-this.extended);
  this.earned+=extra;this.extended+=duration;if(extra>0||duration>0)this.flash=OVERDRIVE.flashDuration;return extra;
 }
}

export function overdriveEnabled(r:Race){return !r.training&&!r.ship.active&&!r.riftTransit&&!r.failed;}

/** Short camera response makes each earned thrust step perceptible. */
export function overdriveSurge(earned:number,flash:number){
 const level=Math.max(0,Math.min(1,earned/OVERDRIVE.maxExtra));
 const pulse=level>0?Math.max(0,Math.min(1,flash/OVERDRIVE.flashDuration)):0;
 return {level,pulse,fov:level*10+pulse*(1+level*3)};
}
