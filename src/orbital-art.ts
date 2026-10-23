import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {batchStatic} from './mesh-batch';
import {horizonFade,VIEW} from './horizon';
import {pathAt,tangentAt} from './path';

/** Baked, seamless cloud band: no full-screen procedural shader or per-frame allocation. */
export function orbitalSky(){
 const c=document.createElement('canvas');c.width=2048;c.height=1024;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#050c20';ctx.fillRect(0,0,c.width,c.height);
 let seed=813;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<100;i++){
  const x=rand()*2048,y=455+Math.sin(x/2048*Math.PI*2)*165+(rand()-.5)*110;
  const rx=100+rand()*230,ry=18+rand()*65;
  for(const wrap of [-2048,0,2048]){ctx.save();ctx.translate(x+wrap,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,i%3?'rgba(30,94,139,.075)':'rgba(94,63,130,.065)');g.addColorStop(.5,'rgba(25,57,107,.025)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();}
 }
 for(let i=0;i<1500;i++){const x=rand()*2048,y=rand()*1024;ctx.fillStyle=`rgba(167,200,234,${.12+rand()*.45})`;ctx.fillRect(x,y,rand()>.985?1.4:.65,.65);}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;return texture;
}

/** Five reused transit docks. All vertices stay well outside the playable tube. */
export class OrbitalDocks {
 root=new THREE.Group();private q=new THREE.Quaternion();private axis=new THREE.Vector3(0,0,-1);private direction=new THREE.Vector3();
 constructor(){
  const ceramic=horizonFade(new THREE.MeshStandardMaterial({color:0xd6e3e8,metalness:.25,roughness:.38}),VIEW.roadFadeStart,VIEW.roadFadeEnd);
  const navy=horizonFade(new THREE.MeshStandardMaterial({color:0x182d48,metalness:.55,roughness:.38}),VIEW.roadFadeStart,VIEW.roadFadeEnd);
  const copper=horizonFade(new THREE.MeshPhysicalMaterial({color:0xeb743e,metalness:.25,roughness:.32,clearcoat:.5}),VIEW.roadFadeStart,VIEW.roadFadeEnd);
  const light=horizonFade(new THREE.MeshStandardMaterial({color:0x85dce9,emissive:0x48b7d4,emissiveIntensity:.8}),VIEW.roadFadeStart,VIEW.roadFadeEnd);
  const geo=new RoundedBoxGeometry(1,1,1,1,.09);
  for(let i=0;i<5;i++){
   const dock=new THREE.Group();this.root.add(dock);
   const block=(mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(w,h,d);dock.add(m);return m;};
   for(const side of [-1,1]){
    const x=side*(30+(i%2)*7),y=i%2?10:-3;
    const bus=new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.3,17,6),ceramic);bus.position.set(x,y,0);bus.rotation.y=Math.PI/6;dock.add(bus);
    block(navy,x,y,0,4.8,19,10);block(ceramic,x,y+1,.6,5.3,13,10);
    block(copper,x,y+9,0,5.8,2.2,14);block(navy,x,y-9,0,7,2,17);
    for(const z of [-4,0,4]){block(navy,x,y+1,z,5.4,10,.22);block(light,x-side*2.71,y+3,z,.045,5,.35);}
    block(navy,x,y+1,5.65,4.3,7.8,.12);
    for(let row=0;row<3;row++)for(let col=0;col<4;col++)block(light,x-1.45+col*.95,y-1+row*1.5,5.73,.47,.6,.04);
    block(ceramic,x,y-4,5.9,3.8,1.4,.3);
    block(light,x,y+7,7.05,3.7,.17,.09);
    block(ceramic,x+side*5,y-5,0,7,.6,15);
    for(let j=0;j<7;j++)block(navy,x+side*5,y-4.65,-6+j*2,6,.08,1.65);
    for(let j=0;j<3;j++)block(copper,x+side*5,y-4.5,-4+j*4,6,.06,.08);
    const spar=block(navy,x+side*5,y-8,0,.6,8,1);spar.rotation.z=side*.8;
    block(navy,x,y+12,-3,.4,5,.4);block(light,x,y+14.5,-3,.5,.45,.5);
   }
   batchStatic(dock);
  }
  this.update(0);
 }
 update(z:number){
  const origin=pathAt(z);
  this.root.children.forEach((dock,i)=>{const at=(Math.floor((z-40-100-i*200)/1000)+1)*1000+100+i*200,p=pathAt(at),t=tangentAt(at);dock.position.set(p.x-origin.x,p.y-origin.y,z-at);this.direction.set(t.x,t.y,-1).normalize();this.q.setFromUnitVectors(this.axis,this.direction);dock.quaternion.copy(this.q);});
 }
}
