import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefundLookup} from '../src/refund-lookup';
const first='a'.repeat(64),second='b'.repeat(64);
test('unchanged Android history is queried once per five minutes; new purchases bypass the cache',async()=>{
 let calls=0,time=0;
 const lookup=createRefundLookup(async ids=>{calls++;return {configured:true,revocations:ids};},()=>time);
 assert.deepEqual(await lookup([]),[]);assert.equal(calls,0);
 assert.deepEqual(await lookup([first]),[first]);time=60000;
 await lookup([first,first]);assert.equal(calls,1);
 assert.deepEqual(await lookup([second,first]),[first,second]);assert.equal(calls,2);
 time+=300000;await lookup([first,second]);assert.equal(calls,3);
});
test('unavailable and failed lookups are retryable and never cached as successful empty data',async()=>{
 let mode='offline',calls=0;
 const lookup=createRefundLookup(async()=>{calls++;if(mode==='offline')throw new Error('offline');return {configured:mode==='ready',revocations:[first]};});
 await assert.rejects(lookup([first]));mode='unconfigured';assert.deepEqual(await lookup([first]),[]);
 mode='ready';assert.deepEqual(await lookup([first]),[first]);await lookup([first]);assert.equal(calls,3);
});
test('complete history is batched at 200 and a failed later batch cannot hide a refund',async()=>{
 const ids=Array.from({length:201},(_,i)=>i.toString(16).padStart(64,'0'));let fail=true,calls=0;
 const lookup=createRefundLookup(async batch=>{calls++;assert.ok(batch.length<=200);if(fail&&batch.length===1)throw new Error('offline');return {configured:true,revocations:batch};});
 await assert.rejects(lookup(ids));fail=false;assert.equal((await lookup(ids)).length,201);assert.equal(calls,4);
});
