import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareLightingMaterial} from '../src/lighting-precision';

test('lighting precision preserves custom shader hooks and high-precision stage interfaces',()=>{
 const material=new THREE.MeshPhysicalMaterial();let called=0;
 material.onBeforeCompile=shader=>{called++;shader.fragmentShader='varying float horizonDepth;\n'+shader.fragmentShader;};
 material.customProgramCacheKey=()=>'horizon-test';
 prepareLightingMaterial(material);const hook=material.onBeforeCompile;
 prepareLightingMaterial(material);assert.equal(material.onBeforeCompile,hook);
 const shader={vertexShader:'varying vec3 vNormal;\nvoid main(){}',fragmentShader:THREE.ShaderLib.physical.fragmentShader};
 const vertex=shader.vertexShader;material.onBeforeCompile(shader as never,{} as never);
 assert.equal(called,1);assert.equal(shader.vertexShader,vertex);
 assert.ok(shader.fragmentShader.startsWith('precision mediump float;'));
 assert.ok(shader.fragmentShader.includes('varying highp float horizonDepth;'));
 assert.ok(shader.fragmentShader.includes('varying highp vec3 vViewPosition;'));
 assert.ok(!/#include </.test(shader.fragmentShader));
 assert.equal(material.customProgramCacheKey(),'horizon-test/bounded-lighting-v1');
});

test('procedural and unlit materials keep their original precision and shader programs',()=>{
 for(const material of [new THREE.ShaderMaterial(),new THREE.MeshBasicMaterial()]){
  const hook=material.onBeforeCompile,key=material.customProgramCacheKey(),version=material.version;
  prepareLightingMaterial(material);
  assert.equal(material.onBeforeCompile,hook);assert.equal(material.customProgramCacheKey(),key);assert.equal(material.version,version);
 }
});
