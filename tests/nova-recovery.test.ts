import test from 'node:test';
import assert from 'node:assert/strict';
import {createNovaRecovery,recoveryOffer} from '../src/nova-recovery';
import {novaRecoveryButton} from '../src/nova-recovery-ui';
import {createPurchaseDelivery} from '../src/purchase-delivery';
import {Race} from '../src/game';
import {SURVIVAL} from '../src/config';
import {setLocale} from '../src/i18n';
import {catalogs} from '../src/locales';
import type {BillingProduct,PurchaseClaim,PurchaseResult} from '../src/billing';

const products:BillingProduct[]=[{id:'example_nova_40',nova:40,price:'₺99,99',available:true},{id:'example_nova_5',nova:5,price:'₺9,99',available:true},{id:'example_nova_15',nova:15,price:'₺39,99',available:true}];
function fixture(balance=0){
 const wallet={journey:{nova:balance},purchaseGrants:[] as string[],novaDebt:0};
 const run=new Race(65);run.z=1275;run.score=200;run.energy=8;run.failed=true;run.health=0;
 let current=run,failSave=false,payment:PurchaseResult={purchased:true},failAck=false,purchases=0,restores=0,claim:PurchaseClaim|undefined;
 const writes:number[]=[],calls:string[]=[];
 const deliver=createPurchaseDelivery(()=>wallet,async()=>{calls.push('grant-save');writes.push(wallet.journey.nova);},{claims:async()=>claim?[claim]:[],completeClaims:async()=>{if(failAck)throw Error('ack');claim=undefined;}});
 const recovery=createNovaRecovery({wallet:()=>wallet,canRestore:r=>r===current&&r.failed&&r.revives<SURVIVAL.maxRevives,restore:r=>{restores++;calls.push('revive');return r.revive();},persist:async()=>{calls.push('debit-save');if(failSave)throw Error('disk');writes.push(wallet.journey.nova);},prepare:async()=>{},purchase:async()=>{purchases++;calls.push('purchase');if(payment.purchased)claim={id:'apple-test-1',nova:5,productId:'example_nova_5'};return payment;},deliver});
 return {wallet,run,recovery,writes,calls,deliver,get purchases(){return purchases;},get restores(){return restores;},set payment(p:PurchaseResult){payment=p;},set failSave(v:boolean){failSave=v;},set failAck(v:boolean){failAck=v;},abandon(){current=new Race(66);}};
}

test('direct purchase delivers once, saves one-NOVA debit, then revives the same run',async()=>{
 const f=fixture();assert.deepEqual(await f.recovery.continue(f.run,'example_nova_5'),{status:'restored'});
 assert.equal(f.wallet.journey.nova,4);assert.deepEqual(f.writes,[5,4]);assert.deepEqual(f.calls,['purchase','grant-save','debit-save','revive']);
 assert.equal(f.run.failed,false);assert.equal(f.run.revives,1);assert.equal(f.run.z,1275);assert.equal(f.run.score,200);assert.equal(f.run.energy,8);assert.equal(f.run.invulnerable,SURVIVAL.reviveGrace);
 assert.deepEqual(await f.recovery.continue(f.run,'example_nova_5'),{status:'stale'});assert.equal(f.purchases,1);assert.equal(f.restores,1);
});
test('existing NOVA spends one without opening a payment even if an offer was tapped before a delayed credit',async()=>{
 const f=fixture(3);assert.equal((await f.recovery.continue(f.run,'example_nova_5')).status,'restored');assert.equal(f.wallet.journey.nova,2);assert.equal(f.purchases,0);
});
test('cancellation, pending approval and network failures keep the run and wallet untouched',async()=>{
 for(const [payment,status] of [[{purchased:false,reason:'cancelled'},'cancelled'],[{purchased:false,pending:true},'pending'],[{purchased:false,reason:'network_error'},'failed']] as const){
  const f=fixture();f.payment=payment;assert.equal((await f.recovery.continue(f.run,'example_nova_5')).status,status);assert.equal(f.run.failed,true);assert.equal(f.run.revives,0);assert.equal(f.wallet.journey.nova,0);assert.deepEqual(f.writes,[]);assert.equal(f.recovery.busy,false);
 }
});
test('no pack, exhausted recoveries, and a stale run never start a payment or charge currency',async()=>{
 const f=fixture();assert.equal((await f.recovery.continue(f.run)).status,'notEnough');f.run.revives=SURVIVAL.maxRevives;assert.equal((await f.recovery.continue(f.run,'example_nova_5')).status,'stale');assert.equal(f.purchases,0);assert.equal(f.wallet.journey.nova,0);
});
test('double taps cannot start overlapping purchases or consume two recoveries',async()=>{
 const f=fixture();const first=f.recovery.continue(f.run,'example_nova_5');assert.equal(f.recovery.busy,true);
 assert.equal((await f.recovery.continue(f.run,'example_nova_5')).status,'busy');assert.equal((await first).status,'restored');assert.equal(f.purchases,1);assert.equal(f.restores,1);assert.equal(f.wallet.journey.nova,4);
});
test('a failed continue save preserves paid NOVA and allows a retry without another purchase',async()=>{
 const f=fixture();f.failSave=true;assert.equal((await f.recovery.continue(f.run,'example_nova_5')).status,'saveFailed');assert.equal(f.wallet.journey.nova,5);assert.equal(f.run.failed,true);assert.equal(f.run.revives,0);
 f.failSave=false;assert.equal((await f.recovery.continue(f.run)).status,'restored');assert.equal(f.wallet.journey.nova,4);assert.equal(f.purchases,1);
});
test('acknowledgment retry does not spend a recovery or grant the same purchase twice',async()=>{
 const f=fixture();f.failAck=true;assert.equal((await f.recovery.continue(f.run,'example_nova_5')).status,'deliveryRetry');assert.equal(f.wallet.journey.nova,5);assert.equal(f.run.failed,true);
 f.failAck=false;await f.deliver();assert.equal(f.wallet.journey.nova,5);assert.equal((await f.recovery.continue(f.run)).status,'restored');assert.equal(f.wallet.journey.nova,4);assert.equal(f.purchases,1);
});
test('a payment confirmed after leaving its run credits NOVA without reviving or spending',async()=>{
 const f=fixture();const first=f.recovery.continue(f.run,'example_nova_5');await Promise.resolve();f.abandon();assert.equal((await first).status,'stale');assert.equal(f.wallet.journey.nova,5);assert.equal(f.run.revives,0);assert.equal(f.restores,0);
});
test('a run invalidated during durable debit is refunded and not revived',async()=>{
 const wallet={journey:{nova:2}};let valid=true;const writes:number[]=[];
 const c=createNovaRecovery({wallet:()=>wallet,canRestore:()=>valid,restore:()=>{throw Error('must not revive');},persist:async()=>{writes.push(wallet.journey.nova);valid=false;},prepare:async()=>{},purchase:async()=>({purchased:false}),deliver:async()=>{}});
 assert.equal((await c.continue({})).status,'stale');assert.equal(wallet.journey.nova,2);assert.deepEqual(writes,[1,2]);
});
test('offers choose the smallest available pack that also settles refund debt',()=>{
 assert.equal(recoveryOffer({journey:{nova:0}},products)?.id,'example_nova_5');
 assert.equal(recoveryOffer({journey:{nova:0},novaDebt:5},products)?.id,'example_nova_15');
 assert.equal(recoveryOffer({journey:{nova:0}},products.filter(p=>p.nova!==5))?.id,'example_nova_15');
 assert.equal(recoveryOffer({journey:{nova:0},novaDebt:40},products),undefined);
 assert.equal(recoveryOffer({journey:{nova:0}},products.map(p=>({...p,available:false}))),undefined);
});
test('a pack that only settles debt cannot consume a recovery',async()=>{
 const f=fixture();f.wallet.novaDebt=5;assert.equal((await f.recovery.continue(f.run,'example_nova_5')).status,'deliveryRetry');assert.equal(f.wallet.journey.nova,0);assert.equal(f.wallet.novaDebt,0);assert.equal(f.restores,0);
});
test('recovery CTA uses the store price and explains pack, cost and remainder in all six languages',()=>{
 try{for(const locale of Object.keys(catalogs)){
  setLocale(locale);const html=novaRecoveryButton({journey:{nova:0}},{ready:true,configured:true,products});
  assert.match(html,/data-action="buyContinue"/);assert.match(html,/data-product="example_nova_5"/);assert.match(html,/₺9,99/);assert.match(html,/5 NOVA/);assert.match(html,/4/);assert.doesNotMatch(html,/disabled|\{\w+\}/);
  const funded=novaRecoveryButton({journey:{nova:2}},{ready:true,configured:true,products});assert.match(funded,/data-action="reviveNova"/);assert.doesNotMatch(funded,/recovery-price/);
  assert.match(novaRecoveryButton({journey:{nova:0}},{ready:false,configured:false,products:[]}),/disabled/);
 }}finally{setLocale('en');}
});

test('a pending payment disables repeat purchase, while already credited NOVA stays usable',()=>{
 setLocale('en');const status={ready:true,configured:true,products};
 const pending=novaRecoveryButton({journey:{nova:0}},status,false,true);assert.match(pending,/PAYMENT PENDING/);assert.match(pending,/disabled/);
 const funded=novaRecoveryButton({journey:{nova:5}},status,false,true);assert.match(funded,/data-action="reviveNova"/);assert.doesNotMatch(funded,/disabled|PAYMENT PENDING/);
});
