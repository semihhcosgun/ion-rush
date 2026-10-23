import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RoadLOD} from '../src/road-lod';
import {horizonFade} from '../src/horizon';

test('LOD keeps nearby panels detailed and covers every road segment across origin shifts',()=>{
 const lod=new RoadLOD();
 for(const economy of [false,true]){lod.setEconomy(economy);assert.equal(lod.includes(200,false),true);assert.equal(lod.includes(200,true),false);
 for(let depth=-32;depth<1000;depth+=8)for(let shift=0;shift<8;shift++){
  const actual=depth-shift;
  if(actual<lod.end.value)assert.ok(lod.includes(depth,false));
  if(actual>lod.start.value)assert.ok(lod.includes(depth,true));
 }}
});

test('near and far shaders retain horizon fade and share live transition uniforms',()=>{
 const lod=new RoadLOD();
 for(const far of [false,true]){
  const material=horizonFade(new THREE.MeshStandardMaterial(),700,940);lod.apply(material,far);
  const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};
  material.onBeforeCompile(shader as any,{} as any);
  assert.match(shader.fragmentShader,/horizonCoverage/);assert.match(shader.fragmentShader,far?/roadNoise>=roadBlend/:/roadNoise<roadBlend/);
  assert.equal((shader.uniforms as any).roadLodStart,lod.start);
  lod.setEconomy(true);assert.equal((shader.uniforms as any).roadLodStart.value,220);
 }
});


test('economy simplifies the distant band while the first 200 metres remain detailed',()=>{
 const lod=new RoadLOD();lod.setEconomy(true);
 assert.equal(lod.start.value,220);assert.equal(lod.end.value,280);
 for(let depth=-32;depth<=200;depth+=8){assert.equal(lod.includes(depth,false),true);assert.equal(lod.includes(depth,true),false);}
 assert.equal(lod.includes(360,false),false);assert.equal(lod.includes(360,true),true);
 lod.setEconomy(false);assert.equal(lod.start.value,340);assert.equal(lod.end.value,440);
});


test('three distance bands cover the road without overlap between the two transitions',()=>{
 const lod=new RoadLOD();
 for(const economy of [false,true]){
  lod.setEconomy(economy);assert.ok(lod.end.value<lod.silhouetteStart.value);
  for(let depth=-32;depth<950;depth+=8)for(let shift=0;shift<8;shift++){
   const actual=depth-shift;
   if(actual<lod.end.value)assert.ok(lod.includes(depth,false));
   if(actual>lod.start.value&&actual<lod.silhouetteEnd.value)assert.ok(lod.includesMiddle(depth));
   if(actual>lod.silhouetteStart.value)assert.ok(lod.includesSilhouette(depth));
  }
  assert.equal(lod.includesMiddle(900),false);assert.equal(lod.includesSilhouette(200),false);
 }
});

test('middle shader composes both transitions without losing the horizon mask',()=>{
 const lod=new RoadLOD(),material=horizonFade(new THREE.MeshLambertMaterial(),700,940);
 lod.apply(material,true);lod.applySilhouette(material,false);
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};
 material.onBeforeCompile(shader as any,{} as any);
 assert.match(shader.fragmentShader,/roadNoise>=roadBlend/);assert.match(shader.fragmentShader,/silhouetteNoise<silhouetteBlend/);assert.match(shader.fragmentShader,/horizonCoverage/);
});


test('far road uses two triangles and exactly matches the detailed panel top face',async()=>{
 const {distantRoadGeometry}=await import('../src/distant-road-geometry');
 const geometry=distantRoadGeometry(),position=geometry.getAttribute('position');
 assert.equal(geometry.index!.count/3,2);
 for(let i=0;i<position.count;i++){
  assert.ok(Math.abs(position.getY(i)-.5)<1e-6);
  assert.equal(Math.abs(position.getX(i)),.5);assert.equal(Math.abs(position.getZ(i)),.5);
  assert.ok(geometry.getAttribute('normal').getY(i)>.999);
 }
 geometry.dispose();
});
