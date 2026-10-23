import * as THREE from 'three';
import {packStaticAttributes} from './packed-static-attributes';
/** Use the same model at riding scale; retain full geometry for close menu views. */
export class VehicleGeometryLOD {
 private pairs:{mesh:THREE.Mesh;full:THREE.BufferGeometry;ride:THREE.BufferGeometry}[]=[];
 private riding=false;
 constructor(full:THREE.Object3D,ride:THREE.Object3D){
  const meshes=(root:THREE.Object3D)=>{const a:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name!=='NOVA scarf')a.push(o);});return a;};
  const a=meshes(full),b=meshes(ride);
  if(a.length!==b.length)throw Error('Vehicle detail mesh layout mismatch');
  this.pairs=a.map((mesh,i)=>({mesh,full:mesh.geometry,ride:b[i].geometry}));
  for(const pair of this.pairs){packStaticAttributes(pair.full);packStaticAttributes(pair.ride);}
  const materials=new Set<THREE.Material>();ride.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});materials.forEach(m=>m.dispose());
  // The live scarf is animated in place and never exchanges its buffer.
  ride.getObjectByName('NOVA scarf')?.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
 }
 setRiding(riding:boolean){if(this.riding===riding)return;this.riding=riding;for(const p of this.pairs)p.mesh.geometry=riding?p.ride:p.full;}
 dispose(){const unused=new Set(this.pairs.map(p=>this.riding?p.full:p.ride));unused.forEach(g=>g.dispose());}
}
