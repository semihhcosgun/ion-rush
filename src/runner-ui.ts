import {RUNNER} from './runner';
import {OVERDRIVE} from './overdrive';
import {t,getLocale} from './i18n';
import type {BikeProgress} from './bike-progress';
import type {Race} from './game';

const speedIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 5 7 7-7 7m6-14 7 7-7 7M2 8h3m-4 4h4m-3 4h3"/></svg>';
const formats=new Map<string,Intl.NumberFormat>();
const percent=(value:number)=>{const locale=getLocale();let format=formats.get(locale);if(!format){format=new Intl.NumberFormat(locale,{maximumFractionDigits:2});formats.set(locale,format);}return format.format(value);};
export function runnerStats(){return `<div class="garage-ability-stats"><span>${t('ability.runner.perPass',{count:RUNNER.perPass})}</span><span>${t('ability.runner.bank')}</span></div>`;}
export function garageRunner(_p:BikeProgress,preview:number){
 if(preview!==RUNNER.tier)return '';
 return `<article class="garage-ability runner-ability" aria-label="Runner · Momentum"><span class="garage-ability-icon">${speedIcon}</span><div class="garage-ability-copy"><small>${t('ability.signature')}</small><h3>Momentum</h3><p>${t('ability.runner.short')}</p>${runnerStats()}</div><button class="garage-ability-open" data-action="bikeAbilities" aria-label="${t('ability.all')}"><span aria-hidden="true">↗&#xfe0e;</span></button></article>`;
}
export function runnerStatus(r:Race){
 if(r.bikeTier===RUNNER.tier&&r.runnerFlash>0)return t('ability.runner.gained',{count:RUNNER.perPass});
 return r.boost>0?t(r.overdrive.earned>=OVERDRIVE.maxExtra?'ability.runner.max':'ability.runner.active',{percent:percent(r.overdrive.earned*100)}):t(r.bikeTier===RUNNER.tier?'ability.runner.momentum':'ability.runner.ready');
}
export function runnerHud(r:Race){return `<small id="runner-status" class="runner-status" data-active="false" data-gaining="false">${runnerStatus(r)}</small>`;}
export function updateRunnerHud(ui:HTMLElement,r:Race){
 const el=ui.querySelector<HTMLElement>('#runner-status');if(!el)return;
 el.hidden=!!r.training||r.ship.active||!!r.riftTransit;
 el.dataset.active=String(r.boost>0);el.dataset.gaining=String((r.boost>0&&r.overdrive.flash>0)||r.runnerFlash>0);
 const text=runnerStatus(r);if(el.textContent!==text)el.textContent=text;
}
