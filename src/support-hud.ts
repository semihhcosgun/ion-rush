import type {Race} from './game';
import {EARTH_SUPPORT} from './earth-support';
import {t,formatNumber} from './i18n';
import './support.css';

const emblem='<svg viewBox="0 0 48 40" fill="none" aria-hidden="true"><path d="M24 3 27 15 35 22v3l-9-3v7l3 3v2l-5-2-5 2v-2l3-3v-7l-9 3v-3l8-7 3-12Z" fill="currentColor"/><path d="m10 12 2 9 6 5v2l-7-2v5l2 2v2l-3-1-3 1v-2l2-2v-5l-7 2v-2l6-5 2-9Zm28 0 2 9 6 5v2l-7-2v5l2 2v2l-3-1-3 1v-2l2-2v-5l-7 2v-2l6-5 2-9Z" fill="currentColor" opacity=".55"/><path d="M23.5 11v8" stroke="#10232c" stroke-width="1.3" stroke-linecap="round"/></svg>';

export function supportHud(){return `<div class="earth-support-control" id="earth-support-control"><button class="earth-support" id="earth-support" data-action="earthSupport" disabled aria-label="${t('support.name')}"><svg class="support-ring" viewBox="0 0 64 64" aria-hidden="true"><path class="support-dial-ticks" d="M32 0v2M32 62v2M0 32h2M62 32h2M9.4 9.4l1.4 1.4M53.2 53.2l1.4 1.4M9.4 54.6l1.4-1.4M53.2 10.8l1.4-1.4"/><circle class="support-ring-track" cx="32" cy="32" r="29"/><circle class="support-ring-fill" cx="32" cy="32" r="29" pathLength="100"/></svg><span class="support-emblem">${emblem}</span><span class="support-button-label">${t('support.short')}</span></button><span id="support-status" class="support-status"></span><div class="support-ready-tip" id="support-ready-tip" role="status" aria-live="polite" hidden><strong>${t('support.readyIntro')}</strong><span>${t('support.readyAction')}</span></div></div><div class="support-radio" id="support-radio" role="status" aria-live="polite" hidden><span class="support-radio-header">${t('support.channel')}<b>3 / 3</b></span><strong id="support-radio-message"></strong><span class="support-radio-footer"><span id="support-cover"></span><span id="support-time"></span></span></div>`;}
const readyTips=new WeakMap<Race,{ready:boolean;until:number}>();
type HudNodes={tip:HTMLElement;first:Element|null;button:HTMLButtonElement;control:HTMLElement;status:HTMLElement;radio:HTMLElement;wings:HTMLElement;message:HTMLElement;cover:HTMLElement;time:HTMLElement};
const hudNodes=new WeakMap<HTMLElement,HudNodes>();
function supportNodes(ui:HTMLElement){
 let nodes=hudNodes.get(ui);if(nodes&&nodes.first===ui.firstElementChild)return nodes;
 const button=ui.querySelector<HTMLButtonElement>('#earth-support'),control=ui.querySelector<HTMLElement>('#earth-support-control');if(!button||!control)return;
 const find=(id:string)=>ui.querySelector<HTMLElement>(id)!;
 const radio=find('#support-radio');nodes={tip:find('#support-ready-tip'),first:ui.firstElementChild,button,control,status:find('#support-status'),radio,wings:radio.querySelector('b')!,message:find('#support-radio-message'),cover:find('#support-cover'),time:find('#support-time')};hudNodes.set(ui,nodes);return nodes;
}
function textIfChanged(node:HTMLElement,text:string){if(node.textContent!==text)node.textContent=text;}
export function updateSupportHud(ui:HTMLElement,r:Race){
 const nodes=supportNodes(ui);if(!nodes)return;
 const {button,control,status,radio}=nodes,s=r.support;
 let tip=readyTips.get(r);if(!tip){tip={ready:false,until:0};readyTips.set(r,tip);}
 if(s.ready&&!tip.ready)tip.until=r.time+5;
 tip.ready=s.ready;
 const tipHidden=!s.ready||r.time>=tip.until||!!r.training||!ui.classList.contains('screen-race');
 if(nodes.tip.hidden!==tipHidden)nodes.tip.hidden=tipHidden;
 const hidden=!!r.training;if(control.hidden!==hidden)control.hidden=hidden;
 const mode=!s.unlocked?'locked':s.active?'active':s.ready?'ready':'charging';
 if(button.dataset.state!==mode)button.dataset.state=mode;
 const disabled=!ui.classList.contains('screen-race')||!s.available(r);if(button.disabled!==disabled)button.disabled=disabled;
 const fill=String(s.active?s.remaining/EARTH_SUPPORT.duration*100:s.charge*100);
 if(button.style.getPropertyValue('--support-fill')!==fill)button.style.setProperty('--support-fill',fill);
 const label=!s.unlocked?t('support.locked',{distance:formatNumber(EARTH_SUPPORT.unlockDistance)}):s.active?t('support.onStation'):s.ready?t('support.ready'):t('support.charging',{percent:Math.floor(s.charge*100)});
 textIfChanged(status,label);
 const aria=t('support.name')+' · '+label;if(button.getAttribute('aria-label')!==aria)button.setAttribute('aria-label',aria);
 const title=t('support.hint',{seconds:EARTH_SUPPORT.rechargeSeconds});if(button.title!==title)button.title=title;
 if(radio.hidden!==!s.active)radio.hidden=!s.active;ui.classList.toggle('support-active',s.active);
 if(s.active){
  textIfChanged(nodes.wings,s.wings.filter(w=>w.hp>0).length+' / '+s.wings.length);
  textIfChanged(nodes.message,t(s.elapsed<2.2?'support.radioArrival':s.remaining<1.5?'support.radioDeparture':'support.radioCover'));
  textIfChanged(nodes.cover,t(s.guard?'support.guardAvailable':'support.guardSpent',{count:s.guard}));
  textIfChanged(nodes.time,Math.ceil(s.remaining)+' S');
 }
}
