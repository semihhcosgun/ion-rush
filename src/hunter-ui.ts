import {HUNTER} from './hunter';
import {t} from './i18n';
import type {BikeProgress} from './bike-progress';
import type {Race} from './game';

const targetIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5m8-7v8m-4-4h8"/><circle cx="12" cy="12" r="4"/></svg>';
export function hunterStats(){return `<div class="garage-ability-stats"><span>${t('ability.hunter.hits',{count:HUNTER.hits})}</span><span>${t('ability.hunter.damage',{count:HUNTER.missiles,damage:HUNTER.damage})}</span><span>${t('ability.interval',{value:HUNTER.cooldown})}</span></div>`;}
export function garageHunter(_p:BikeProgress,preview:number){
 if(preview!==HUNTER.tier)return '';
 return `<article class="garage-ability hunter-ability" aria-label="Hunter · Target Lock"><span class="garage-ability-icon">${targetIcon}</span><div class="garage-ability-copy"><small>${t('ability.signature')}</small><h3>Target Lock</h3><p>${t('ability.hunter.short')}</p>${hunterStats()}</div><button class="garage-ability-open" data-action="bikeAbilities" aria-label="${t('ability.all')}"><span aria-hidden="true">↗&#xfe0e;</span></button></article>`;
}
export function hunterStatus(r:Race){
 const lock=r.combat.hunter;
 return lock.flash>0?t('ability.hunter.launched'):!lock.ready?t('ability.hunter.recharge',{seconds:Math.ceil(lock.remaining)}):r.combat.locked?t('ability.hunter.cooling'):t('ability.hunter.ready',{hits:lock.hits,count:HUNTER.hits});
}
export function hunterHud(r:Race){return r.bikeTier===HUNTER.tier?`<small id="hunter-status" class="hunter-status" data-ready="true" data-launching="false">${hunterStatus(r)}</small>`:'';}
export function updateHunterHud(ui:HTMLElement,r:Race){
 const el=ui.querySelector<HTMLElement>('#hunter-status');if(!el)return;
 el.hidden=!!r.training||r.ship.active||!!r.riftTransit;
 el.dataset.ready=String(r.combat.hunter.ready&&!r.combat.locked);el.dataset.launching=String(r.combat.hunter.flash>0);
 const text=hunterStatus(r);if(el.textContent!==text)el.textContent=text;
}
