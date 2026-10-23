import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeNovaRider} from '../src/nova-rider';
import {makeVesper} from '../src/vehicle';
import {batchStatic} from '../src/mesh-batch';

test('helmet overlays face outwards and clear the shell without depth fighting',()=>{
 const {root}=makeNovaRider();
 for(const name of ['NOVA crown stripe','NOVA black visor']){
  const mesh=root.getObjectByName(name) as THREE.Mesh,geometry=mesh.geometry;
  const positions=geometry.attributes.position,index=geometry.index!;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   a.fromBufferAttribute(positions,i);
   const radius=(a.x/.291)**2+(a.y/.345)**2+(a.z/.302)**2;
   assert.ok(radius>1.003&&radius<1.05,`${name} must sit above the shell`);
  }
  for(let i=0;i<index.count;i+=3){
   a.fromBufferAttribute(positions,index.getX(i));b.fromBufferAttribute(positions,index.getX(i+1));c.fromBufferAttribute(positions,index.getX(i+2));
   const outward=b.sub(a).cross(c.sub(a)).dot(a);
   assert.ok(outward>0,`${name} has an inward-facing triangle`);
  }
 }
});

test('batched rider keeps its silhouette, live scarf, and bounded geometry',()=>{
 const bike=makeVesper(),before=new THREE.Box3().setFromObject(bike,true),scarf=bike.getObjectByName('NOVA scarf') as THREE.Mesh;
 batchStatic(bike);
 const after=new THREE.Box3().setFromObject(bike,true);
 assert.ok(before.min.distanceTo(after.min)<1e-5&&before.max.distanceTo(after.max)<1e-5);
 assert.equal(bike.getObjectByName('NOVA scarf'),scarf);
 let draws=0,triangles=0;bike.traverse(part=>{if(part instanceof THREE.Mesh){draws++;triangles+=(part.geometry.index?.count??part.geometry.attributes.position.count)/3;}});
 assert.ok(draws<=20&&triangles<125000,`${draws} draws / ${triangles} triangles`);
 const positions=scarf.geometry.attributes.position,anchor=new THREE.Vector3().fromBufferAttribute(positions,0);
 for(const time of [0,.25,5,100,10000]){
  bike.userData.animate(time);
  assert.ok(anchor.distanceTo(new THREE.Vector3().fromBufferAttribute(positions,0))<1e-6);
  for(const attribute of [positions,scarf.geometry.attributes.normal])assert.ok(Array.from(attribute.array).every(Number.isFinite));
 }
});
