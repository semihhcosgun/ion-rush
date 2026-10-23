import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Texture} from 'three';
import {shareBumpSample} from '../src/shared-bump-sample';
test('shared bump sampling only accepts identical color and height textures',()=>{
 const map=new Texture(),m=new MeshStandardMaterial({map,bumpMap:new Texture()});
 assert.equal(shareBumpSample(m),false);m.bumpMap=map;
 let prior=false;m.onBeforeCompile=()=>{prior=true;};
 assert.equal(shareBumpSample(m),true);
 const shader={fragmentShader:'#include <bumpmap_pars_fragment>\n#include <normal_fragment_maps>'};
 m.onBeforeCompile(shader as never,{} as never);
 assert.ok(prior);
 assert.ok(shader.fragmentShader.includes('dHdxy_fwd(sampledDiffuseColor.r)'));
 assert.ok(shader.fragmentShader.includes('vBumpMapUv + dSTdx'));
 assert.ok(shader.fragmentShader.includes('vBumpMapUv + dSTdy'));
 assert.ok(!shader.fragmentShader.includes('texture2D( bumpMap, vBumpMapUv ).x'));
});
