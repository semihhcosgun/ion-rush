import {test} from 'node:test';import assert from 'node:assert/strict';import {CourseStream} from '../src/game';import {VIEW} from '../src/horizon';import {KINDS,TUNE,SURVIVAL} from '../src/config';
test('expanded visibility has buffered terrain and sufficient pools across 1000 seeds',()=>{
 assert.ok((VIEW.trackSegments-5)*8>VIEW.roadFadeEnd+24);assert.ok(TUNE.streamAhead>VIEW.objectFadeEnd+SURVIVAL.pickupOffset);assert.ok(VIEW.objectFadeStart>400);
 for(let seed=0;seed<1000;seed++){const stream=new CourseStream(seed),gates=Array.from({length:90},()=>stream.next());for(let z=0;z<9000;z+=180){const visible=gates.filter(g=>g.z-z>-20&&g.z-z<VIEW.objectFadeEnd);for(const kind of KINDS)assert.ok(visible.filter(g=>g.kind===kind).length<=VIEW.gateSlots);assert.ok(gates.filter(g=>g.pickup&&g.z+SURVIVAL.pickupOffset>=z-5&&g.z+SURVIVAL.pickupOffset<=z+VIEW.objectFadeEnd).length<=SURVIVAL.pickupPool);}}
});
