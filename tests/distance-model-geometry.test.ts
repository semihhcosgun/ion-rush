import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CombatView} from '../src/combat-view';
import {Race} from '../src/game';
import {ENEMY_TYPES,type EnemyKind} from '../src/config';

const meshes=(root:THREE.Object3D)=>{const a:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)a.push(o);});return a;};
const triangles=(nodes:THREE.Mesh[])=>nodes.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
test('all enemy models keep their close geometry and materials, sharing cheaper distant buffers',()=>{
 const view=new CombatView(),race=new Race(71),kinds=Object.keys(ENEMY_TYPES) as EnemyKind[];
 race.z=5000;race.time=10;
 for(let k=0;k<kinds.length;k++){
  const model=view.models[0][k],nodes=meshes(model),full=nodes.map(m=>m.geometry),materials=nodes.map(m=>m.material),bounds=nodes.map(m=>{m.geometry.computeBoundingBox();return m.geometry.boundingBox!.clone();}),count=triangles(nodes);
  for(let i=0;i<2;i++)Object.assign(race.combat.enemies[i],{active:true,id:i,kind:kinds[k],hp:3,age:10,z:race.z+220,surface:0,visualSurface:0});
  view.render(race,false);const distant=triangles(nodes);
  assert.ok(distant<count*.65,`${kinds[k]}: ${distant} / ${count}`);
  nodes.forEach((m,i)=>{
   assert.equal(m.material,materials[i]);assert.equal(m.geometry,meshes(view.models[1][k])[i].geometry);
   m.geometry.computeBoundingBox();const b=m.geometry.boundingBox!;
   assert.ok(b.min.distanceTo(bounds[i].min)<.25,kinds[k]+' min bound');
   assert.ok(b.max.distanceTo(bounds[i].max)<.25,kinds[k]+' max bound');
  });
  race.combat.enemies[0].z=race.z+30;view.render(race,false);
  nodes.forEach((m,i)=>assert.equal(m.geometry,full[i],kinds[k]+' close buffer'));
  assert.ok(triangles(meshes(view.models[1][k]))<count*.65,'other instance stays distant');
 }
 view.disposeGeometry();
});
