import * as THREE from 'three';
import {uploadLivePrefix} from './gpu-upload';

/** Cache transforms relative to the pool root, including animated nested groups. */
export class AnimatedInstanceTransforms {
 private frame=0;
 private entries=new WeakMap<THREE.Object3D,{frame:number;visible:boolean;matrix:THREE.Matrix4}>();
 private identity=new THREE.Matrix4();
 constructor(private root:THREE.Object3D){}
 beginFrame(){this.frame++;}
 get(node:THREE.Object3D):THREE.Matrix4|undefined {
  if(node===this.root)return this.identity;
  let entry=this.entries.get(node);
  if(entry?.frame===this.frame)return entry.visible?entry.matrix:undefined;
  if(!entry){entry={frame:-1,visible:false,matrix:new THREE.Matrix4()};this.entries.set(node,entry);}
  entry.frame=this.frame;
  const parent=node.parent?this.get(node.parent):undefined;
  entry.visible=!!parent&&node.visible;
  if(!entry.visible)return;
  if(node.matrixAutoUpdate)node.updateMatrix();
  entry.matrix.multiplyMatrices(parent!,node.matrix);
  return entry.matrix;
 }
}

/** Equivalent factory parts share a draw; source nodes retain animation and hierarchy. */
export class AnimatedInstances {
 readonly mesh:THREE.InstancedMesh;
 private masks:number[];
 constructor(private parts:THREE.Mesh[]){
  const first=parts[0];
  this.mesh=new THREE.InstancedMesh(first.geometry,first.material,parts.length);
  this.mesh.name='Instanced animated '+first.name;
  this.mesh.frustumCulled=false;this.mesh.count=0;
  this.mesh.castShadow=first.castShadow;this.mesh.receiveShadow=first.receiveShadow;
  this.mesh.renderOrder=first.renderOrder;
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.masks=parts.map(p=>p.layers.mask);
  // Layers suppress only the original draw, without hiding children or animation nodes.
  parts.forEach(p=>p.layers.mask=0);
 }
 update(cache:AnimatedInstanceTransforms){
  let count=0;
  for(const part of this.parts){const matrix=cache.get(part);if(matrix)this.mesh.setMatrixAt(count++,matrix);}
  this.mesh.count=count;this.mesh.visible=count>0;
  uploadLivePrefix(this.mesh.instanceMatrix,count);
 }
 dispose(){this.parts.forEach((p,i)=>p.layers.mask=this.masks[i]);this.mesh.dispose();}
}
