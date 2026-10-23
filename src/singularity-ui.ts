import {SINGULARITY} from './singularity';
import {t} from './i18n';
import type {Race} from './game';
import type {BikeProgress} from './bike-progress';
const icon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-25 12 12)"/><path d="M5 5 3 3m16 16 2 2M4 18l-2 1M20 6l2-1"/></svg>';
export function singularityStats(){return `<div class="garage-ability-stats"><span>${t('ability.singularity.energy',{count:SINGULARITY.energy})}</span><span>${t('ability.singularity.limits',{radius:SINGULARITY.pullRadius,seconds:SINGULARITY.duration})}</span><span>${t('ability.interval',{value:SINGULARITY.cooldown})}</span></div>`;}
export function garageSingularity(_p:BikeProgress,preview:number){return preview===SINGULARITY.tier?`<article class="garage-ability singularity-ability" aria-label="Event Horizon · Singularity"><span class="garage-ability-icon">${icon}</span><div class="garage-ability-copy"><small>${t('ability.signature')}</small><h3>Singularity</h3><p>${t('ability.singularity.short')}</p>${singularityStats()}</div><button class="garage-ability-open" data-action="bikeAbilities" aria-label="${t('ability.all')}"><span aria-hidden="true">↗&#xfe0e;</span></button></article>`:'';}
export function singularityStatus(r:Race){const s=r.combat.singularity;return s.launching?t('ability.singularity.deploying'):s.active?t('ability.singularity.active',{seconds:(Math.ceil((SINGULARITY.duration-s.elapsed)*10)/10).toFixed(1),count:s.absorbed}):s.ready?t('ability.singularity.ready'):t('ability.singularity.charging',{energy:s.energy,count:SINGULARITY.energy})+(s.remaining>1e-8?` · ${Math.ceil(s.remaining)}s`:'');}
export function singularityHud(r:Race){return r.bikeTier===SINGULARITY.tier?`<div id="singularity-control" class="singularity-control"><button id="singularity-trigger" data-action="singularity" aria-label="${t('ability.singularity.use')}" disabled><svg class="singularity-ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="singularity-ring-track" cx="28" cy="28" r="25"/><circle class="singularity-ring-fill" cx="28" cy="28" r="25" pathLength="1"/></svg>${icon}<span class="singularity-bank" aria-hidden="true">1</span></button><small id="singularity-status" class="singularity-status">${singularityStatus(r)}</small></div>`:'';}
type Nodes={first:Element|null;control:HTMLElement;button:HTMLButtonElement;status:HTMLElement};
const cache=new WeakMap<HTMLElement,Nodes>();
export function updateSingularityHud(ui:HTMLElement,r:Race){
 let nodes=cache.get(ui);if(!nodes||nodes.first!==ui.firstElementChild){const control=ui.querySelector<HTMLElement>('#singularity-control'),button=ui.querySelector<HTMLButtonElement>('#singularity-trigger'),status=ui.querySelector<HTMLElement>('#singularity-status');if(!control||!button||!status)return;nodes={first:ui.firstElementChild,control,button,status};cache.set(ui,nodes);}
 const {control,button,status}=nodes,s=r.combat.singularity;
 control.hidden=!!r.training||r.ship.active||!!r.riftTransit||!!r.riftChallenge||!!r.riftCapture;
 button.disabled=!ui.classList.contains('screen-race')||!r.singularityAvailable();
 const mode=s.launching?'launching':s.active?'active':s.ready?'ready':'charging';if(control.dataset.mode!==mode)control.dataset.mode=mode;
 const fill=s.busy?0:Math.min(s.energy/SINGULARITY.energy,1-s.remaining/SINGULARITY.cooldown).toFixed(3);if(button.style.getPropertyValue('--charge')!==String(fill))button.style.setProperty('--charge',String(fill));
 const text=singularityStatus(r);if(status.textContent!==text)status.textContent=text;const label=`${t('ability.singularity.use')} · ${text}`;if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
}
