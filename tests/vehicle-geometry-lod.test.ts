import{test}from'node:test';import assert from'node:assert/strict';import * as THREE from 'three';
import{makeVesper}from'../src/vehicle';import{batchStatic}from'../src/mesh-batch';import{VehicleGeometryLOD}from'../src/vehicle-geometry-lod';
test('riding geometry keeps model bounds, material layout and the animated scarf',()=>{
 const full=makeVesper(),ride=makeVesper(true);batchStatic(full);batchStatic(ride);
 const nodes=(root:THREE.Object3D)=>{const a:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)a.push(o);});return a;};
 const a=nodes(full),b=nodes(ride);assert.equal(a.length,b.length);
 const triangles=(list:THREE.Mesh[])=>list.reduce((s,m)=>s+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
 assert.ok(triangles(b)<triangles(a)*.65);console.log({fullTriangles:triangles(a),ridingTriangles:triangles(b)});
 a.forEach((m,i)=>{m.geometry.computeBoundingBox();b[i].geometry.computeBoundingBox();const x=m.geometry.boundingBox!,y=b[i].geometry.boundingBox!;assert.ok(x.min.distanceTo(y.min)<.015);assert.ok(x.max.distanceTo(y.max)<.015);assert.equal((m.material as THREE.Material).type,(b[i].material as THREE.Material).type);});
 const scarf=full.getObjectByName('NOVA scarf') as THREE.Mesh,geometry=scarf.geometry,original=a.map(m=>m.geometry),lod=new VehicleGeometryLOD(full,ride);
 lod.setRiding(true);assert.equal(scarf.geometry,geometry);full.userData.animate(3);assert.ok(geometry.attributes.position.version>0);
 lod.setRiding(false);a.forEach((m,i)=>assert.equal(m.geometry,original[i]));lod.dispose();
});
