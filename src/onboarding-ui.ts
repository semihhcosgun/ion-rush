import {t,type TranslationKey} from './i18n';
import type {FlightLesson} from './onboarding';
import './onboarding.css';

export function clearLessonUI(ui:HTMLElement){
 ui.classList.remove('lesson-active','lesson-graduating');ui.querySelectorAll('.lesson-reminder').forEach(e=>e.classList.remove('lesson-reminder'));ui.querySelector('.flight-coach')?.remove();ui.querySelector('.lesson-handoff')?.remove();
 ui.querySelectorAll('[data-lesson-target]').forEach(e=>{e.removeAttribute('data-lesson-target');e.querySelector('.lesson-hand')?.remove();});
}
export function drawLesson(ui:HTMLElement,lesson:FlightLesson|undefined){
 if(!lesson?.active){if(ui.classList.contains('lesson-active'))clearLessonUI(ui);return;}
 if(lesson.handoff){
  ui.querySelector('.flight-coach')?.remove();
  ui.querySelectorAll('[data-lesson-target]').forEach(e=>{e.removeAttribute('data-lesson-target');e.querySelector('.lesson-hand')?.remove();});
  ui.classList.add('lesson-active','lesson-graduating');
  let banner=ui.querySelector<HTMLElement>('.lesson-handoff');
  if(!banner){banner=document.createElement('section');banner.className='lesson-handoff';banner.innerHTML=`<div class="handoff-copy"><strong>${t('lesson.completeTitle')} · ${t('lesson.yourTurn')}</strong><p>${t('lesson.launching')} <span class="handoff-count" role="status" aria-live="polite"></span></p></div>`;ui.append(banner);}
  const count=banner.querySelector<HTMLElement>('.handoff-count')!,label=lesson.handoff>3?'':String(Math.ceil(lesson.handoff));
  if(count.textContent!==label)count.textContent=label;
  return;
 }
 ui.classList.add('lesson-active');
 const r=lesson.race,step=lesson.step;
 let coach=ui.querySelector<HTMLElement>('.flight-coach');
 if(!coach){coach=document.createElement('section');coach.className='flight-coach';coach.setAttribute('aria-label',t('lesson.title'));ui.append(coach);}
 const charging=step===3&&!r.boostCharge&&!lesson.success;
 const key=(step===0?'lane':step===1?(Math.abs(r.lane)===1?'surface':'edge'):step===2?(lesson.fireStage==='hold'?'fireHold':'fireTrack'):charging?'charge':'turbo');
 const targets=new Map<HTMLElement,string>();
 if(!lesson.success){
  if(step===2){const fire=ui.querySelector<HTMLElement>('#fire');if(fire)targets.set(fire,lesson.fireStage);}
  else if(step===3&&!charging){const turbo=ui.querySelector<HTMLElement>('#turbo');if(turbo)targets.set(turbo,'tap');}
  else if(step<2){
   const direction=step===1&&Math.abs(r.lane)===1?r.lane:0;
   ui.querySelectorAll<HTMLElement>('.steer[data-lane]').forEach(button=>{if(!direction||Number(button.dataset.lane)===direction)targets.set(button,'tap');});
  }
 }
 ui.querySelectorAll<HTMLElement>('[data-lesson-target]').forEach(button=>{if(!targets.has(button)){button.removeAttribute('data-lesson-target');button.classList.remove('lesson-reminder');button.querySelector('.lesson-hand')?.remove();}});
 for(const [button,gesture] of targets){
  button.dataset.lessonTarget=gesture;button.classList.toggle('lesson-reminder',lesson.age>=5);
  if(!button.querySelector('.lesson-hand')){
   const hand=document.createElement('span');hand.className='lesson-hand';hand.setAttribute('aria-hidden','true');
   hand.innerHTML='<svg viewBox="0 0 32 40" fill="none"><path d="M11 21V7a3 3 0 0 1 6 0v10l2-1 4 1 5 4v10l-5 6H12L4 25a3 3 0 0 1 4-4l3 3" fill="#ffe5ba" stroke="#263847" stroke-width="2" stroke-linejoin="round"/></svg><svg class="lesson-drag-arrow" viewBox="0 0 48 14"><path d="M2 7h44M8 1 2 7l6 6M40 1l6 6-6 6" fill="none" stroke="#fff0cf" stroke-width="2"/></svg>';
   button.append(hand);
  }
 }
 const signature=`${key}:${!!lesson.success}`;
 if(coach.dataset.state!==signature){
  coach.dataset.state=signature;coach.classList.toggle('is-success',!!lesson.success);
  coach.innerHTML=`<div class="coach-message" role="status" aria-live="polite"><strong>${step+1}/4 · ${lesson.success?t(step===3||step===2?'lesson.ready':'lesson.nice'):t(`lesson.${key}.title` as TranslationKey)}</strong><p>${lesson.success?t(step===3?'lesson.finished':'lesson.success'):t(`lesson.${key}.body` as TranslationKey)}</p></div><button data-action="skipLesson" aria-label="${t('lesson.skip')}"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="m3 3 12 9L3 21Zm12 0 12 9-12 9Z" fill="currentColor"/><path d="M29 3v18" stroke="currentColor" stroke-width="3"/></svg><span>${t('lesson.skip')}</span></button>`;
 }
}
