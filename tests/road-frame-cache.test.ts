import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {RoadFrameCache} from '../src/road-frame-cache';
import {pathAt,tangentAt} from '../src/path';
test('cached road frames exactly match original geometry through ascent and ring reuse',()=>{
 const cache=new RoadFrameCache(256);
 for(const segment of [-4,0,99,100,144,200,300,400,1200,7000,0,-4]){
  const sample=cache.get(segment),d=tangentAt(segment*8);
  assert.deepEqual(sample.center,pathAt(segment*8));
  assert.deepEqual(sample.rotation.toArray(),new Quaternion().setFromUnitVectors(new Vector3(0,0,-1),new Vector3(d.x,d.y,-1).normalize()).toArray());
  assert.equal(cache.get(segment),sample);
 }
});
test('advancing the 128-segment road reuses 127 existing frames',()=>{
 const cache=new RoadFrameCache(256),old=Array.from({length:128},(_,i)=>cache.get(i));
 let reused=0;for(let i=1;i<=128;i++)if(cache.get(i)===old[i])reused++;
 assert.equal(reused,127);
});
