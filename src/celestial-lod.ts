import * as THREE from 'three';
import {packStaticAttributes} from './packed-static-attributes';
/** Use apparent size: a huge distant planet keeps detail when it fills the screen. */
export class CelestialLOD {
 private entries=new Map<THREE.Mesh,{full:THREE.BufferGeometry;medium:THREE.BufferGeometry;low:THREE.BufferGeometry;radius:number}>();
 private position=new THREE.Vector3();private scale=new THREE.Vector3();
 update(root:THREE.Object3D,camera:THREE.Camera){
  root.traverseVisible(o=>{
   if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh)return;
   let entry=this.entries.get(o);
   if(!entry){
    const sphere=o.geometry.type==='SphereGeometry',rock=o.geometry.type==='IcosahedronGeometry';if(!sphere&&!rock)return;
    const full=o.geometry;full.computeBoundingBox();full.computeBoundingSphere();const b=full.boundingBox!,size=b.getSize(new THREE.Vector3()).multiplyScalar(.5),center=b.getCenter(new THREE.Vector3());
    const make=(fine:boolean)=>{const g=sphere?new THREE.SphereGeometry(1,fine?28:12,fine?18:8):new THREE.IcosahedronGeometry(1,fine?1:0);g.scale(size.x,size.y,size.z);g.translate(center.x,center.y,center.z);packStaticAttributes(g);return g;};
    entry={full,medium:make(true),low:make(false),radius:full.boundingSphere!.radius};this.entries.set(o,entry);
   }
   o.updateWorldMatrix(true,false);o.getWorldPosition(this.position);o.getWorldScale(this.scale);
   const apparent=entry.radius*Math.max(this.scale.x,this.scale.y,this.scale.z)/Math.max(1,this.position.distanceTo(camera.position));
   o.geometry=apparent<.06?entry.low:apparent<.22?entry.medium:entry.full;
  });
 }
 dispose(){for(const e of this.entries.values()){e.full.dispose();e.medium.dispose();e.low.dispose();}this.entries.clear();}
}
