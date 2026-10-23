import * as THREE from 'three';
import {PHANTOM} from './phantom';
import {VisibleModelGroup} from './visible-model-group';
/** Cached local material copies keep ghosting away from scenery and restore exact originals. */
export class PhaseFX {
 readonly root=new VisibleModelGroup();
 private readonly clones=new Map<THREE.Material,THREE.Material>();
 private bindings:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[];castShadow:boolean}[]=[];
 private active=false;
 private readonly glow=new THREE.MeshBasicMaterial({color:0xef8cdd,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 constructor(){
  const ring=new THREE.TorusGeometry(.9,.025,5,28),streak=new THREE.CylinderGeometry(.025,.025,1.7,5);
  for(const z of [-.75,.8]){const mesh=new THREE.Mesh(ring,this.glow);mesh.position.set(0,.9,z);mesh.scale.set(1,1.35,1);this.root.add(mesh);}
  for(const x of [-.75,0,.75]){const mesh=new THREE.Mesh(streak,this.glow);mesh.rotation.x=Math.PI/2;mesh.position.set(x,.8,2.1);this.root.add(mesh);}
  this.root.visible=false;
 }
 private begin(roots:THREE.Object3D[]){
  const refreshed=new Set<THREE.Material>();
  const ghost=(source:THREE.Material)=>{
   let copy=this.clones.get(source);if(!copy){copy=source.clone();this.clones.set(source,copy);}
   if(!refreshed.has(source)){
    copy.copy(source);copy.onBeforeCompile=source.onBeforeCompile;copy.customProgramCacheKey=source.customProgramCacheKey;
    copy.transparent=true;copy.opacity=Math.min(source.opacity,.32);copy.depthWrite=false;
    if(copy instanceof THREE.MeshStandardMaterial||copy instanceof THREE.MeshBasicMaterial)copy.color.lerp(new THREE.Color(0xef8cdd),.6);
    if(copy instanceof THREE.MeshStandardMaterial){copy.emissive.set(0xa142bb);copy.emissiveIntensity=.25;}
    copy.needsUpdate=true;refreshed.add(source);
   }
   return copy;
  };
  for(const root of roots)root.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;let ancestor:THREE.Object3D|null=o;
   while(ancestor){if(ancestor===this.root)return;ancestor=ancestor.parent;}
   const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.some(m=>m instanceof THREE.ShaderMaterial))return;
   this.bindings.push({mesh:o,material:o.material,castShadow:o.castShadow});o.material=Array.isArray(o.material)?o.material.map(ghost):ghost(o.material);o.castShadow=false;
  });
 }
 update(active:boolean,remaining:number,time:number,...objects:THREE.Object3D[]){
  if(active&&!this.active)this.begin(objects);if(!active&&this.active)this.reset();this.active=active;this.root.visible=active;if(!active)return;
  const progress=1-THREE.MathUtils.clamp(remaining/PHANTOM.duration,0,1),envelope=Math.min(1,remaining/.09);
  this.glow.opacity=envelope*(.42+Math.sin(time*20)*.08);
  for(let i=0;i<2;i++){this.root.children[i].rotation.z=(i===0?1:-1)*(time*1.7);this.root.children[i].position.z=(i===0?-.8:.8)+progress*.4;}
 }
 reset(){for(const binding of this.bindings){binding.mesh.material=binding.material;binding.mesh.castShadow=binding.castShadow;}this.bindings=[];this.active=false;this.root.visible=false;}
 dispose(){this.reset();for(const material of this.clones.values())material.dispose();this.clones.clear();}
}
