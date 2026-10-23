import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AnimatedInstances,AnimatedInstanceTransforms} from '../src/animated-instances';
import {makePickupVisual} from '../src/pickup-visual';
test('animated pools preserve nested pickup animation, visibility and render properties',()=>{
 const root=new THREE.Group();root.position.set(11,3,9);
 const pickups=Array.from({length:3},(_,i)=>{const gate=new THREE.Group();gate.position.set(i*7,2,-i*70);gate.rotation.y=.2*i;root.add(gate);const pickup=makePickupVisual('energy');gate.add(pickup);pickup.rotation.z=i*Math.PI/2;return pickup;});
 const parts=pickups.map(p=>{const a:THREE.Mesh[]=[];p.traverse(o=>{if(o instanceof THREE.Mesh)a.push(o);});return a;});
 const pools=parts[0].map((_,i)=>new AnimatedInstances(parts.map(p=>p[i])));pools.forEach(p=>root.add(p.mesh));
 const cache=new AnimatedInstanceTransforms(root),actual=new THREE.Matrix4();
 for(let frame=0;frame<5;frame++){
  pickups.forEach((p,i)=>{p.userData.animate?.(frame*.31,i);p.parent!.visible=frame!==2||i!==1;});
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();cache.beginFrame();
  pools.forEach((pool,i)=>{pool.update(cache);assert.equal(pool.mesh.count,frame===2?2:3);assert.equal(pool.mesh.renderOrder,parts[0][i].renderOrder);let index=0;parts.forEach((list,j)=>{if(!pickups[j].parent!.visible)return;pool.mesh.getMatrixAt(index++,actual);const expected=new THREE.Matrix4().multiplyMatrices(inverse,list[i].matrixWorld);expected.elements.forEach((v,k)=>assert.ok(Math.abs(v-actual.elements[k])<1e-4));});});
 }
 assert.ok(pickups[0].getObjectByName('energy-gimbal-a'));
 pickups.forEach(p=>p.visible=false);cache.beginFrame();pools.forEach(p=>{p.update(cache);assert.equal(p.mesh.count,0);assert.equal(p.mesh.visible,false);p.dispose();});
 assert.equal(parts[0][0].layers.mask,1);
});
test('hidden moving mesh parents suppress children; reappearing uses fresh transforms',()=>{
 const root=new THREE.Group(),mover=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mover);
 const child=new THREE.Mesh(mover.geometry,mover.material);mover.add(child);
 const pool=new AnimatedInstances([child]);root.add(pool.mesh);const cache=new AnimatedInstanceTransforms(root);
 mover.visible=false;cache.beginFrame();pool.update(cache);assert.equal(pool.mesh.count,0);
 mover.visible=true;mover.position.x=5;child.position.y=7;cache.beginFrame();pool.update(cache);const m=new THREE.Matrix4();pool.mesh.getMatrixAt(0,m);assert.equal(m.elements[12],5);assert.equal(m.elements[13],7);
});
