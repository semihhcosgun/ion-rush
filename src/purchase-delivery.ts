import {NOVA_PACKS,type PurchaseClaim} from './billing';
import {creditNova,revokeNova,type NovaWallet} from './nova-wallet';

interface Wallet extends NovaWallet {purchaseGrants:string[];purchaseRevocations?:string[]}
interface DeliveryAPI {claims(knownIds:string[]):Promise<PurchaseClaim[]>;completeClaims(ids:string[]):Promise<unknown>;revocations?(knownIds:string[]):Promise<PurchaseClaim[]>}

function validClaims(claims:PurchaseClaim[]){
 const valid=new Map<string,PurchaseClaim>();
 for(const claim of claims){
  if(typeof claim.id==='string'&&claim.id.length>0&&claim.id.length<=512&&
     NOVA_PACKS.some(pack=>pack.id===claim.productId&&pack.nova===claim.nova))valid.set(claim.id,claim);
 }
 return valid;
}

// Serial delivery prevents startup, purchase completion and Ask to Buy updates
// from racing. The store is acknowledged only after the balance is saved.
export function createPurchaseDelivery(wallet:()=>Wallet,persist:()=>Promise<unknown>,api:DeliveryAPI){
 let queue=Promise.resolve(0);
 return ()=>{
  queue=queue.catch(()=>0).then(async()=>{
   const valid=validClaims(await api.claims(wallet().purchaseGrants));
   const save=wallet(),known=new Set(save.purchaseGrants);
   const revoked=new Set(save.purchaseRevocations??[]);
   // A failed refund lookup does not destroy or delay a paid grant. Startup,
   // foreground and store polling retry it independently of purchase delivery.
   const requested=new Set([...known,...valid.keys()]);
   const refunds=validClaims(await api.revocations?.([...requested]).catch(()=>[])??[]);
   const newRefunds=[...refunds.values()].filter(c=>requested.has(c.id)&&!revoked.has(c.id));
   newRefunds.forEach(c=>revoked.add(c.id));
   const fresh=[...valid.values()].filter(claim=>!known.has(claim.id)&&!revoked.has(claim.id));
   const old={nova:save.journey.nova,debt:save.novaDebt,grants:[...save.purchaseGrants],revocations:save.purchaseRevocations?[...save.purchaseRevocations]:undefined};
   const delivered=fresh.reduce((sum,claim)=>sum+creditNova(save,claim.nova),0);
   // Only previously delivered purchases are debited. A refund discovered
   // before first delivery prevents that grant without removing other NOVA.
   newRefunds.filter(c=>known.has(c.id)).forEach(c=>revokeNova(save,c.nova));
   if(fresh.length||newRefunds.length){
    save.purchaseGrants=[...old.grants,...fresh.map(claim=>claim.id)];
    save.purchaseRevocations=[...revoked];
    try{await persist();}
    catch{save.journey.nova=old.nova;save.novaDebt=old.debt;save.purchaseGrants=old.grants;save.purchaseRevocations=old.revocations;throw new Error('save_failed');}
   }
   if(valid.size)await api.completeClaims([...valid.keys()]);
   return delivered;
  });
  return queue;
 };
}
