import * as THREE from 'three';
import {makeNovaRider} from './nova-rider';
import {BIKE_FINISHES} from './bike-finishes';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** VESPER–07: café-racer proportions, magnetic halo wheels, cream/coral livery.
 * NOVA: striped flight helmet, ivory jacket and a turquoise comet scarf.
 * Geometry is built once; the scarf reuses its vertex buffer each frame.
 */
export function makeVesper(ridingDetail=false){
 const bike=new THREE.Group();bike.name='NOVA / VESPER-07';
 const paint=new THREE.MeshPhysicalMaterial({color:0xe94816,metalness:.16,roughness:.36,clearcoat:.8,clearcoatRoughness:.23});
 const ivory=new THREE.MeshPhysicalMaterial({color:0xffedcc,metalness:.2,roughness:.28,clearcoat:.8});
 const chrome=new THREE.MeshStandardMaterial({color:0xb6cad2,metalness:.95,roughness:.2});
 const black=new THREE.MeshStandardMaterial({color:0x101c26,metalness:.4,roughness:.4});
 const leather=new THREE.MeshStandardMaterial({color:0x322820,roughness:.83});
 const glow=new THREE.MeshStandardMaterial({color:0x6af5db,emissive:0x23d9b5,emissiveIntensity:1.5,metalness:.5,roughness:.25});
 const lamp=new THREE.MeshStandardMaterial({color:0xffe6bb,emissive:0xffcc79,emissiveIntensity:2.4});
 const add=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=bike)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;};
 const round=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>add(new RoundedBoxGeometry(w,h,d,ridingDetail?2:3,Math.min(w,h,d)*.23),m,x,y,z);
 const ellipsoid=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const o=add(new THREE.SphereGeometry(1,ridingDetail?24:32,ridingDetail?16:20),m,x,y,z);o.scale.set(w,h,d);return o;};
 const rod=(a:number[],b:number[],r:number,m:THREE.Material)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b);const o=add(new THREE.CylinderGeometry(r,r,p.distanceTo(q),12),m,0,0,0);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),q.sub(p).normalize());return o;};
 // Exposed wishbone frame and compact reactor beneath the long teardrop tank.
 for(const side of [-1,1]){
  rod([side*.24,.48,1],[side*.22,.91,-.66],.055,chrome);
  rod([side*.24,.48,1],[side*.29,.46,-.48],.065,black);
  rod([side*.24,.46,-.48],[side*.22,.91,-.66],.05,chrome);
  rod([side*.2,1.01,-.65],[side*.18,.43,-1.24],.045,chrome);
  const reactor=add(new THREE.CylinderGeometry(.23,.23,.075,32),black,side*.3,.57,.02);reactor.rotation.z=Math.PI/2;
  const ring=add(new THREE.TorusGeometry(.18,.018,8,40),glow,side*.347,.57,.02);ring.rotation.y=Math.PI/2;
  const exhaust=add(new THREE.CylinderGeometry(.105,.14,.9,20),chrome,side*.37,.41,.83);exhaust.rotation.x=Math.PI/2;
  add(new THREE.CircleGeometry(.09,20),glow,side*.37,.41,1.29);
  round(black,side*.3,.62,.06,.065,.24,.47);
  for(let n=0;n<5;n++)round(chrome,side*.338,.53+n*.045,.06,.045,.018,.35);
 }
 ellipsoid(paint,0,.86,-.42,.35,.27,.69);
 ellipsoid(ivory,0,.985,-.43,.095,.157,.58);
 round(leather,0,.91,.53,.5,.16,.76);
 ellipsoid(paint,0,.83,1.01,.3,.22,.39);
 round(lamp,0,.98,1.28,.21,.045,.025);
 const wheelGeometry=new THREE.TorusGeometry(.43,.095,12,56),rimGeometry=new THREE.TorusGeometry(.355,.027,8,56);
 const flightWheels:THREE.Group[]=[];bike.userData.flightWheels=flightWheels;
 for(const z of [-1.25,1.08]){
  const wheelStart=bike.children.length;
  const tire=add(wheelGeometry,black,0,.44,z);tire.rotation.y=Math.PI/2;
  for(const side of [-1,1]){
   const rim=add(rimGeometry,glow,side*.11,.44,z);rim.rotation.y=Math.PI/2;
   const plate=add(new THREE.CylinderGeometry(.3,.3,.025,32),ivory,side*.09,.44,z);plate.rotation.z=Math.PI/2;
   const hub=add(new THREE.CylinderGeometry(.095,.095,.035,20),chrome,side*.12,.44,z);hub.rotation.z=Math.PI/2;
   for(let n=0;n<3;n++){const a=n*Math.PI*2/3;rod([side*.14,.44+Math.cos(a)*.11,z+Math.sin(a)*.11],[side*.14,.44+Math.cos(a+.35)*.29,z+Math.sin(a+.35)*.29],.022,paint);}
  }
  const fender=add(new THREE.TorusGeometry(.56,.07,10,40,Math.PI*.83),paint,0,.44,z);fender.rotation.set(0,Math.PI/2,.27);
  const parts=bike.children.slice(wheelStart),wheel=new THREE.Group();wheel.position.set(0,.44,z);bike.add(wheel);for(const part of parts){part.position.sub(wheel.position);wheel.add(part);}flightWheels.push(wheel);
 }
 // Layered tail, heat shields and mechanical suspension read from the chase camera.
 const brake=new THREE.MeshStandardMaterial({color:0xff4930,emissive:0xff3217,emissiveIntensity:2});
 round(black,0,.87,1.32,.37,.14,.1);round(brake,0,.89,1.38,.29,.045,.035);
 for(const side of [-1,1]){
  ellipsoid(paint,side*.22,.74,.87,.16,.18,.48);
  round(ivory,side*.33,.76,.84,.035,.075,.45);
  const cap=add(new THREE.TorusGeometry(.108,.026,12,40),chrome,side*.37,.41,1.31);
  add(new THREE.CircleGeometry(.082,32),black,side*.37,.41,1.325);
  add(new THREE.CircleGeometry(.035,24),glow,side*.37,.41,1.328);
  rod([side*.2,.76,.74],[side*.17,.46,1.08],.038,chrome);
  for(let k=0;k<7;k++){const spring=add(new THREE.TorusGeometry(.067,.012,8,20),chrome,side*.2,.51+k*.032,.98-k*.032);spring.rotation.x=Math.PI/4;}
  round(black,side*.36,.43,.77,.028,.08,.52);
  for(let k=0;k<4;k++)round(chrome,side*.38,.43,.61+k*.095,.02,.06,.012);
 }
 for(const z of [-1.25,1.08])for(let k=0;k<32;k++){
  const a=k*Math.PI*2/32,tread=add(new THREE.BoxGeometry(.11,.009,.025),black,0,.44+Math.sin(a)*.52,z+Math.cos(a)*.52);tread.rotation.x=-a;
 }
 // A single circular headlamp is the recognisable front signature.
 const head=add(new THREE.CylinderGeometry(.2,.17,.22,32),chrome,0,.95,-1.11);head.rotation.x=Math.PI/2;
 const lens=add(new THREE.CircleGeometry(.161,32),lamp,0,.95,-1.225);lens.rotation.y=Math.PI;
 const bezel=add(new THREE.TorusGeometry(.182,.025,10,40),ivory,0,.95,-1.23);
 bezel.rotation.y=Math.PI;
 rod([-.44,1.16,-.73],[.44,1.16,-.73],.034,chrome);
 for(const side of [-1,1])round(leather,side*.4,1.16,-.73,.17,.08,.1);
 // One shared NOVA model is used in the menu and during every riding mode.
 const rider=makeNovaRider(ridingDetail);bike.add(rider.root);bike.userData.animate=rider.animate;
 bike.userData.setPalette=(primary:string,secondary:string,light:string)=>{paint.color.set(primary);ivory.color.set(secondary);glow.color.set(light);glow.emissive.set(light);};
 bike.userData.setFinish=(level:number)=>{
  const f=BIKE_FINISHES[level];paint.color.set(f.paint);paint.metalness=f.metalness;paint.roughness=f.roughness;
  ivory.color.set(f.secondary);ivory.metalness=level===0?.2:.72;ivory.roughness=level===0?.28:.3;
  glow.color.set(f.light);glow.emissive.set(level===0?'#23d9b5':f.light);glow.emissiveIntensity=level===0?1.5:.85;
 };
 bike.userData.setLivery=(horizon:boolean)=>{bike.userData.setFinish(horizon?7:0);rider.setLivery(horizon);bike.userData.livery=horizon?'event-horizon':'classic';};
 return bike;
}
