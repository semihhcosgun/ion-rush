import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GateInstances,GateTransformCache} from '../src/gate-instances';
test('gate instances preserve rotated lane-scaled geometry and exclude hidden faces',()=>{
 const root=new THREE.Group(),gate=new THREE.Group(),face=new THREE.Group();root.add(gate);gate.add(face);
 gate.position.set(7,-3,-90);gate.rotation.y=.3;face.rotation.z=-Math.PI/2;face.scale.x=.3;face.position.y=2;
 const part=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());part.position.set(2,4,8);face.add(part);
 root.updateMatrixWorld(true);const expected=part.matrixWorld.clone();
 const pool=new GateInstances([{part,face,gate}]);root.add(pool.mesh);pool.update();
 const actual=new THREE.Matrix4();pool.mesh.getMatrixAt(0,actual);
 expected.elements.forEach((v,i)=>assert.ok(Math.abs(v-actual.elements[i])<1e-5));
 assert.equal(pool.mesh.count,1);face.visible=false;pool.update();assert.equal(pool.mesh.count,0);assert.equal(pool.mesh.visible,false);
});
test('shared transforms update once per frame and follow moving, hidden and reused gates',()=>{
 const gate=new THREE.Group(),face=new THREE.Group();gate.add(face);
 const pools=Array.from({length:8},(_,i)=>{
  const part=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  part.position.set(i,2,3);face.add(part);return new GateInstances([{part,face,gate}]);
 });
 let gateUpdates=0,faceUpdates=0;
 const gu=gate.updateMatrix,fu=face.updateMatrix;
 gate.updateMatrix=function(){gateUpdates++;gu.call(this);};
 face.updateMatrix=function(){faceUpdates++;fu.call(this);};
 const cache=new GateTransformCache(),actual=new THREE.Matrix4();
 for(let frame=0;frame<5;frame++){
  gate.position.set(frame*7,2,-frame*12);gate.rotation.y=frame*.2;
  face.rotation.z=frame*.3;face.scale.x=frame%2?.3:1;face.visible=frame!==2;
  cache.beginFrame();pools.forEach(p=>p.update(cache));
  pools.forEach((p,i)=>{
   assert.equal(p.mesh.count,face.visible?1:0);if(!face.visible)return;
   const expected=new THREE.Matrix4().multiplyMatrices(gate.matrix,face.matrix).multiply(new THREE.Matrix4().makeTranslation(i,2,3));
   p.mesh.getMatrixAt(0,actual);expected.elements.forEach((v,j)=>assert.ok(Math.abs(v-actual.elements[j])<1e-5));
  });
 }
 assert.equal(gateUpdates,4);assert.equal(faceUpdates,4);
});
