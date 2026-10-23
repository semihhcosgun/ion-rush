import {VisibleModelGroup} from './visible-model-group';
import * as THREE from 'three';

/** A small wisp curls into the rider, followed by a restrained glow inside the torso. */
export class HealthFX {
 root=new VisibleModelGroup();private age=1;private readonly duration=.9;
 private wisps:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[]=[];
 private glow:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 constructor(){
  const geometry=new THREE.PlaneGeometry(1,1);
  const material=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{opacity:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
   varying vec2 p;uniform float opacity;
   void main(){
    float d=dot(p,p);
    float core=exp(-d*14.);
    float mist=exp(-d*4.)*(1.-smoothstep(.55,1.,d));
    vec3 color=mix(vec3(.25,.85,.72),vec3(.83,1.,.94),core);
    gl_FragColor=vec4(color,(core*.65+mist*.3)*opacity);
   }`});
  for(let i=0;i<9;i++){
   const wisp=new THREE.Mesh(geometry,material());wisp.name=i===0?'health-soul-head':'health-soul-trail';
   this.wisps.push(wisp);this.root.add(wisp);
  }
  this.glow=new THREE.Mesh(geometry,material());this.glow.name='health-soul-absorbed';
  // A faint overlay reads as light within the suit, without hiding the character.
  this.glow.material.depthTest=false;this.glow.renderOrder=3;
  this.root.add(this.glow);this.root.visible=false;
 }
 trigger(){this.age=0;}
 reset(){this.age=this.duration;this.root.visible=false;}
 update(dt:number,anchor:THREE.Object3D,camera:THREE.Camera){
  this.age=Math.min(this.duration,this.age+Math.max(0,dt));
  this.root.visible=this.age<this.duration;if(!this.root.visible)return;
  anchor.updateWorldMatrix(true,false);
  for(let i=0;i<this.wisps.length;i++){
   const w=this.wisps[i],progress=(this.age-i*.012)/.36;
   w.visible=progress>=0&&progress<1;if(!w.visible)continue;
   const u=progress*progress*(3-2*progress),remaining=1-u;
   // The thin tail follows the same inward path; nothing bursts away from the rider.
   w.position.set(remaining*(1.15*Math.cos(u*2.4)),1.58+remaining*1.45,.55+remaining*.25).applyMatrix4(anchor.matrixWorld);
   w.quaternion.copy(camera.quaternion);
   const size=(.82-i*.05)*(.6+remaining*.4);
   w.scale.set(size,size*1.4,1);
   w.material.uniforms.opacity.value=Math.min(1,progress/.12)*Math.min(1,(1-progress)/.18)*(i===0?1:.55*(1-i/9));
  }
  const absorbed=Math.max(0,this.age-.27);
  const impact=Math.min(1,absorbed/.07)*Math.exp(-Math.max(0,absorbed-.07)*9);
  this.glow.position.set(0,1.58,.62).applyMatrix4(anchor.matrixWorld);
  this.glow.quaternion.copy(camera.quaternion);this.glow.scale.set(1.5+impact*.35,1.9+impact*.4,1);
  this.glow.material.uniforms.opacity.value=impact*.82;
 }
}
