import type {BillingProduct,NovaProductId,PurchaseResult} from './billing';
import {canSpendNova,NOVA_REVIVE_COST} from './nova';
import type {NovaWallet} from './nova-wallet';

/** A refunded balance is settled before a new pack can fund a continue. */
export function recoveryOffer(wallet:NovaWallet,products:readonly BillingProduct[]){
 const missing=Math.max(0,NOVA_REVIVE_COST-wallet.journey.nova)+(wallet.novaDebt??0);
 return products.filter(p=>p.available&&p.nova>=missing).sort((a,b)=>a.nova-b.nova)[0];
}

type RecoveryResult={status:'restored'|'busy'|'stale'|'notEnough'|'pending'|'cancelled'|'failed'|'deliveryRetry'|'saveFailed';reason?:string};
interface RecoveryAPI<R>{
 wallet():NovaWallet;
 canRestore(run:R):boolean;
 restore(run:R):boolean;
 persist():Promise<unknown>;
 purchase(product:NovaProductId):Promise<PurchaseResult>;
 deliver():Promise<unknown>;
 prepare():Promise<unknown>;
 busyChanged?(busy:boolean):void;
}

/** Keep the same run while paying; only a saved wallet debit can resume it. */
export function createNovaRecovery<R>(api:RecoveryAPI<R>){
 let busy=false;
 return {
  get busy(){return busy;},
  async continue(run:R,product?:NovaProductId):Promise<RecoveryResult>{
   if(busy)return {status:'busy'};
   if(!api.canRestore(run))return {status:'stale'};
   busy=true;api.busyChanged?.(true);
   try{
    await api.prepare();
    if(!api.canRestore(run))return {status:'stale'};
    if(!canSpendNova(api.wallet().journey.nova)){
     if(!product)return {status:'notEnough'};
     let payment:PurchaseResult;
     try{payment=await api.purchase(product);}catch{return {status:'failed'};}
     if(payment.pending)return {status:'pending'};
     if(!payment.purchased)return {status:payment.reason==='cancelled'?'cancelled':'failed',reason:payment.reason};
     try{await api.deliver();}catch{return {status:'deliveryRetry'};}
     // Delayed confirmations credit the wallet elsewhere, without reviving
     // an abandoned run or deducting its continue cost automatically.
     if(!api.canRestore(run))return {status:'stale'};
     if(!canSpendNova(api.wallet().journey.nova))return {status:'deliveryRetry'};
    }
    const wallet=api.wallet();
    wallet.journey.nova-=NOVA_REVIVE_COST;
    try{await api.persist();}
    catch{wallet.journey.nova+=NOVA_REVIVE_COST;return {status:'saveFailed'};}
    if(api.canRestore(run)&&api.restore(run))return {status:'restored'};
    // A run that became invalid during the write must not consume currency.
    wallet.journey.nova+=NOVA_REVIVE_COST;
    await api.persist();
    return {status:'stale'};
   }finally{busy=false;api.busyChanged?.(false);}
  }
 };
}
