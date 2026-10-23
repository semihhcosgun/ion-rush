import {VisibleModelGroup} from './visible-model-group';
import * as THREE from 'three';
import {trackPoint} from './combat-space';
import {tangentAt} from './path';
import {METEOR,meteorProfile} from './meteors';
import {meteorRoadMaterial,meteorRockMaterial,meteorPlasmaMaterial,meteorWakeMaterial} from './meteor-materials';
import {meteorBodyGeometry,meteorWakeGeometry} from './meteor-body';
import {fractureMeteor,fragmentHeight} from './meteor-fracture';
import type {Race} from './game';

const forward=new THREE.Vector3(0,0,-1),up=new THREE.Vector3(0,1,0);
function glow(color:number,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});}
/** Two persistent effect slots; road tiles follow the actual curved track. */
export class MeteorView {
 detail=0;
 root=new VisibleModelGroup();private slots=Array.from({length:2},()=>this.makeSlot());private origin=new THREE.Vector3();private direction=new THREE.Vector3();private dummy=new THREE.Object3D();
 constructor(){this.root.name='meteor-field';for(const s of this.slots)this.root.add(s.root);this.root.visible=false;}
 private makeSlot(){
  const root=new VisibleModelGroup(),anchor=new THREE.Group();root.add(anchor);
  const material=meteorRoadMaterial(),roadGeo=new THREE.PlaneGeometry(2,1,8,96),road=new THREE.Mesh(roadGeo,material);road.frustumCulled=false;root.add(road);
  const target=new THREE.Group();anchor.add(target);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.76,.85,64),glow(0xff9f43));ring.rotation.x=-Math.PI/2;target.add(ring);
  const countdown=new THREE.Mesh(new THREE.RingGeometry(.88,.96,64),glow(0xffd69b));countdown.rotation.x=-Math.PI/2;target.add(countdown);
  const rockGeo=meteorBodyGeometry();
  const rock=new THREE.Mesh(rockGeo,meteorRockMaterial());anchor.add(rock);
  const fractureMaterial=new THREE.MeshStandardMaterial({color:0x4f2820,emissive:0xff641c,emissiveIntensity:.7,roughness:1,flatShading:true});
  const fragments=fractureMeteor(rockGeo).map(part=>{const mesh=new THREE.Mesh(part.geometry,[rock.material,fractureMaterial]);mesh.visible=false;anchor.add(mesh);return {...part,mesh};});
  const flame=new THREE.Mesh(meteorWakeGeometry(),meteorWakeMaterial());anchor.add(flame);
  const hot=new THREE.Mesh(new THREE.SphereGeometry(1,20,16),meteorPlasmaMaterial());anchor.add(hot);
  const craterGeo=new THREE.TorusGeometry(.67,.17,8,48);const cp=craterGeo.attributes.position;for(let j=0;j<cp.count;j++){const a=Math.atan2(cp.getY(j),cp.getX(j)),k=1+.1*Math.sin(a*7)+.065*Math.cos(a*13);cp.setXYZ(j,cp.getX(j)*k,cp.getY(j)*k,cp.getZ(j)*(1+.3*Math.sin(a*11)));}craterGeo.computeVertexNormals();const crater=new THREE.Mesh(craterGeo,new THREE.MeshStandardMaterial({color:0x382722,emissive:0xff3708,emissiveIntensity:1,roughness:.96,flatShading:true}));crater.rotation.x=-Math.PI/2;crater.scale.set(1,1,.5);anchor.add(crater);
  const shock=new THREE.Mesh(new THREE.RingGeometry(.88,1,64),glow(0xffb86a));shock.rotation.x=-Math.PI/2;anchor.add(shock);
  const flash=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),meteorPlasmaMaterial());anchor.add(flash);
  const smoke=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,10),meteorPlasmaMaterial(true),10);smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);smoke.frustumCulled=false;anchor.add(smoke);
  const emberGeo=new THREE.BufferGeometry();emberGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(96*3),3));const embers=new THREE.Points(emberGeo,new THREE.PointsMaterial({color:0xffaf51,size:.065,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));embers.frustumCulled=false;anchor.add(embers);
  const debris=Array.from({length:18},(_,i)=>{const mesh=new THREE.Mesh(rockGeo,i%3?rock.material:glow(0xffa147));mesh.scale.setScalar(.05+(i%4)*.045);anchor.add(mesh);return mesh;});
  return {effectMeteor:undefined as Race['meteors']['items'][number]|undefined,detail:0,root,anchor,material,road,smoke,embers,target,ring,countdown,rock,fragments,fractureMaterial,flame,hot,crater,shock,flash,debris};
 }
 render(r:Race|undefined,menu:boolean,origin:{x:number;y:number}){
  this.root.visible=!!r&&!menu;if(!r||menu)return;this.origin.set(origin.x,origin.y,-r.z);
  for(let i=0;i<this.slots.length;i++){
   const s=this.slots[i],m=r.meteors.items[i];s.root.visible=!!m&&m.age>=0;if(!m||m.age<0)continue;
   if(s.effectMeteor!==m){s.effectMeteor=m;s.detail=this.detail;}
   const smokeCount=s.detail>=2?3:s.detail===1?6:10,emberCount=s.detail>=2?32:s.detail===1?56:96;
   const warning=meteorProfile(m).warning,fall=Math.min(1,m.age/warning),after=Math.max(0,m.age-warning),heat=1-THREE.MathUtils.smoothstep(after,2,METEOR.cooling);
   s.material.uniforms.time.value=r.time;s.material.uniforms.heat.value=heat;s.material.uniforms.warning.value=m.impact?0:1;s.material.uniforms.fill.value=fall;
   const length=m.end-m.z+8;
   s.material.uniforms.span.value=length;s.material.uniforms.age.value=after;s.material.uniforms.seed.value=m.id*13.71;
   // One connected ribbon follows the surface; its UV never restarts at a segment boundary.
   const vertices=s.road.geometry.attributes.position,uv=s.road.geometry.attributes.uv;
   const roadKey=`${m.id}:${m.z}:${m.surface}:${m.lane}:${length}`;
   if(s.road.userData.key!==roadKey){for(let j=0;j<vertices.count;j++){const u=uv.getX(j),v=uv.getY(j),point=trackPoint(m.z-8+v*length,m.surface,m.lane+(u-.5)*1.95/2.2,4.065);vertices.setXYZ(j,point.x,point.y,point.z);}vertices.needsUpdate=true;s.road.userData.key=roadKey;}s.road.position.copy(this.origin).negate();
   s.anchor.position.copy(trackPoint(m.z,m.surface,m.lane,4.09)).sub(this.origin);const d=tangentAt(m.z);this.direction.set(d.x,d.y,-1).normalize();s.anchor.quaternion.setFromUnitVectors(forward,this.direction);s.anchor.rotateZ(-m.surface*Math.PI/2);
   s.target.visible=!m.impact;s.target.scale.setScalar(1+fall*.15);(s.ring.material as THREE.MeshBasicMaterial).opacity=.45+.5*fall;
   s.countdown.geometry.setDrawRange(0,Math.floor(fall*64)*6);s.countdown.rotation.z=r.time*.3;
   s.rock.visible=!m.impact||after<.045;s.flame.visible=s.hot.visible=!m.impact||after<.15;
   const poseAge=Math.min(m.age,warning),remaining=1-fall*fall;s.rock.position.set(-remaining*12,remaining*42+.85,-remaining*20);s.rock.rotation.set(poseAge*.22,-.3+poseAge*.31,poseAge*.17);s.rock.scale.set(1,m.impact?1-.12*Math.min(1,after/.045):1,1);s.hot.position.copy(s.rock.position);
   s.fractureMaterial.emissiveIntensity=.7*heat;
   for(const part of s.fragments){const piece=part.mesh,j=part.id;piece.visible=m.impact&&after>=.035&&after<5;if(!piece.visible)continue;const t=Math.max(0,after-.035),flight=t*t/(t+.035),drag=(1-Math.exp(-flight*1.3))/1.3,a=j*2.399;
    piece.quaternion.copy(s.rock.quaternion);piece.position.copy(part.centroid).applyQuaternion(piece.quaternion);const start=piece.position.y+.85;
    piece.position.x+=(1.3+Math.cos(a)*(1.5+j%3))*drag;
    piece.position.z+=(2.8+Math.sin(a)*(1.1+j%4*.45))*drag;
    piece.position.y=fragmentHeight(flight,start,1.8+j%4*.85);
    const spin=(1-Math.exp(-flight*1.8))*(1+j%3);piece.rotateX(spin*(j%2?1:-1));piece.rotateZ(spin*.7);
    piece.scale.setScalar(1-THREE.MathUtils.smoothstep(after,4.3,5));
   }
   this.direction.set(-12,42,-20).normalize();s.flame.quaternion.setFromUnitVectors(up,this.direction);s.flame.position.copy(s.rock.position).addScaledVector(this.direction,.55);s.flame.scale.set(1, .7+fall*.45,1);s.hot.scale.set(1.27,1.08,1.19);
   for(const volume of [s.flame,s.hot,s.flash,s.smoke]){const mat=volume.material as THREE.ShaderMaterial;mat.uniforms.time.value=r.time;mat.uniforms.strength.value=1;}
   (s.hot.material as THREE.ShaderMaterial).uniforms.strength.value=.16;
   if(m.impact){(s.flame.material as THREE.ShaderMaterial).uniforms.strength.value=Math.max(0,1-after/.15);(s.hot.material as THREE.ShaderMaterial).uniforms.strength.value=.16*Math.max(0,1-after/.15);}
   const smokeEnd=5-s.detail*.7;s.smoke.count=smokeCount;s.smoke.visible=m.impact&&after<smokeEnd;const smokeMat=s.smoke.material as THREE.ShaderMaterial;smokeMat.uniforms.strength.value=(1-THREE.MathUtils.smoothstep(after,2.3-s.detail*.3,smokeEnd))*Math.min(1,after*4);
   if(s.smoke.visible){for(let k=0;k<smokeCount;k++){const j=Math.floor(k*10/smokeCount),a=j*2.399,t=Math.max(0,after-j*.018),spread=1-Math.exp(-t*2);this.dummy.position.set((.5+Math.cos(a)*1.1)*spread,.12+t*(j<6?.24:.65),(.9+Math.sin(a)*1.4)*spread);this.dummy.scale.set(.15+t*.8,.13+t*(j<6?.28:.65),.2+t);this.dummy.rotation.set(j*.7,after*.14,j);this.dummy.updateMatrix();s.smoke.setMatrixAt(k,this.dummy.matrix);}s.smoke.instanceMatrix.needsUpdate=true;}
   s.embers.visible=!m.impact||after<2.8;s.embers.geometry.setDrawRange(0,emberCount);const ep=s.embers.geometry.attributes.position;if(s.embers.visible){for(let k=0;k<emberCount;k++){const j=Math.floor(k*96/emberCount),a=j*2.399,v=1.5+j%11*.65,t=after*(.8+j%5*.08);if(m.impact)ep.setXYZ(k,Math.cos(a)*v*t,(3+j%7*.65)*t-4.9*t*t+.12,Math.sin(a)*v*t);else{const trail=((m.age*1.3+j/96)%1),spread=.4+trail*.7;ep.setXYZ(k,s.rock.position.x+this.direction.x*trail*9+Math.cos(a)*spread,s.rock.position.y+this.direction.y*trail*9,s.rock.position.z+this.direction.z*trail*9+Math.sin(a)*spread);}}ep.needsUpdate=true;}(s.embers.material as THREE.PointsMaterial).opacity=m.impact?Math.max(0,1-after/2.8):.8;
   s.crater.visible=m.impact;(s.crater.material as THREE.MeshStandardMaterial).emissiveIntensity=heat*1.8;
   s.shock.visible=m.impact&&after<.45;s.shock.scale.setScalar(.65+after*8);s.shock.position.y=.05;(s.shock.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-after/.45)*.32;
   s.flash.visible=m.impact&&after<.14;s.flash.scale.set(.9+after*8,.35+after*3,.9+after*9);(s.flash.material as THREE.ShaderMaterial).uniforms.strength.value=Math.max(0,1-after/.14)*.85;
   s.debris.forEach((piece,j)=>{piece.visible=(m.impact?after<1.65:j<6)&&(s.detail===0||j%(s.detail+1)===0);if(!piece.visible)return;const a=j*2.399,v=2+j%5;if(m.impact)piece.position.set(Math.cos(a)*v*after,Math.max(.05,(3+j%4)*after-4.9*after*after),Math.sin(a)*v*after);else{const age=(m.age*.8+j*.17)%1;piece.position.copy(s.rock.position).addScaledVector(this.direction,.8+age*5);piece.position.x+=Math.cos(a)*age*.9;piece.position.z+=Math.sin(a)*age*.9;}piece.rotation.set(m.age*(j+1),j+m.age*3,m.age);});
  }
 }
}
