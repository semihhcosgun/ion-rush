import {uploadLivePrefix} from './gpu-upload';
import {DistanceModelGeometry} from './distance-model-geometry';
import {VisibleModelGroup} from './visible-model-group';
import {warpFlare,warpMaterial} from './warp-fx';
import {BlastFX} from './blast-fx';
import {HunterView} from './hunter-view';
import {VanguardView} from './vanguard-view';
import {SingularityView} from './singularity-view';
import {TitanView} from './titan-view';
import {enemyPose} from './combat-space';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {COMBAT,TUNE,ENEMY_TYPES,ENEMY_ENTRY,type EnemyKind} from './config';
import {pathAt,tangentAt} from './path';
import {enemyWarningLanes} from './combat';
import type {Race} from './game';
const kinds=Object.keys(ENEMY_TYPES) as EnemyKind[];
export class CombatView {
 private geometryTemplates:DistanceModelGeometry[]=[];
 private modelDetail:((distance:number)=>void)[][]=[];
 singularity=new SingularityView();titan=new TitanView();vanguard=new VanguardView();hunter=new HunterView();blasts=new BlastFX();private lastRace?:Race;private lastTime=0;private deadIds=new Map<number,number>();
 friendlyColor=new THREE.Color(0x8affed);colors=kinds.map(k=>new THREE.Color(ENEMY_TYPES[k].color));root=new THREE.Group();ships:THREE.Group[]=[];models:THREE.Group[][]=[];arrivals:THREE.Mesh[]=[];arrivalProgress:{value:number}[]=[];warnings:THREE.Mesh[][]=[];cores:THREE.Mesh[]=[];
 debris:THREE.InstancedMesh;bolts:THREE.InstancedMesh;dummy=new THREE.Object3D();direction=new THREE.Vector3();offset=new THREE.Vector3();q=new THREE.Quaternion();roll=new THREE.Quaternion();forward=new THREE.Vector3(0,0,-1);axis=new THREE.Vector3(0,0,1);
 private renderOrigin={x:0,y:0,z:0};private identityCamera=new THREE.Quaternion();
 private pathFrames=new Map<number,{x:number;y:number;q:THREE.Quaternion}>();
 private framePool:{x:number;y:number;q:THREE.Quaternion}[]=[];private frameCount=0;
 private selectedModels=new Int16Array(COMBAT.enemies).fill(-2);
 private frameAt(z:number){
  const cached=this.pathFrames.get(z);if(cached)return cached;
  let frame=this.framePool[this.frameCount];if(!frame){frame={x:0,y:0,q:new THREE.Quaternion()};this.framePool.push(frame);}this.frameCount++;
  const p=pathAt(z),d=tangentAt(z);frame.x=p.x;frame.y=p.y;
  frame.q.setFromUnitVectors(this.forward,this.direction.set(d.x,d.y,-1).normalize());this.pathFrames.set(z,frame);return frame;
 }
 constructor(){
  this.root.add(this.blasts.root,this.hunter.root,this.vanguard.root,this.titan.root,this.singularity.root);
  const alloy=new THREE.MeshStandardMaterial({color:0x334654,metalness:.85,roughness:.3}),edge=new THREE.MeshStandardMaterial({color:0xd99965,metalness:.65,roughness:.3}),shell=new THREE.MeshStandardMaterial({color:0x564776,metalness:.7,roughness:.25}),organic=new THREE.MeshStandardMaterial({color:0x244641,metalness:.35,roughness:.35});
  const cube=new RoundedBoxGeometry(1,1,1,1,.08),sphere=new THREE.SphereGeometry(1,32,20),cone=new THREE.ConeGeometry(1,1,32),disc=new THREE.CylinderGeometry(1,1,1,48),hull=new THREE.IcosahedronGeometry(1,2),ringGeo=new THREE.RingGeometry(.84,1,32);
  const canopy=new THREE.MeshPhysicalMaterial({color:0x183044,metalness:.65,roughness:.2,clearcoat:1});
  const glow=kinds.map(k=>new THREE.MeshBasicMaterial({color:ENEMY_TYPES[k].color}));
  function part(parent:THREE.Group,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  const templates:THREE.Group[]=[];
  for(let i=0;i<COMBAT.enemies;i++){
   const ship=new THREE.Group();this.root.add(ship);this.ships.push(ship);const models:THREE.Group[]=[],detail:((distance:number)=>void)[]=[];
   for(const kind of kinds){if(i>0){const index=kinds.indexOf(kind),body=templates[index].clone(true);ship.add(body);models.push(body);detail.push(this.geometryTemplates[index].bind(body));continue;}const body=new VisibleModelGroup();ship.add(body);models.push(body);const gi=kinds.indexOf(kind);
    if(kind==='drone'){
     part(body,hull,alloy,0,0,0,.8,.55,1.6);
     for(const side of [-1,1]){part(body,cube,alloy,side*1.2,0,-.25,1.8,.16,1.4).rotation.y=side*.45;part(body,cube,edge,side*2,.07,-.65,.16,.3,1.5).rotation.y=side*.3;part(body,cube,glow[gi],side*.8,0,1,.28,.12,.12);}
     part(body,sphere,glow[gi],0,.06,1.35,.36,.24,.24);
     part(body,sphere,canopy,0,.42,.25,.47,.22,.73);
     for(const side of [-1,1]){part(body,cube,edge,side*.54,.33,-.2,.1,.12,1.25);for(let j=0;j<3;j++)part(body,cube,canopy,side*1.2,.11,-.55+j*.25,.65,.05,.06);}
    }else if(kind==='saucer'){
     part(body,cone,shell,0,.18,0,2.4,.55,2.4);const lower=part(body,cone,alloy,0,-.3,0,2.4,.5,2.4);lower.rotation.z=Math.PI;
     part(body,disc,edge,0,-.04,0,2.43,.1,2.43);part(body,sphere,shell,0,.45,0,1.05,.55,1.05);
     part(body,sphere,glow[gi],0,.69,.47,.57,.23,.58);
     for(let j=0;j<8;j++){const a=j*Math.PI/4;part(body,sphere,glow[gi],Math.cos(a)*1.96,.16,Math.sin(a)*1.96,.16,.08,.16);}
     part(body,disc,alloy,0,-.6,0,.7,.25,.7);part(body,sphere,glow[gi],0,-.74,.15,.32,.16,.32);
     part(body,sphere,canopy,0,.61,0,.79,.44,.79);
     for(let j=0;j<12;j++){const a=j*Math.PI/6;const vent=part(body,cube,alloy,Math.cos(a)*1.55,.3,Math.sin(a)*1.55,.11,.1,.48);vent.rotation.y=-a+Math.PI/2;}
    }else if(kind==='wraith'){
     part(body,hull,alloy,0,0,0,.5,.5,2.2);
     for(const side of [-1,1]){part(body,cube,shell,side*1.3,0,-.3,.25,.7,3.6).rotation.y=side*.4;part(body,cube,glow[gi],side*1.3,.4,-.3,.12,.1,2.4).rotation.y=side*.4;part(body,sphere,glow[gi],side*.6,0,-1.7,.25,.25,.55);}
     part(body,sphere,glow[gi],0,0,1.8,.3,.3,.35);
    }else if(kind==='sentinel'){
     const hoop=part(body,new THREE.TorusGeometry(2,.24,8,24),alloy,0,0,0,1,1,1);hoop.rotation.x=.25;
     part(body,hull,shell,0,0,0,1,.85,1.25);part(body,sphere,glow[gi],0,0,1,.45,.45,.3);
     for(let j=0;j<3;j++){const a=j*Math.PI*2/3;part(body,cube,edge,Math.cos(a)*2,Math.sin(a)*2,0,.6,.6,1.8);part(body,sphere,glow[gi],Math.cos(a)*2,Math.sin(a)*2,1,.23,.23,.2);}
    }else if(ENEMY_TYPES[kind].rank>=6||kind==='scarab'||kind==='helix'){
     const jewel=new THREE.MeshPhysicalMaterial({color:ENEMY_TYPES[kind].color,metalness:.58,roughness:.23,clearcoat:1});
     const accent=new THREE.MeshBasicMaterial({color:kind==='prism'?0xda8cff:kind==='revenant'?0x82efff:kind==='seraph'?0x83fff0:kind==='sovereign'?0xfff3cd:0x65ffeb});
     part(body,new THREE.OctahedronGeometry(1,0),jewel,0,0,0,.9,1.1,1.25);
     part(body,sphere,accent,0,0,1.08,.38,.38,.24);
     if(kind==='scarab'){
      part(body,sphere,jewel,0,.25,-.25,1.35,.65,1.65);
      for(const side of [-1,1])for(let j=0;j<3;j++){const leg=part(body,cube,edge,side*1.5,-.25,-.9+j*.8,.8,.14,.25);leg.rotation.z=side*.35;part(body,sphere,accent,side*.5,.25,1.2,.16,.13,.2);}
     }else if(kind==='helix'){
      for(let j=0;j<3;j++){const arc=part(body,new THREE.TorusGeometry(1.6,.14,8,32,Math.PI*1.35),jewel,0,0,-.6+j*.6,1,1,1);arc.rotation.z=j*2.1;arc.rotation.y=.4;part(body,sphere,accent,Math.cos(j*2.1)*1.6,Math.sin(j*2.1)*1.6,.6,.2,.2,.18);}
     }else if(kind==='medusa'){
      part(body,sphere,jewel,0,.65,0,1.5,.7,1.1);
      for(let j=0;j<6;j++){const a=j*Math.PI/3;const tendril=part(body,cone,jewel,Math.cos(a)*1.05,-.85,Math.sin(a)*.7,.12,2,.12);tendril.rotation.z=Math.cos(a)*.2;part(body,sphere,accent,Math.cos(a)*1.25,-1.6,Math.sin(a)*.7,.13,.25,.13);}
     }else if(kind==='comet'){
      part(body,hull,jewel,0,0,-.1,.6,.5,2.15);
      for(const side of [-1,1]){const blade=part(body,cube,jewel,side*1.2,0,-.15,.22,.6,3);blade.rotation.y=side*.5;part(body,cone,accent,side*.7,0,-1.4,.18,1.1,.18).rotation.x=Math.PI/2;}
     }else if(kind==='oracle'){
      for(let j=0;j<3;j++){const orbit=part(body,new THREE.TorusGeometry(1.85,.09,8,40),jewel,0,0,0,1,1,1);orbit.rotation.set(j*.85,j*.65,0);part(body,sphere,accent,Math.cos(j*2.1)*1.8,Math.sin(j*2.1)*1.8,.4,.2,.2,.2);}
     }else if(kind==='prism'){
      for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;const crystal=part(body,new THREE.OctahedronGeometry(1,0),jewel,Math.cos(a)*1.6,Math.sin(a)*1.6,-.15,.42,.8,.55);crystal.rotation.z=a-Math.PI/2;part(body,sphere,accent,Math.cos(a)*1.3,Math.sin(a)*1.3,.45,.12,.12,.3);}
     }else if(kind==='revenant'){
      for(const side of [-1,1]){const arc=part(body,new THREE.TorusGeometry(1.65,.18,10,40,Math.PI*1.4),jewel,side*.35,0,-.3,1,1,1);arc.rotation.z=side>0?-.7:Math.PI-.7;part(body,cone,accent,side*1.4,.25,-1.15,.18,1.6,.18).rotation.x=Math.PI/2;}
     }else if(kind==='seraph'){
      for(let j=0;j<6;j++){const a=j*Math.PI/3;const wing=part(body,cone,jewel,Math.cos(a)*1.45,Math.sin(a)*1.45,-.25,.35,1.6,.25);wing.rotation.z=a-Math.PI/2;part(body,sphere,accent,Math.cos(a)*1.95,Math.sin(a)*1.95,.05,.13,.13,.24);}
      part(body,new THREE.TorusGeometry(1.1,.055,8,40),accent,0,0,.4,1,1,1);
     }else if(kind==='sovereign'){
      part(body,new THREE.TorusGeometry(1.95,.19,10,48),jewel,0,0,0,1,1,1);
      for(let j=0;j<8;j++){const a=j*Math.PI/4;const crown=part(body,cone,edge,Math.cos(a)*1.95,Math.sin(a)*1.95,.15,.21,.65,.3);crown.rotation.z=a-Math.PI/2;part(body,sphere,accent,Math.cos(a)*1.7,Math.sin(a)*1.7,.35,.13,.13,.2);}
     }else{
      const outer=part(body,new THREE.TorusGeometry(2,.15,10,48),jewel,0,0,0,1,1,1);outer.rotation.x=.45;
      const inner=part(body,new THREE.TorusGeometry(1.45,.075,8,48),accent,0,0,.2,1,1,1);inner.rotation.y=.65;
      for(const side of [-1,1]){part(body,new THREE.OctahedronGeometry(1,0),jewel,0,side*1.75,0,.38,.65,.55);part(body,sphere,accent,side*1.95,0,.3,.16,.16,.25);}
     }
    }else{
     part(body,sphere,organic,0,0,0,.95,.48,1.7);part(body,hull,alloy,0,.25,-.15,.55,.35,1.5);
     for(const side of [-1,1]){const fin=part(body,cone,organic,side*1.55,-.06,-.2,1.05,3.3,.32);fin.rotation.z=side*-1.15;fin.rotation.y=side*.35;
      for(let j=0;j<3;j++){part(body,hull,organic,side*(.8+j*.55),.04,-.6-j*.22,.5,.2,.8);part(body,sphere,glow[gi],side*(.7+j*.5),.2,.05-j*.24,.13,.08,.3);}
      part(body,sphere,glow[gi],side*.32,.15,1.3,.17,.1,.28);
     }const tail=part(body,cone,organic,0,0,-2.1,.23,2,.23);tail.rotation.x=-Math.PI/2;
    }
    const geometry=new DistanceModelGeometry(body);this.geometryTemplates.push(geometry);detail.push(geometry.bind(body));
    templates.push(body.clone(true));
   }this.models.push(models);this.modelDetail.push(detail);
   const progress={value:0},cache=new Map<THREE.Material,THREE.Material>();this.arrivalProgress.push(progress);
   for(const model of models)model.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){let mat=cache.get(o.material);if(!mat){mat=warpMaterial(o.material,progress);cache.set(o.material,mat);}o.material=mat;}});

   const core=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:0xffffff}));core.position.set(0,.1,2);ship.add(core);this.cores.push(core);
   const arrival=warpFlare(0x99eaff);ship.add(arrival);this.arrivals.push(arrival);
   const warnings:THREE.Mesh[]=[];for(let j=0;j<3;j++){const warning=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({color:0xff6045,transparent:true,opacity:.23,depthWrite:false}));this.root.add(warning);warnings.push(warning);}this.warnings.push(warnings);
  }
  this.bolts=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.12,2.3),new THREE.MeshBasicMaterial({color:0xffffff}),COMBAT.bolts);this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.bolts.frustumCulled=false;this.root.add(this.bolts);
  this.debris=new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.32),new THREE.MeshBasicMaterial({color:0xffbf6a}),COMBAT.enemies*12);this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.debris.frustumCulled=false;this.root.add(this.debris);
 }
 private place(object:THREE.Object3D,z:number,surface:number,lane:number,radius:number,race:Race){const frame=this.frameAt(z);this.roll.setFromAxisAngle(this.axis,-surface*Math.PI/2);object.quaternion.copy(frame.q).multiply(this.roll);this.offset.set(lane*TUNE.laneSpacing,radius,0).applyQuaternion(object.quaternion);object.position.set(frame.x-this.renderOrigin.x,frame.y-this.renderOrigin.y,race.z-z).add(this.offset);}
 render(race:Race|undefined,menu:boolean,camera?:THREE.Camera){this.root.visible=!menu&&!!race;if(!race||menu)return;
  if(this.lastRace!==race){this.blasts.reset();this.deadIds.clear();this.lastRace=race;this.lastTime=race.time;}const dt=Math.max(0,race.time-this.lastTime);this.lastTime=race.time;
  const origin=pathAt(race.z);this.renderOrigin.x=origin.x;this.renderOrigin.y=origin.y;this.renderOrigin.z=-race.z;this.pathFrames.clear();this.frameCount=0;
  let debrisCount=0;race.combat.enemies.forEach((e,i)=>{const ship=this.ships[i],ki=kinds.indexOf(e.kind),def=ENEMY_TYPES[e.kind];ship.visible=e.active;this.warnings[i].forEach(w=>w.visible=false);if(!e.active){if(this.selectedModels[i]!==-1){for(const model of this.models[i])model.visible=false;this.selectedModels[i]=-1;}return;}
   const entry=Math.max(0,1-e.age/ENEMY_ENTRY),drift=entry*entry,side=e.id%2?1:-1;
   const pose=enemyPose(e);this.place(ship,e.z,e.pursuing?e.visualSurface:e.surface,pose.lane,pose.height,race);
   const captured=e.gravity?.id===e.id&&e.gravity.captured;
   if(e.gravity?.id===e.id)ship.position.add(e.gravity.offset);
   const selected=e.hp>0||captured?ki:-1;
   if(this.selectedModels[i]!==selected){for(let j=0;j<this.models[i].length;j++)this.models[i][j].visible=j===selected;this.selectedModels[i]=selected;}
   if(selected>=0){const m=this.models[i][selected];m.scale.setScalar(captured?1.5*e.gravity!.deathScale*Math.max(.01,1-e.dead/.55)**1.5:(1.5+e.flash*1.2)*(1-(e.gravity?.id===e.id?e.gravity.compression*.995:0)));m.rotation.z=(e.motion?.bank??Math.sin(e.age*3+e.id)*.09)+side*entry*.45;if(captured)m.rotation.z+=e.dead*11;else if(e.gravity?.id===e.id)m.rotation.z+=e.gravity.compression*e.age*8;m.rotation.x=e.motion?.pitch??0;m.rotation.y=(e.motion?.yaw??0)+Math.sin(e.age*(e.motion?.frequency??.6)+(e.motion?.phase??e.id))*(e.kind==='saucer'?.16:.06);}
   if(selected>=0)this.modelDetail[i][selected](Math.abs(e.z-race.z));
   const core=this.cores[i];core.visible=e.hp>0&&(e.flash>0||e.charge>0||e.volley>0);core.scale.setScalar(e.flash>0?.5+e.flash*6:e.volley>0?.7:.15+e.charge*.4);(core.material as THREE.MeshBasicMaterial).color.set(e.flash>0?0xfff0cb:ENEMY_TYPES[e.kind].color);
   if(e.hp<=0&&this.deadIds.get(i)!==e.id){this.deadIds.set(i,e.id);if(!captured)this.blasts.trigger(ship.position.x+origin.x,ship.position.y+origin.y,ship.position.z-race.z,e.id*.73+ki);}
   if(e.hp>0&&e.flash>0){for(let j=0;j<6;j++){const a=j*Math.PI/3+e.id,t=.12-e.flash;this.dummy.position.set(Math.cos(a)*t*26,Math.sin(a)*t*26,2+t*8).applyQuaternion(ship.quaternion).add(ship.position);this.dummy.rotation.set(a,a*2,t*25);this.dummy.scale.set(.35,.35,(e.flash/.12)*2);this.dummy.updateMatrix();this.debris.setMatrixAt(debrisCount++,this.dummy.matrix);}}
   const gate=race.gates.find(g=>g.id===e.gateId);if(e.hp>0&&e.charge>0&&(!e.fired||e.volley>0)&&(e.hunting||gate)){const lanes=enemyWarningLanes(e);for(let j=0;j<lanes.length;j++){const w=this.warnings[i][j];w.visible=true;this.place(w,e.hunting?race.z+30:Math.min(gate!.z-30,race.z+30),e.surface,lanes[j],4.24,race);w.scale.set(1.5,.025,20);const mat=w.material as THREE.MeshBasicMaterial;mat.color.copy(this.colors[ki]);mat.opacity=.16+e.charge*.18+Math.sin(e.age*12)*.06;}}
   this.arrivalProgress[i].value=THREE.MathUtils.smoothstep(e.age,.08,.85);
   const arrival=this.arrivals[i];arrival.visible=e.hp>0&&e.age<.8;arrival.scale.setScalar(9);if(camera)arrival.quaternion.copy(ship.quaternion).invert().multiply(camera.quaternion);(arrival.material as THREE.ShaderMaterial).uniforms.age.value=e.age;

  });
  this.blasts.update(dt,this.renderOrigin,camera?.quaternion??this.identityCamera);
  this.hunter.render(race,this.renderOrigin,camera?.quaternion??this.identityCamera);
  this.vanguard.render(race,this.renderOrigin);this.titan.render(race,this.renderOrigin);this.singularity.render(race,this.renderOrigin);
  this.debris.count=debrisCount;uploadLivePrefix(this.debris.instanceMatrix,debrisCount);
  let count=0;for(const b of race.combat.bolts){if(!b.active)continue;this.dummy.position.set(b.wx-origin.x,b.wy-origin.y,b.wz+race.z);this.direction.set(b.vx,b.vy,b.vz).normalize();this.dummy.quaternion.setFromUnitVectors(this.axis,this.direction);const ki=kinds.indexOf(b.kind);this.dummy.scale.set(b.hostile?4:b.supportIndex!==undefined?2:1,b.hostile?4:b.supportIndex!==undefined?2:1,b.supportIndex!==undefined?.65:b.hostile&&b.kind==='saucer'?.65:1.4);this.dummy.updateMatrix();this.bolts.setMatrixAt(count,this.dummy.matrix);this.bolts.setColorAt(count++,b.hostile?this.colors[ki]:this.friendlyColor);}this.bolts.count=count;uploadLivePrefix(this.bolts.instanceMatrix,count);if(count>0&&this.bolts.instanceColor)uploadLivePrefix(this.bolts.instanceColor,count);
 }
 warmModels(){return [...this.geometryTemplates.flatMap((geometry,i)=>[this.models[0][i],geometry.preview(this.models[0][i],1),geometry.preview(this.models[0][i],2)]),this.hunter.root,this.vanguard.root,this.titan.root,this.singularity.root];}
 disposeGeometry(){this.geometryTemplates.forEach(model=>model.dispose());}
}
