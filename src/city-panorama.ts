import * as THREE from 'three';
import {batchStatic} from './mesh-batch';

/** Repeating floors, varied glazing and masonry for the distant surveyed city. */
export function cityFacades(){
 const palette=['#c7c1b2','#9faaa9','#b7ac98','#789399','#d2cec0','#a49b91'];
 return palette.map((base,style)=>{
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const g=c.getContext('2d')!;g.fillStyle=base;g.fillRect(0,0,256,256);
  for(let floor=0;floor<8;floor++){
   g.fillStyle='rgba(28,35,38,.2)';g.fillRect(0,floor*32,256,2);
   for(let col=0;col<8;col++){
    const n=(col*17+floor*31+style*13)%19;
    g.fillStyle=n<2?'#b9b8a4':n<7?'#6b858e':'#3c5662';
    g.fillRect(col*32+6,floor*32+5,style===3?25:18,21);
    g.fillStyle='rgba(206,223,222,.4)';g.fillRect(col*32+7,floor*32+6,2,19);
    g.fillStyle='rgba(22,29,34,.4)';g.fillRect(col*32+5,floor*32+26,21,2);
   }
  }
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  return new THREE.MeshStandardMaterial({map,roughness:style===3?.38:.82,metalness:style===3?.3:.04});
 });
}

export function cityWaterfront(){
 const root=new THREE.Group();root.name='San Francisco / waterfront terraces and piers';
 const materials=[0x777968,0x8a8477,0xc2b7a1,0x6d5142,0x405341,0x3e484a].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}));
 const [earth,quay,plaster,roof,green,asphalt]=materials;
 const box=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);root.add(mesh);return mesh;
 };
 // The near edge descends underwater; a layered waterfront replaces the flat slab.
 const ground=new THREE.PlaneGeometry(2200,1600,60,40);ground.rotateX(-Math.PI/2);
 const p=ground.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),edge=735+24*Math.sin(x*.009)+12*Math.sin(x*.023);
  const inland=THREE.MathUtils.smoothstep(edge-z,0,95);
  p.setY(i,-83+16*inland);
 }
 ground.computeVertexNormals();const land=new THREE.Mesh(ground,earth);land.position.set(1420,0,-2350);root.add(land);
 for(let i=0;i<25;i++){
  const x=420+i*78,z=-1620-24*Math.sin((x-1420)*.009);
  box(quay,x,-69,z,79,8,32);box(asphalt,x,-64.7,z-34,79,.5,25);
  // Low warehouses keep the water's edge distinct from the downtown towers.
  if(i%3!==1){box(plaster,x,-55,z-65,48,18,28);box(roof,x,-45,z-65,51,2,31);}
  if(i%4===0){
   box(quay,x,-69,z+57,26,7,112);box(plaster,x,-58,z+56,19,16,74);box(roof,x,-49,z+56,22,2,78);
   for(let k=0;k<6;k++)box(asphalt,x-14,-70,z+k*18,2,13,2);
  }
  if(i%5===1||i%5===2)for(let j=0;j<4;j++){
   const size=4+(i*7+j*3)%5;const tree=new THREE.Mesh(new THREE.IcosahedronGeometry(size,1),green);tree.position.set(x-25+j*15,-63+size,z-20-j%2*7);tree.scale.set(1,1.2+(j%3)*.17,.85);tree.rotation.y=i+j;root.add(tree);
  }
 }
 batchStatic(root);return {root,materials};
}
