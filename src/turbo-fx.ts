import {OVERDRIVE} from './overdrive';
import {VisibleModelGroup} from './visible-model-group';
import * as THREE from 'three';
/** Twin nozzle-bound plasma jets, with a short spool instead of rigid cone scaling. */
export class TurboFX{
 root=new VisibleModelGroup();private strength=0;private materials:THREE.ShaderMaterial[]=[];
 constructor(){
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const radial=20,axial=28;
  for(let j=0;j<=axial;j++){const t=j/axial,r=.095*(1-t)+.075*Math.sin(Math.PI*t);for(let i=0;i<=radial;i++){const a=i/radial*Math.PI*2;positions.push(Math.cos(a)*r,Math.sin(a)*r,t*2.15);uvs.push(i/radial,t);if(j<axial&&i<radial){const k=j*(radial+1)+i;indices.push(k,k+1,k+radial+1,k+1,k+radial+2,k+radial+1);}}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Interpolated UVs can slightly exceed 1 on the GPU; clamp before fractional
  // powers, otherwise NaN propagates from the flame tip through HDR bloom.
  for(const side of [-1,1]){
   const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},power:{value:0},overdrive:{value:0},phase:{value:side*1.7}},vertexShader:`uniform float time;uniform float power;uniform float overdrive;uniform float phase;varying vec2 tex;varying vec3 n;varying vec3 view;void main(){tex=uv;vec3 p=position;float t=uv.y;float ripple=sin(t*34.-time*32.+phase)*sin(t*15.-time*19.);p.xy*=(1.+ripple*.12*t)*(1.+.28*overdrive);p.x+=sin(t*18.-time*24.+phase)*.032*t*t;p.y+=sin(t*21.-time*27.+phase)*.025*t*t;p.z*=(.35+.65*power)*(1.+.85*overdrive);vec4 v=modelViewMatrix*vec4(p,1.);n=normalize(normalMatrix*normal);view=normalize(-v.xyz);gl_Position=projectionMatrix*v;}`,fragmentShader:`uniform float time;uniform float power;uniform float overdrive;uniform float phase;varying vec2 tex;varying vec3 n;varying vec3 view;void main(){float t=clamp(tex.y,0.,1.);float turbulence=.8+.2*sin(t*55.-time*40.+phase)*sin(tex.x*31.+time*8.);float facing=pow(abs(dot(normalize(n),normalize(view))),1.15);float envelope=pow(max(0.,1.-t),1.9)*smoothstep(0.,.035,t);float diamonds=pow(max(0.,sin(t*27.-.8)),9.)*exp(-t*2.8);vec3 color=mix(vec3(.02,.25,1.3),vec3(.04,.9,1.8),1.-t);color=mix(color,vec3(.12,1.7,1.1),overdrive*.75);color+=vec3(2.3,2.6,2.2)*(exp(-t*12.)+diamonds*.75);gl_FragColor=vec4(color,envelope*turbulence*facing*power*.48);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`});
   const plume=new THREE.Mesh(geometry,material);plume.position.set(side*.37,.41,1.34);plume.frustumCulled=false;this.root.add(plume);this.materials.push(material);
   const core=new THREE.Mesh(new THREE.SphereGeometry(.065,16,10),new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,2.8,2.5),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));core.position.set(side*.37,.41,1.36);core.scale.z=2.5;this.root.add(core);
  }
  this.root.visible=false;
 }
 update(dt:number,active:boolean,time:number,overdrive=0,thrust=0){this.strength=THREE.MathUtils.damp(this.strength,active?1:0,active?22:30,Math.max(0,dt));this.root.visible=this.strength>.015;for(const m of this.materials){m.uniforms.time.value=time;m.uniforms.power.value=this.strength;m.uniforms.overdrive.value=active?THREE.MathUtils.clamp(Math.max(overdrive/OVERDRIVE.flashDuration,thrust/OVERDRIVE.maxExtra*.8),0,1):0;}for(const child of this.root.children)if(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshBasicMaterial)child.material.opacity=this.strength;}
 reset(){this.strength=0;this.root.visible=false;}
}
