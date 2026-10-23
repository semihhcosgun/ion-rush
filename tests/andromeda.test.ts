import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DeepSpaceArt} from '../src/deep-space-art';
import {ROUTES} from '../src/config';
import {routeText} from '../src/i18n';

test('Andromeda occupies sector 12 and hands off continuously to Sagittarius A*',()=>{
 assert.equal(routeText(ROUTES[11].id,'name'),'ANDROMEDA');
 const art=new DeepSpaceArt(),camera=new THREE.PerspectiveCamera();art.galaxy.material.map=new THREE.Texture();
 const geometry=art.galaxy.geometry;let previous=0;
 for(let z=36000;z<=52000;z+=10){
  art.update(z,0,{x:0,y:0},camera);
  const opacity=art.galaxy.material.opacity;
  assert.ok(opacity>=0&&opacity<=1);assert.ok(Math.abs(opacity-previous)<.01);
  if(z<48000)assert.equal(art.hole.visible,false);
  if(z>=43000&&z<=48000){assert.equal(art.galaxy.visible,true);assert.ok(opacity>.9);}
  if(z>=50500){assert.equal(art.galaxy.visible,false);assert.equal(art.hole.visible,true);}
  assert.equal(art.galaxy.geometry,geometry);previous=opacity;
 }
 art.hide();assert.equal(art.root.visible,false);
});
