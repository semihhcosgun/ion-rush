import {t,upper,formatNumber} from './i18n';
import {ALIEN_KINDS,alienLore,type AlienLog} from './alien-catalog';
import {ENEMY_TYPES} from './config';
export function alienArchive(log:AlienLog){
 const found=ALIEN_KINDS.filter(k=>log[k]?.seen).length,mastered=ALIEN_KINDS.filter(k=>(log[k]?.kills??0)>0).length;
 return `<section class="alien-content"><div class="alien-heading"><div><small>${t('archive.guide')}</small><h2>${t('archive.title')}</h2></div><p>${t('archive.intro',{found,total:ALIEN_KINDS.length,mastered})}</p></div><div class="alien-grid">${ALIEN_KINDS.map((kind,index)=>{
  const def=ENEMY_TYPES[kind],lore=alienLore(kind),entry=log[kind],known=entry?.seen;
  return `<article class="alien-card ${known?'discovered':'unidentified'}" data-alien-kind="${kind}" data-action="flipAlien" role="button" tabindex="0" aria-pressed="false" aria-label="${t('archive.flip',{name:known?lore.name:t('archive.unknown')})}" style="--alien:#${def.color.toString(16).padStart(6,'0')}"><div class="alien-front"><div class="alien-top"><span>${t('archive.class')} ${String(index+1).padStart(2,'0')} / ${lore.rarity}</span><span>${known?'◈':'◇'}</span></div><div class="alien-art"><img src="/textures/alien-${kind}.png" alt="${known?lore.name:t('archive.lockedTitle')}"/>${known?'':`<div class="alien-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14.5v2.5"/></svg><strong>${t('archive.locked')}</strong><small>${t('archive.reach',{distance:formatNumber(def.unlock)})}</small></div>`}<span>${known?lore.role:t('archive.encrypted')}</span></div><div class="alien-info"><small>${upper(lore.region)} · ${formatNumber(def.unlock)} M+</small><h3>${known?lore.name:t('archive.unknown')}</h3><div class="alien-flip-hint">${t('archive.intel')}</div></div></div><div class="alien-back" hidden><h3>${known?lore.name:t('archive.unknown')}</h3><p class="alien-description">${known?lore.detail:t('archive.unknownBody')}</p><div class="alien-stats"><span><small>${t('archive.armour')}</small><b>${known?def.hp:'?'}</b></span><span><small>${t('archive.reward')}</small><b>${known?def.points:'?'} <em>${t('common.points')}</em></b></span><span><small>${t('archive.destroyed')}</small><b>${entry?.kills??0}</b></span></div><div class="alien-counter"><small>${known?t('archive.evade'):t('archive.lockedTitle')}</small><p>${known?lore.counter:t('archive.keepExploring')}</p></div><div class="alien-bonus">${entry?.kills?t('archive.claimed'):t('archive.bonus',{points:def.points})}</div><div class="alien-flip-hint">${t('archive.return')}</div></div></article>`;
 }).join('')}</div></section>`;
}

export function flipAlienCard(card:HTMLElement){
 const back=card.querySelector<HTMLElement>('.alien-back'),front=card.querySelector<HTMLElement>('.alien-front');
 if(!back||!front)return;
 const flipped=card.getAttribute('aria-pressed')!=='true';
 card.setAttribute('aria-pressed',String(flipped));
 front.hidden=flipped;back.hidden=!flipped;
}