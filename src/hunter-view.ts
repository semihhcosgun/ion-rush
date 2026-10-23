import * as THREE from 'three';
import {VisibleModelGroup} from './visible-model-group';
import {enemyPoint} from './combat-space';
import {HUNTER} from './hunter';
import type {Race} from './game';

const TRAIL_SEGMENTS=6,TRAIL_INTERVAL=1/60;
/** Two missile models and short, pooled exhaust trails; no particles or extra lights. */
export class HunterView {
 readonly root=new VisibleModelGroup();
 readonly missiles:THREE.Group[]=[];
 readonly trails:THREE.Mesh[][]=[];
 readonly reticle:THREE.LineSegments;
 private readonly forward=new THREE.Vector3(0,0,1);
 private readonly trailAxis=new THREE.Vector3(0,1,0);
 private readonly direction=new THREE.Vector3();
 private readonly history=Array.from({length:HUNTER.missiles},()=>Array.from({length:TRAIL_SEGMENTS},()=>new THREE.Vector3()));
 private readonly sampledAt=new Float64Array(HUNTER.missiles);
 private readonly lastLife=new Float64Array(HUNTER.missiles);
 private readonly wasActive=new Uint8Array(HUNTER.missiles);
 constructor(){
  const shell=new THREE.MeshStandardMaterial({color:0xd8e7ef,emissive:0x1d4762,emissiveIntensity:.6,metalness:.65,roughness:.3});
  const blue=new THREE.MeshBasicMaterial({color:0x8fdcff}),white=new THREE.MeshBasicMaterial({color:0xecfbff,depthWrite:false});
  const glow=new THREE.MeshBasicMaterial({color:0x46caff,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending});
  const body=new THREE.CylinderGeometry(.14,.14,1.05,8),nose=new THREE.ConeGeometry(.17,.4,8),fin=new THREE.BoxGeometry(.8,.06,.4),flame=new THREE.ConeGeometry(.23,1.3,8),core=new THREE.ConeGeometry(.10,.85,8),halo=new THREE.ConeGeometry(.38,1.8,8);
  const trailGeometry=new THREE.CylinderGeometry(1,1,1,6);
  const trailMaterials=Array.from({length:TRAIL_SEGMENTS},(_,j)=>new THREE.MeshBasicMaterial({color:0x8fe5ff,transparent:true,opacity:.65*(1-j/TRAIL_SEGMENTS),depthWrite:false,blending:THREE.AdditiveBlending}));
  for(let i=0;i<HUNTER.missiles;i++){
   const model=new THREE.Group(),hull=new THREE.Mesh(body,shell),tip=new THREE.Mesh(nose,blue),fins=new THREE.Mesh(fin,shell),jet=new THREE.Mesh(flame,blue),hot=new THREE.Mesh(core,white),aura=new THREE.Mesh(halo,glow);
   hull.rotation.x=tip.rotation.x=Math.PI/2;tip.position.z=.7;fins.position.z=-.3;
   for(const exhaust of [jet,hot,aura])exhaust.rotation.x=-Math.PI/2;
   jet.position.z=-1.1;hot.position.z=-.9;aura.position.z=-1.3;
   model.add(hull,tip,fins,aura,jet,hot);model.visible=false;this.root.add(model);this.missiles.push(model);
   const trail=trailMaterials.map(material=>{const mesh=new THREE.Mesh(trailGeometry,material);mesh.visible=false;mesh.frustumCulled=false;this.root.add(mesh);return mesh;});this.trails.push(trail);
  }
  const vertices:number[]=[];
  for(const x of [-1,1])for(const y of [-1,1])vertices.push(x*3.7,y*5,0,x*5,y*5,0,x*5,y*5,0,x*5,y*3.7,0);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  this.reticle=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x78c8ff,transparent:true,opacity:.8,depthWrite:false}));this.reticle.visible=false;this.root.add(this.reticle);this.root.visible=false;
 }
 render(r:Race,origin:{x:number;y:number;z:number},camera:THREE.Quaternion){
  this.root.visible=r.bikeTier===HUNTER.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.failed;if(!this.root.visible){this.wasActive.fill(0);for(const trail of this.trails)for(const segment of trail)segment.visible=false;return;}
  const lock=r.combat.hunter;
  for(let i=0;i<this.missiles.length;i++){
   const state=lock.missiles[i],model=this.missiles[i],history=this.history[i],trail=this.trails[i];model.visible=state.active;
   if(!state.active){this.wasActive[i]=0;for(const segment of trail)segment.visible=false;continue;}
   if(!this.wasActive[i]||state.life>this.lastLife[i]+1e-8||r.time<this.sampledAt[i]){for(const point of history)point.copy(state.position);this.sampledAt[i]=r.time;}
   else if(r.time-this.sampledAt[i]>=TRAIL_INTERVAL){for(let j=history.length-1;j>0;j--)history[j].copy(history[j-1]);history[0].copy(state.previous);this.sampledAt[i]=r.time;}
   this.wasActive[i]=1;this.lastLife[i]=state.life;
   model.position.copy(state.position);model.position.x-=origin.x;model.position.y-=origin.y;model.position.z-=origin.z;
   model.quaternion.setFromUnitVectors(this.forward,this.direction.copy(state.velocity).normalize());model.scale.setScalar(1.7);
   for(let j=0;j<trail.length;j++){
    const segment=trail[j],from=j===0?state.position:history[j-1],to=history[j],length=this.direction.copy(from).sub(to).length();segment.visible=length>1e-4;if(!segment.visible)continue;
    segment.position.copy(from).add(to).multiplyScalar(.5);segment.position.x-=origin.x;segment.position.y-=origin.y;segment.position.z-=origin.z;
    segment.quaternion.setFromUnitVectors(this.trailAxis,this.direction.multiplyScalar(1/length));const radius=.14*(1-j/(TRAIL_SEGMENTS+1));segment.scale.set(radius,length,radius);
   }
  }
  const id=lock.focusId??lock.targetId,target=r.combat.enemies.find(e=>e.active&&e.hp>0&&e.id===id);
  this.reticle.visible=!!target;
  if(target){enemyPoint(target,this.reticle.position);this.reticle.position.x-=origin.x;this.reticle.position.y-=origin.y;this.reticle.position.z-=origin.z;this.reticle.quaternion.copy(camera);this.reticle.scale.setScalar(lock.flash>0?1+lock.flash*.25:1);}
 }
}
