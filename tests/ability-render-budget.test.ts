import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeVesper} from '../src/vehicle';
import {attachBikeEvolution} from '../src/bike-evolution';
import {batchStatic} from '../src/mesh-batch';
import {VehicleGeometryLOD} from '../src/vehicle-geometry-lod';
import {HunterView} from '../src/hunter-view';
import {VanguardView} from '../src/vanguard-view';
import {TitanView} from '../src/titan-view';
import {SingularityView} from '../src/singularity-view';
import {CombatView} from '../src/combat-view';
const meshes=(root:THREE.Object3D)=>{const a:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)a.push(o);});return a;};
const triangles=(root:THREE.Object3D)=>meshes(root).reduce((s,m)=>s+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
test('every evolved bike has lighter riding geometry with the same bounds and exact garage restoration',()=>{
 const full=makeVesper(),ride=makeVesper(true);batchStatic(full);batchStatic(ride);
 const kits=attachBikeEvolution(full),ridingKits=attachBikeEvolution(ride,true),original=meshes(full).map(m=>m.geometry),lod=new VehicleGeometryLOD(full,ride);
 const budgets=[];
 for(let i=0;i<7;i++){
  const a=meshes(kits[i]),b=meshes(ridingKits[i]);assert.equal(a.length,b.length);
  const before=triangles(kits[i]),after=triangles(ridingKits[i]);assert.ok(after<before*.7,`${i+1}: ${after}/${before}`);budgets.push({tier:i+1,full:before,ride:after});
  a.forEach((m,j)=>{m.geometry.computeBoundingBox();b[j].geometry.computeBoundingBox();const x=m.geometry.boundingBox!,y=b[j].geometry.boundingBox!;assert.ok(x.min.distanceTo(y.min)<.02,`${i+1} min`);assert.ok(x.max.distanceTo(y.max)<.02,`${i+1} max`);assert.equal((m.material as THREE.Material).type,(b[j].material as THREE.Material).type);});
 }
 lod.setRiding(true);kits.forEach((g,i)=>assert.equal(triangles(g),triangles(ridingKits[i])));
 lod.setRiding(false);meshes(full).forEach((m,i)=>assert.equal(m.geometry,original[i]));console.log(budgets);lod.dispose();
});
test('dormant ability models skip descendants and refresh correctly on reappearance',()=>{
 for(const view of [new HunterView(),new VanguardView(),new TitanView(),new SingularityView()]){
  const scene=new THREE.Group();scene.add(view.root);const child=view.root.children[0];let calls=0;const update=child.updateMatrixWorld;child.updateMatrixWorld=function(force){calls++;update.call(this,force);};
  view.root.visible=false;scene.position.set(12,23,34);for(let i=0;i<60;i++)scene.updateMatrixWorld(true);assert.equal(calls,0);
  view.root.visible=true;child.visible=true;scene.updateMatrixWorld();assert.equal(calls,1);assert.deepEqual(child.matrixWorld.elements.slice(12,15),[12+child.position.x,23+child.position.y,34+child.position.z]);
 }
});
test('loading previews include all four pooled combat ability buffers and materials',()=>{
 const view=new CombatView(),warm=view.warmModels();for(const effect of [view.hunter,view.vanguard,view.titan,view.singularity]){assert.ok(warm.includes(effect.root));const preview=effect.root.clone(true);assert.equal(meshes(preview).length,meshes(effect.root).length);meshes(preview).forEach((m,i)=>{assert.equal(m.geometry,meshes(effect.root)[i].geometry);assert.equal(m.material,meshes(effect.root)[i].material);});}
 view.disposeGeometry();
});
