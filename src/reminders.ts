import {t,type TranslationKey} from './i18n';
import {Capacitor,registerPlugin} from '@capacitor/core';
import type {Save} from './storage';
import './reminders.css';

type Status={enabled:boolean;asked:boolean;allowed:boolean};
interface ReminderPlugin {
 status():Promise<Status>;enable():Promise<Status>;disable():Promise<Status>;
 updateBest(options:{best:number;language:string}):Promise<void>;openSettings():Promise<void>;
}
const native=registerPlugin<ReminderPlugin>('IonReminders');
const available=['android','ios'].includes(Capacitor.getPlatform());
let state:Status={enabled:false,asked:false,allowed:false},ready=false,busy=false;
let message:TranslationKey|''='',lastBest=-1,lastLanguage='';
export function reminderSetting(){
 const on=state.enabled&&state.allowed;
 return `<div class="setting-row"><div><strong>${t('reminder.setting')}</strong><small>${(message?t(message):'')||(!available?t('reminder.android'):!ready?t('reminder.checking'):state.enabled&&!state.allowed?t('reminder.off'):t('reminder.hint'))}</small></div><button class="toggle ${on?'on':''}" data-action="reminders" aria-label="${t('reminder.setting')}" aria-pressed="${on}" ${!available||!ready||busy?'disabled':''}><span></span></button></div>`;
}
export async function refreshReminders(){
 if(!available)return;
 try{state=await native.status();ready=true;if(state.allowed||message==='reminder.unavailable')message='';}catch{ready=false;message='reminder.unavailable';}
}
export function updateReminderBest(save:Save){
 const best=Math.floor(save.journey.distance);
 if(available&&(best!==lastBest||save.language!==lastLanguage)){lastBest=best;lastLanguage=save.language;void native.updateBest({best,language:save.language}).catch(()=>{lastBest=-1;});}
}
export async function toggleReminders(redraw:()=>void){
 if(!available||!ready||busy)return;
 busy=true;message='';redraw();
 try{
  if(state.enabled){state=await native.disable();}
  else{state=await native.enable();if(!state.allowed){message='reminder.allowSettings';await native.openSettings();}}
 }catch{message='reminder.error';}
 finally{busy=false;redraw();}
}
export async function reminderHome(save:Save){
 updateReminderBest(save);await refreshReminders();
 if(!available||!ready||state.allowed||state.asked||save.journey.runs<3||document.body.dataset.screen!=='home'||document.querySelector('dialog[open]'))return;
 showReminderChoice();
}
export function showReminderChoice(){
 if((available&&state.allowed)||document.querySelector('.reminder-choice'))return;
 const dialog=document.createElement('dialog');dialog.className='reminder-choice';
 dialog.setAttribute('aria-labelledby','reminder-title');
 dialog.innerHTML=`<div class="reminder-art" aria-hidden="true"><img src="/textures/reminder-pilot-wave.png" alt=""/></div><div class="reminder-copy"><span class="eyebrow">${t('reminder.eyebrow')}</span><h2 id="reminder-title">${t('reminder.title')}</h2><p>${t('reminder.body')}</p><button class="primary" data-reminder="yes">${t('reminder.allow')} <span aria-hidden="true">↗</span></button><button class="reminder-later" data-reminder="no">${t('reminder.later')}</button><small>${t('reminder.disableHint')}</small><p class="reminder-status" role="status"></p></div>`;
 let submitting=false;
 const choose=async(yes:boolean)=>{
  if(submitting)return;submitting=true;
  dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
  try{
   if(available)state=await (yes?native.enable():native.disable());
   if(yes&&available&&!state.allowed){
    dialog.querySelector('.reminder-status')!.textContent=t('reminder.denied');
    dialog.querySelector<HTMLButtonElement>('[data-reminder="no"]')!.textContent=t('common.gotIt');
    dialog.querySelector<HTMLButtonElement>('[data-reminder="no"]')!.disabled=false;
    submitting=false;return;
   }
   dialog.close();
  }catch{
   dialog.querySelector('.reminder-status')!.textContent=t('reminder.enableError');
   submitting=false;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);
  }
 };
 dialog.addEventListener('click',e=>{const choice=(e.target as Element).closest<HTMLElement>('[data-reminder]');if(choice)void choose(choice.dataset.reminder==='yes');});
 dialog.addEventListener('cancel',e=>{e.preventDefault();void choose(false);});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);dialog.showModal();
}
