import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** Cache a slowly evolving distant sky in UV space; camera motion stays full rate.
 * Three buffers let the next sky be prepared in strips while two complete skies blend. */
export class TemporalBackdrop {
 readonly material:THREE.ShaderMaterial;
 private targets=Array.from({length:3},()=>new THREE.WebGLRenderTarget(1024,640,{type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false}));
 private source:THREE.ShaderMaterial;
 private quad:FullScreenQuad;
 private previous=0;private current=1;private future=2;
 private base=NaN;private strip=0;private preparing=0;private ready=0;private nextStrip=0;
 readonly period=1;
 constructor(source:THREE.ShaderMaterial){
  this.source=source.clone();this.source.transparent=false;this.source.blending=THREE.NoBlending;this.source.depthTest=false;this.source.depthWrite=false;
  this.source.uniforms.presence.value=1;
  this.quad=new FullScreenQuad(this.source);
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:source.blending,
   uniforms:{previous:{value:this.targets[0].texture},current:{value:this.targets[1].texture},phase:{value:0},presence:{value:0}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`uniform sampler2D previous,current;uniform float phase,presence;varying vec2 vUv;
    void main(){gl_FragColor=mix(texture2D(previous,vUv),texture2D(current,vUv),phase);gl_FragColor.a*=presence;
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
 }
 get initialized(){return this.ready>=2;}
 /** Allocate the three textures and compile the offscreen variant behind loading.
  * The single warm pixel is never displayed: update still builds complete skies. */
 prepare(renderer:THREE.WebGLRenderer){
  const previousTarget=renderer.getRenderTarget(),autoClear=renderer.autoClear;
  try{
   renderer.autoClear=false;
   for(const target of this.targets){
    target.scissor.set(0,0,1,1);target.scissorTest=true;
    renderer.setRenderTarget(target);this.quad.render(renderer);
   }
  }finally{renderer.setRenderTarget(previousTarget);renderer.autoClear=autoClear;}
 }
 update(renderer:THREE.WebGLRenderer,time:number,presence:number){
  if(!Number.isFinite(this.base)||time<this.base||time>this.base+3*this.period){this.base=time;this.ready=0;this.preparing=0;this.strip=0;this.nextStrip=time;}
  if(this.ready===3&&time>=this.base+this.period){
   const old=this.previous;this.previous=this.current;this.current=this.future;this.future=old;
   this.base+=this.period;this.ready=2;this.preparing=2;this.strip=0;this.nextStrip=time;
  }
  if(this.ready<3&&time>=this.nextStrip){
   const index=this.preparing===0?this.previous:this.preparing===1?this.current:this.future,target=this.targets[index];
   const previousTarget=renderer.getRenderTarget(),autoClear=renderer.autoClear;
   this.source.uniforms.time.value=this.base+this.preparing*this.period;
   target.scissor.set(0,this.strip*80,1024,80);target.scissorTest=true;
   try{renderer.autoClear=false;renderer.setRenderTarget(target);this.quad.render(renderer);}
   finally{renderer.setRenderTarget(previousTarget);renderer.autoClear=autoClear;}
   this.strip++;
   if(this.strip===8){this.ready++;this.preparing++;this.strip=0;}
   this.nextStrip=time+(this.initialized?this.period/10:0);
  }
  this.material.uniforms.previous.value=this.targets[this.previous].texture;
  this.material.uniforms.current.value=this.targets[this.current].texture;
  this.material.uniforms.phase.value=THREE.MathUtils.clamp((time-this.base)/this.period,0,1);
  this.material.uniforms.presence.value=presence;
 }
 dispose(){this.targets.forEach(t=>t.dispose());this.source.dispose();this.material.dispose();this.quad.dispose();}
}
