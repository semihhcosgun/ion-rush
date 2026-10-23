import * as THREE from 'three';
import {VisibleModelGroup} from './visible-model-group';
import {IGNITION} from './ignition';

/** Two short, engine-bound pressure plumes, driven only by simulation time. */
export class HeatVentFX {
 readonly root=new VisibleModelGroup();
 private air=new THREE.MeshBasicMaterial({color:new THREE.Color(2,.65,.12),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 private core=new THREE.MeshBasicMaterial({color:new THREE.Color(2.5,1.5,.6),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 constructor(){
  const plume=new THREE.ConeGeometry(.18,.8,10,1,true),cap=new THREE.SphereGeometry(.085,10,6);
  for(const side of [-1,1]){
   const nozzle=new THREE.Group();nozzle.position.set(side*.56,.65,.32);nozzle.rotation.z=-side*Math.PI*.35;
   const steam=new THREE.Mesh(plume,this.air);steam.rotation.z=Math.PI;steam.position.y=.4;
   const glow=new THREE.Mesh(cap,this.core);glow.scale.set(1,1.7,1);nozzle.add(steam,glow);this.root.add(nozzle);
  }
  this.root.visible=false;
 }
 update(remaining:number){
  const progress=1-THREE.MathUtils.clamp(remaining/IGNITION.flashDuration,0,1);
  this.root.visible=remaining>0;
  const envelope=Math.min(1,(1-progress)*3)*Math.min(1,progress*12+.3);
  this.air.opacity=envelope*.6;this.core.opacity=envelope*.85;
  for(const nozzle of this.root.children)nozzle.scale.setScalar(.7+progress*.6);
 }
}
