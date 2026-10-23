import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchStatic} from '../src/mesh-batch';
test('indexed batching preserves every triangle corner, normal and UV exactly',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 for(let i=0;i<3;i++){const geometry=new THREE.SphereGeometry(1,32,20);const mesh=new THREE.Mesh(i===1?geometry.toNonIndexed():geometry,material);mesh.position.set(i*3,.2*i,-i);mesh.rotation.set(.13*i,.27*i,.32*i);mesh.scale.set(1+i*.2,.7,1.2);root.add(mesh);}
 root.updateWorldMatrix(true,true);
 const before:THREE.BufferGeometry[]=root.children.map(o=>{const mesh=o as THREE.Mesh;return (mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);});
 const oldBytes=before.reduce((n,g)=>n+Object.values(g.attributes).reduce((v,a)=>v+a.array.byteLength,0),0);
 batchStatic(root);
 const merged=(root.children.find(o=>o instanceof THREE.Mesh) as THREE.Mesh).geometry;
 const expanded=merged.toNonIndexed();
 for(const name of ['position','normal','uv']){
  const expected=before.flatMap(g=>Array.from(g.attributes[name].array));
  assert.deepEqual(Array.from(expanded.attributes[name].array),expected);
 }
 const bytes=Object.values(merged.attributes).reduce((n,a)=>n+a.array.byteLength,0)+merged.index!.array.byteLength;
 assert.ok(bytes<oldBytes*.6);
 before.forEach(g=>g.dispose());expanded.dispose();
});
