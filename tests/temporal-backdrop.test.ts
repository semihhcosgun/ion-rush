import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TemporalBackdrop} from '../src/temporal-backdrop';

test('loading prepares all backing textures without exposing incomplete sky frames',()=>{
 const cache=new TemporalBackdrop(new THREE.ShaderMaterial({uniforms:{time:{value:0},presence:{value:1}}}));
 const original=new THREE.WebGLRenderTarget(2,2),targets=new Set<THREE.WebGLRenderTarget>();let target=original;
 const renderer={autoClear:true,getRenderTarget:()=>target,setRenderTarget:(value:THREE.WebGLRenderTarget)=>{target=value;},render:()=>{
  assert.deepEqual(target.scissor.toArray(),[0,0,1,1]);assert.equal(target.scissorTest,true);targets.add(target);
 }} as unknown as THREE.WebGLRenderer;
 cache.prepare(renderer);assert.equal(targets.size,3);assert.equal(target,original);assert.equal(renderer.autoClear,true);assert.equal(cache.initialized,false);
 cache.dispose();original.dispose();
});

test('the sky only displays complete frames while the next texture is built in strips',()=>{
 const cache=new TemporalBackdrop(new THREE.ShaderMaterial({uniforms:{time:{value:0},presence:{value:1}}}));
 const rows=new Map<THREE.Texture,number[]>();let target:THREE.WebGLRenderTarget|null=null,draws=0;
 const renderer={autoClear:true,getRenderTarget:()=>target,setRenderTarget:(t:THREE.WebGLRenderTarget|null)=>{target=t;},render:(mesh:THREE.Mesh)=>{
  assert.ok(target);const contents=rows.get(target.texture)??Array(8).fill(NaN);contents[target.scissor.y/80]=(mesh.material as THREE.ShaderMaterial).uniforms.time.value;rows.set(target.texture,contents);draws++;
 }} as unknown as THREE.WebGLRenderer;
 for(let frame=0;frame<600;frame++){
  const time=frame/60;cache.update(renderer,time,.8);
  assert.equal(renderer.autoClear,true);assert.equal(target,null);
  if(!cache.initialized)continue;
  const previous=rows.get(cache.material.uniforms.previous.value)!,current=rows.get(cache.material.uniforms.current.value)!;
  assert.ok(previous.every(t=>Number.isFinite(t)&&t===previous[0]));
  assert.ok(current.every(t=>Number.isFinite(t)&&t===current[0]));
  assert.equal(current[0]-previous[0],1);
  const visibleTime=previous[0]+cache.material.uniforms.phase.value;
  if(time>2)assert.ok(Math.abs(visibleTime-time)<.15);
 }
 assert.ok(draws<110,'slow sky is reused between frame samples');
 cache.update(renderer,100,.6);assert.equal(cache.initialized,false,'large gaps rebuild before displaying');
 cache.dispose();
});
