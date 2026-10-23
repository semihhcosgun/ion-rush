import * as THREE from 'three';
import {VisibleModelGroup} from './visible-model-group';
import {SINGULARITY,singularityEnabled} from './singularity';
import type {Race} from './game';
/** Seven fixed meshes. Local accretion disc and lens halo leave the road visible. */
export class SingularityView {
 readonly root=new VisibleModelGroup();readonly core:THREE.Mesh;readonly disc:THREE.Mesh;readonly lens:THREE.Mesh;
 constructor(){
  this.core=new THREE.Mesh(new THREE.SphereGeometry(1.6,20,12),new THREE.MeshBasicMaterial({color:0x020309,depthWrite:true}));
  const gold=new THREE.MeshBasicMaterial({color:0xffc975,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  this.disc=new THREE.Mesh(new THREE.RingGeometry(1.9,3.5,48),gold);this.disc.rotation.x=-Math.PI*.32;
  this.lens=new THREE.Mesh(new THREE.TorusGeometry(1.85,.09,6,48),new THREE.MeshBasicMaterial({color:0xffedd0,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
  this.root.add(this.core,this.disc,this.lens);
  for(let i=0;i<4;i++){const arc=new THREE.Mesh(new THREE.TorusGeometry(2.7+i*.28,.035,4,24,Math.PI*.65),gold.clone());arc.rotation.set(Math.PI*.18,i*Math.PI*.32,i*1.7);this.root.add(arc);}
  this.root.visible=false;
 }
 render(r:Race,origin:{x:number;y:number;z:number}){
  const s=r.combat.singularity;this.root.visible=!!singularityEnabled(r)&&s.busy&&!r.shiftLeft;if(!this.root.visible)return;
  this.root.position.set(s.center.x-origin.x,s.center.y-origin.y,s.center.z-origin.z);
  (this.core.material as THREE.MeshBasicMaterial).color.setHex(s.launching?0xffe5ad:0x020309);
  this.disc.visible=!s.launching;for(let i=3;i<this.root.children.length;i++)this.root.children[i].visible=!s.launching;
  const envelope=Math.min(1,s.elapsed/.12)*Math.min(1,(SINGULARITY.duration-s.elapsed)/.22),pulse=1+s.flash*.7;
  this.root.scale.setScalar(s.launching?.28:envelope*pulse);this.root.rotation.z=r.angle;
  this.disc.rotation.z=s.elapsed*2;this.lens.scale.setScalar(1+Math.sin(s.elapsed*7)*.035);
  for(let i=3;i<this.root.children.length;i++){const arc=this.root.children[i];arc.rotation.z=s.elapsed*(i%2?2:-1.5)+i*1.7;( (arc as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=.35+Math.sin(s.elapsed*8+i)*.15;}
 }
}
