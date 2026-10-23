import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {exactVertices} from './exact-vertices';

/** Bake only static meshes. Animated scarf keeps its original buffer and identity. */
export function batchStatic(root:THREE.Object3D,cellSize?:number){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert();
 const batches=new Map<string,{material:THREE.Material;parts:THREE.BufferGeometry[]}>(),sources:THREE.Mesh[]=[];
 root.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.name==='NOVA scarf'||Array.isArray(o.material))return;
  // Preserve vertex reuse exactly; expanding indexed meshes repeats every
  // position, normal and UV for every triangle corner.
  const copy=o.geometry.clone();const g=exactVertices(copy);if(g!==copy)copy.dispose();
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  g.computeBoundingBox();const bounds=g.boundingBox!;
  const cell=cellSize?`${Math.floor((bounds.min.x+bounds.max.x)/2/cellSize)},${Math.floor((bounds.min.z+bounds.max.z)/2/cellSize)}`:'';
  const key=o.material.uuid+'/'+cell;
  const batch=batches.get(key)??{material:o.material,parts:[] as THREE.BufferGeometry[]};batch.parts.push(g);batches.set(key,batch);sources.push(o);
 });
 for(const {material,parts} of batches.values()){const merged=mergeGeometries(parts,false);if(!merged)throw Error('Static geometry batching failed');merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);mesh.matrixAutoUpdate=false;root.add(mesh);parts.forEach(g=>g.dispose());}
 sources.forEach(o=>o.removeFromParent());
 return sources.length-batches.size;
}
