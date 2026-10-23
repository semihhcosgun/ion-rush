import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CombatView} from '../src/combat-view';
import {COMBAT} from '../src/config';
test('enemy slots share exact geometry while keeping transforms and warp state independent',()=>{
 const view=new CombatView();
 const geometries=new Set<THREE.BufferGeometry>();let references=0;
 for(let kind=0;kind<view.models[0].length;kind++){
  const meshes=(group:THREE.Group)=>{const list:THREE.Mesh[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh)list.push(o);});return list;};
  const first=meshes(view.models[0][kind]);
  for(let slot=0;slot<COMBAT.enemies;slot++){
   const current=meshes(view.models[slot][kind]);
   assert.equal(current.length,first.length);
   current.forEach((mesh,i)=>{assert.equal(mesh.geometry,first[i].geometry);geometries.add(mesh.geometry);references++;if(slot)assert.notEqual(mesh.material,first[i].material);});
  }
 }
 assert.equal(references,geometries.size*COMBAT.enemies);
 view.models[1][0].rotation.z=1;
 assert.equal(view.models[0][0].rotation.z,0);
 view.arrivalProgress[1].value=.8;
 assert.equal(view.arrivalProgress[0].value,0);
 const bytes=[...geometries].reduce((sum,g)=>sum+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0),0);
 console.log(JSON.stringify({enemyGeometryBytes:bytes,previousDuplicatedBytes:bytes*COMBAT.enemies,savedBytes:bytes*(COMBAT.enemies-1)}));
});
