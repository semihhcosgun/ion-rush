import * as THREE from 'three';
import {uploadLivePrefix} from './gpu-upload';
/** Partition static decorative rocks by distance, without removing any instance. */
export class DistantInstances {
 readonly medium:THREE.InstancedMesh;readonly far:THREE.InstancedMesh;
 private originals:THREE.Matrix4[]=[];private position=new THREE.Vector3();
 constructor(private source:THREE.InstancedMesh){
  for(let i=0;i<source.count;i++){const m=new THREE.Matrix4();source.getMatrixAt(i,m);this.originals.push(m);}
  this.medium=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),source.material,source.count);
  this.far=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0x829ba9,fog:false}),source.count);
  for(const mesh of [source,this.medium,this.far]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);}
  source.parent!.add(this.medium,this.far);this.medium.name='Distant ice';this.far.name='Far ice silhouettes';
 }
 update(camera:THREE.Camera){
  const source=this.source;this.medium.visible=this.far.visible=source.visible;if(!source.visible)return;
  source.updateWorldMatrix(true,false);let near=0,middle=0,far=0;
  for(const m of this.originals){this.position.setFromMatrixPosition(m).applyMatrix4(source.matrixWorld);const d=this.position.distanceTo(camera.position);
   if(d<400)source.setMatrixAt(near++,m);else if(d<850)this.medium.setMatrixAt(middle++,m);else this.far.setMatrixAt(far++,m);
  }
  source.count=near;this.medium.count=middle;this.far.count=far;
  for(const mesh of [this.medium,this.far]){mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);}
  const material=this.far.material as THREE.MeshLambertMaterial,map=(source.material as THREE.MeshStandardMaterial).map;
  if(material.map!==map){material.map=map;material.needsUpdate=true;}
  for(const mesh of [source,this.medium,this.far])uploadLivePrefix(mesh.instanceMatrix,mesh.count);
 }
}
