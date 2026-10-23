import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {trackPoint} from '../src/combat-space';
import {pathAt,tangentAt} from '../src/path';
import {TUNE} from '../src/config';

test('pooled track math exactly preserves original positions across faces and the journey',()=>{
 const scratch=new THREE.Vector3();
 for(let i=0;i<2000;i++){
  const z=i*37.51,surface=(i%17)/4,lane=(i%7)-3,height=7+i%19;
  const p=pathAt(z),d=tangentAt(z);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(d.x,d.y,-1).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-surface*Math.PI/2));
  const expected=new THREE.Vector3(lane*TUNE.laneSpacing,height,0).applyQuaternion(q).add(new THREE.Vector3(p.x,p.y,-z));
  const owned=trackPoint(z,surface,lane,height);
  assert.deepEqual(owned.toArray(),expected.toArray());
  assert.equal(trackPoint(z,surface,lane,height,scratch),scratch);
  assert.deepEqual(scratch.toArray(),expected.toArray());
  trackPoint(z+1,0,0,0);assert.deepEqual(owned.toArray(),expected.toArray());
 }
});
