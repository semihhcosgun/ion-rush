import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LiquidTransit,liquidPullAt} from '../src/liquid-transit';
import {SurvivalView} from '../src/survival-view';
import {Race} from '../src/game';
import {SURVIVAL} from '../src/config';

test('shield shares the bike portal projection and uniforms, preserving its rim shader and mesh budget',()=>{
 const survival=new SurvivalView(),shield=survival.shield,anchor=new THREE.Group();
 const bike=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());anchor.add(bike,shield);
 const geometry=shield.geometry,vertices=geometry.attributes.position.count,triangles=geometry.index!.count/3;
 const liquid=new LiquidTransit(anchor,bike,shield);
 const compile=(m:THREE.Material,vertexShader:string)=>{const shader={uniforms:{} as Record<string,any>,vertexShader,fragmentShader:''};m.onBeforeCompile(shader as any,{} as THREE.WebGLRenderer);return shader;};
 const material=shield.material as THREE.ShaderMaterial;
 const shieldShader=compile(material,material.vertexShader),bikeShader=compile(bike.material,'#include <project_vertex>');
 assert.ok(!shieldShader.vertexShader.includes('#include <project_vertex>'));
 assert.ok(shieldShader.vertexShader.includes('liquidLocal = mix(liquidLocal,throat,pull);'));
 assert.ok(shieldShader.vertexShader.includes('v=-mvPosition.xyz;'));
 assert.ok(material.fragmentShader.includes('rim*0.55'));
 for(const name of ['liquidPull','liquidThroat','liquidFrame','liquidInverse'])assert.equal(shieldShader.uniforms[name],bikeShader.uniforms[name]);
 const r=new Race();r.shield=SURVIVAL.shieldHits;r.shieldFlash=.2;const health=r.health;
 for(const kind of ['blue','violet','black'] as const){
  const rift={id:1,z:100,kind,surface:0,lane:0,jump:1100,points:900};
  for(const elapsed of [.1,.4,.7,.82,1,1.4,1.79]){
   r.riftTransit={rift,elapsed,jumped:elapsed>.82,portalZ:100,portalSurface:0,portalLane:0,mode:'enter'};
   liquid.update(r);survival.render(r,false);assert.equal(shieldShader.uniforms.liquidPull.value,liquidPullAt(r));assert.ok(shieldShader.uniforms.liquidPull.value>0);assert.ok(shield.visible);
  }
 }
 r.riftTransit=undefined;r.rifts=[];liquid.update(r);assert.equal(shieldShader.uniforms.liquidPull.value,0);
 assert.equal(r.shield,SURVIVAL.shieldHits);assert.equal(r.health,health);assert.equal(material.uniforms.pulse.value,r.shieldFlash/.35);
 assert.equal(shield.geometry,geometry);assert.equal(geometry.attributes.position.count,vertices);assert.equal(geometry.index!.count/3,triangles);assert.equal(anchor.children.length,2);
 r.shield=0;survival.render(r,false);assert.equal(shield.visible,false);survival.render(r,true);assert.equal(shield.visible,false);
});
