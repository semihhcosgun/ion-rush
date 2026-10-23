import * as THREE from 'three';
import {VisibleModelGroup} from './visible-model-group';
import {trackPoint} from './combat-space';
import {VANGUARD,vanguardEnabled} from './vanguard';
import type {Race} from './game';
export class VanguardView {
 readonly root=new VisibleModelGroup();readonly satellites:THREE.Group[]=[];readonly pulses:THREE.Mesh[]=[];readonly counters:THREE.Mesh[]=[];
 private readonly forward=new THREE.Vector3(0,0,1);private readonly direction=new THREE.Vector3();
 constructor(){
  const metal=new THREE.MeshStandardMaterial({color:0xbcb4de,metalness:.8,roughness:.25}),violet=new THREE.MeshBasicMaterial({color:0xb49aff});
  for(let i=0;i<VANGUARD.max;i++){
   const drone=new THREE.Group(),core=new THREE.Mesh(new THREE.OctahedronGeometry(.22),violet),wings=new THREE.Mesh(new THREE.BoxGeometry(.9,.07,.25),metal),ring=new THREE.Mesh(new THREE.TorusGeometry(.34,.025,5,16),violet);ring.rotation.x=Math.PI/2;drone.add(core,wings,ring);this.satellites.push(drone);this.root.add(drone);
   const pulse=new THREE.Mesh(new THREE.RingGeometry(.3,.38,24),new THREE.MeshBasicMaterial({color:0xc6adff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));pulse.rotation.x=-Math.PI/2;this.pulses.push(pulse);this.root.add(pulse);
   const shot=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,1.5,6),violet);shot.geometry.rotateX(Math.PI/2);this.counters.push(shot);this.root.add(shot);
  }
  this.root.visible=false;
 }
 render(r:Race,origin:{x:number;y:number;z:number}){
  this.root.visible=!!vanguardEnabled(r);if(!this.root.visible)return;const g=r.combat.vanguard;
  for(let i=0;i<VANGUARD.max;i++){
   const angle=r.time*1.8+i*Math.PI,drone=this.satellites[i],pulse=this.pulses[i],shot=this.counters[i],state=g.counters[i];
   trackPoint(r.z+Math.sin(angle)*1.1,r.surface,r.laneX+Math.cos(angle)*.65,r.playerHeight+.8,drone.position);drone.position.x-=origin.x;drone.position.y-=origin.y;drone.position.z-=origin.z;drone.rotation.y=-angle;drone.visible=g.satellites[i];
   pulse.visible=g.flashes[i]>0;pulse.position.copy(drone.position);pulse.scale.setScalar(1+(1-g.flashes[i]/VANGUARD.flashDuration)*5);(pulse.material as THREE.MeshBasicMaterial).opacity=g.flashes[i]/VANGUARD.flashDuration*.8;
   shot.visible=state.active;if(state.active){shot.position.copy(state.position);shot.position.x-=origin.x;shot.position.y-=origin.y;shot.position.z-=origin.z;shot.quaternion.setFromUnitVectors(this.forward,this.direction.copy(state.velocity).normalize());}
  }
 }
}
