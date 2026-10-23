import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WebGLAttributes} from 'three/src/renderers/webgl/WebGLAttributes.js';
import {uploadLivePrefix} from '../src/gpu-upload';
import {BlastFX} from '../src/blast-fx';

test('Three uploads only the live prefix and preserves data through pool shrink and growth',()=>{
 let gpu=new Float32Array(),sent=0;
 const gl={FLOAT:5126,createBuffer:()=>({}),bindBuffer:()=>{},bufferData:(_t:number,a:Float32Array)=>{gpu=a.slice();},bufferSubData:(_t:number,offset:number,a:Float32Array,start=0,count=a.length)=>{gpu.set(a.subarray(start,start+count),offset/4);sent+=count*4;}};
 const buffers=WebGLAttributes(gl),attribute=new THREE.InstancedBufferAttribute(new Float32Array(12*16),16);
 buffers.update(attribute,34962); // The initial allocation necessarily contains the full pool.
 for(const live of [1,7,2,12,1]){
  for(let i=0;i<live*16;i++)attribute.array[i]=live+i*.25;
  sent=0;uploadLivePrefix(attribute,live);buffers.update(attribute,34962);
  assert.equal(sent,live*16*4);assert.deepEqual(gpu.slice(0,live*16),attribute.array.slice(0,live*16));
  assert.equal(attribute.updateRanges.length,0);
 }
 sent=0;uploadLivePrefix(attribute,0);buffers.update(attribute,34962);assert.equal(sent,0);
});

test('a single blast uploads one twelfth of pool capacity without reducing particles',()=>{
 const fx=new BlastFX();fx.trigger(1,2,3,4);fx.update(.1,{x:0,y:0,z:0},new THREE.Quaternion());
 const attributes=[fx.puffs.instanceMatrix,fx.sparks.instanceMatrix,fx.shards.instanceMatrix,fx.sparks.instanceColor!,...['blastAge','blastSeed','blastMode'].map(k=>fx.puffs.geometry.getAttribute(k) as THREE.BufferAttribute)];
 const full=attributes.reduce((n,a)=>n+a.array.byteLength,0);
 const live=attributes.reduce((n,a)=>n+a.updateRanges.reduce((sum,r)=>sum+r.count*4,0),0);
 assert.equal(full,live*12);assert.equal(fx.puffs.count,9);assert.equal(fx.sparks.count,24);assert.equal(fx.shards.count,8);
 console.log(`Single blast GPU update bytes: ${full} -> ${live}`);
});
