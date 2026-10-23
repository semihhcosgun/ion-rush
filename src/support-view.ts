import {SUPPORT_DEPARTURE_SECONDS} from './earth-support';
import {VisibleModelGroup} from './visible-model-group';
import * as THREE from 'three';
import type {Race} from './game';
import {batchStatic} from './mesh-batch';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Three human rescue interceptors. Shared geometry, one brief beam, no new lights. */
export class SupportView {
 root=new VisibleModelGroup();crafts:THREE.Group[]=[];
 private beam=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1,6),new THREE.MeshBasicMaterial({color:0x9dffe4,transparent:true,opacity:.85,depthWrite:false}));
 private shield=new THREE.Mesh(new THREE.SphereGeometry(2.6,32,20),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pulse:{value:0},time:{value:0}},vertexShader:`varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);vUv=uv;gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;uniform float pulse,time;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.8);float scan=pow(.5+.5*sin(vUv.y*80.-time*2.),12.);float alpha=rim*(.16+pulse*.55)+scan*.014;gl_FragColor=vec4(mix(vec3(.28,.83,.74),vec3(.9,1.,.94),pulse),alpha);}`}));
 private warpFlashes:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>[]=[];
 private exhausts:THREE.Mesh[]=[];private trails:THREE.Mesh[]=[];
 private axis=new THREE.Vector3(0,1,0);
 private frames=Array.from({length:3},()=>({position:new THREE.Vector3(),rotation:new THREE.Quaternion()}));
 private lastRace?:Race;private lastUse=-1;private lastElapsed=0;
 private lastOrigin=new THREE.Vector3();
 private anchorPosition=new THREE.Vector3();private anchorRotation=new THREE.Quaternion();
 private inverseAnchor=new THREE.Quaternion();private desired=new THREE.Vector3();private attitude=new THREE.Quaternion();
 private angles=new THREE.Euler();private anchorInverse=new THREE.Matrix4();
 private hullMaterials:THREE.MeshStandardMaterial[][]=[];
 constructor(){
  this.root.name='Earth rescue squad';
  const core=new THREE.Mesh(this.beam.geometry,new THREE.MeshBasicMaterial({color:0xf2fff8,transparent:true,opacity:.95,depthWrite:false}));core.scale.set(.35,1,.35);this.beam.add(core);
  const trailGeo=new THREE.PlaneGeometry(.38,1);trailGeo.rotateX(-Math.PI/2);trailGeo.translate(0,0,.5);
  const trailMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 v;void main(){float edge=pow(max(0.,1.-abs(v.x*2.-1.)),2.);float fade=pow(v.y,1.7);gl_FragColor=vec4(.3,.95,.83,edge*fade*.42);}`});
  const hull=new THREE.MeshStandardMaterial({color:0xece7d7,metalness:.48,roughness:.3}),navy=new THREE.MeshStandardMaterial({color:0x153343,metalness:.7,roughness:.26}),gold=new THREE.MeshStandardMaterial({color:0xdba36b,metalness:.65,roughness:.3}),glow=new THREE.MeshBasicMaterial({color:0x9ffff0});
  const glass=new THREE.MeshPhysicalMaterial({color:0x173f58,metalness:.65,roughness:.13,clearcoat:1});
  const box=new RoundedBoxGeometry(1,1,1,1,.1),sphere=new THREE.SphereGeometry(1,16,10),ring=new THREE.TorusGeometry(.23,.055,8,24);
  const wings=[-1,1].map(side=>{const shape=new THREE.Shape();shape.moveTo(side*.3,-.45);shape.lineTo(side*2.1,.55);shape.lineTo(side*2.25,1.25);shape.lineTo(side*.45,.9);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelThickness:.035,bevelSize:.045,bevelSegments:1,steps:1});geo.rotateX(Math.PI/2);return geo;});
  const warpGeo=new THREE.SphereGeometry(1,12,8);
  const plumeGeo=new THREE.ConeGeometry(.17,1.9,16);plumeGeo.rotateX(Math.PI/2);plumeGeo.translate(0,0,.95);
  const plumeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 p;void main(){float a=sin(p.x*3.14159)*pow(p.y,1.4);gl_FragColor=vec4(.27,.9,.79,a*.7);}`});
  for(let i=0;i<3;i++){
   const flash=new THREE.Mesh(warpGeo,new THREE.MeshBasicMaterial({color:0xbffff0,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));flash.name='Escort warp flash';flash.visible=false;this.warpFlashes.push(flash);this.root.add(flash);
   const craft=new THREE.Group();craft.name=`Earth wing ${i+1}`;
   const part=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);craft.add(mesh);return mesh;};
   part(sphere,navy,0,-.07,.05,.6,.32,1.88);
   part(sphere,hull,0,.05,-.1,.55,.32,1.88);
   part(sphere,gold,0,.24,-.52,.39,.2,.89);
   part(sphere,glass,0,.3,-.52,.34,.2,.8);
   part(box,hull,0,.43,-.36,.045,.035,1.02);
   part(box,navy,0,.21,-1.53,.14,.065,.43);
   part(box,glow,0,.27,-1.55,.055,.035,.27);
   for(const side of [-1,1]){
    part(wings[side<0?0:1],hull,0,0,0,1,1,1);
    part(box,navy,side*1.1,.015,.52,1,.045,.32).rotation.y=side*-.23;
    part(box,gold,side*1.56,.04,.73,.16,.035,.64).rotation.y=side*-.23;
    part(box,glow,side*2,.035,.96,.1,.06,.27);
    part(sphere,navy,side*.64,-.04,1.08,.27,.26,.7);
    part(ring,gold,side*.64,-.04,1.63,1,1,1);
    part(sphere,glow,side*.64,-.04,1.66,.17,.17,.06);
    part(box,navy,side*.76,-.22,-1,.12,.14,.72);
    part(box,gold,side*.76,-.22,-1.39,.16,.18,.12);
    for(let vent=0;vent<4;vent++)part(box,navy,side*.42,.24,.44+vent*.18,.12,.025,.07);
   }
   for(const side of [-1,1])part(box,hull,side*.48,.4,1.13,.09,.63,.62).rotation.z=side*-.22;
   for(let stripe=0;stripe<=i;stripe++)part(box,gold,-.14+stripe*.13,.355,.43,.065,.025,.36);
   batchStatic(craft);
   const materials:THREE.MeshStandardMaterial[]=[];
   for(const child of craft.children){const mesh=child as THREE.Mesh;if(!Array.isArray(mesh.material)&&mesh.material instanceof THREE.MeshStandardMaterial){const material=mesh.material.clone() as THREE.MeshStandardMaterial;material.emissive.setHex(0xff6c32);mesh.material=material;materials.push(material);}}
   this.hullMaterials.push(materials);
   for(const side of [-1,1]){const exhaust=new THREE.Mesh(plumeGeo,plumeMaterial);exhaust.position.set(side*.64,-.04,1.7);craft.add(exhaust);this.exhausts.push(exhaust);}
   for(const side of [-1,1]){const trail=new THREE.Mesh(trailGeo,trailMat);trail.position.set(side*.64,-.04,1.72);craft.add(trail);this.trails.push(trail);}
   craft.scale.setScalar(i===2?1.24:1.1);this.root.add(craft);this.crafts.push(craft);
  }
  box.dispose();sphere.dispose();ring.dispose();wings.forEach(g=>g.dispose());
  this.shield.position.set(0,1,0);this.shield.scale.set(1,.8,1.4);this.root.add(this.shield,this.beam);this.root.visible=false;
 }
 update(r:Race|undefined,anchor:THREE.Group,origin:{x:number;y:number},camera?:THREE.PerspectiveCamera){
  this.root.visible=!!r?.support.active;if(!r||!this.root.visible)return;
  const s=r.support;
  camera?.updateWorldMatrix(true,false);
  anchor.updateWorldMatrix(true,false);
  anchor.getWorldPosition(this.anchorPosition);anchor.getWorldQuaternion(this.anchorRotation);
  this.inverseAnchor.copy(this.anchorRotation).invert();
  this.anchorInverse.copy(anchor.matrixWorld).invert();
  const reset=this.lastRace!==r||this.lastUse!==s.used||s.elapsed<this.lastElapsed;
  const dt=reset?0:Math.max(0,s.elapsed-this.lastElapsed);
  for(let i=0;i<3;i++){
   const wing=s.wings[i],entry=THREE.MathUtils.smootherstep(s.elapsed-i*.3,0,1.5),departure=Math.min(s.remaining,wing.hp<=0?wing.retreat:Infinity);
   const side=i===0?-1:i===1?1:0;
   const frame=this.frames[i],craft=this.crafts[i];
   craft.visible=wing.hp>0||wing.retreat>0;
   const teleport=1-THREE.MathUtils.smoothstep(departure,0,SUPPORT_DEPARTURE_SECONDS);
   for(const material of this.hullMaterials[i]){material.emissive.setHex(teleport>0?0x9dffe4:0xff6c32);material.emissiveIntensity=wing.flash*2+Math.sin(teleport*Math.PI)*.55;}
   if(reset){frame.position.copy(this.anchorPosition);frame.rotation.copy(this.anchorRotation);}
   else if(dt>0){
    // Floating-origin compensation is immediate; following the pilot is deliberately delayed.
    frame.position.x+=this.lastOrigin.x-origin.x;frame.position.y+=this.lastOrigin.y-origin.y;
    // Forward speed must never drag the escorts behind the camera.
    frame.position.z=this.anchorPosition.z;
    frame.position.lerp(this.anchorPosition,1-Math.exp(-dt*(2.8+i*.65)));
    frame.rotation.slerp(this.anchorRotation,1-Math.exp(-dt*(2.1+i*.55)));
   }
   const t=s.elapsed,phase=i*2.37,cruise=entry;
   const lateral=Math.sin(t*(.73+i*.11)+phase)*(i===2?1.8:1.15)+Math.sin(wing.flash*Math.PI*2)*side*1.2;
   const vertical=Math.sin(t*(1.03+i*.13)+phase)*.65;
   const surge=Math.sin(t*(.87+i*.09)+phase)*2.4;
   this.desired.set(side*(4.8+(1-entry)*7)+lateral*cruise,
    (i===2?5.5:3.6)+(1-entry)*5+vertical*cruise,
    (i===2?-20:-10)+(1-entry)*42+surge*cruise);
   this.desired.applyQuaternion(frame.rotation).add(frame.position);
   if(camera){
    // Reserve a sphere around the whole hull, not just its center. This also
    // bounds turn lag and arrival paths on narrow phone viewports.
    this.desired.applyMatrix4(camera.matrixWorldInverse);
    const radius=3.8,tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom;
    const tanX=tanY*camera.aspect,depth=Math.max(-this.desired.z,22,radius*3/tanX);
    this.desired.z=-depth;
    const limitX=Math.max(0,(depth-radius)*tanX*.88-radius);
    const limitY=Math.max(0,(depth-radius)*tanY*.82-radius);
    this.desired.x=THREE.MathUtils.clamp(this.desired.x,-limitX,limitX);
    this.desired.y=THREE.MathUtils.clamp(this.desired.y,-limitY,limitY);
    // Arrival starts physically behind the camera. Apply this AFTER the
    // escort framing constraint so the constraint cannot teleport ships into view.
    // Staggered smoothstep decelerates each high-speed pass into its station.
    this.desired.z+=(1-entry)*65;
    this.desired.x+=side*(1-entry)*12;
    this.desired.y+=(1-entry)*2;
    this.desired.applyMatrix4(camera.matrixWorld);
   }
   craft.position.copy(this.desired.applyMatrix4(this.anchorInverse));
   // Bank and pitch follow each interceptor's own maneuver, not the player's roll.
   this.angles.set((1-entry)*-.12+Math.cos(t*(1.03+i*.13)+phase)*.07*cruise,
    side*(1-entry)*-.24-Math.cos(t*(.73+i*.11)+phase)*.1*cruise,
    side*(-.08-Math.sin(entry*Math.PI)*.48)-Math.cos(t*(.73+i*.11)+phase)*.22*cruise);
   this.attitude.setFromEuler(this.angles);
   craft.quaternion.copy(this.inverseAnchor).multiply(frame.rotation).multiply(this.attitude);
   wing.position.copy(craft.position).applyMatrix4(anchor.matrixWorld);wing.position.x+=origin.x;wing.position.y+=origin.y;wing.position.z+=-r.z;wing.posed=true;
   // A restrained in-place pinch into a thin light trace, with no expanding flash.
   const collapse=THREE.MathUtils.smoothstep(teleport,.12,1);
   const pulse=Math.sin(teleport*Math.PI);
   const size=(i===2?1.24:1.1)*(1+wing.flash*.07);
   craft.scale.set(size*(1-collapse),size*(1-collapse),size*(1-THREE.MathUtils.smoothstep(teleport,.4,1)));
   const flash=this.warpFlashes[i];flash.visible=craft.visible&&pulse>0;
   flash.position.copy(craft.position);flash.quaternion.copy(craft.quaternion);
   flash.scale.set(.09,.07,1.8*(1-THREE.MathUtils.smoothstep(teleport,.65,1)));flash.material.opacity=pulse*.7;
   for(let j=0;j<2;j++){this.exhausts[i*2+j].scale.z=1.5+(1-entry)*2+Math.sin(r.time*24+i)*.1;this.trails[i*2+j].scale.z=5+(1-entry)*16;}
  }
  this.lastRace=r;this.lastUse=s.used;this.lastElapsed=s.elapsed;this.lastOrigin.set(origin.x,origin.y,r.z);
  this.shield.visible=!!s.guard||s.guardPulse>0;this.shield.material.uniforms.pulse.value=s.guardPulse/.45;this.shield.material.uniforms.time.value=r.time;
  this.beam.visible=false;
 }
}
