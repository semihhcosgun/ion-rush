import * as THREE from 'three';
import {VisibleModelGroup} from './visible-model-group';
import {TITAN,titanEnabled} from './titan';
import type {Race} from './game';
/** One bounded beam with a thin white core, golden halo and local muzzle ring. */
export class TitanView {
 readonly root=new VisibleModelGroup();readonly core:THREE.Mesh;readonly halo:THREE.Mesh;readonly muzzle:THREE.Mesh;
 private readonly forward=new THREE.Vector3(0,0,1);private readonly axis=new THREE.Vector3(0,1,0);private readonly direction=new THREE.Vector3();
 constructor(){
  const geometry=new THREE.CylinderGeometry(1,1,1,8),coreMaterial=new THREE.MeshBasicMaterial({color:0xfff4cf,depthWrite:false}),haloMaterial=new THREE.MeshBasicMaterial({color:0xf6cd79,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});
  this.core=new THREE.Mesh(geometry,coreMaterial);this.halo=new THREE.Mesh(geometry,haloMaterial);this.muzzle=new THREE.Mesh(new THREE.TorusGeometry(.4,.07,6,20),haloMaterial.clone());this.root.add(this.core,this.halo,this.muzzle);this.root.visible=false;
 }
 render(r:Race,origin:{x:number;y:number;z:number}){
  const beam=r.combat.titan;this.root.visible=!!titanEnabled(r)&&beam.active;if(!this.root.visible)return;
  const length=beam.from.distanceTo(beam.to),envelope=Math.min(1,beam.elapsed/.04)*Math.min(1,(TITAN.duration-beam.elapsed)/.1),pulse=1+Math.sin(beam.elapsed*45)*.08;
  this.direction.copy(beam.direction);for(const model of [this.core,this.halo]){model.position.copy(beam.from).addScaledVector(this.direction,length/2);model.position.x-=origin.x;model.position.y-=origin.y;model.position.z-=origin.z;model.quaternion.setFromUnitVectors(this.axis,this.direction);const radius=(model===this.core?.12:.45)*envelope*pulse;model.scale.set(radius,length,radius);}
  this.muzzle.position.copy(beam.from);this.muzzle.position.x-=origin.x;this.muzzle.position.y-=origin.y;this.muzzle.position.z-=origin.z;this.muzzle.quaternion.setFromUnitVectors(this.forward,this.direction);this.muzzle.scale.setScalar(envelope*pulse);(this.muzzle.material as THREE.MeshBasicMaterial).opacity=.6*envelope;
 }
}
