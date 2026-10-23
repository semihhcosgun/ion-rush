import {PHANTOM,phaseActive} from './phantom';
import {t} from './i18n';
import type {Race} from './game';
import type {BikeProgress} from './bike-progress';
const icon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 3-8 9h6l-2 9 8-11h-6ZM3 7h3m-4 5h2m-1 5h3m13-10h2m-2 10h2"/></svg>';
export function phantomStats(){return `<div class="garage-ability-stats"><span>${t('ability.phantom.duration',{seconds:PHANTOM.duration})}</span><span>${t('ability.phantom.trigger')}</span><span>${t('ability.phantom.noFire')}</span></div>`;}
export function garagePhantom(_p:BikeProgress,preview:number){return preview===PHANTOM.tier?`<article class="garage-ability phantom-ability" aria-label="Phantom · Phase Drive"><span class="garage-ability-icon">${icon}</span><div class="garage-ability-copy"><small>${t('ability.signature')}</small><h3>Phase Drive</h3><p>${t('ability.phantom.short')}</p>${phantomStats()}</div><button class="garage-ability-open" data-action="bikeAbilities" aria-label="${t('ability.all')}"><span aria-hidden="true">↗&#xfe0e;</span></button></article>`:'';}
export function phantomStatus(r:Race){return phaseActive(r)?t('ability.phantom.active',{seconds:(Math.ceil((r.phase.remaining-1e-8)*10)/10).toFixed(1)}):r.boost>0?t('ability.phantom.spent'):r.boostCharge?t('ability.phantom.ready'):t('ability.phantom.charging');}
export function phantomHud(r:Race){return r.bikeTier===PHANTOM.tier?`<small id="phantom-status" class="phantom-status">${phantomStatus(r)}</small>`:'';}
export function updatePhantomHud(ui:HTMLElement,r:Race){const el=ui.querySelector<HTMLElement>('#phantom-status');if(!el)return;el.hidden=!!r.training||r.ship.active||!!r.riftTransit;el.dataset.ready=String(!!r.boostCharge&&r.boost===0);el.dataset.phased=String(phaseActive(r));const text=phantomStatus(r);if(el.textContent!==text)el.textContent=text;}
