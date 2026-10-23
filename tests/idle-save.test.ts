import test from 'node:test';
import assert from 'node:assert/strict';
import {DemandFrameLoop} from '../src/demand-frame-loop';
import {SaveWriter} from '../src/save-writer';
import {createPurchaseDelivery} from '../src/purchase-delivery';

function frameClock(){
 let next=0,wakes=0,frames=0,continuous=false;
 const callbacks=new Map<number,FrameRequestCallback>();
 const loop=new DemandFrameLoop(()=>{frames++;return continuous;},()=>wakes++,callback=>{callbacks.set(++next,callback);return next;},id=>{callbacks.delete(id);});
 return {loop,callbacks,get frames(){return frames;},get wakes(){return wakes;},run(now=0){const [id,callback]=callbacks.entries().next().value!;callbacks.delete(id);callback(now);},set continuous(value:boolean){continuous=value;}};
}

test('static screens sleep after one frame and resume gameplay without accumulated idle time',()=>{
 const c=frameClock();c.loop.setActive(true);c.run();
 assert.equal(c.frames,1);assert.equal(c.callbacks.size,0);
 c.continuous=true;c.loop.invalidate();c.loop.invalidate();
 assert.equal(c.callbacks.size,1);assert.equal(c.wakes,2);
 for(let i=0;i<120;i++)c.run(10000+i*1000/120);
 assert.equal(c.callbacks.size,1);assert.equal(c.wakes,2);
 c.continuous=false;c.run();assert.equal(c.callbacks.size,0);
 c.loop.invalidate();c.run();assert.equal(c.frames,123);assert.equal(c.callbacks.size,0);
});

test('background cancels all queued game frames and invalidations stay dormant until foreground',()=>{
 const c=frameClock();c.continuous=true;c.loop.setActive(true);c.run();
 c.loop.setActive(false);assert.equal(c.callbacks.size,0);
 c.loop.invalidate();c.loop.invalidate();assert.equal(c.callbacks.size,0);
 c.loop.setActive(true);assert.equal(c.callbacks.size,1);c.run();assert.equal(c.callbacks.size,1);
});

test('state changes during drawing schedule exactly one additional static frame',()=>{
 const callbacks:FrameRequestCallback[]=[];let count=0;
 const loop=new DemandFrameLoop(()=>{if(++count===1){loop.invalidate();loop.invalidate();}return false;},()=>{},callback=>{callbacks.push(callback);return callbacks.length;},()=>{});
 loop.setActive(true);callbacks.shift()!(0);assert.equal(callbacks.length,1);
 callbacks.shift()!(16);assert.equal(callbacks.length,0);assert.equal(count,2);
});

test('a burst of kill updates takes one latest snapshot and writes once at the fixed deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let kills=0,snapshots=0;const values:string[]=[];
 const writer=new SaveWriter(async value=>{values.push(value);});
 const pending=writer.schedule(()=>{snapshots++;return String(kills);});
 for(let i=0;i<100;i++){kills++;assert.equal(writer.schedule(()=>{snapshots++;return String(kills);}),pending);}
 t.mock.timers.tick(749);assert.equal(snapshots,0);assert.deepEqual(values,[]);
 kills++;writer.schedule(()=>{snapshots++;return String(kills);});
 t.mock.timers.tick(1);await pending;assert.equal(snapshots,1);assert.deepEqual(values,['101']);
});

test('a pause or critical write absorbs pending kills without a stale write afterward',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const values:string[]=[];const writer=new SaveWriter(async value=>{values.push(value);});
 const deferred=writer.schedule(()=>'old kills');
 await writer.immediate('kills plus final score');await deferred;
 t.mock.timers.tick(1000);await Promise.resolve();assert.deepEqual(values,['kills plus final score']);
});

test('an in-flight old save finishes before a critical write and its acknowledgment',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const values:string[]=[];let release!:()=>void;
 const writer=new SaveWriter(async value=>{if(value==='old')await new Promise<void>(resolve=>{release=resolve;});values.push(value);});
 const old=writer.immediate('old');await Promise.resolve();await Promise.resolve();
 const batch=writer.schedule(()=>'stale');const critical=writer.immediate('paid');
 await Promise.resolve();assert.deepEqual(values,[]);
 release();await Promise.all([old,batch,critical]);t.mock.timers.tick(1000);assert.deepEqual(values,['old','paid']);
});

test('failed immediate purchase persistence rejects the batch, rolls back currency, never acknowledges, and permits retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let fail=true,ack=0;const values:string[]=[];
 const writer=new SaveWriter(async value=>{if(fail)throw new Error('disk full');values.push(value);});
 const wallet={journey:{nova:3},purchaseGrants:[] as string[]};
 const deferred=writer.schedule(()=>JSON.stringify(wallet));const failedBatch=assert.rejects(deferred,/disk full/);
 const deliver=createPurchaseDelivery(()=>wallet,()=>writer.immediate(JSON.stringify(wallet)),{claims:async()=>[{id:'apple-1',productId:'example_nova_5',nova:5}],completeClaims:async()=>{ack++;}});
 await assert.rejects(deliver(),/save_failed/);await failedBatch;
 assert.equal(ack,0);assert.equal(wallet.journey.nova,3);
 t.mock.timers.tick(1000);assert.deepEqual(values,[]);
 fail=false;await deliver();assert.equal(ack,1);assert.equal(JSON.parse(values[0]).journey.nova,8);
});

test('a failed timed batch reports the error and does not block the next successful save',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let fail=true;const values:string[]=[];
 const writer=new SaveWriter(async value=>{if(fail)throw new Error('storage offline');values.push(value);});
 const pending=writer.schedule(()=>'kills');const failed=assert.rejects(pending,/storage offline/);
 t.mock.timers.tick(750);await failed;
 fail=false;await writer.immediate('recovered');assert.deepEqual(values,['recovered']);
});
