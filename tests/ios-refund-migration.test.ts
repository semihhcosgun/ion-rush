import test from 'node:test';
import assert from 'node:assert/strict';
import {readSave,writeSave} from '../src/storage';
import {createPurchaseDelivery} from '../src/purchase-delivery';
import type {PurchaseClaim} from '../src/billing';

test('pre-refund Preferences saves preserve progress and migrate refund debt through a durable restart',async()=>{
  const entries=new Map<string,string>();
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{
    getItem:(key:string)=>entries.get(key)??null,
    setItem:(key:string,value:string)=>entries.set(key,value)
  }}});
  try{
    entries.set('CapacitorStorage.ion-save-v1',JSON.stringify({version:1,language:'tr',
      purchaseGrants:['apple-99'],journey:{nova:2,runs:9,distance:12345,energy:8,score:100},
      best:{mars:12345},completed:['mars']}));
    let save=await readSave();
    assert.equal(save.novaDebt,0);
    assert.deepEqual(save.purchaseRevocations,[]);
    assert.equal(save.journey.distance,12345);
    assert.equal(save.language,'tr');
    const refund:PurchaseClaim={id:'apple-99',productId:'example_nova_5',nova:5};
    const api={claims:async()=>[],revocations:async()=>[refund],completeClaims:async()=>{}};
    await createPurchaseDelivery(()=>save,()=>writeSave(save),api)();
    save=await readSave();
    assert.equal(save.journey.nova,0);
    assert.equal(save.novaDebt,3);
    assert.deepEqual(save.purchaseRevocations,['apple-99']);
    assert.equal(save.journey.runs,9);
    assert.deepEqual(save.best,{mars:12345});
    await createPurchaseDelivery(()=>save,()=>writeSave(save),api)();
    assert.equal((await readSave()).novaDebt,3);
  }finally{
    if(previous)Object.defineProperty(globalThis,'window',previous);
    else Reflect.deleteProperty(globalThis,'window');
  }
});
