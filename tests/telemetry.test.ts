import test from 'node:test';
import assert from 'node:assert/strict';
import {EventQueue,QUEUE_KEY,validEvent,type RecordEvent,type Store} from '../src/telemetry-core';
import {RunTelemetry} from '../src/run-telemetry';
import {Race} from '../src/game';
const event=(id=1):RecordEvent=>({name:'run_start',created:1000,params:{index:id}});
function storage():Store {const map=new Map<string,string>();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}};}
test('consent prevents collection; retries retain order across reload; withdrawal clears pending data',async()=>{
  const disk=storage(),sent:number[]=[];let offline=true;const transport={send:async(e:RecordEvent)=>{if(offline)throw Error('offline');sent.push(Number(e.params.index));}};
  const q=new EventQueue(disk,transport,()=>1000);q.push(event());assert.equal(q.events.length,0);q.enable();q.push(event(1));q.push(event(2));await q.flush();assert.equal(q.events.length,2);
  const restarted=new EventQueue(disk,transport,()=>1000);restarted.enable();offline=false;await Promise.all([restarted.flush(),restarted.flush()]);assert.deepEqual(sent,[1,2]);restarted.push(event(3));restarted.disable();await restarted.flush();assert.equal(disk.getItem(QUEUE_KEY),null);assert.deepEqual(sent,[1,2]);
});
test('queue is bounded, expires old records and rejects non-Firebase payloads',()=>{
  const disk=storage(),q=new EventQueue(disk,{send:async()=>{}},()=>1000);q.enable();for(let n=0;n<600;n++)q.push(event(n));assert.equal(q.events.length,500);
  assert.equal(validEvent({...event(),params:{value:NaN}}),false);assert.equal(validEvent({...event(),params:Object.fromEntries(Array.from({length:26},(_,i)=>['p'+i,i]))}),false);
  const later=new EventQueue(disk,{send:async()=>{}},()=>1000+73*3600000);later.enable();assert.equal(later.events.length,0);
});
test('withdrawal during an in-flight send cannot consume new consented events',async()=>{
  let release!:()=>void;const disk=storage();const q=new EventQueue(disk,{send:()=>new Promise<void>(resolve=>{release=resolve;})},()=>1000);q.enable();q.push(event());const pending=q.flush();q.disable();q.enable();q.push(event(2));release();await pending;assert.equal(q.events[0].params.index,2);
});
function harness(){const records:RecordEvent[]=[];const t=new RunTelemetry((name,params)=>{const e={name,params:{schema_version:1,balance_version:'test',app_version:'test',is_test:1,client_time_ms:1000,...params},created:1000};assert.ok(validEvent(e),name+' has invalid parameters: '+Object.keys(e.params).length);records.push(e);});const r=new Race(123);t.start(r,0,true);return {r,t,records};}
test('resume does not duplicate starts; death and shield absorption preserve exact source and health',()=>{
  const {r,t,records}=harness();t.start(r,0,true);r.shield=1;r.damage('enemy','manta',7);r.invulnerable=0;r.health=1;r.damage('obstacle','laser');t.events(r.events);t.end('death');t.end('death');
  assert.equal(records.filter(e=>e.name==='run_start').length,1);const damage=records.filter(e=>e.name==='damage_taken');assert.equal(damage[0].params.health_before,damage[0].params.health_after);assert.equal(damage[0].params.shield_after,0);assert.equal(damage[1].params.health_after,0);const end=records.filter(e=>e.name==='run_end');assert.equal(end.length,1);assert.equal(end[0].params.death_reason,'laser');
});
test('checkpoint carries segment counters within the 25 parameter limit and flushes partial segments',()=>{
  const {r,t,records}=harness();r.elapsed=30;r.z=900;r.combat.shots=12;r.combat.hits=3;t.events([{type:'lane'},{type:'shift'}]);t.update(r,30);r.elapsed=35;r.z=1050;r.combat.shots=14;t.end('quit');const checkpoints=records.filter(e=>e.name==='run_checkpoint');assert.equal(checkpoints.length,2);assert.equal(checkpoints[0].params.shots,12);assert.equal(checkpoints[0].params.lane_changes,1);assert.equal(checkpoints[1].params.shots,2);assert.equal(checkpoints[1].params.segment_duration_s,5);
});
test('enemy identity survives pooling and tracks actual hit damage',()=>{
  const {r,t,records}=harness();const enemy=r.combat.enemies[0];Object.assign(enemy,{id:9,active:true,hp:2,kind:'drone'});t.events([{type:'encounter',kind:'drone',enemyId:9}]);t.events([{type:'enemyHit',enemyId:9,value:2}]);enemy.hp=0;t.update(r,.01);Object.assign(enemy,{id:10,active:true,hp:2});t.update(r,.01);const ended=records.find(e=>e.name==='enemy_encounter_end');assert.equal(ended?.params.encounter_id,'9');assert.equal(ended?.params.damage_received,2);assert.equal(ended?.params.outcome,'defeated');assert.equal(records.filter(e=>e.name==='enemy_encounter_start').length,2);
});
test('ship, rift and destination events pair once and include skipped destinations',()=>{
  const {r,t,records}=harness();r.z=18990;r.ship.core={z:19000,surface:0,lane:0};t.update(r,.01);t.update(r,.01);r.ship.active=true;r.ship.core=undefined;t.update(r,.01);r.z=20000;r.ship.active=false;t.update(r,.01);assert.equal(records.filter(e=>e.name==='ship_core_presented').length,1);assert.equal(records.filter(e=>e.name==='ship_started').length,1);assert.equal(records.find(e=>e.name==='ship_ended')?.params.outcome,'landed');
  const portal={id:42,z:20100,kind:'blue' as const,surface:0,lane:0,jump:650,points:400};r.rifts=[portal];t.update(r,.01);r.riftTransit={rift:portal,elapsed:0,jumped:false,mode:'enter'};t.events([{type:'riftEnter',rift:'blue'}]);r.z+=650;t.events([{type:'riftComplete',rift:'blue',value:400}]);t.events([{type:'riftComplete',rift:'blue'}]);assert.equal(records.filter(e=>e.name==='rift_ended').length,1);assert.ok(records.filter(e=>e.name==='destination_reached').length>5);
});
test('pickups report zero gain when full and missed only once',()=>{
  const {r,t,records}=harness();const gate={...r.gates[0],pickup:{kind:'health' as const,lane:0}};r.collectPickup(gate);r.collectPickup(gate);assert.equal(records.filter(e=>e.name==='pickup_resolved').length,1);assert.equal(records.find(e=>e.name==='pickup_resolved')?.params.amount,0);t.end('quit');
});
