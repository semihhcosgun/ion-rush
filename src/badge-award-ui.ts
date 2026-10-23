import {BIKE_TIERS} from './bike-progress';
import {badge} from './garage';
import {t} from './i18n';
import {BadgeAwardSession,BADGE_AWARD_DURATION} from './badge-award';

export function badgeAwardMarkup(level:number){
 const rank=BIKE_TIERS[level];
 return `<article class="race-badge-award ${level===7?'is-final-rank':''}" role="status" aria-live="polite" aria-atomic="true" data-rank="${level}" style="--award-color:${rank.color};--award-duration:${BADGE_AWARD_DURATION}s">
 <div class="badge-award-art" aria-hidden="true">${badge(level)}</div>
 <div class="badge-award-copy"><span class="badge-award-label">${t('garage.badgeUnlocked')}</span><strong>${rank.name}</strong></div></article>`;
}

export class RaceBadgeAwards {
 readonly session=new BadgeAwardSession();
 private element?:HTMLElement;
 constructor(private shown:(level:number)=>void){}
 enqueue(level:number){this.session.enqueue(level);}
 reset(){this.session.reset();this.element?.remove();this.element=undefined;}
 update(dt:number,active:boolean,host:HTMLElement){
  const started=this.session.advance(dt,active),level=this.session.current;
  if(!active||level===undefined){this.element?.remove();this.element=undefined;return;}
  if(!this.element||this.element.parentElement!==host||Number(this.element.dataset.rank)!==level){
   this.element?.remove();host.insertAdjacentHTML('beforeend',badgeAwardMarkup(level));
   this.element=host.lastElementChild as HTMLElement;
   // Reconstruct the remaining animation after pause or a HUD redraw.
   this.element.style.setProperty('--award-offset',`-${this.session.elapsed}s`);
  }
  if(started!==undefined)this.shown(started);
 }
}
