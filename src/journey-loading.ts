import {t} from './i18n';

export function journeyLoadingMarkup(routeName:string){
  return `<section class="launch-panel" aria-label="${t('loading.title')}">
    <div class="launch-art" aria-hidden="true"></div>
    <img class="launch-wordmark" src="/ion-rush-wordmark.png" width="1024" height="366" alt="ION RUSH" />
    <div class="launch-copy">
      <div class="launch-origin"><i aria-hidden="true"></i>${t('loading.departure',{planet:routeName})}</div>
      <h2>${t('loading.title')}</h2>
      <p>${t('loading.tip')}</p>
    </div>
    <div class="launch-rail" aria-hidden="true"><i></i></div>
    <div class="launch-progress" id="launch-progress" role="progressbar" aria-label="${t('loading.studio')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="launch-progress-top"><span id="loadtext">${t('loading.initializing')}</span><b id="loadpercent">0%</b></div>
      <div class="launch-progress-track"><i></i></div>
    </div>
  </section>`;
}

export function updateJourneyLoading(ui:HTMLElement,progress:number,label:string){
  const panel=ui.querySelector<HTMLElement>('.launch-panel');
  if(!panel)return;
  const value=Math.max(0,Math.min(1,progress));
  panel.style.setProperty('--launch-progress',String(value));
  const percent=Math.round(value*100);
  ui.querySelector('#launch-progress')?.setAttribute('aria-valuenow',String(percent));
  ui.querySelector('#loadtext')!.textContent=label||t('loading.track');
  ui.querySelector('#loadpercent')!.textContent=percent+'%';
}
