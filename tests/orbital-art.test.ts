import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {OrbitalDocks} from '../src/orbital-art';
import {pathAt} from '../src/path';
import {VIEW} from '../src/horizon';

test('orbital architecture stays outside the road and recycles only beyond the horizon',()=>{
 const docks=new OrbitalDocks(),point=new THREE.Vector3();
 for(const group of docks.root.children){group.updateWorldMatrix(true,true);group.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);assert.ok(Math.hypot(point.x,point.y)>20);}}});}
 let previous:number[]=[];let recycles=0;
 for(let z=0;z<12000;z+=7){docks.update(z);const absolute=docks.root.children.map(o=>z-o.position.z);assert.equal(docks.root.children.length,5);for(let i=0;i<5;i++){
  const o=docks.root.children[i];assert.ok(-o.position.z<=967&&-o.position.z>=-40);
  if(previous.length&&absolute[i]!==previous[i]){assert.ok(-o.position.z>=VIEW.roadFadeEnd);assert.equal(absolute[i]-previous[i],1000);recycles++;}
  const p=pathAt(absolute[i]),origin=pathAt(z);assert.ok(Math.abs(o.position.x-(p.x-origin.x))<1e-8);
 }previous=absolute;}
 assert.ok(recycles>50);
});
