import * as THREE from 'three';
import {batchStatic} from './mesh-batch';
import {packStaticAttributes} from './packed-static-attributes';

function meshes(root:THREE.Object3D){const result:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)result.push(o);});return result;}

/** Build shared geometry once; lighting, materials and model animation stay live. */
export class DistanceModelGeometry {
 readonly levels:THREE.BufferGeometry[][];
 constructor(root:THREE.Group){
  const temporary=new Set<THREE.BufferGeometry>();
  const copies=[1,2].map(level=>{
   const copy=root.clone(true);
   for(const mesh of meshes(copy)){
    const source=mesh.geometry;
    const p=(source as THREE.SphereGeometry).parameters;
    let geometry:THREE.BufferGeometry|undefined;
    if(source instanceof THREE.SphereGeometry)geometry=new THREE.SphereGeometry(p.radius,level===1?16:8,level===1?10:6,p.phiStart,p.phiLength,p.thetaStart,p.thetaLength);
    else if(source instanceof THREE.ConeGeometry){const p=source.parameters;geometry=new THREE.ConeGeometry(p.radius,p.height,level===1?16:8,p.heightSegments,p.openEnded,p.thetaStart,p.thetaLength);}
    else if(source instanceof THREE.CylinderGeometry){const p=source.parameters;geometry=new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,level===1?16:8,p.heightSegments,p.openEnded,p.thetaStart,p.thetaLength);}
    else if(source instanceof THREE.TorusGeometry){const p=source.parameters;geometry=new THREE.TorusGeometry(p.radius,p.tube,level===1?6:4,level===1?20:12,p.arc);}
    else if(source instanceof THREE.IcosahedronGeometry){const p=source.parameters;geometry=new THREE.IcosahedronGeometry(p.radius,Math.min(p.detail,level===1?1:0));}
    if(geometry){
     // Different polyhedron subdivisions need the original hull dimensions.
     source.computeBoundingBox();geometry.computeBoundingBox();
     const original=source.boundingBox!,replacement=geometry.boundingBox!,a=original.getSize(new THREE.Vector3()),b=replacement.getSize(new THREE.Vector3()),center=original.getCenter(new THREE.Vector3()),oldCenter=replacement.getCenter(new THREE.Vector3());
     geometry.translate(-oldCenter.x,-oldCenter.y,-oldCenter.z);geometry.scale(a.x/Math.max(b.x,1e-8),a.y/Math.max(b.y,1e-8),a.z/Math.max(b.z,1e-8));geometry.translate(center.x,center.y,center.z);
     mesh.geometry=geometry;temporary.add(geometry);
    }
   }
   batchStatic(copy);return meshes(copy).map(m=>m.geometry);
  });
  batchStatic(root);this.levels=[meshes(root).map(m=>m.geometry),...copies];
  if(this.levels.some(level=>level.length!==this.levels[0].length))throw Error('Distant model material layout mismatch');
  for(const level of this.levels)for(const geometry of level)packStaticAttributes(geometry);
  temporary.forEach(g=>g.dispose());
 }
 bind(root:THREE.Group){
  const nodes=meshes(root);let current=-1;
  return (distance:number)=>{
   // Hysteresis avoids exchanging buffers repeatedly near a boundary.
   const level=distance>(current===2?165:185)?2:distance>(current>=1?75:95)?1:0;
   if(level===current)return;
   current=level;nodes.forEach((node,i)=>node.geometry=this.levels[level][i]);
  };
 }
 preview(root:THREE.Group,level:number){const copy=root.clone(true);meshes(copy).forEach((node,i)=>node.geometry=this.levels[level][i]);return copy;}
 dispose(){new Set(this.levels.flat()).forEach(g=>g.dispose());}
}
