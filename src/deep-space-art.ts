import {DistantInstances} from './distant-instances';
import * as THREE from 'three';
import {DEEP_SPACE} from './config';
import {DeepVoid} from './deep-void';

/** A stylised accretion disk and lensed far-side arcs, drawn in one reusable pass. */
export function blackHole(){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},fade:{value:1}},
 vertexShader:`varying vec2 tex;void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float time,fade;varying vec2 tex;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){
  vec2 p=(tex-.5)*2.;p.x*=1.65;float r=length(p),a=atan(p.y,p.x);
  float ellipse=length(vec2(p.x,p.y*4.6));float theta=atan(p.y*4.6,p.x);
  float bands=.54+.3*noise(vec2(ellipse*150.,theta*9.-time*.15))+.16*sin(ellipse*250.+noise(vec2(theta*7.,time*.06))*9.);
  float disk=smoothstep(.28,.36,ellipse)*(1.-smoothstep(.8,1.45,ellipse))*bands;
  disk*=p.y<0.?1.:smoothstep(.265,.34,r);
  float lensRadius=.32+.07*abs(sin(a));
  float arc=exp(-pow((r-lensRadius)/.026,2.))*(.8+.2*noise(vec2(a*8.,time*.12)))*smoothstep(.025,.11,abs(p.y));
  float photon=exp(-pow((r-.273)/.004,2.));
  float haze=exp(-r*3.5)*.085;
  vec3 hot=mix(vec3(1.6,.34,.065),vec3(2.6,1.8,.95),1.-smoothstep(.3,1.2,ellipse));
  float beaming=1.+.48*clamp(-p.x*4.,-1.,1.);
  vec3 color=(hot*disk*beaming+vec3(2.6,1.45,.6)*arc+vec3(2.8,2.25,1.5)*photon)*.58+vec3(.16,.08,.25)*haze;
  float core=1.-smoothstep(.258,.269,r);color*=1.-core;
  float alpha=max(core,clamp(disk*1.5+arc+photon+haze,0.,1.));
  gl_FragColor=vec4(color,alpha*fade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.3,2),material);mesh.name='Sagittarius A*';return mesh;
}

export class DeepSpaceArt {
 private iceLod:DistantInstances;
 root=new THREE.Group();hole=blackHole();ice:THREE.InstancedMesh;
 voidArt=new DeepVoid();
 galaxy=new THREE.Mesh(new THREE.PlaneGeometry(3,2),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false,blending:THREE.AdditiveBlending}));
 constructor(){
  this.root.name='Deep-space expedition';this.root.visible=false;this.root.add(this.hole);
  this.root.add(this.voidArt.root);
  this.galaxy.name='Andromeda / folded corridor';this.galaxy.visible=false;this.galaxy.renderOrder=-7;this.root.add(this.galaxy);
  const geometry=new THREE.IcosahedronGeometry(1,2),material=new THREE.MeshStandardMaterial({color:0x829ba9,roughness:.96,metalness:.06,emissive:0x20323d,emissiveIntensity:.08,bumpScale:4,fog:false});
  const vertices=geometry.attributes.position;for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),rough=1+.12*Math.sin(x*19+y*7)*Math.sin(z*17-x*11);vertices.setXYZ(i,x*rough,y*rough,z*rough);}geometry.computeVertexNormals();
  this.ice=new THREE.InstancedMesh(geometry,material,180);this.ice.name='Kuiper ice';const dummy=new THREE.Object3D();
  let seed=28107;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<180;i++){const side=i%2?1:-1;dummy.position.set(side*(320+rand()*1600),(rand()-.5)*1500,-rand()*8500);dummy.rotation.set(rand()*6,rand()*6,rand()*6);const size=12+rand()*48;dummy.scale.set(size,size*(.5+rand()),size*(.6+rand()));dummy.updateMatrix();this.ice.setMatrixAt(i,dummy.matrix);}this.ice.instanceMatrix.needsUpdate=true;this.root.add(this.ice);this.iceLod=new DistantInstances(this.ice);
 }
 update(z:number,time:number,origin:{x:number;y:number},camera:THREE.Camera){
  this.root.visible=z>17500;if(!this.root.visible)return;
  this.voidArt.update(z,time,origin,camera);
  this.ice.visible=z<31000;this.ice.position.set(-origin.x,-origin.y,z-DEEP_SPACE.kuiper);this.iceLod.update(camera);
  // Establish the galaxy at a distance, open its disk across sector 12, then
  // let it recede through the return fold as the galactic heart comes into view.
  const arrival=THREE.MathUtils.smoothstep(z,37000,43000),departure=THREE.MathUtils.smoothstep(z,48000,50500);
  this.galaxy.visible=z>37000&&z<50500&&!!this.galaxy.material.map;
  this.galaxy.material.opacity=arrival*(1-departure)*.95;
  const approach=THREE.MathUtils.smoothstep(z,39000,48000);
  this.galaxy.position.set(-750-origin.x,150-origin.y,-(5200-approach*2400));
  this.galaxy.scale.setScalar((650+approach*1000)*(1-departure*.35));
  this.galaxy.quaternion.copy(camera.quaternion);
  this.hole.visible=z>48000;
  const progress=THREE.MathUtils.smoothstep(z,48000,DEEP_SPACE.target);
  this.hole.material.uniforms.time.value=time;this.hole.material.uniforms.fade.value=THREE.MathUtils.smoothstep(z,48000,50000);
  this.hole.position.set(-850-origin.x,350-origin.y,-(5400-progress*3600));this.hole.scale.setScalar(420+progress*1000);this.hole.quaternion.copy(camera.quaternion);
 }
 hide(){this.root.visible=false;}
}
