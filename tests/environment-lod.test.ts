import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CelestialLOD} from '../src/celestial-lod';
import {DistantInstances} from '../src/distant-instances';

test('planet detail returns at large apparent size and original shape is retained',()=>{
 const full=new THREE.SphereGeometry(1,64,40);full.scale(1,.9,1);
 const mesh=new THREE.Mesh(full,new THREE.MeshBasicMaterial()),lod=new CelestialLOD(),camera=new THREE.PerspectiveCamera();
 mesh.position.z=-100;lod.update(mesh,camera);assert.ok(mesh.geometry.index!.count<full.index!.count/8);
 mesh.geometry.computeBoundingBox();assert.ok(Math.abs(mesh.geometry.boundingBox!.max.y-.9)<1e-6);
 mesh.position.z=-4;lod.update(mesh,camera);assert.equal(mesh.geometry,full);lod.dispose();
});

test('decorative instance LOD retains every rock and restores full meshes when approaching',()=>{
 const source=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial(),3),root=new THREE.Group();root.add(source);
 for(let i=0;i<3;i++)source.setMatrixAt(i,new THREE.Matrix4().makeTranslation(0,0,-[100,700,2000][i]));
 const lod=new DistantInstances(source),camera=new THREE.PerspectiveCamera();lod.update(camera);
 assert.deepEqual([source.count,lod.medium.count,lod.far.count],[1,1,1]);
 source.position.z=1900;lod.update(camera);assert.equal(source.count+lod.medium.count+lod.far.count,3);
 const m=new THREE.Matrix4();source.getMatrixAt(0,m);assert.equal(m.elements[14],-2000);
 source.visible=false;lod.update(camera);assert.equal(lod.far.visible,false);
});


test('tiny distant planets use the stronger silhouette while nearby planets retain original geometry',()=>{
 const full=new THREE.SphereGeometry(1,64,40),mesh=new THREE.Mesh(full,new THREE.MeshBasicMaterial()),lod=new CelestialLOD(),camera=new THREE.PerspectiveCamera();
 mesh.position.z=-100;lod.update(mesh,camera);assert.equal(mesh.geometry.index!.count/3,168);
 mesh.position.z=-10;lod.update(mesh,camera);assert.equal(mesh.geometry.index!.count/3,952);
 mesh.position.z=-3;lod.update(mesh,camera);assert.equal(mesh.geometry,full);lod.dispose();
});
