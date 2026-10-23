import * as THREE from 'three';
import {trackPoint} from './combat-space';
import {tangentAt} from './path';
import type {Race} from './game';
import type {RiftKind} from './rifts';
import {liquidPullAt} from './liquid-transit';

const colors:Record<RiftKind,number>={blue:0x6ffff0,violet:0xc076ff,black:0xff9a55};
const forward=new THREE.Vector3(0,0,-1),origin3=new THREE.Vector3(),tangent=new THREE.Vector3();

export class RiftView{
 root=new THREE.Group();private outer:THREE.Mesh;private inner:THREE.Mesh;private rim:THREE.Mesh;private disc:THREE.Mesh;private sparks:THREE.Points;
 private outerMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
 private innerMat=this.outerMat.clone();private discMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});private sparkMat=new THREE.PointsMaterial({size:.13,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
 private membrane={liquidTime:{value:0},liquidPull:{value:0}};
 constructor(){
  this.discMat.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.membrane);
   shader.vertexShader='uniform float liquidPull; varying vec2 liquidUV;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    liquidUV=position.xy/2.22;
    float r=length(liquidUV);
    transformed.z -= liquidPull*1.4*pow(1.0-r,2.0);
   `);
   shader.fragmentShader='uniform float liquidTime; uniform float liquidPull; varying vec2 liquidUV;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float radius=length(liquidUV);
    float angle=atan(liquidUV.y,liquidUV.x);
    float flow=sin(radius*39.0-angle*4.0-liquidTime*3.0+sin(angle*5.0+radius*12.0)*0.8);
    float silk=pow(0.5+0.5*flow,5.0);
    float edge=smoothstep(0.58,1.0,radius);
    diffuseColor.rgb=mix(vec3(0.004,0.006,0.018),diffuseColor.rgb,edge*0.25+silk*radius*0.13);
    diffuseColor.rgb+=vec3(0.35,0.22,0.52)*silk*liquidPull*radius*0.35;
   `);
  };

  this.outer=new THREE.Mesh(new THREE.TorusGeometry(2.35,.065,14,72),this.outerMat);this.inner=new THREE.Mesh(new THREE.TorusGeometry(1.84,.055,10,64),this.innerMat);this.rim=new THREE.Mesh(new THREE.TorusGeometry(2.05,.035,8,72),this.innerMat);this.disc=new THREE.Mesh(new THREE.RingGeometry(0,2.22,96,24),this.discMat);
  const positions=new Float32Array(72*3);for(let i=0;i<72;i++){const a=i/72*Math.PI*2,r=1.65+(i%7)*.12;positions.set([Math.cos(a)*r,Math.sin(a)*r,(i%5-2)*.025],i*3);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.sparks=new THREE.Points(geometry,this.sparkMat);
  this.root.add(this.disc,this.outer,this.inner,this.rim,this.sparks);this.root.visible=false;this.root.renderOrder=3;
 }
 reset(){this.root.visible=false;}
 render(race:Race,origin:{x:number;y:number},time:number){
  this.membrane.liquidTime.value=time;this.membrane.liquidPull.value=liquidPullAt(race);
  const transit=race.riftTransit,active=race.riftChallenge;const rift=transit?.rift??active?.rift??race.rifts.find(item=>!race.resolvedRifts.has(item.id)&&item.z-race.z>-25&&item.z-race.z<230);
  if(!rift){this.root.visible=false;return;}
  const kind=rift.kind;let z=active?race.z+72:rift.z,surface=active?race.surface:rift.surface,lane=active?0:rift.lane,height=active?12:7.55,scale=active?4.2:1.35,reveal=1;
  if(transit){z=transit.portalZ??rift.z;surface=transit.portalSurface??rift.surface;lane=transit.portalLane??rift.lane;height=7.55;scale=1.35;reveal=1-THREE.MathUtils.smoothstep(transit.elapsed,1.55,1.8);}
  else if(!active){const distance=Math.max(0,rift.z-race.z);reveal=THREE.MathUtils.smoothstep(230-distance,0,120);scale*=1+Math.sin(time*3+rift.id)*.035;}
  origin3.set(origin.x,origin.y,-race.z);this.root.position.copy(trackPoint(z,surface,lane,height)).sub(origin3);
  const d=tangentAt(z);tangent.set(d.x,d.y,-1).normalize();this.root.quaternion.setFromUnitVectors(forward,tangent);this.root.rotateZ(time*(kind==='black'?.34:.16));
  const phase=transit?Math.min(1,transit.elapsed/1.8):0,liquid=transit?Math.sin(Math.PI*phase):0,wave=Math.sin(time*8.5+rift.id)*.055*liquid;
  this.root.scale.set(scale*(1+wave),scale*(1-wave*.7),scale);this.inner.scale.setScalar(1+Math.sin(time*10.5)*.075*liquid);this.rim.scale.setScalar(1-Math.sin(time*7.3)*.055*liquid);this.disc.scale.set(1+wave*.8,1-wave,1);
  const color=colors[kind];this.outerMat.color.setHex(color);this.innerMat.color.setHex(kind==='black'?0xc878ff:color);this.sparkMat.color.setHex(color);this.discMat.color.setHex(kind==='black'?0x010108:color);
  const transitGlow=transit?1.28:1;this.outerMat.opacity=Math.min(1,.58*reveal*transitGlow);this.innerMat.opacity=Math.min(1,.8*reveal*transitGlow);this.sparkMat.opacity=Math.min(1,.72*reveal*transitGlow);this.discMat.opacity=.98*reveal;this.inner.rotation.z=-time*1.1;this.rim.rotation.z=time*.62;this.sparks.rotation.z=time*(kind==='black'?-1.5:.85);this.root.visible=true;
 }
}
