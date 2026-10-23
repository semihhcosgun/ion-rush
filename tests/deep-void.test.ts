import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DeepVoid,voidPresence} from '../src/deep-void';
import {pathAt} from '../src/path';

test('the mysterious reach fades smoothly in and out without persisting into Andromeda',()=>{
 let previous=0;
 for(let z=26000;z<=45000;z+=10){const p=voidPresence(z);assert.ok(p>=0&&p<=1);assert.ok(Math.abs(p-previous)<.007);previous=p;}
 assert.equal(voidPresence(26000),0);assert.equal(voidPresence(34000),1);assert.equal(voidPresence(43000),0);
});

test('relics stay outside the playable corridor and reuse their geometry across long runs',()=>{
 const art=new DeepVoid(),camera=new THREE.PerspectiveCamera(),geometries=new Set<THREE.BufferGeometry>();
 art.root.traverse(o=>{if(o instanceof THREE.Mesh)geometries.add(o.geometry);});
 for(let z=26000;z<=45000;z+=100){
  art.update(z,20,pathAt(z),camera);
  assert.equal(art.root.visible,voidPresence(z)>.001);
  for(const relic of art.relics)if(art.root.visible&&relic.root.visible){
   assert.ok(Math.abs(relic.root.position.x)>600);
   assert.ok(relic.root.position.z< -200);
   for(const m of relic.materials)assert.ok(m.opacity>0&&m.opacity<=1);
  }
  art.root.traverse(o=>{if(o instanceof THREE.Mesh)assert.ok(geometries.has(o.geometry));});
 }
 art.update(37000,42,pathAt(37000),camera);const rotation=art.relics[2].root.rotation.clone();
 art.update(37000,42,pathAt(37000),camera);assert.ok(art.relics[2].root.rotation.equals(rotation));
});
