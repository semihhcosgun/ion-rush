import * as THREE from 'three';
import type {Race} from './game';
import {suctionRift} from './rifts';
import {trackPoint} from './combat-space';
import {pathAt} from './path';

// The same spatial deformation is traversed forwards on entry and backwards on exit.
export function suctionAt(elapsed:number){
 // Meet at the distance jump without holding the fully collapsed pose.
 const phase=elapsed<=.82?elapsed/.82:1+(elapsed-.82)/.98;
 return Math.pow(Math.max(0,Math.sin(Math.PI*Math.min(2,Math.max(0,phase))/2)),2);
}

export function liquidPullAt(race?:Race){
 if(!race)return 0;
 if(race.riftTransit){
  const {elapsed}=race.riftTransit;
  return elapsed<=.82?.16+.84*suctionAt(elapsed):suctionAt(elapsed);
 }
 const lead=race.speed*.82+9;
 const rift=race.riftCapture??suctionRift(race);
 if(!rift)return 0;
 const aligned=1-THREE.MathUtils.smoothstep(Math.abs(race.laneX-rift.lane),.48,1);
 return .16*aligned*(1-THREE.MathUtils.smoothstep(rift.z-race.z,lead,lead+72));
}

export class LiquidTransit{
 private uniforms={liquidThroat:{value:new THREE.Vector3(0,3.35,-9)},liquidPull:{value:0},liquidFrame:{value:new THREE.Matrix4()},liquidInverse:{value:new THREE.Matrix4()}};
 constructor(private anchor:THREE.Group,...objects:THREE.Object3D[]){
  const copies=new Map<THREE.Material,THREE.Material>();
  const attach=(source:THREE.Material,clone=false)=>{
   if(copies.has(source))return copies.get(source)!;
   const material=clone?source.clone():source;copies.set(source,material);
   material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,this.uniforms);
    shader.vertexShader='uniform vec3 liquidThroat; uniform float liquidPull; uniform mat4 liquidFrame; uniform mat4 liquidInverse;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
     vec4 mvPosition;
     if(liquidPull<=0.0){
       mvPosition=modelViewMatrix*vec4(transformed,1.0);
     }else{
     vec4 liquidWorld = modelMatrix * vec4(transformed,1.0);
     vec3 liquidLocal = (liquidInverse * liquidWorld).xyz;
     // Front vertices reach the throat first; the rear trails into a continuous filament.
     float front = clamp((2.6-liquidLocal.z)/5.2,0.0,1.0);
     float pull = pow(liquidPull,mix(6.5,0.25,front))*smoothstep(0.0,0.2,liquidPull);
     vec3 throat = liquidThroat;
     liquidLocal = mix(liquidLocal,throat,pull);
     liquidLocal.x *= 1.0-0.65*sin(pull*3.14159265);
     float bend = sin(pull*3.14159265)*(1.0-pull);
     liquidLocal.x += sin(front*4.0+liquidPull*3.0)*bend*0.32;
     liquidLocal.y += bend*0.55;
     mvPosition = viewMatrix * liquidFrame * vec4(liquidLocal,1.0);
     }
     gl_Position = projectionMatrix * mvPosition;
    `);
   };
   material.customProgramCacheKey=()=> 'liquid-vacuum-v3';return material;
  };
  for(const [index,root] of objects.entries())root.traverse(o=>{if(o instanceof THREE.Mesh){o.material=Array.isArray(o.material)?o.material.map(m=>attach(m,index>0)):attach(o.material,index>0);o.customDepthMaterial=attach(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));o.frustumCulled=false;}});
 }
 update(race?:Race){
  this.uniforms.liquidPull.value=liquidPullAt(race);
  if(this.uniforms.liquidPull.value<=0)return;
  this.anchor.updateWorldMatrix(true,false);
  this.uniforms.liquidFrame.value.copy(this.anchor.matrixWorld);
  this.uniforms.liquidInverse.value.copy(this.anchor.matrixWorld).invert();
  if(race){
   const transit=race.riftTransit;
   const rift=transit?.rift??race.riftCapture??suctionRift(race);
   if(rift){
    const origin=pathAt(race.z),z=transit?.portalZ??rift.z;
    this.uniforms.liquidThroat.value.copy(trackPoint(z,transit?.portalSurface??rift.surface,transit?.portalLane??rift.lane,7.55)).sub(new THREE.Vector3(origin.x,origin.y,-race.z)).applyMatrix4(this.uniforms.liquidInverse.value);
   }
  }
 }
}
