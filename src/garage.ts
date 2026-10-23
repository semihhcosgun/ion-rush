import {BIKE_TIERS,masteryXp,type BikeProgress} from './bike-progress';
import {garageIgnition} from './ignition-ui';
import {garageRunner} from './runner-ui';
import {garageHunter} from './hunter-ui';
import {garageVanguard} from './vanguard-ui';
import {garageTitan} from './titan-ui';
import {garageSingularity} from './singularity-ui';
import {garagePhantom} from './phantom-ui';
import {t,formatNumber as fmt} from './i18n';

const BADGE_ART=['01-rookie','02-ignition','03-runner','04-hunter','05-vanguard','06-titan','07-phantom','08-event-horizon'] as const;
function badgeImage(level:number,className:string){return `<img class="${className}" src="/badges/${BADGE_ART[level]}.webp" width="128" height="128" alt="" aria-hidden="true" decoding="async" draggable="false">`;}
export function badge(level:number,_scope='tile'){return badgeImage(level,'rank-badge');}
const lockIcon='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="5" y="9" width="10" height="8" rx="2"/><path d="M7 9V6a3 3 0 0 1 6 0v3m-3 3v2"/></svg>';
const activeIcon='<svg class="garage-active-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 2 7 4v8l-7 4-7-4V6l7-4Z"/><path class="garage-active-core" d="m10 6 1.2 2.8L14 10l-2.8 1.2L10 14l-1.2-2.8L6 10l2.8-1.2L10 6Z"/></svg>';
const localIcon='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 2 6 2v5c0 4-6 8-6 8S4 13 4 9V4l6-2Z"/><path d="m7 9 2 2 4-4"/></svg>';
const rotateIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9a8 8 0 1 1-.5 5M5 4v5h5"/></svg>';
export function garageMarkup(p:BikeProgress,preview=p.selected){
 const ability=garageIgnition(p,preview)||garageRunner(p,preview)||garageHunter(p,preview)||garageVanguard(p,preview)||garageTitan(p,preview)||garagePhantom(p,preview)||garageSingularity(p,preview);
 const tier=BIKE_TIERS[preview],xp=masteryXp(p),next=BIKE_TIERS[Math.min(7,p.unlocked+1)],unlocked=preview<=p.unlocked;
 const needed=unlocked&&p.unlocked<7?next:tier,complete=p.unlocked===7&&unlocked;
 const progress=Math.floor(100*(complete?1:Math.max(0,Math.min(1,p.best/needed.distance,needed===BIKE_TIERS[7]?1:xp/needed.xp))));
 const meter=(label:string,value:number,target:number,suffix='')=>`<div class="garage-metric ${value>=target?'is-complete':''}"><div><span>${label}</span><strong>${fmt(Math.min(value,target))}<span> / ${fmt(target)}${suffix}</span></strong></div><progress max="${Math.max(1,target)}" value="${Math.min(value,target)}" aria-label="${label}"></progress></div>`;
 return `<main class="garage" style="--rank:${tier.color};--rank-glow:${tier.color}22;--rank-edge:${tier.color}66">
 <section class="garage-stage" aria-label="${t('garage.rotate')}">
  <div class="garage-viewport" aria-hidden="true"></div>
  <div class="garage-stage-heading"><div><span class="eyebrow">${t('garage.title')}</span><p>${t('garage.rotate')}</p></div><span class="garage-stage-index" aria-hidden="true">${String(preview+1).padStart(2,'0')}<i> / 08</i></span></div>
  <div class="garage-display" aria-hidden="true"><span class="garage-display-mark left"></span><span class="garage-display-mark right"></span><span class="garage-calibration"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></div>
  <div class="garage-turntable" tabindex="0" role="slider" aria-label="${t('garage.rotate')}" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="0"></div>
  <div class="garage-model ${preview>0?'is-evolved':''}"><span>${t('garage.level',{level:preview+1})}</span><strong>${tier.model}</strong><small>${t('garage.lookOnly')}</small></div>
  <div class="garage-rotate-actions"><button data-action="garageRotate" data-turn="-.4" aria-label="${t('garage.left')}">${rotateIcon}</button><span>360°</span><button data-action="garageRotate" data-turn=".4" aria-label="${t('garage.right')}">${rotateIcon}</button></div>
 </section>
 <section class="garage-panel ${unlocked?'is-unlocked':'is-locked'}" aria-label="${t('garage.progress')}">
  <div class="garage-panel-body"><span class="garage-rank-watermark" aria-hidden="true">${String(preview+1).padStart(2,'0')}</span>
   <div class="garage-rank"><span class="garage-hero-badge">${badge(preview,'hero')}</span><div class="garage-rank-copy"><div class="garage-rank-meta"><small class="garage-status">${unlocked?activeIcon:lockIcon}${t(unlocked?'garage.unlocked':'garage.locked')}</small><span class="garage-rank-level">${t('garage.level',{level:preview+1})}</span></div><h2>${tier.name}</h2><span class="garage-xp"><i aria-hidden="true"></i>${fmt(xp)} <b>${t('garage.xp')}</b></span></div></div>
   ${ability||`<p class="garage-upgrade">${t((['garage.form0','garage.form1','garage.form2','garage.form3','garage.form4','garage.form5','garage.form6','garage.form7'] as const)[preview])}</p>`}${ability?'':`<button class="garage-catalog-trigger" data-action="bikeAbilities">${t('ability.all')} ↗&#xfe0e;</button>`}
   <div class="garage-goal"><div class="garage-goal-heading"><h3><i aria-hidden="true"></i>${complete?t('garage.complete'):t('garage.next',{name:needed.name})}</h3><span class="garage-goal-percent" aria-hidden="true">${fmt(progress)}<b>%</b></span></div>${complete?`<p>${t('garage.completeBody')}</p>`:`<div class="garage-meters ${needed===BIKE_TIERS[7]?'is-distance-only':''}">${(needed===BIKE_TIERS[7]?'':meter(t('garage.mastery'),xp,needed.xp))+meter(t('garage.record'),p.best,needed.distance,' m')}</div>`}</div>
   <details class="garage-earn"><summary>${t('garage.earn')}<span aria-hidden="true">+</span></summary><p>${t('garage.earnBody')}</p></details>
  </div>
  <div class="garage-panel-footer"><button class="garage-equip primary ${p.selected===preview?'is-equipped':''}" data-action="garageEquip" data-tier="${preview}" ${!unlocked||p.selected===preview?'disabled':''}>${!unlocked?`<i class="garage-equip-icon">${lockIcon}</i>`:p.selected===preview?`<i class="garage-equip-icon">${activeIcon}</i>`:'<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>'}<span>${t(!unlocked?'garage.locked':p.selected===preview?'garage.equipped':'garage.equip')}</span></button><small class="garage-local">${localIcon}${t('garage.local')}</small></div>
 </section>
 <nav class="garage-tiers" aria-label="${t('garage.evolutions')}">${BIKE_TIERS.map((b,i)=>`<button class="garage-tier ${i===preview?'is-preview':''} ${i<=p.unlocked?'is-unlocked':''} ${i===p.selected?'is-equipped':''}" style="--rank:${b.color};--rank-glow:${b.color}22;--rank-edge:${b.color}66" data-action="garagePreview" data-tier="${i}" ${i>p.unlocked?'disabled':''} aria-pressed="${i===preview}" aria-label="${b.name}: ${t(i<=p.unlocked?'garage.unlocked':'garage.locked')}"><span class="garage-tier-code" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="garage-tier-state">${i<=p.unlocked?activeIcon:lockIcon}</span>${badge(i)}<span class="garage-tier-name">${b.name}</span><small>${i===p.selected?t('garage.equipped'):i<=p.unlocked?t('garage.unlocked'):t('garage.locked')}</small></button>`).join('')}</nav>
 </main>`;
}
function homeBadge(level:number){return badgeImage(level,'garage-insignia');}
export function garageHome(p:BikeProgress){
 const rank=BIKE_TIERS[p.unlocked],next=BIKE_TIERS[p.unlocked+1];
 const progress=next?Math.min(1,p.best/next.distance,next===BIKE_TIERS[7]?1:masteryXp(p)/next.xp):1;
 const title=`${t('garage.title')} · ${rank.name} · ${t('garage.level',{level:p.unlocked+1})}`;
 return `<button class="home-garage" data-action="garage" aria-label="${title}" style="--rank:${rank.color};--garage-glow:${rank.color}33;--garage-edge:${rank.color}77"><span class="garage-insignia-mount">${homeBadge(p.unlocked)}</span><span class="home-garage-copy"><small>${t('garage.title')}</small><strong>${rank.name}</strong><span class="home-garage-track" aria-hidden="true">${BIKE_TIERS.map((_,i)=>`<i class="${i<=p.unlocked?'is-earned':''}" style="--fill:${i<=p.unlocked?100:i===p.unlocked+1?Math.round(progress*100):0}%"></i>`).join('')}</span></span><svg class="home-garage-chevron" viewBox="0 0 12 20" fill="none" aria-hidden="true"><path d="m3 4 6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
}
export function garageRun(p:BikeProgress){const next=BIKE_TIERS[p.unlocked+1];return `<button class="run-garage" data-action="garage">${badge(p.unlocked)}<span><strong>${BIKE_TIERS[p.unlocked].name} · ${t('garage.level',{level:p.unlocked+1})}</strong><small>${next?(next===BIKE_TIERS[7]?`${t('garage.record')}: ${fmt(p.best)} / ${fmt(next.distance)} m`:t('garage.runProgress',{xp:fmt(masteryXp(p)),target:fmt(next.xp),name:next.name})):t('garage.complete')}</small></span><b>↗&#xfe0e;</b></button>`;}
