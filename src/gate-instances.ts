import {uploadLivePrefix} from './gpu-upload';
import * as THREE from 'three';

export interface StaticGatePart {part:THREE.Mesh;face:THREE.Object3D;gate:THREE.Object3D;}
/** Share parent transforms across all material pools for one render frame. */
export class GateTransformCache {
 private frame=0;
 private gates=new WeakMap<THREE.Object3D,number>();
 private faces=new WeakMap<THREE.Object3D,{frame:number;matrix:THREE.Matrix4}>();
 beginFrame(){this.frame++;}
 get(gate:THREE.Object3D,face:THREE.Object3D){
  let entry=this.faces.get(face);
  if(entry?.frame===this.frame)return entry.matrix;
  if(this.gates.get(gate)!==this.frame){gate.updateMatrix();this.gates.set(gate,this.frame);}
  face.updateMatrix();
  if(!entry){entry={frame:-1,matrix:new THREE.Matrix4()};this.faces.set(face,entry);}
  entry.matrix.multiplyMatrices(gate.matrix,face.matrix);entry.frame=this.frame;
  return entry.matrix;
 }
}
/** One draw for repeated static gate parts, with the original face/lane transforms. */
export class GateInstances {
 readonly mesh:THREE.InstancedMesh;
 private matrix=new THREE.Matrix4();
 constructor(private entries:StaticGatePart[]){
  const first=entries[0].part;
  this.mesh=new THREE.InstancedMesh(first.geometry,first.material,entries.length);
  this.mesh.name='Instanced static gate parts';this.mesh.frustumCulled=false;
  this.mesh.castShadow=first.castShadow;this.mesh.receiveShadow=first.receiveShadow;
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;
  for(const {part} of entries)part.removeFromParent();
 }
 update(cache?:GateTransformCache){
  let count=0;
  for(const {part,face,gate} of this.entries){
   if(!gate.visible||!face.visible||!part.visible)continue;
   if(part.matrixAutoUpdate)part.updateMatrix();
   if(cache)this.matrix.copy(cache.get(gate,face)).multiply(part.matrix);
   else{gate.updateMatrix();face.updateMatrix();this.matrix.multiplyMatrices(gate.matrix,face.matrix).multiply(part.matrix);}
   this.mesh.setMatrixAt(count++,this.matrix);
  }
  this.mesh.count=count;this.mesh.visible=count>0;
  uploadLivePrefix(this.mesh.instanceMatrix,count);
 }
}
