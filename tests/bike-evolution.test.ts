import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeVesper} from '../src/vehicle';
import {attachBikeEvolution} from '../src/bike-evolution';
import {batchStatic} from '../src/mesh-batch';

test('rank switches use one complete kit, reuse buffers and stay inside the riding silhouette',()=>{
 const bike=makeVesper();batchStatic(bike);const groups=attachBikeEvolution(bike),geometries=new Set<THREE.BufferGeometry>();
 bike.traverse(o=>{if(o instanceof THREE.Mesh)geometries.add(o.geometry);});
 for(const level of [0,1,2,3,4,5,6,7,2,0,7,0]){
  bike.userData.setEvolution(level);assert.equal(groups.filter(g=>g.visible).length,level===0?0:1);if(level>0)assert.equal(groups[level-1].visible,true);assert.equal(bike.scale.x,1);
  const current=new Set<THREE.BufferGeometry>();bike.traverse(o=>{if(o instanceof THREE.Mesh)current.add(o.geometry);});assert.deepEqual(current,geometries);
  const box=new THREE.Box3().setFromObject(bike);assert.ok(box.max.x<.85&&box.min.x>-.85,'body kits must not extend across adjacent lanes');
  let draws=0,triangles=0;bike.traverseVisible(o=>{if(o instanceof THREE.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  assert.ok(draws<=26&&triangles<145000,`${level}: ${draws} draws / ${triangles} triangles`);
 }
 assert.equal(bike.userData.livery,'classic');assert.equal(groups.some(g=>g.visible),false);
});
test('Rookie materials and the live rider restore exactly after previewing every finish',()=>{
 const bike=makeVesper();batchStatic(bike);attachBikeEvolution(bike);
 const scarf=bike.getObjectByName('NOVA scarf') as THREE.Mesh;
 const materials=new Set<THREE.Material>();bike.traverse(o=>{if(o instanceof THREE.Mesh&&!o.parent?.name.startsWith('Evolution'))for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 const before=[...materials].map(m=>m.toJSON());
 for(let i=1;i<8;i++)bike.userData.setEvolution(i);
 bike.userData.setEvolution(0);assert.deepEqual([...materials].map(m=>m.toJSON()),before);assert.equal(bike.getObjectByName('NOVA scarf'),scarf);
 const version=scarf.geometry.attributes.position.version;bike.userData.animate(2);assert.ok(scarf.geometry.attributes.position.version>version);
});
