import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {StylizedCity} from '../src/stylized-city';
import {pathAt} from '../src/path';
test('stylized opening stays within its geometry and material budget',()=>{
 const city=new StylizedCity();let triangles=0,draws=0;
 city.root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
  draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
  assert.equal(o.castShadow,false);assert.equal(o.receiveShadow,false);
  assert.ok(o.material instanceof THREE.MeshBasicMaterial||o.material instanceof THREE.ShaderMaterial);
  for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
 });
 assert.ok(triangles<70000); // Includes both retained representations; distant copies add <10k triangles.
 assert.equal(draws,7);
});
test('stylized opening follows the shared ascent and disappears before deep space',()=>{
 const city=new StylizedCity(),camera=new THREE.PerspectiveCamera();camera.position.set(1,2,3);
 for(const z of [0,1000,1700,2300]){
  const origin=pathAt(z);city.update(z,0,origin,camera);assert.equal(city.root.visible,true);
  assert.deepEqual(city.land.position.toArray(),[-origin.x,-origin.y,z]);
 }
 city.update(3200,0,pathAt(3200),camera);assert.equal(city.root.visible,false);
});


test('distant city silhouettes contain substantially fewer triangles than detailed architecture',()=>{
 const city=new StylizedCity();let detailed=0,distant=0;
 for(const group of [city.street,city.bridge,city.skyline])for(const branch of group.children){
  let count=0;branch.traverse(o=>{if(o instanceof THREE.Mesh)count+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  if(branch.name==='Detailed scenery')detailed+=count;else if(branch.name==='Distant silhouettes')distant+=count;
 }
 assert.ok(distant<detailed*.65,`${detailed} -> ${distant}`);
 console.log(`City triangles by representation: ${detailed} -> ${distant}`);
});
