import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SupportView} from '../src/support-view';
import {Race} from '../src/game';

test('three escorts enter, hold formation and leave without reallocating models',()=>{
 const view=new SupportView(),anchor=new THREE.Group(),r=new Race();anchor.add(view.root);
 const meshes:THREE.Mesh[]=[];view.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
 assert.ok(meshes.length<=33);let triangles=0;for(const mesh of meshes)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
 assert.ok(triangles<20000,`Support geometry budget: ${triangles}`);
 r.support.unlocked=true;r.support.charge=1;r.support.activate(r);
 view.update(r,anchor,{x:0,y:0});const entrance=view.crafts.map(c=>c.position.clone());
 r.support.remaining=4;view.update(r,anchor,{x:0,y:0});const station=view.crafts.map(c=>c.position.clone());
 assert.ok(station[0].x<0&&station[1].x>0&&station[2].z<station[0].z);
 for(let i=0;i<3;i++)assert.ok(entrance[i].z>station[i].z+20);
 const stable=view.crafts.map(c=>c.position.clone());view.update(r,anchor,{x:0,y:0});for(let i=0;i<3;i++)assert.ok(view.crafts[i].position.equals(stable[i]));
 r.support.remaining=.05;view.update(r,anchor,{x:0,y:0});for(let i=0;i<3;i++)assert.ok(view.crafts[i].position.distanceTo(station[i])<7,'departure stays in formation instead of flying off');
 r.support.cancel();view.update(r,anchor,{x:0,y:0});assert.equal(view.root.visible,false);
 const after:THREE.Mesh[]=[];view.root.traverse(o=>{if(o instanceof THREE.Mesh)after.push(o);});assert.deepEqual(after,meshes);
});

test('escorts maneuver independently and follow player turns without snapping',()=>{
 const view=new SupportView(),anchor=new THREE.Group(),r=new Race();anchor.add(view.root);
 r.support.unlocked=true;r.support.charge=1;r.support.activate(r);r.support.remaining=10;
 view.update(r,anchor,{x:0,y:0});anchor.updateWorldMatrix(true,true);
 const before=view.crafts.map(c=>c.getWorldPosition(new THREE.Vector3()));
 const rotations=view.crafts.map(c=>c.getWorldQuaternion(new THREE.Quaternion()));
 anchor.position.x=4;anchor.rotation.z=.8;r.support.remaining-=1/60;
 view.update(r,anchor,{x:0,y:0});anchor.updateWorldMatrix(true,true);
 for(let i=0;i<3;i++){
  assert.ok(view.crafts[i].getWorldPosition(new THREE.Vector3()).distanceTo(before[i])<1,'no rigid translation with player');
  assert.ok(view.crafts[i].getWorldQuaternion(new THREE.Quaternion()).angleTo(rotations[i])<.15,'no inherited instant player roll');
 }
 const start=view.crafts.map(c=>c.position.clone());
 for(let n=0;n<120;n++){r.support.remaining-=1/60;view.update(r,anchor,{x:0,y:0});}
 const motion=view.crafts.map((c,i)=>c.position.clone().sub(start[i]));
 assert.ok(motion[0].distanceTo(motion[1])>.5);assert.ok(motion[1].distanceTo(motion[2])>.5);
 const paused=view.crafts.map(c=>c.position.clone());
 for(let n=0;n<60;n++)view.update(r,anchor,{x:0,y:0});
 for(let i=0;i<3;i++)assert.ok(view.crafts[i].position.distanceTo(paused[i])<1e-10);
});

test('escort lag compensates a shifted world origin and resets on retry',()=>{
 const view=new SupportView(),anchor=new THREE.Group(),r=new Race();anchor.add(view.root);
 r.support.unlocked=true;r.support.charge=1;r.support.activate(r);r.support.remaining=10;
 view.update(r,anchor,{x:0,y:0});const before=view.crafts.map(c=>c.position.clone());
 anchor.position.set(-100,-30,50);r.z=50;r.support.remaining-=.001;
 view.update(r,anchor,{x:100,y:30});
 for(let i=0;i<3;i++)assert.ok(view.crafts[i].position.distanceTo(before[i])<.02);
 const retry=new Race();retry.support.unlocked=true;retry.support.charge=1;retry.support.activate(retry);
 anchor.position.set(0,0,0);anchor.rotation.set(0,0,0);view.update(retry,anchor,{x:0,y:0});
 assert.ok(view.crafts[0].position.z>20);assert.ok(Math.abs(view.crafts[0].position.x)<20);
});

test('whole escort hulls remain inside camera at flight speed, turns and mobile aspect ratios',()=>{
 for(const aspect of [16/9,844/390,4/3,.75]){
  const view=new SupportView(),anchor=new THREE.Group(),r=new Race();anchor.add(view.root);
  const camera=new THREE.PerspectiveCamera(58,aspect,.1,500);
  r.support.unlocked=true;r.support.charge=1;r.support.activate(r);
  for(let n=0;n<840;n++){
   const time=n/60,angle=Math.sin(time*1.8)*1.6;
   r.z=time*70;r.support.remaining=14-time;
   anchor.position.set(Math.sin(angle)*4.2+Math.sin(time*2)*2,Math.cos(angle)*4.2,0);anchor.rotation.z=-angle;
   camera.position.set(Math.sin(angle)*9.7,Math.cos(angle)*9.7,12);
   camera.up.set(Math.sin(angle),Math.cos(angle),0);camera.lookAt(Math.sin(angle)*3.4,Math.cos(angle)*3.4,-27);
   view.update(r,anchor,{x:time*2,y:0},camera);anchor.updateWorldMatrix(true,true);
   if(time<2.2)continue; // Arrival intentionally travels from behind the camera.
   for(const craft of view.crafts)for(const part of craft.children.slice(0,5)){
    const mesh=part as THREE.Mesh;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox!;
    for(let v=0;v<8;v++){
     const point=new THREE.Vector3(v&1?bounds.max.x:bounds.min.x,v&2?bounds.max.y:bounds.min.y,v&4?bounds.max.z:bounds.min.z).applyMatrix4(mesh.matrixWorld).project(camera);
     assert.ok(Math.abs(point.x)<.94&&Math.abs(point.y)<.94&&point.z<1,`clipped hull: aspect ${aspect}, frame ${n}, ${point.toArray()}`);
    }
   }
  }
 }
});


test('arrival begins behind camera and flies continuously forward into formation',()=>{
 const view=new SupportView(),anchor=new THREE.Group(),r=new Race();anchor.add(view.root);
 const camera=new THREE.PerspectiveCamera(58,16/9,.1,500);camera.position.set(0,9.7,12);camera.lookAt(0,3.4,-27);
 r.support.unlocked=true;r.support.charge=1;r.support.activate(r);
 view.update(r,anchor,{x:0,y:0},camera);anchor.updateWorldMatrix(true,true);
 const prior=view.crafts.map(c=>c.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse));
 for(const p of prior)assert.ok(p.z>20,'must start behind the camera');
 const crossings:number[]=[];
 for(let n=1;n<=150;n++){
  r.support.remaining=14-n/60;view.update(r,anchor,{x:0,y:0},camera);anchor.updateWorldMatrix(true,true);
  view.crafts.forEach((c,i)=>{
   const p=c.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse);
   assert.ok(p.distanceTo(prior[i])<3,'arrival must not teleport');
   if(p.z<0&&prior[i].z>=0)crossings[i]=n;
   prior[i].copy(p);
  });
 }
 assert.ok(crossings[0]<crossings[1]&&crossings[1]<crossings[2]);
 for(const p of prior)assert.ok(p.z<-20,'must settle ahead of the camera');
});


test('departure has a visible short collapse in place rather than an instant disappearance',()=>{
 const view=new SupportView(),anchor=new THREE.Group(),r=new Race();anchor.add(view.root);r.support.unlocked=true;r.support.charge=1;r.support.activate(r);
 r.support.remaining=.4;view.update(r,anchor,{x:0,y:0});const start=view.crafts[0].position.clone(),size=view.crafts[0].scale.x;
 r.support.remaining=.16;view.update(r,anchor,{x:0,y:0});assert.ok(view.crafts[0].scale.x>0&&view.crafts[0].scale.x<size);
 assert.ok(view.crafts[0].position.distanceTo(start)<2);
 r.support.remaining=.01;view.update(r,anchor,{x:0,y:0});assert.ok(view.crafts[0].scale.x<.01);
});
