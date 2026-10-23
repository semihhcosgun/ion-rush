import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {exactVertices} from '../src/exact-vertices';
test('duplicate vertices share storage without altering triangle corners or UV seams',()=>{
 const source=new THREE.BoxGeometry(2,3,4,4,4,4).toNonIndexed(),result=exactVertices(source);
 assert.ok(result.attributes.position.count<source.attributes.position.count*.6);
 for(const [name,attr] of Object.entries(source.attributes))for(let i=0;i<attr.count;i++)for(let k=0;k<attr.itemSize;k++){
  assert.equal(result.attributes[name].array[result.index!.getX(i)*attr.itemSize+k],attr.array[i*attr.itemSize+k]);
 }
 assert.equal(result.index!.count,source.attributes.position.count);
});
