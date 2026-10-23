import {VIEW} from './horizon';
import {makePickupVisual} from './pickup-visual';
import * as THREE from 'three';
import {SURVIVAL} from './config';
import {trackPoint} from './combat-space';
import {pathAt,tangentAt} from './path';
import type {Race} from './game';
/** Fixed pickup pool; both icon types are built once and switched by visibility. */
export class SurvivalView{
 root=new THREE.Group();pickups:THREE.Group[]=[];models:THREE.Group[][]=[];shield:THREE.Mesh;forward=new THREE.Vector3(0,0,-1);axis=new THREE.Vector3(0,0,1);q=new THREE.Quaternion();roll=new THREE.Quaternion();
 constructor(){
  for(let i=0;i<SURVIVAL.pickupPool;i++){const root=new THREE.Group(),sh=makePickupVisual('shield'),hp=makePickupVisual('health');root.scale.setScalar(1.2);root.add(sh,hp);this.root.add(root);this.pickups.push(root);this.models.push([sh,hp]);}
  this.shield=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pulse:{value:0},durability:{value:1}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec3 transformed=position;\n#include <project_vertex>\nn=normalize(normalMatrix*normal);v=-mvPosition.xyz;}',fragmentShader:'uniform float pulse;uniform float durability;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),2.0);vec3 c=mix(vec3(0.2,0.6,1.0),vec3(0.3,1.0,0.85),durability);gl_FragColor=vec4(mix(c,vec3(0.85,1.0,1.0),pulse),0.025+rim*0.55+pulse*0.16);}'}));this.shield.position.set(0,.9,0);this.shield.scale.set(1.2,1.4,1.95);this.shield.renderOrder=2;
 }
 render(r:Race|undefined,menu:boolean){this.root.visible=!menu&&!!r;this.shield.visible=!menu&&!!r&&r.shield>0;if(!r||menu)return;const material=this.shield.material as THREE.ShaderMaterial;material.uniforms.pulse.value=r.shieldFlash/.35;material.uniforms.durability.value=r.shield/SURVIVAL.shieldHits;const origin=pathAt(r.z);let slot=0;
  for(const gate of r.gates){if(!gate.pickup||r.pickupTaken.has(gate.id))continue;const z=gate.z+SURVIVAL.pickupOffset;if(z<r.z-5||z>r.z+VIEW.objectFadeEnd)continue;if(slot>=this.pickups.length)throw Error('Pickup pool exhausted');const o=this.pickups[slot],models=this.models[slot++];o.visible=true;models[0].visible=gate.pickup.kind==='shield';models[1].visible=gate.pickup.kind==='health';models[0].userData.animate?.(r.time,gate.id*.37);models[1].userData.animate?.(r.time,gate.id*.37);o.position.copy(trackPoint(z,gate.safe,gate.pickup.lane,6.3+Math.sin(r.time*2+gate.id)*.16));o.position.x-=origin.x;o.position.y-=origin.y;o.position.z+=r.z;const d=tangentAt(z);this.q.setFromUnitVectors(this.forward,new THREE.Vector3(d.x,d.y,-1).normalize());this.roll.setFromAxisAngle(this.axis,-gate.safe*Math.PI/2);o.quaternion.copy(this.q).multiply(this.roll);
  }for(;slot<this.pickups.length;slot++)this.pickups[slot].visible=false;
 }
}
