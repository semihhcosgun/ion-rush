import {VisibleModelGroup} from './visible-model-group';
import * as THREE from 'three';

/** A pooled ignition pulse in bike-local space, following every road face. */
export class ReviveFX {
 readonly root=new VisibleModelGroup();
 private age=1;
 private reduced=false;
 private rings:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>[]=[];
 private glow:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
 private sparks:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
 private positions=new Float32Array(16*3);
 constructor(){
  this.root.name='NOVA recovery ignition';this.root.visible=false;
  const geometry=new THREE.RingGeometry(.92,1,48);
  for(let i=0;i<2;i++){
   const ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:i?0x85ffe0:0xffcc83,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
   ring.rotation.x=-Math.PI/2;ring.position.y=.45+i*.45;this.rings.push(ring);this.root.add(ring);
  }
  this.glow=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{strength:{value:0}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=-p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 v;uniform float strength;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.5);gl_FragColor=vec4(.5,1.,.86,rim*strength);}'}));
  this.glow.position.y=1;this.glow.scale.set(1.3,1.8,2);this.root.add(this.glow);
  const particles=new THREE.BufferGeometry();particles.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
  this.sparks=new THREE.Points(particles,new THREE.PointsMaterial({color:0xffd394,size:.08,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.sparks.frustumCulled=false;this.root.add(this.sparks);
 }
 trigger(reduced=false){this.age=0;this.reduced=reduced;this.update(0);}
 reset(){this.age=1;this.root.visible=false;}
 update(dt:number){
  this.age=Math.min(1,this.age+Math.max(0,dt));this.root.visible=this.age<1;if(!this.root.visible)return;
  const t=this.age;
  this.glow.material.uniforms.strength.value=Math.sin(Math.PI*Math.min(1,t/.72))*(this.reduced?.23:.65);
  for(let i=0;i<this.rings.length;i++){
   const p=(t-i*.12)/.78,ring=this.rings[i];ring.visible=!this.reduced&&p>=0&&p<1;
   if(ring.visible){ring.scale.setScalar(.65+3.2*(1-(1-p)**2));ring.material.opacity=Math.sin(Math.PI*p)*.65;}
  }
  this.sparks.visible=!this.reduced;
  if(!this.reduced){for(let i=0;i<16;i++){const a=i*2.39996,r=.45+t*(1+i%3*.35);this.positions[i*3]=Math.cos(a)*r;this.positions[i*3+1]=.6+t*(1.4+i%4*.3);this.positions[i*3+2]=Math.sin(a)*r;}this.sparks.geometry.attributes.position.needsUpdate=true;this.sparks.material.opacity=Math.sin(Math.PI*t)*(1-t)*.85;}
 }
}
