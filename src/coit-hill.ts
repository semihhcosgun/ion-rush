import * as THREE from 'three';
import {solidTerrain} from './solid-terrain';
import {batchStatic} from './mesh-batch';

/** Authored coastal adaptation of Telegraph Hill, with a solid, submerged perimeter. */
export function makeCoitHill(){
 const root=new THREE.Group();root.name='Coit Tower / terraced coastal hill';root.position.set(240,-72,-610);
 const ground=new THREE.MeshStandardMaterial({color:0xb3af95,vertexColors:true,roughness:.96});
 const concrete=new THREE.MeshStandardMaterial({color:0xc7bfa8,roughness:.86});
 const stone=new THREE.MeshStandardMaterial({color:0x79796b,roughness:.94});
 const foliage=new THREE.MeshStandardMaterial({color:0x3a4937,roughness:1});
 const bark=new THREE.MeshStandardMaterial({color:0x514d3d,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x283336,roughness:.65});
 const height=(x:number,z:number)=>{
  const angle=Math.atan2(z,x),r=Math.hypot(x/110,z/135)/(1+.065*Math.sin(angle*5)+.03*Math.sin(angle*11));
  const fall=THREE.MathUtils.smoothstep(r,.15,.91);
  return 50-60*fall+(Math.sin(x*.13+z*.08)*2+Math.sin(z*.19)*1.2)*fall*(1-fall);
 };
 const top=new THREE.PlaneGeometry(250,300,64,72);top.rotateX(-Math.PI/2);
 const p=top.getAttribute('position'),colors:number[]=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),y=height(x,z);p.setY(i,y);
  const c=new THREE.Color('#8a866f').lerp(new THREE.Color('#3b463a'),THREE.MathUtils.smoothstep(y,6,38)*.5);
  c.multiplyScalar(.88+.12*Math.sin(x*.08+z*.07));colors.push(c.r,c.g,c.b);
 }
 top.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 root.add(new THREE.Mesh(solidTerrain(top,-80),ground));top.dispose();
 const cube=new THREE.BoxGeometry(1,1,1);
 const box=(mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const m=new THREE.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);root.add(m);return m;};
 const plaza=new THREE.Mesh(new THREE.CylinderGeometry(16,19,3,32),stone);plaza.position.y=50;root.add(plaza);
 const tower=new THREE.Mesh(new THREE.CylinderGeometry(5.5,7,38,32),concrete);tower.position.y=70;root.add(tower);
 for(let i=0;i<12;i++){
  const a=i/12*Math.PI*2,x=Math.cos(a),z=Math.sin(a);
  const opening=box(dark,x*5.55,82,z*5.55,1.5,5.5,.2);opening.rotation.y=Math.PI/2-a;
  const rib=box(concrete,x*6.1,68,z*6.1,.36,27,.5);rib.rotation.y=Math.PI/2-a;
 }
 const crown=new THREE.Mesh(new THREE.CylinderGeometry(6,5.8,1.5,32),concrete);crown.position.y=89;root.add(crown);
 // A switchback stair and low stone retaining walls anchor the summit to the slope.
 for(let i=0;i<54;i++){
  const t=i/53,z=18+t*99,x=24*Math.sin(t*Math.PI*2),y=height(x,z);
  box(stone,x,y+.25,z,5.5,.55,2.2);box(stone,x+3.3,y+.8,z,.6,1.6,2.2);
 }
 const leaves=new THREE.IcosahedronGeometry(1,1);
 for(let i=0;i<34;i++){
  const a=i*2.39996,r=30+(i%6)*9,x=Math.cos(a)*r,z=Math.sin(a)*r,y=height(x,z);
  if(Math.abs(x)<10&&z>0)continue;
  box(bark,x,y+2.5,z,.6,5,.6);
  for(let branch=0;branch<3;branch++){
   const m=new THREE.Mesh(leaves,foliage);m.position.set(x+Math.cos(a+branch*2)*1.5,y+4.5+branch*1.1,z+Math.sin(a+branch*2)*1.5);m.scale.set(2.7,3.4,2.5);m.rotation.set(a,branch*.6,a*.3);root.add(m);
  }
 }
 batchStatic(root);root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 return {root,materials:[ground,concrete,stone,foliage,bark,dark],pbrTargets:[{material:ground,asset:'coast_land_rocks_01',repeat:[4,5] as [number,number]},{material:concrete,asset:'white_plaster_rough_02',repeat:[1,2] as [number,number]}]};
}
