import type {BillingStatus} from './billing';
import {t} from './i18n';
import {canSpendNova,NOVA_REVIVE_COST} from './nova';
import {recoveryOffer} from './nova-recovery';
import type {NovaWallet} from './nova-wallet';

const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function novaRecoveryButton(wallet:NovaWallet,status:BillingStatus,busy=false,paymentPending=false){
 const canPay=canSpendNova(wallet.journey.nova),offer=recoveryOffer(wallet,status.products);
 const disabled=busy||!canPay&&(!offer||paymentPending);
 const title=busy?t('recovery.processing'):paymentPending&&!canPay?t('recovery.pendingLabel'):canPay?t('run.continue',{cost:NOVA_REVIVE_COST}):t('recovery.buyContinue');
 const detail=canPay?t('run.vault',{count:wallet.journey.nova}):offer?t('recovery.pack',{count:offer.nova,cost:NOVA_REVIVE_COST,left:wallet.journey.nova+offer.nova-(wallet.novaDebt??0)-NOVA_REVIVE_COST}):t(status.ready||status.reason==='not_configured'?'store.unavailable':'store.connecting');
 return `<button class="nova-continue ${canPay?'':'nova-buy-continue'}" data-action="${canPay?'reviveNova':'buyContinue'}" ${offer&&!canPay?`data-product="${offer.id}"`:''} ${disabled?'disabled':''}><span class="run-nova-icon" aria-hidden="true"><img src="/textures/nova-store-core.png" alt=""/></span><span><strong>${escape(title)}</strong><small>${escape(detail)}</small></span>${!canPay&&offer?`<b class="recovery-price">${escape(offer.price)}</b>`:''}</button>`;
}
