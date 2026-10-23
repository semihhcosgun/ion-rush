import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {packStaticAttributes,packStaticScene} from '../src/packed-static-attributes';

test('packing preserves positions/topology and bounds decoded normal/UV error',()=>{
 const geometry=new THREE.TorusGeometry(3,.5,12,24),position=geometry.attributes.position,index=geometry.index;
 const originals=['normal','uv'].map(name=>geometry.attributes[name].array.slice());
 const bytes=originals.reduce((sum,a)=>sum+a.byteLength,0);
 assert.equal(packStaticAttributes(geometry),bytes/2);
 assert.equal(geometry.attributes.position,position);assert.equal(geometry.index,index);
 ['normal','uv'].forEach((name,j)=>{
  const attribute=geometry.attributes[name] as THREE.BufferAttribute;
  for(let i=0;i<attribute.count;i++)for(let k=0;k<attribute.itemSize;k++)assert.ok(Math.abs(attribute.getComponent(i,k)-originals[j][i*attribute.itemSize+k])<1/32767);
 });
 assert.equal(packStaticAttributes(geometry),0,'repeated loading does not repack or allocate');
});

test('live normals, wrapping UVs and the animated scarf keep their original buffers',()=>{
 const geometry=new THREE.PlaneGeometry();
 geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);geometry.attributes.uv.setX(0,2);
 const normal=geometry.attributes.normal,uv=geometry.attributes.uv;
 assert.equal(packStaticAttributes(geometry),0);
 assert.equal(geometry.attributes.normal,normal);assert.equal(geometry.attributes.uv,uv);
 const scarf=new THREE.Mesh(new THREE.PlaneGeometry());scarf.name='NOVA scarf';
 const scarfNormal=scarf.geometry.attributes.normal;
 assert.equal(packStaticScene(scarf),0);assert.equal(scarf.geometry.attributes.normal,scarfNormal);
});

test('scene packing preserves reusable templates and shares one packed copy per geometry',()=>{
 const source=new THREE.BoxGeometry(),normal=source.attributes.normal;
 const a=new THREE.Mesh(source),b=new THREE.Mesh(source),root=new THREE.Group();root.add(a,b);
 assert.ok(packStaticScene(root)>0);assert.equal(source.attributes.normal,normal);
 assert.notEqual(a.geometry,source);assert.equal(a.geometry,b.geometry);
 assert.equal(a.geometry.attributes.position,source.attributes.position);assert.equal(a.geometry.index,source.index);
 assert.equal(packStaticScene(root),0);
});
