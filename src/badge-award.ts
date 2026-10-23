import {BIKE_TIERS} from './bike-progress';

export const BADGE_AWARD_DURATION=5;
/** A jump can earn several ranks: celebrate the highest one, without a backlog. */
export class BadgeAwardSession {
 current?:number;
 elapsed=0;
 private pending?:number;
 private highest=0;
 enqueue(level:number){
  if(!Number.isInteger(level)||level<1||level>=BIKE_TIERS.length||level<=this.highest)return;
  this.highest=level;this.pending=level;
 }
 advance(dt:number,active:boolean){
  if(!active)return;
  if(this.current!==undefined){
   this.elapsed+=Math.max(0,Math.min(.1,dt));
   if(this.elapsed<BADGE_AWARD_DURATION)return;
   this.current=undefined;this.elapsed=0;
  }
  if(this.pending===undefined)return;
  this.current=this.pending;this.pending=undefined;this.elapsed=0;
  return this.current;
 }
 reset(){this.current=undefined;this.pending=undefined;this.highest=0;this.elapsed=0;}
}
