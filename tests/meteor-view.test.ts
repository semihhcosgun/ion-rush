import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeteorView} from '../src/meteor-view';
import {Race} from '../src/game';

test('hidden meteor particles stop buffer uploads and resume when a slot is reused',()=>{
 const view=new MeteorView(),r=new Race(33);r.z=10000;
 const m={id:1,z:10100,end:10300,surface:0,lane:0,age:1,impact:false};r.meteors.items=[m];
 const smoke:THREE.InstancedMesh[]=[],embers:THREE.Points[]=[];
 view.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)smoke.push(o);if(o instanceof THREE.Points)embers.push(o);});
 const render=()=>view.render(r,false,{x:0,y:0});
 render();assert.equal(smoke[0].visible,false);assert.equal(smoke[0].instanceMatrix.version,0);
 m.impact=true;m.age=2.5;render();assert.equal(smoke[0].visible,true);assert.ok(smoke[0].instanceMatrix.version>0);
 m.age=8;render();const sv=smoke[0].instanceMatrix.version,ev=embers[0].geometry.attributes.position.version;
 m.age=9;render();assert.equal(smoke[0].instanceMatrix.version,sv);assert.equal(embers[0].geometry.attributes.position.version,ev);
 m.id=2;m.age=0;m.impact=false;render();assert.equal(embers[0].visible,true);assert.ok(embers[0].geometry.attributes.position.version>ev);
 m.age=2.5;m.impact=true;render();assert.equal(smoke[0].visible,true);assert.ok(smoke[0].instanceMatrix.version>sv);
});


test('meteor decoration scales down without changing its warning or impact body',()=>{
 for(const detail of [0,1,2]){
  const view=new MeteorView(),r=new Race(1);view.detail=detail;r.z=10000;
  r.meteors.items=[{id:1,z:10100,end:10300,surface:0,lane:0,age:2.5,impact:true}];
  view.render(r,false,{x:0,y:0});
  const smoke:THREE.InstancedMesh[]=[],embers:THREE.Points[]=[];
  view.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)smoke.push(o);if(o instanceof THREE.Points)embers.push(o);});
  assert.equal(smoke[0].count,[10,6,3][detail]);assert.equal(embers[0].geometry.drawRange.count,[96,56,32][detail]);
  view.detail=2-detail;view.render(r,false,{x:0,y:0});assert.equal(smoke[0].count,[10,6,3][detail]);
 }
});
