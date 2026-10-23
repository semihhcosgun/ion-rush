import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector2} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ReducedBloomPass} from '../src/reduced-bloom-pass';

test('bloom reduces intermediate allocation on landscape and portrait buffers without changing HDR glow settings',()=>{
  const reduced=new ReducedBloomPass(new Vector2(1280,720),.24,.45,1.35);
  const original=new UnrealBloomPass(new Vector2(1280,720),.24,.45,1.35);
  const targets=(pass:UnrealBloomPass)=>[pass.renderTargetBright,...pass.renderTargetsHorizontal,...pass.renderTargetsVertical];
  const pixels=(pass:UnrealBloomPass)=>targets(pass).reduce((sum,t)=>sum+t.width*t.height,0);
  for(const [width,height] of [[1280,720],[760,390],[1170,2532],[2532,1170]]){
    reduced.setSize(width,height);original.setSize(width,height);
    assert.ok(pixels(reduced)/pixels(original)<.26);
    for(const target of targets(reduced)){
      assert.equal(target.depthBuffer,false);assert.equal(target.stencilBuffer,false);
      assert.equal(target.texture.type,original.renderTargetBright.texture.type);
    }
    assert.equal(reduced.strength,original.strength);
    assert.equal(reduced.radius,original.radius);
    assert.equal(reduced.threshold,original.threshold);
  }
  reduced.dispose();original.dispose();
});

test('every bloom mip remains renderable after a collapsed or tiny viewport resize',()=>{
  const bloom=new ReducedBloomPass(new Vector2(1,1),.24,.45,1.35);
  for(const [width,height] of [[0,0],[1,1],[2,3],[3,2],[10,100]]){
    bloom.setSize(width,height);
    for(const target of [bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical]){
      assert.ok(target.width>=1&&target.height>=1);
    }
    for(const material of bloom.separableBlurMaterials){
      const inv=material.uniforms.invSize.value as Vector2;
      assert.ok(Number.isFinite(inv.x)&&Number.isFinite(inv.y));
    }
  }
  bloom.dispose();
});
