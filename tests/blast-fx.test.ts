import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {BlastFX,BLAST_DURATION} from '../src/blast-fx';
test('blast survives enemy recycle window, freezes when paused and releases all draws',()=>{const fx=new BlastFX(),q=new THREE.Quaternion();fx.trigger(100,20,-200,4);fx.update(.56,{x:90,y:0,z:-180},q);assert.equal(fx.slots.filter(s=>s.active).length,1);assert.ok(fx.puffs.count>0);const age=fx.slots[0].age;fx.update(0,{x:90,y:0,z:-180},q);assert.equal(fx.slots[0].age,age);fx.update(BLAST_DURATION,{x:90,y:0,z:-180},q);assert.equal(fx.puffs.count+fx.sparks.count+fx.shards.count,0);assert.ok(fx.rings.every(r=>!r.visible));});
test('simultaneous kills stay bounded and retry removes previous run effects',()=>{const fx=new BlastFX(),q=new THREE.Quaternion();for(let i=0;i<100;i++)fx.trigger(i,3,-20,i);fx.update(.12,{x:0,y:0,z:0},q);assert.equal(fx.slots.filter(s=>s.active).length,12);assert.ok(fx.puffs.count<=108&&fx.sparks.count<=288&&fx.shards.count<=96);for(const mesh of [fx.puffs,fx.sparks,fx.shards])assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));fx.reset();assert.equal(fx.puffs.count+fx.sparks.count+fx.shards.count,0);assert.ok(fx.slots.every(s=>!s.active));});

test('empty effects do not upload buffers; reused effects upload fresh data',()=>{
 const fx=new BlastFX(),q=new THREE.Quaternion(),origin={x:0,y:0,z:0};
 const versions=()=>[fx.puffs.instanceMatrix.version,fx.sparks.instanceMatrix.version,fx.shards.instanceMatrix.version,fx.puffs.geometry.attributes.blastAge.version];
 const empty=versions();for(let i=0;i<60;i++)fx.update(1/60,origin,q);assert.deepEqual(versions(),empty);
 fx.trigger(1,2,3,4);fx.update(.1,origin,q);const live=versions();assert.ok(live.every((n,i)=>n>empty[i]));
 fx.update(BLAST_DURATION,origin,q);assert.equal(fx.puffs.count,0);assert.deepEqual(versions(),live);
 fx.trigger(3,4,5,6);fx.update(.1,origin,q);assert.ok(versions().every((n,i)=>n>live[i]));
});


test('reduced effects keep impact flash, reduce decorative particles, and hold quality during an active blast',()=>{
 for(const detail of [0,1,2]){
  const fx=new BlastFX();fx.detail=detail;fx.trigger(0,0,0,2);fx.update(.05,{x:0,y:0,z:0},new THREE.Quaternion());
  assert.equal(fx.puffs.count,[9,4,4][detail]);assert.equal(fx.sparks.count,[24,10,6][detail]);
  const modes=Array.from(fx.puffs.geometry.getAttribute('blastMode').array).slice(0,fx.puffs.count);assert.ok(modes.includes(2));
  fx.detail=2-detail;fx.update(.05,{x:0,y:0,z:0},new THREE.Quaternion());assert.equal(fx.puffs.count,[9,4,4][detail]);
 }
});
