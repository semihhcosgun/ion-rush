import {t} from './i18n';
import type {Race} from './game';
import type {Sound} from './audio';
import {meteorProfile,meteorImpactDamage} from './meteors';
import './meteor.css';

let lastRace:Race|undefined,warningId=-1,urgentId=-1,impactId=-1;
export function meteorHud(ui:HTMLElement,r:Race,sound:Sound){
 if(lastRace!==r){lastRace=r;warningId=urgentId=impactId=-1;}
 let el=ui.querySelector<HTMLElement>('#meteor-alert');
 if(!el){el=document.createElement('div');el.id='meteor-alert';el.className='meteor-alert';el.innerHTML='<span class="meteor-message" role="status" aria-live="polite"></span><span class="meteor-time" aria-hidden="true"></span>';ui.append(el);}
 const m=r.meteors.items.find(m=>m.age>=0&&m.age<meteorProfile(m).warning),heat=r.meteors.heat;
 el.classList.toggle('visible',!!m||heat>.02);el.classList.toggle('overheat',heat>.02);
 if(m||heat>.02){
  const message=heat>.02?`${t('meteor.heat')} · ${t('meteor.cool')}`:`${m!.targeted?t('meteor.direct'):t('meteor.incoming')} · ${m!.lane<0?t('rift.left'):m!.lane>0?t('rift.right'):t('rift.center')} · ${meteorImpactDamage(m!)} ${t('meteor.damage')}`;
  const time=heat>.02?`${Math.round(heat*100)}%`:`${Math.max(0,meteorProfile(m!).warning-m!.age).toFixed(1)} ${t('common.seconds')}`;
  const messageNode=el.querySelector('.meteor-message')!,timeNode=el.querySelector('.meteor-time')!;
  if(messageNode.textContent!==message)messageNode.textContent=message;
  if(timeNode.textContent!==time)timeNode.textContent=time;
 }
 if(m&&m.id!==warningId){warningId=m.id;sound.play('meteorWarning');}
 if(m&&m.age>meteorProfile(m).warning-.6&&m.id!==urgentId){urgentId=m.id;sound.play('meteorWarning');}
 for(const item of r.meteors.items)if(item.impact&&item.id>impactId){impactId=item.id;sound.play('meteorImpact');}
}
