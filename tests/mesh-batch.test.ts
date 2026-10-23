import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchStatic} from '../src/mesh-batch';
test('spatial batches preserve geometry while allowing offscreen districts to be culled',()=>{
 const make=()=>{const root=new THREE.Group(),mat=new THREE.MeshBasicMaterial();for(const x of [0,1000]){const m=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),mat);m.position.set(x,0,-40);root.add(m);}return root;};
 const whole=make(),cells=make();batchStatic(whole);batchStatic(cells,100);
 const before=new THREE.Box3().setFromObject(whole),after=new THREE.Box3().setFromObject(cells);
 assert.deepEqual(before.min.toArray(),after.min.toArray());assert.deepEqual(before.max.toArray(),after.max.toArray());
 const camera=new THREE.PerspectiveCamera(60,1,.1,2000);camera.updateMatrixWorld();
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const triangles=(root:THREE.Group)=>root.children.reduce((sum,o)=>sum+(frustum.intersectsObject(o)?(o as THREE.Mesh).geometry.index!.count/3:0),0);
 assert.equal(triangles(whole),24);assert.equal(triangles(cells),12);
 assert.equal(cells.children.reduce((n,o)=>n+(o as THREE.Mesh).geometry.index!.count,0),72);
});
test('static batching reduces draws and preserves transformed geometry and animated scarf',()=>{const root=new THREE.Group();root.position.set(4,2,-8);const mat=new THREE.MeshStandardMaterial();for(let i=0;i<20;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);m.position.set(i,0,0);root.add(m);}const scarf=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);scarf.name='NOVA scarf';root.add(scarf);const before=new THREE.Box3().setFromObject(root);assert.equal(batchStatic(root),19);const after=new THREE.Box3().setFromObject(root);assert.ok(before.min.distanceTo(after.min)<1e-6);assert.ok(before.max.distanceTo(after.max)<1e-6);assert.equal(root.children.length,2);assert.equal(root.children.includes(scarf),true);assert.equal((root.children.find(o=>o!==scarf) as THREE.Mesh).geometry.index!.count,20*36);});
