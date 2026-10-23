import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {makeVesper} from './vehicle';
import {attachBikeEvolution} from './bike-evolution';
import {batchStatic} from './mesh-batch';
import {contactShadow} from './art-direction';
import {garageSpaceMaterial} from './garage-space';
import {BIKE_TIERS} from './bike-progress';

/** A cached studio render uses the existing WebGL context, independently of race lighting. */
export class GarageShowroom {
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.OrthographicCamera(-3,3,1.75,-1.75,.1,40);
 readonly bike=makeVesper();
 private target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
 private spaceMaterial=garageSpaceMaterial();
 private space=new FullScreenQuad(this.spaceMaterial);
 private screen=new FullScreenQuad(new THREE.MeshBasicMaterial({map:this.target.texture,depthTest:false,depthWrite:false}));
 private accent=new THREE.MeshStandardMaterial({color:0xff8154,emissive:0xff8154,emissiveIntensity:1.8,roughness:.3,metalness:.45});
 private rim=new THREE.DirectionalLight(0xffa16e,2.4);
 private key='';
 private level=-1;
 constructor(environment:THREE.Texture){
  this.scene.environment=environment;this.scene.environmentIntensity=.55;
  this.scene.add(new THREE.HemisphereLight(0xbddfff,0x10131d,.7));
  const key=new THREE.DirectionalLight(0xffebda,3.7);key.position.set(3,6,-4);key.castShadow=true;
  key.shadow.mapSize.set(512,512);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.camera.near=.1;key.shadow.camera.far=16;key.shadow.normalBias=.025;key.shadow.bias=-.00015;
  const fill=new THREE.DirectionalLight(0x86c9e7,1.25);fill.position.set(4,2,5);
  this.rim.position.set(-4,3,1);this.scene.add(key,fill,this.rim,key.target);
  batchStatic(this.bike);attachBikeEvolution(this.bike);
  this.bike.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  this.scene.add(this.bike);
  const surface=new THREE.MeshStandardMaterial({color:0x17232d,metalness:.7,roughness:.28});
  const edge=new THREE.MeshStandardMaterial({color:0x101924,metalness:.8,roughness:.34});
  const disk=(radius:number,height:number,y:number,material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,96),material);mesh.position.y=y;mesh.receiveShadow=true;this.scene.add(mesh);return mesh;};
  disk(2.04,.16,-.21,edge);disk(1.98,.055,-.105,surface);
  const ring=(radius:number,y:number,material:THREE.Material,tube=.012)=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,6,96),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=y;this.scene.add(mesh);};
  ring(2.045,-.17,this.accent,.018);ring(1.86,-.072,new THREE.MeshStandardMaterial({color:0x55717e,metalness:.8,roughness:.32}),.006);
  ring(1.63,-.073,new THREE.MeshStandardMaterial({color:0x344650,metalness:.5,roughness:.5}),.004);
  const ticks=new THREE.Group();
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2,major=i%4===0;const mesh=new THREE.Mesh(new THREE.BoxGeometry(major?.012:.007,.003,major?.11:.045),major?this.accent:surface);mesh.position.set(Math.sin(a)*1.94,-.073,Math.cos(a)*1.94);mesh.rotation.y=a;ticks.add(mesh);}
  batchStatic(ticks);this.scene.add(ticks);
  const shadow=contactShadow();shadow.position.y=-.068;shadow.material.uniforms.opacity.value=.7;shadow.scale.set(.64,1,.78);this.bike.add(shadow);
  // An unlit radial floor fades into the studio without an expensive mirror pass.
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.ShaderMaterial({depthWrite:false,transparent:true,uniforms:{tint:{value:new THREE.Color(0x162a38)}},vertexShader:'varying vec2 v;void main(){v=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform vec3 tint;void main(){float r=length(v);gl_FragColor=vec4(tint,(1.-smoothstep(.05,.55,r))*.55);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.31;this.scene.add(floor);
 }
 invalidate(){this.key='';}
 render(renderer:THREE.WebGLRenderer,angle:number,level:number){
  const mount=document.querySelector('.garage-viewport');if(!mount)return;
  const rect=mount.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
  const ratio=Math.min(2,renderer.getPixelRatio()),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
  const key=`${innerWidth}/${innerHeight}/${angle}/${level}/${rect.x}/${rect.y}/${width}/${height}/${renderer.shadowMap.enabled}`;if(this.key===key)return;this.key=key;
  if(this.level!==level){this.level=level;this.bike.userData.setEvolution(level);this.accent.color.set(BIKE_TIERS[level].color);this.accent.emissive.copy(this.accent.color);this.rim.color.copy(this.accent.color);}
  this.bike.rotation.y=angle;this.bike.userData.animate?.(0);
  const aspect=rect.width/rect.height,vertical=Math.max(3.6,4.8/aspect);
  this.camera.left=-vertical*aspect/2;this.camera.right=vertical*aspect/2;this.camera.top=vertical/2;this.camera.bottom=-vertical/2;
  this.camera.position.set(7,2.05,2.4);this.camera.lookAt(0,.45+Math.max(0,1.5-aspect)*.35,0);this.camera.updateProjectionMatrix();
  if(this.target.width!==width||this.target.height!==height)this.target.setSize(width,height);
  const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),test=renderer.getScissorTest(),target=renderer.getRenderTarget();
  const color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),exposure=renderer.toneMappingExposure,autoClear=renderer.autoClear;
  try{
   renderer.autoClear=false;renderer.toneMappingExposure=1.02;renderer.setScissorTest(false);renderer.setRenderTarget(this.target);renderer.setClearColor(0x070f1a,1);renderer.clear();
   this.spaceMaterial.uniforms.viewSize.value.set(innerWidth,innerHeight);this.spaceMaterial.uniforms.origin.value.set(rect.left,innerHeight-rect.bottom);this.spaceMaterial.uniforms.pixelRatio.value=width/rect.width;this.space.render(renderer);renderer.render(this.scene,this.camera);
   renderer.setRenderTarget(null);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setClearColor(0x070f1a,1);renderer.clear();
   this.spaceMaterial.uniforms.origin.value.set(0,0);this.spaceMaterial.uniforms.pixelRatio.value=renderer.getPixelRatio();this.space.render(renderer);
   renderer.setViewport(rect.left,innerHeight-rect.bottom,rect.width,rect.height);renderer.setScissor(rect.left,innerHeight-rect.bottom,rect.width,rect.height);renderer.setScissorTest(true);this.screen.render(renderer);
  }finally{renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.setClearColor(color,alpha);renderer.toneMappingExposure=exposure;renderer.autoClear=autoClear;}
 }
 dispose(){
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();this.scene.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}if(o instanceof THREE.Light&&'shadow' in o)(o as THREE.DirectionalLight).shadow?.map?.dispose();});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.target.dispose();this.spaceMaterial.dispose();this.space.dispose();this.screen.material.dispose();this.screen.dispose();
 }
}
