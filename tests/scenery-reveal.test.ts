import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SceneryReveal} from '../src/scenery-reveal';
import {horizonFade} from '../src/horizon';

test('scenery fades continuously without changing shared gameplay materials or losing horizon fading',()=>{
 const source=horizonFade(new THREE.MeshStandardMaterial(),700,940),root=new THREE.Group();
 const scenery=new THREE.Mesh(new THREE.BoxGeometry(),source),road=new THREE.Mesh(scenery.geometry,source);root.add(scenery);
 const reveal=new SceneryReveal(root,420,510);
 assert.notEqual(scenery.material,road.material);assert.equal(road.material,source);
 for(const amount of [0,.01,.199,.201,.5,1]){reveal.update(amount);assert.equal(reveal.coverage.value,amount);assert.equal(root.visible,amount>0);}
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};
 scenery.material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
 assert.match(shader.fragmentShader,/horizonCoverage/);assert.match(shader.fragmentShader,/sceneryCoverage/);
 assert.equal((shader.uniforms as Record<string,unknown>).sceneryCoverage,reveal.coverage);
 reveal.update(.3);assert.equal(reveal.coverage.value,.3);
 assert.equal(source.transparent,false);assert.equal(source.opacity,1);
});
