import {BIKE_TIERS,type BikeProgress} from './bike-progress';
import {IGNITION} from './ignition';
import {runnerStats} from './runner-ui';
import {hunterStats} from './hunter-ui';
import {vanguardStats} from './vanguard-ui';
import {titanStats} from './titan-ui';
import {singularityStats} from './singularity-ui';
import {phantomStats} from './phantom-ui';
import {t,type TranslationKey} from './i18n';
import type {Race} from './game';

const ventIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h10M4 12h14M4 17h10M17 4l3 3-3 3M20 9l3 3-3 3M17 14l3 3-3 3"/></svg>';
const names=['Standard Ride','Heat Vent','Momentum','Target Lock','Orbital Guard','Siege Beam','Phase Drive','Singularity'];
export function garageIgnition(p:BikeProgress,preview:number){
 const teaser=preview===0&&p.unlocked===0;
 if(preview!==IGNITION.tier&&!teaser)return '';
 return `<article class="garage-ability ${teaser?'is-teaser':''}" aria-label="Ignition · Heat Vent">
  <span class="garage-ability-icon">${ventIcon}</span><div class="garage-ability-copy"><small>${t(teaser?'ability.ignition.unlock':'ability.signature')}</small><h3>Heat Vent</h3><p>${t('ability.ignition.short')}</p>
  <div class="garage-ability-stats"><span>${t('ability.ventHeat',{value:IGNITION.heat})}</span><span>${t('ability.ignition.boost',{value:IGNITION.rechargeBonus*100,seconds:IGNITION.rechargeDuration})}</span><span>${t('ability.interval',{value:IGNITION.cooldown})}</span></div></div><button class="garage-ability-open" data-action="bikeAbilities" aria-label="${t('ability.all')}"><span aria-hidden="true">↗&#xfe0e;</span></button>
 </article>`;
}
export function ignitionStatus(r:Race){
 const vent=r.combat.ignition;
 return vent.flash>0?t('ability.ignition.venting',{value:Math.round(vent.removed)}):vent.rechargeRemaining>0?t('ability.ignition.boosting',{value:IGNITION.rechargeBonus*100,seconds:vent.rechargeRemaining.toFixed(1)}):vent.ready?t('ability.ignition.ready'):t('ability.ignition.recharge',{seconds:Math.ceil(vent.remaining)});
}
export function ignitionHud(r:Race){return r.bikeTier===IGNITION.tier?`<small id="ignition-status" class="ignition-status" data-ready="${r.combat.ignition.ready}" data-venting="${r.combat.ignition.flash>0}" data-recharging="${r.combat.ignition.rechargeRemaining>0}">${ignitionStatus(r)}</small>`:'';}
/** Read-only ability catalogue: locked bike buttons and equipment stay untouched. */
export function openBikeAbilities(p:BikeProgress){
 document.querySelector('.bike-abilities-dialog')?.remove();
 const dialog=document.createElement('dialog');dialog.className='bike-abilities-dialog';
 dialog.setAttribute('aria-labelledby','bike-abilities-title');
 dialog.innerHTML=`<header><div><small>ION RUSH / GARAGE</small><h2 id="bike-abilities-title">${t('ability.all')}</h2></div><button class="ability-close" aria-label="${t('common.close')}">×</button></header><div class="bike-abilities-list">${BIKE_TIERS.map((b,i)=>`<details class="bike-ability-entry ${p.unlocked<7&&i===p.unlocked+1?'is-next':''}" style="--ability-rank:${b.color}" ${i===(p.selected>=1&&p.selected<=7?p.selected:1)?'open':''}><summary><span class="ability-number">${String(i+1).padStart(2,'0')}</span><span><small>${b.name}</small><strong>${names[i]}</strong></span><em>${t(i>p.unlocked?'garage.locked':p.selected===i?'garage.equipped':'garage.unlocked')}</em><b aria-hidden="true">+</b></summary><div class="bike-ability-description"><p>${t(('ability.description'+i) as TranslationKey)}</p>${i===1?`<div class="garage-ability-stats"><span>${t('ability.ventHeat',{value:IGNITION.heat})}</span><span>${t('ability.ignition.boost',{value:IGNITION.rechargeBonus*100,seconds:IGNITION.rechargeDuration})}</span><span>${t('ability.interval',{value:IGNITION.cooldown})}</span></div>`:i===2?runnerStats():i===3?hunterStats():i===4?vanguardStats():i===5?titanStats():i===6?phantomStats():i===7?singularityStats():''}</div></details>`).join('')}</div><footer>${t('overdrive.description')}<br>${t('ability.nextRun')}</footer>`;
 document.body.append(dialog);dialog.querySelector('button')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 const open=dialog.querySelector<HTMLElement>('.bike-ability-entry[open]'),list=dialog.querySelector<HTMLElement>('.bike-abilities-list');
 if(open&&list)list.scrollTop=Math.max(0,open.offsetTop-list.offsetTop-8);
 dialog.querySelectorAll<HTMLDetailsElement>('.bike-ability-entry').forEach(entry=>entry.addEventListener('toggle',()=>{if(entry.open&&list)list.scrollTop=Math.max(0,entry.offsetTop-list.offsetTop-8);}));
}
