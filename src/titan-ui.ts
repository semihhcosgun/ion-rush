import {TITAN} from './titan';
import {t} from './i18n';
import type {Race} from './game';
import type {BikeProgress} from './bike-progress';
const icon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8v8l5-2V10ZM8 12h13M11 8l10-2M11 16l10 2"/><circle cx="8" cy="12" r="2"/></svg>';
export function titanStats(){return `<div class="garage-ability-stats"><span>${t('ability.titan.energy',{count:TITAN.energy})}</span><span>${t('ability.titan.damage',{targets:TITAN.targets,damage:TITAN.damage})}</span><span>${t('ability.interval',{value:TITAN.cooldown})}</span></div>`;}
export function garageTitan(_p:BikeProgress,preview:number){return preview===TITAN.tier?`<article class="garage-ability titan-ability" aria-label="Titan · Siege Beam"><span class="garage-ability-icon">${icon}</span><div class="garage-ability-copy"><small>${t('ability.signature')}</small><h3>Siege Beam</h3><p>${t('ability.titan.short')}</p>${titanStats()}</div><button class="garage-ability-open" data-action="bikeAbilities" aria-label="${t('ability.all')}"><span aria-hidden="true">↗&#xfe0e;</span></button></article>`:'';}
export function titanStatus(r:Race){const b=r.combat.titan;return b.active?t('ability.titan.firing'):b.ready?t(r.combat.locked?'ability.titan.cooling':'ability.titan.ready'):t('ability.titan.charging',{energy:b.energy,count:TITAN.energy})+(b.remaining>0?` · ${Math.ceil(b.remaining)}s`:'');}
export function titanHud(r:Race){return r.bikeTier===TITAN.tier?`<small id="titan-status" class="titan-status">${titanStatus(r)}</small>`:'';}
export function updateTitanHud(ui:HTMLElement,r:Race){const el=ui.querySelector<HTMLElement>('#titan-status');if(!el)return;const b=r.combat.titan;el.hidden=!!r.training||r.ship.active||!!r.riftTransit;el.dataset.ready=String(b.ready&&!r.combat.locked);el.dataset.firing=String(b.active);const text=titanStatus(r);if(el.textContent!==text)el.textContent=text;}
