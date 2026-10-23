import {VisibleModelGroup} from './visible-model-group';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {trackPoint} from './combat-space';
import type {Race} from './game';
export class ShipView{
 craft=new VisibleModelGroup();core=new VisibleModelGroup();private wings:THREE.Group[]=[];private jets:THREE.Group[]=[];
 private exhaust=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{time:{value:0},throttle:{value:0}},vertexShader:`
 varying vec2 plumeUV;
 void main(){plumeUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
 `,fragmentShader:`
 uniform float time;uniform float throttle;varying vec2 plumeUV;
 void main(){
  float t=plumeUV.y;
  float x=(plumeUV.x-.5)*2.0;
  float drift=sin(t*19.0-time*13.0)*.035*t+sin(t*31.0-time*8.0)*.02*t;
  float width=mix(.52,.07,t);
  float soft=exp(-pow((x+drift)/width,2.0)*3.0);
  float hot=exp(-pow(x/(width*.36),2.0)*2.0)*(1.0-t);
  float flow=.9+.1*sin(t*42.0-time*22.0);
  float fade=(1.0-smoothstep(.35,1.0,t))*smoothstep(0.0,.045,t);
  vec3 color=mix(vec3(.08,.32,.95),vec3(.2,.95,.87),1.0-t);
  color=mix(color,vec3(.86,1.0,1.0),hot);
  gl_FragColor=vec4(color*(1.1+hot),soft*fade*flow*throttle*.48);
 }
 `});
 constructor(){
  const hull=new THREE.MeshPhysicalMaterial({color:0xffebd1,metalness:.65,roughness:.28,clearcoat:1}),dark=new THREE.MeshStandardMaterial({color:0x172c3c,metalness:.8,roughness:.32}),trim=new THREE.MeshStandardMaterial({color:0xf47740,metalness:.5,roughness:.3}),light=new THREE.MeshBasicMaterial({color:0x7affeb});
  const box=(parent:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.06),mat);m.position.set(x,y,z);parent.add(m);return m;};
  box(this.craft,dark,0,.55,0,1.3,.55,3.6);box(this.craft,hull,0,.8,-1.45,1,.4,1.5);
  const glass=new THREE.Mesh(new THREE.SphereGeometry(1,36,24),new THREE.MeshPhysicalMaterial({color:0x458f9c,transparent:true,opacity:.48,metalness:.35,roughness:.08,clearcoat:1,depthWrite:false}));glass.position.set(0,1.45,-.12);glass.scale.set(.8,1.1,1.5);this.craft.add(glass);
  for(const side of [-1,1]){
   const wing=new THREE.Group();this.craft.add(wing);this.wings.push(wing);
   const blade=box(wing,hull,side*1.5,.7,.2,2.8,.18,1.5);blade.rotation.y=-side*.28;
   box(wing,trim,side*1.5,.81,.2,2,.04,.18);box(wing,dark,side*2.65,.55,.55,.6,.65,2.1);box(wing,hull,side*2.65,.87,.1,.65,.12,1.1);
   const nozzle=new THREE.Mesh(new THREE.TorusGeometry(.21,.045,10,32),dark);nozzle.position.set(side*2.65,.55,1.64);wing.add(nozzle);
   const throat=new THREE.Mesh(new THREE.CircleGeometry(.17,32),light);throat.position.set(side*2.65,.55,1.645);wing.add(throat);
   const jet=new THREE.Group();jet.position.set(side*2.65,.55,1.66);
   const plumeGeometry=new THREE.PlaneGeometry(.8,1.65,1,12);plumeGeometry.rotateX(Math.PI/2);plumeGeometry.translate(0,0,.825);
   for(const angle of [0,Math.PI/2]){const plume=new THREE.Mesh(plumeGeometry,this.exhaust);plume.rotation.z=angle;jet.add(plume);}
   wing.add(jet);this.jets.push(jet);
  }
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.65),light);this.core.add(gem);
  for(const tilt of [-.7,.7]){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.045,8,64),trim);ring.rotation.y=tilt;this.core.add(ring);}
  this.craft.visible=false;this.core.visible=false;
 }
 update(r?:Race,origin={x:0,y:0},time=0){
  const lift=r?.ship.deployment??0;this.craft.visible=lift>.001;this.craft.scale.setScalar(1.28);this.craft.rotation.x=r?.ship.landingPitch??0;this.craft.position.y=r?.ship.suspension??0;this.craft.scale.y*=Math.max(.05,lift);
  this.wings.forEach((wing,i)=>{wing.scale.x=.12+.88*lift;wing.rotation.z=(i===0?1:-1)*(1-lift)*1.1;});
  const thrust=r?.ship.active?(.28+.72*r.ship.lift)*lift:0;
  this.exhaust.uniforms.time.value=time;this.exhaust.uniforms.throttle.value=thrust;
  this.jets.forEach((j,i)=>j.scale.z=.55+.45*thrust+Math.sin(time*11+i*.8)*.025*thrust);
  const core=r?.ship.core;this.core.visible=!!core&&core.z-r!.z<230&&core.z>r!.z-10;
  if(core&&r){this.core.position.copy(trackPoint(core.z,core.surface,core.lane,6.4)).sub(new THREE.Vector3(origin.x,origin.y,-r.z));this.core.rotation.set(time*.6,time*.9,time*.3);}
 }
}
