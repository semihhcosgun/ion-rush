import {t} from './i18n';
import {rewardedAds} from './rewarded-ads';
import {earnNovaAd,novaAdQuota,NOVA_AD_LIMIT} from './nova-ad-reward';
import {writeSave,type Save} from './storage';
import {creditNova} from './nova-wallet';

export function openNovaAdDialog(save:Save,onSaved:()=>void){
  if(document.querySelector('.nova-ad-dialog'))return;
  const dialog=document.createElement('dialog');
  dialog.className='nova-ad-dialog';
  dialog.setAttribute('aria-labelledby','nova-ad-title');
  dialog.innerHTML=`<button class="nova-ad-close" aria-label="${t('common.close')}">×</button><div class="nova-ad-eyebrow">${t('ad.free')}</div><h2 id="nova-ad-title">${t('ad.title')}</h2><p>${t('ad.body')}</p><p class="nova-ad-count"></p><button class="nova-ad-watch" disabled>${t('ad.checking')}</button><p class="nova-ad-status" role="status" aria-live="polite"></p><small>${t('ad.terms')}</small>`;
  const close=dialog.querySelector<HTMLButtonElement>('.nova-ad-close')!;
  const watch=dialog.querySelector<HTMLButtonElement>('.nova-ad-watch')!;
  const count=dialog.querySelector<HTMLElement>('.nova-ad-count')!;
  const message=dialog.querySelector<HTMLElement>('.nova-ad-status')!;
  let busy=false,pendingSave=false,refreshing=false,credited=0;
  function render(){
    const remaining=NOVA_AD_LIMIT-novaAdQuota(save.novaAdQuota).used;
    count.textContent=t('ad.remaining',{count:remaining});
    watch.disabled=busy||(!pendingSave&&(remaining===0||!rewardedAds.current.ready));
    watch.textContent=busy?t('ad.wait'):pendingSave?t('ad.retry'):remaining===0?t('ad.limit'):rewardedAds.current.ready?t('ad.get'):t('ad.notReady');
    close.disabled=busy||pendingSave;
  }
  async function refresh(){
    if(busy||pendingSave||refreshing)return;
    refreshing=true;
    try{await rewardedAds.refresh();if(dialog.open)render();}finally{refreshing=false;}
  }
  function dismiss(){if(busy||pendingSave)return;clearInterval(timer);dialog.close();dialog.remove();}
  close.onclick=dismiss;
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  watch.onclick=async()=>{
    if(busy)return;
    if(!pendingSave&&novaAdQuota(save.novaAdQuota).used>=NOVA_AD_LIMIT)return;
    busy=true;render();message.textContent='';
    try{
      if(!pendingSave){
        const result=await rewardedAds.show();
        if(!result.rewarded){message.textContent=t('ad.noReward');return;}
        const quota=earnNovaAd(save.novaAdQuota);
        if(!quota)return;
        save.novaAdQuota=quota;
        credited=creditNova(save,1);
        pendingSave=true;
      }
      await writeSave(save);
      pendingSave=false;
      onSaved();
      message.textContent=t(credited?'ad.added':'ad.debtSettled');
    }catch{message.textContent=t('ad.saveError');}
    finally{busy=false;render();}
  };
  document.body.append(dialog);
  dialog.showModal();
  const timer=setInterval(()=>void refresh(),2000);
  void refresh();
}
