import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseDelivery} from '../src/purchase-delivery';
import type {PurchaseClaim} from '../src/billing';

const claim=(id='apple-1'):PurchaseClaim=>({id,productId:'example_nova_5',nova:5});

test('purchase delivery saves balance before acknowledging and serializes overlapping callbacks',async()=>{
 const wallet={journey:{nova:3},purchaseGrants:[] as string[]};
 let pending=[claim(),claim()],writes=0;const actions:string[]=[];
 const deliver=createPurchaseDelivery(()=>wallet,async()=>{writes++;actions.push('save');await new Promise(resolve=>setTimeout(resolve,5));},{claims:async()=>pending,completeClaims:async(ids)=>{actions.push('ack');assert.equal(wallet.journey.nova,8);pending=pending.filter(c=>!ids.includes(c.id));}});
 assert.deepEqual(await Promise.all([deliver(),deliver(),deliver()]),[5,0,0]);
 assert.equal(wallet.journey.nova,8);assert.equal(writes,1);assert.deepEqual(actions,['save','ack']);
});

test('a failed balance save never consumes the purchase and delivery resumes later',async()=>{
 const wallet={journey:{nova:3},purchaseGrants:[] as string[]};let fail=true,completed=0;
 const deliver=createPurchaseDelivery(()=>wallet,async()=>{if(fail)throw new Error('disk full');},{claims:async()=>[claim()],completeClaims:async()=>{completed++;}});
 await assert.rejects(deliver(),/save_failed/);assert.equal(wallet.journey.nova,3);assert.deepEqual(wallet.purchaseGrants,[]);assert.equal(completed,0);
 fail=false;assert.equal(await deliver(),5);assert.equal(wallet.journey.nova,8);assert.equal(completed,1);
});

test('a crash after saved delivery retries acknowledgement without granting NOVA again',async()=>{
 const wallet={journey:{nova:3},purchaseGrants:[] as string[]};let fail=true,writes=0;
 const api={claims:async()=>[claim()],completeClaims:async()=>{if(fail)throw new Error('interrupted');}};
 const first=createPurchaseDelivery(()=>wallet,async()=>{writes++;},api);
 await assert.rejects(first());assert.equal(wallet.journey.nova,8);
 const reloaded=JSON.parse(JSON.stringify(wallet));fail=false;
 const next=createPurchaseDelivery(()=>reloaded,async()=>{writes++;},api);
 assert.equal(await next(),0);assert.equal(reloaded.journey.nova,8);assert.equal(writes,1);
});

test('unknown products, wrong quantities and malformed claims cannot grant currency or be acknowledged',async()=>{
 const wallet={journey:{nova:3},purchaseGrants:[] as string[]};let completed:string[]=[];
 const pending=[claim('good'),{...claim('wrong'),nova:1000},{...claim('foreign'),productId:'anything'},{...claim(''),nova:5}];
 const deliver=createPurchaseDelivery(()=>wallet,async()=>{}, {claims:async()=>pending as PurchaseClaim[],completeClaims:async ids=>{completed=ids;}});
 assert.equal(await deliver(),5);assert.equal(wallet.journey.nova,8);assert.deepEqual(completed,['good']);
});

test('a large unfinished batch survives interrupted acknowledgment without losing delivery history',async()=>{
 const wallet={journey:{nova:0},purchaseGrants:[] as string[]};let fail=true;
 const pending=Array.from({length:300},(_,i)=>claim(`apple-${i}`));
 const api={claims:async()=>pending,completeClaims:async()=>{if(fail)throw new Error('interrupted');}};
 const deliver=createPurchaseDelivery(()=>wallet,async()=>{},api);
 await assert.rejects(deliver());assert.equal(wallet.journey.nova,1500);
 const reloaded=JSON.parse(JSON.stringify(wallet));fail=false;
 const retry=createPurchaseDelivery(()=>reloaded,async()=>{},api);
 assert.equal(await retry(),0);assert.equal(reloaded.journey.nova,1500);
});
