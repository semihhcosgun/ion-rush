import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Large clean shapes carry the art direction; fine detail stays below hazard contrast. */
export function transitPanel(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d')!;
 c.fillStyle='#263c50';c.fillRect(0,0,1024,1024);
 const gradient=c.createLinearGradient(0,0,1024,1024);gradient.addColorStop(0,'#506c88');gradient.addColorStop(.48,'#304c69');gradient.addColorStop(1,'#263e5a');
 c.fillStyle=gradient;c.beginPath();c.roundRect(24,20,976,984,24);c.fill();
 c.strokeStyle='#8ea9b8';c.lineWidth=3;c.stroke();
 for(const x of [48,916]){c.fillStyle='#172b3c';c.fillRect(x,48,60,928);for(let y=65;y<970;y+=28){c.fillStyle='#506c7e';c.fillRect(x+8,y,44,5);}}
 for(const x of [340,678]){c.fillStyle='#203849';c.fillRect(x,35,6,954);c.fillStyle='#abc5ca';for(let y=100;y<950;y+=180)c.fillRect(x+2,y,3,66);}
 for(const y of [38,973]){c.fillStyle='#112838';c.fillRect(125,y,774,13);c.fillStyle='#7d99a7';c.fillRect(125,y+13,774,2);}
 for(const x of [138,886])for(const y of [74,949]){c.fillStyle='#0c2334';c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();c.fillStyle='#829eab';c.fillRect(x-3,y-1,6,2);}
 // Ceramic lane insets, chamfered borders and recessed fasteners give the deck depth.
 for(let lane=0;lane<3;lane++){
  const x=126+lane*260;c.beginPath();c.moveTo(x+16,118);c.lineTo(x+218,118);c.lineTo(x+234,134);c.lineTo(x+234,858);c.lineTo(x+218,874);c.lineTo(x+16,874);c.lineTo(x,858);c.lineTo(x,134);c.closePath();
  const inset=c.createLinearGradient(x,0,x+234,0);inset.addColorStop(0,'#3e5873');inset.addColorStop(.08,'#48627e');inset.addColorStop(1,'#3b5572');c.fillStyle=inset;c.fill();c.strokeStyle='#1b3047';c.lineWidth=4;c.stroke();
  // Baked recess and reflected edge light: no additional material or draw.
  const recess=c.createLinearGradient(x,0,x+234,0);
  recess.addColorStop(0,'rgba(5,20,35,.40)');recess.addColorStop(.09,'rgba(5,20,35,0)');
  recess.addColorStop(.83,'rgba(5,20,35,0)');recess.addColorStop(1,'rgba(5,20,35,.30)');
  c.fillStyle=recess;c.fillRect(x+4,138,226,710);
  const sheen=c.createLinearGradient(0,145,0,835);
  sheen.addColorStop(0,'rgba(160,220,220,.12)');sheen.addColorStop(.45,'rgba(160,220,220,0)');sheen.addColorStop(1,'rgba(8,22,40,.15)');
  c.fillStyle=sheen;c.fillRect(x+12,145,210,690);
  c.fillStyle='#92adbd';c.fillRect(x+18,121,198,3);
  c.fillStyle='#20364b';c.fillRect(x+18,869,198,3);
  for(const y of [142,847])for(const bx of [x+15,x+219]){c.fillStyle='#15293e';c.beginPath();c.arc(bx,y,4,0,7);c.fill();c.fillStyle='#71869a';c.fillRect(bx-2,y-1,4,1);}
 }
 for(const x of [42,922]){c.fillStyle='#c6cbd0';c.fillRect(x,44,58,100);c.fillRect(x,880,58,100);c.fillStyle='#ed8d52';c.fillRect(x,154,58,70);c.fillRect(x,800,58,70);}
 c.fillStyle='#8eabb7';c.fillRect(452,63,120,3);
 c.fillStyle='#c79967';for(const x of [155,841]){c.beginPath();c.moveTo(x,850);c.lineTo(x+24,826);c.lineTo(x+24,842);c.lineTo(x,866);c.fill();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
/** Free-flying relay / observatory / communications satellites; no support poles. */
export function transitStation(index:number){
 const root=new THREE.Group();root.name=['KEPLER relay','LYRA observatory','ATLAS communications'][index%3];
 const alloy=new THREE.MeshStandardMaterial({color:0xd0dce2,metalness:.82,roughness:.27}),ceramic=new THREE.MeshPhysicalMaterial({color:0xe9e1cc,metalness:.24,roughness:.36,clearcoat:.3}),navy=new THREE.MeshStandardMaterial({color:0x122234,metalness:.65,roughness:.36}),foil=new THREE.MeshStandardMaterial({color:0xb58a3d,metalness:.87,roughness:.43}),solar=new THREE.MeshPhysicalMaterial({color:0x174d8c,metalness:.72,roughness:.26,clearcoat:.85}),light=new THREE.MeshStandardMaterial({color:0x9cf3e8,emissive:0x55d7c7,emissiveIntensity:1.8});
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;};
 const cube=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,parent:THREE.Object3D=root)=>mesh(Math.min(w,h,d)>.25?new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.12):new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
 const rod=(a:THREE.Vector3,b:THREE.Vector3,r=.08,m:THREE.Material=alloy,parent:THREE.Object3D=root)=>{const o=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),10),m,0,0,0,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o;};
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 // Octagonal insulated service bus, radiator panels and raised access hatches.
 const bus=mesh(new THREE.CylinderGeometry(2.25,2.25,5.6,8),foil);bus.rotation.x=Math.PI/2;
 for(const z of [-2.8,2.8]){const end=mesh(new THREE.CylinderGeometry(2.3,2.3,.2,8),alloy,0,0,z);end.rotation.x=Math.PI/2;}
 for(const side of [-1,1]){
  cube(ceramic,side*2.15,0,0,.2,2.7,3.8);for(let j=0;j<9;j++)cube(navy,side*2.27,-1.05+j*.26,0,.04,.06,3.25);
  // Hinged solar wings have separate frames, dark cell strips and fine busbars.
  rod(v(side*2.1,0,0),v(side*5.2,0,0),.2);mesh(new THREE.SphereGeometry(.43,16,12),alloy,side*4.4,0,0);
  const wing=new THREE.Group();wing.position.x=side*5;wing.rotation.x=.24+(index%3)*.18;root.add(wing);
  for(let segment=0;segment<3;segment++){
   const x=side*(1.85+segment*3.8);cube(alloy,x,0,0,3.6,.2,9,wing);cube(navy,x,.12,0,3.36,.06,8.76,wing);
   for(let row=0;row<12;row++)for(let col=0;col<3;col++)cube(solar,x-1.06+col*1.06,.18,-3.96+row*.72,.99,.035,.66,wing);
   for(let col=0;col<3;col++)cube(alloy,x-1.06+col*1.06,.203,0,.018,.008,8.4,wing);
   if(segment<2)for(const z of [-3.5,3.5])rod(v(side*(3.65+segment*3.8),0,z),v(side*(4.05+segment*3.8),0,z),.09,alloy,wing);
  }
  const nozzle=mesh(new THREE.CylinderGeometry(.4,.25,.8,20,1,true),navy,side*1.45,-1.4,3.05);nozzle.rotation.x=Math.PI/2;
 }
 cube(ceramic,0,2.08,0,2.3,.2,3.6);cube(navy,0,2.23,.3,1.4,.12,1.7);
 for(let i=0;i<5;i++)cube(alloy,-.5+i*.25,2.32,.3,.07,.035,1.45);
 const dish=(radius:number,x:number,y:number,z:number,tilt:number)=>{
  const assembly=new THREE.Group();assembly.position.set(x,y,z);assembly.rotation.x=tilt;root.add(assembly);
  const profile=Array.from({length:25},(_,i)=>{const r=i/24*radius;return new THREE.Vector2(r,.16*r*r);});
  const bowl=mesh(new THREE.LatheGeometry(profile,64),ceramic,0,0,0,assembly);(bowl.material as THREE.MeshPhysicalMaterial).side=THREE.DoubleSide;
  const rim=mesh(new THREE.TorusGeometry(radius,.065,10,64),alloy,0,.16*radius*radius,0,assembly);rim.rotation.x=Math.PI/2;
  for(let k=0;k<3;k++){const angle=k*Math.PI*2/3;rod(v(Math.cos(angle)*radius,.16*radius*radius,Math.sin(angle)*radius),v(0,radius*.95,0),.045,alloy,assembly);}
  mesh(new THREE.CylinderGeometry(.18,.25,.45,16),navy,0,radius*.95,0,assembly);
  rod(v(0,-1.7,0),v(0,0,0),.22,alloy,assembly);
 };
 if(index%3===1){
  const telescope=mesh(new THREE.CylinderGeometry(1.7,1.5,7,32,1,true),ceramic,0,1,-3.6);telescope.rotation.x=Math.PI/2;
  const aperture=mesh(new THREE.CircleGeometry(1.48,32),navy,0,1,-7.15);aperture.rotation.y=Math.PI;
  const lip=mesh(new THREE.TorusGeometry(1.65,.13,12,48),alloy,0,1,-7.1);
  dish(1.6,0,3,1.4,.65);
 }else{dish(index%3===0?3.5:2.7,0,3.3,0,.6);if(index%3===2)dish(1.8,0,.6,4,1.4);}
 for(const side of [-1,1]){rod(v(side*1.4,1.4,-2.5),v(side*2.5,3.5,-5),.04);mesh(new THREE.SphereGeometry(.13,12,8),light,side*2.5,3.5,-5);}
 root.position.set((index%2?1:-1)*(35+index%3*10),-4+(index%3)*6,-index*72-50);root.rotation.set(.12*(index%3-1),index*.63,.12*(index%2?1:-1));return root;
}
export function contactShadow(){
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:.38}},vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float opacity;varying vec2 p;void main(){float d=dot(p,p);gl_FragColor=vec4(.015,.025,.045,opacity*exp(-d*3.)*(1.-smoothstep(.55,1.,d)));}'});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.5,4.4),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=-.13;mesh.renderOrder=1;return mesh;
}
