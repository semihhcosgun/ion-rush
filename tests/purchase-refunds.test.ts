import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseDelivery} from '../src/purchase-delivery';
import {creditNova,type NovaWallet} from '../src/nova-wallet';
import type {PurchaseClaim} from '../src/billing';

const purchase:PurchaseClaim={id:'google-1',productId:'example_nova_5',nova:5};
function setup(nova=14){
 const wallet={journey:{nova},purchaseGrants:[purchase.id],purchaseRevocations:[] as string[],novaDebt:0};
 let refunds:PurchaseClaim[]=[purchase],pending:PurchaseClaim[]=[],fail=false,writes=0;
 const api={claims:async()=>pending,revocations:async()=>refunds,completeClaims:async()=>{}};
 const persist=async()=>{if(fail)throw new Error('disk full');writes++;};
 return {wallet,api,persist,deliver:createPurchaseDelivery(()=>wallet,persist,api),refunds:(value:PurchaseClaim[])=>{refunds=value;},pending:(value:PurchaseClaim[])=>{pending=value;},fail:(value:boolean)=>{fail=value;},writes:()=>writes};
}
test('a confirmed refund removes exactly five NOVA once, including after restart',async()=>{
 const s=setup();await Promise.all([s.deliver(),s.deliver()]);
 assert.equal(s.wallet.journey.nova,9);assert.deepEqual(s.wallet.purchaseRevocations,[purchase.id]);assert.equal(s.writes(),1);
 const next=createPurchaseDelivery(()=>s.wallet,s.persist,s.api);await next();assert.equal(s.wallet.journey.nova,9);
});
test('consumed purchases missing from the active store list do not imply a refund',async()=>{
 const s=setup();s.refunds([]);await s.deliver();assert.equal(s.wallet.journey.nova,14);assert.equal(s.writes(),0);
});
test('a refund arriving before first delivery suppresses the grant without taking other NOVA',async()=>{
 const s=setup(3);s.wallet.purchaseGrants=[];s.pending([purchase]);await s.deliver();assert.equal(s.wallet.journey.nova,3);
 s.refunds([]);await s.deliver();assert.equal(s.wallet.journey.nova,3);assert.deepEqual(s.wallet.purchaseGrants,[]);
});
test('a spent refund persists a debt that future ad and purchase credits settle',async()=>{
 const s=setup(2);await s.deliver();assert.equal(s.wallet.journey.nova,0);assert.equal(s.wallet.novaDebt,3);
 const loaded:typeof s.wallet=JSON.parse(JSON.stringify(s.wallet));
 assert.equal(creditNova(loaded,1),0);assert.equal(loaded.novaDebt,2);
 const next={...purchase,id:'google-2'};
 const deliver=createPurchaseDelivery(()=>loaded,async()=>{}, {claims:async()=>[next],completeClaims:async()=>{}});
 assert.equal(await deliver(),3);assert.equal(loaded.journey.nova,3);assert.equal(loaded.novaDebt,0);
});
test('a failed save rolls the refund back and retries without losing the debit',async()=>{
 const s=setup(2);s.fail(true);await assert.rejects(s.deliver(),/save_failed/);
 assert.equal(s.wallet.journey.nova,2);assert.equal(s.wallet.novaDebt,0);assert.deepEqual(s.wallet.purchaseRevocations,[]);
 s.fail(false);await s.deliver();assert.equal(s.wallet.journey.nova,0);assert.equal(s.wallet.novaDebt,3);
});
test('foreign IDs, unsupported products and wrong quantities never debit the wallet',async()=>{
 const s=setup();s.refunds([{...purchase,id:'foreign'},{...purchase,nova:500}]);await s.deliver();assert.equal(s.wallet.journey.nova,14);
});
test('offline refund lookup still delivers a paid purchase and a later lookup reconciles it',async()=>{
 const s=setup(3);s.wallet.purchaseGrants=[];s.pending([purchase]);s.api.revocations=async()=>{throw new Error('offline');};
 assert.equal(await s.deliver(),5);assert.equal(s.wallet.journey.nova,8);
 s.pending([]);s.api.revocations=async()=>[purchase];await s.deliver();assert.equal(s.wallet.journey.nova,3);
});
test('a delayed approval is delivered after the original pending response, once across repeated syncs',async()=>{
 const s=setup(3);s.wallet.purchaseGrants=[];s.refunds([]);
 assert.equal(await s.deliver(),0);s.pending([purchase]);assert.equal(await s.deliver(),5);assert.equal(await s.deliver(),0);assert.equal(s.wallet.journey.nova,8);
});
