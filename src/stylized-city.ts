import {SceneryDistanceLOD} from './scenery-distance-lod';
import {t,onLocaleChange} from './i18n';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {SceneryReveal} from './scenery-reveal';
import {departureAt} from './departure-profile';
import {pathAt} from './path';

const C={cream:0xffe5b5,white:0xfff4d9,coral:0xf87949,orange:0xf45a2c,teal:0x42c9bb,blue:0x619cca,navy:0x234b68,mint:0x94d9b8,yellow:0xf9c86c,road:0x52798a,green:0x54b68d};

/** Lightweight opening art: baked vertex lighting, shared opaque materials, no PBR maps. */
export class StylizedCity {
 readonly root=new THREE.Group();
 readonly land=new THREE.Group();
 readonly street=new THREE.Group();
 readonly bridge=new THREE.Group();
 readonly skyline=new THREE.Group();
 private material=new THREE.MeshBasicMaterial({vertexColors:true});
 private reveal:SceneryReveal;private distanceLod:SceneryDistanceLOD;
 private sky:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
 private signs:THREE.Mesh[]=[];
 private boxGeometry=new THREE.BoxGeometry(1,1,1);
 private sun=new THREE.Vector3(-.45,.85,.3).normalize();
 constructor(){
  this.root.name='NOVA / stylized San Francisco';this.root.visible=false;
  this.street.name='NOVA / colourful launch district';this.bridge.name='NOVA / Golden Gate';this.skyline.name='NOVA / bay skyline';
  this.root.add(this.land);this.land.add(this.street,this.bridge,this.skyline);
  this.makeStreet();this.makeBridge();this.makeBay();
  this.distanceLod=new SceneryDistanceLOD([this.street,this.bridge,this.skyline]);
  this.reveal=new SceneryReveal(this.land);
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(6800,24,16),new THREE.ShaderMaterial({
   side:THREE.BackSide,transparent:true,depthWrite:false,fog:false,
   uniforms:{air:{value:1}},vertexShader:'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec3 ray;uniform float air;
    void main(){vec3 d=normalize(ray);float h=smoothstep(-.12,.8,d.y);
     vec3 color=mix(vec3(.93,.91,.78),vec3(.19,.64,.83),h);
     float sun=smoothstep(.9975,.9985,dot(d,normalize(vec3(-.55,.4,-1.))));
     color=mix(color,vec3(1.,.94,.73),sun);
     gl_FragColor=vec4(color,air);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`
  }));this.sky.renderOrder=-9;this.root.add(this.sky);
  this.boxGeometry.dispose();
 }
 private put(parent:THREE.Group,geometry:THREE.BufferGeometry,color:number,x:number,y:number,z:number,sx=1,sy=1,sz=1,rotation=0){
  const mesh=new THREE.Mesh(geometry.clone(),this.material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=rotation;mesh.updateMatrix();
  const normals=mesh.geometry.getAttribute('normal'),normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrix),normal=new THREE.Vector3(),base=new THREE.Color(color),colors=new Float32Array(normals.count*3);
  mesh.geometry.computeBoundingBox();
  const bounds=mesh.geometry.boundingBox!,positions=mesh.geometry.attributes.position;
  const span=Math.max(.001,bounds.max.y-bounds.min.y);
  const shade=new THREE.Color(),haze=new THREE.Color(0x9fcad0);
  for(let i=0;i<normals.count;i++){
   normal.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
   // Art-directed light is baked once into the existing color buffer.
   // Warm upper faces, cooler sides and darker bases add depth without lights.
   const height=(positions.getY(i)-bounds.min.y)/span;
   const direct=Math.max(0,normal.dot(this.sun));
   const light=(.58+.42*direct)*(.84+.16*height);
   shade.copy(base).multiplyScalar(light);
   shade.r*=.94+.10*direct;shade.g*=.98+.03*direct;shade.b*=1.08-.10*direct;
   if(parent===this.skyline){
    const distance=Math.max(0,-(positions.getZ(i)*sz+z)-900);
    shade.lerp(haze,Math.min(.24,distance/9000));
   }
   shade.toArray(colors,i*3);
  }
  mesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));parent.add(mesh);return mesh;
 }
 private box(parent:THREE.Group,color:number,x:number,y:number,z:number,w:number,h:number,d:number){return this.put(parent,this.boxGeometry,color,x,y,z,w,h,d);}
 private rounded(parent:THREE.Group,color:number,x:number,y:number,z:number,w:number,h:number,d:number,r=.8){
  const geometry=new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4));const mesh=this.put(parent,geometry,color,x,y,z);geometry.dispose();return mesh;
 }
 private tree(x:number,z:number,size=1,parent=this.street,y=0){
  this.box(parent,C.navy,x,y+3*size,z,.65*size,6*size,.65*size);
  const geo=new THREE.IcosahedronGeometry(1,1);
  this.put(parent,geo,C.green,x,y+7*size,z,3.1*size,4.5*size,3.1*size);
  this.put(parent,geo,C.mint,x+1.4*size,y+8.4*size,z+.3*size,2.1*size,2.5*size,2.1*size);geo.dispose();
 }
 private makeStreet(){
  const g=this.street,palette=[C.cream,C.teal,C.coral,C.blue,C.yellow,C.mint];
  this.box(g,C.road,0,-5,-145,110,8,440);
  for(const side of [-1,1]){
   this.box(g,C.cream,side*26,-.65,-145,19,1.5,440);
   this.box(g,C.white,side*16.6,.2,-145,.6,.35,440);
   for(let i=0;i<7;i++){
    const z=10-i*51,h=21+(i%3)*7,color=palette[(i+(side===1?2:0))%palette.length];
    this.rounded(g,color,side*36,h/2,z,24,h,40,1.1);
    this.rounded(g,C.white,side*36,h+.2,z,25.5,1.2,41.5,.35);
    this.box(g,C.navy,side*23.8,2.8,z,.15,5.4,36);
    for(let floor=0;floor<Math.floor(h/6);floor++)for(let k=0;k<4;k++){
     const zz=z-14+k*9;
     this.rounded(g,C.navy,side*23.8,7+floor*5.7,zz,.18,3.6,5.2,.05);
     this.box(g,C.white,side*23.6,5.1+floor*5.7,zz,.5,.35,5.7);
     this.box(g,0x87dbdf,side*23.65,7.7+floor*5.7,zz-1.1,.03,1.5,1.4);
    }
    // Broad coloured awnings and one roof silhouette, rather than tiny railings.
    for(let k=-1;k<=1;k++){
     this.rounded(g,C.white,side*22.3,5.2,z+k*11,3.4,.65,8,.2);
     this.box(g,color,side*20.65,4.85,z+k*11,.25,.7,8);
    }
    if(i%2===0)this.rounded(g,C.navy,side*40,h+1.5,z+9,5,3,7,.5);
    this.rounded(g,C.coral,side*20,1,z-22,4.8,1.5,4.8,.5);this.tree(side*20,z-22,.85);
    this.box(g,C.navy,side*17,5,z+19,.35,10,.35);
    this.rounded(g,C.yellow,side*17,10.1,z+19,2.2,.7,2.2,.2);
   }
   // Graphic street arrows stay outside every playable face of the orbital road.
   for(let z=0;z>-350;z-=24)this.box(g,C.yellow,side*20,.16,z,2,.03,8);
   const x=side*20,z=-128-side*35;
   this.rounded(g,C.orange,x,2,z,4.4,3.8,11,.7);
   this.rounded(g,C.cream,x,4.6,z,4,2.4,10,.4);
   this.rounded(g,C.navy,x,6,z,4.8,.55,11.4,.2);
   for(let k=-3;k<=3;k+=3)this.box(g,C.blue,x,4.7,z+k,4.1,1.5,1.8);
  }
  for(const side of [-1,1])this.rounded(g,C.teal,side*15.7,17,-25,2,34,2,.4);
  this.rounded(g,C.navy,0,35,-25,34,7,2,1);
 }
 private makeBridge(){
  const g=this.bridge;
  for(let z=330;z<1100;z+=22){const p=pathAt(z);
   this.box(g,C.road,p.x,-13,-z,38,2,22.3);
   for(const side of [-1,1])this.box(g,C.orange,p.x+side*19,-10,-z,.9,5,22.3);
  }
  for(const z of [495,765]){
   const x=pathAt(z).x;
   for(const side of [-1,1]){
    this.box(g,C.cream,x+side*20,-39,-z,13,64,17);
    this.rounded(g,C.orange,x+side*20,45,-z,6.5,126,8,.5);
    this.box(g,C.coral,x+side*22.7,46,-z+4.1,.55,120,.35);
    this.rounded(g,C.coral,x+side*20,110,-z,8,8,10,.5);
   }
   for(const y of [42,65,86,103])this.box(g,C.orange,x,y,-z,40,4,6);
  }
  const height=(z:number)=>z<495?5+103*((z-300)/195)**2:z>765?5+103*((1110-z)/345)**2:27+81*((z-630)/135)**2;
  for(const side of [-1,1]){
   const points:THREE.Vector3[]=[];
   for(let z=300;z<=1110;z+=9)points.push(new THREE.Vector3(pathAt(z).x+side*20,height(z),-z));
   const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),90,.8,5,false);this.put(g,geo,C.coral,0,0,0);geo.dispose();
   for(let z=330;z<1090;z+=27){const h=height(z);this.box(g,C.orange,pathAt(z).x+side*20,(h-10)/2,-z,.26,h+10,.26);}
  }
  this.rounded(g,C.navy,0,48,-435,31,7,2,.7);
 }
 private makeBay(){
  const g=this.skyline;
  this.box(g,0x45b7c6,0,-76,-2100,6600,5,6200);
  this.rounded(g,C.mint,1420,-72,-1850,1900,20,1100,3);
  const hill=new THREE.IcosahedronGeometry(1,2);
  for(let i=0;i<9;i++)this.put(g,hill,i%2?C.mint:C.green,-580-i*145,-120,-1320-i*245,430,140+(i%3)*60,370,.2*i);
  hill.dispose();
  let seed=73;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const palette=[C.cream,C.white,C.mint,C.blue,C.teal];
  for(let i=0;i<84;i++){
   const x=500+i%14*108+(random()-.5)*35,z=-1400-Math.floor(i/14)*140,h=20+random()**2*135,w=35+random()*32;
   this.box(g,palette[i%palette.length],x,-61+h/2,z,w,h,48);
   this.box(g,C.navy,x,-61+h,z,w+2,2,50);
   for(let floor=1;floor<Math.floor(h/16);floor++)this.box(g,C.blue,x,-61+floor*16,z+24.1,w*.72,3,.1);
  }
  // Two recognisable landmark silhouettes in the stylised bay.
  this.rounded(g,C.cream,1400,60,-1940,35,180,35,2);
  const pyramid=new THREE.ConeGeometry(36,125,4);this.put(g,pyramid,C.white,1670,60,-2210,1,1,1,Math.PI/4);pyramid.dispose();
  for(let i=0;i<7;i++){
   const x=-140-i*90,z=-540-i*110;this.rounded(g,C.white,x,-69,z,9,5,25,.8);this.box(g,C.coral,x,-65,z,6,3,12);
  }
 }
 async loadAssets(){
  if(this.signs.length)return;
  for(const [text,sub,y,z] of [['city.district','city.next',35,-23.95],['GOLDEN GATE','city.route',48,-433.95]] as const){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d')!;
   const draw=()=>{ctx.fillStyle='#234b68';ctx.fillRect(0,0,768,160);ctx.textAlign='center';ctx.fillStyle='#fff0cd';ctx.font='bold 64px sans-serif';ctx.fillText(text==='GOLDEN GATE'?text:t(text),384,78,730);ctx.fillStyle='#60dfcd';ctx.font='20px sans-serif';ctx.fillText(t(sub),384,123,730);};draw();
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
   const sign=new THREE.Mesh(new THREE.PlaneGeometry(28,5.8),new THREE.MeshBasicMaterial({map}));sign.position.set(0,y,z);this.land.add(sign);this.signs.push(sign);
  }
 }
 update(z:number,_time:number,origin:{x:number;y:number},camera:THREE.Camera){
  this.root.visible=z<3200;if(!this.root.visible)return;
  this.distanceLod.update(z);const phase=departureAt(z);this.land.position.set(-origin.x,-origin.y,z);this.reveal.update(phase.city);
  this.sky.position.copy(camera.position);this.sky.material.uniforms.air.value=phase.air;this.sky.visible=phase.air>.001;
  for(const sign of this.signs)sign.visible=phase.city>.8;
 }
}
