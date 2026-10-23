import * as THREE from 'three';
import {batchStatic} from './mesh-batch';
import {solidTerrain} from './solid-terrain';

/** Detailed, compressed island landmark; all parts are grounded in the same coastal mesh. */
export function makeAlcatraz(){
 const root=new THREE.Group();root.name='Alcatraz / rocky island and cellhouse';root.position.set(-225,-72,-820);
 const rock=new THREE.MeshStandardMaterial({color:0x9a9280,roughness:.97,vertexColors:true});
 const plaster=new THREE.MeshStandardMaterial({color:0xbeb6a1,roughness:.92});
 const stone=new THREE.MeshStandardMaterial({color:0x746f62,roughness:.95});
 const roof=new THREE.MeshStandardMaterial({color:0x525a5b,roughness:.8});
 const glass=new THREE.MeshStandardMaterial({color:0x24363b,metalness:.2,roughness:.36});
 const steel=new THREE.MeshStandardMaterial({color:0x4b514b,metalness:.5,roughness:.66});
 const cube=new THREE.BoxGeometry(1,1,1);
 const box=(mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const mesh=new THREE.Mesh(cube,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);root.add(mesh);return mesh;};
 const positions:number[]=[0,17,0],uv:number[]=[.5,.5],colors:number[]=[.58,.56,.45],indices:number[]=[];
 const segments=96,rings=12;
 for(let ring=1;ring<=rings;ring++)for(let i=0;i<segments;i++){
  const angle=i/segments*Math.PI*2,r=ring/rings;
  const shape=1+.055*Math.sin(angle*5)+.04*Math.sin(angle*9+1.3)+.025*Math.sin(angle*17);
  const x=Math.cos(angle)*85*r*shape,z=Math.sin(angle)*139*r*shape;
  const coast=THREE.MathUtils.smoothstep(r,.57,1);
  const h=17-25*coast+(Math.sin(angle*13+r*19)*1.8+Math.sin(angle*27)*.7)*coast;
  positions.push(x,h,z);uv.push(x/170+.5,z/278+.5);
  const c=new THREE.Color().setRGB(.57,.56,.46).lerp(new THREE.Color(.28,.3,.29),coast*.7);colors.push(c.r,c.g,c.b);
  const current=1+(ring-1)*segments+i,next=1+(ring-1)*segments+(i+1)%segments;
  if(ring===1)indices.push(0,next,current);
  else{const inner=current-segments,innerNext=next-segments;indices.push(inner,innerNext,current,innerNext,next,current);}
 }
 const surface=new THREE.BufferGeometry();surface.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));surface.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));surface.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));surface.setIndex(indices);surface.computeVertexNormals();
 const island=new THREE.Mesh(solidTerrain(surface,-60),rock);surface.dispose();root.add(island);
 // Terraced retaining wall and long three-storey cellhouse, instead of a single blank cube.
 box(stone,0,15,0,61,6,89);box(plaster,0,27,0,53,20,78);
 box(stone,0,18,0,55,2,80);box(plaster,0,37.5,0,56,1.2,81);box(roof,0,38.3,0,55,.5,80);
 for(const x of [-27,27])for(let z=-34;z<=34;z+=8.5){
  box(stone,x,27,z,.8,18,.65);
  for(let floor=0;floor<3;floor++){
   box(glass,x,22+floor*5,z+3,.16,2.8,2.4);
   box(plaster,x*1.01,20.5+floor*5,z+3,.5,.3,3);
   box(steel,x*1.012,22+floor*5,z+3,.18,2.8,.13);
  }
 }
 for(const z of [-39.1,39.1])for(let x=-21;x<=21;x+=7)for(let floor=0;floor<3;floor++){
  box(glass,x,22+floor*5,z,2.5,2.8,.15);box(plaster,x,20.5+floor*5,z,3,.3,.4);
 }
 for(let z=-28;z<=28;z+=14){box(roof,0,40,z,12,3,6);box(stone,18,40,z,2.4,4,2.4);}
 box(plaster,0,23,48,22,12,18);box(roof,0,29.5,48,24,1,20);box(glass,0,21,57.1,5,7,.15);
 // Service buildings and the eastern landing pier.
 box(stone,48,1,67,25,6,46);box(roof,48,4.4,83,23,.6,22);
 box(plaster,43,11,39,19,12,27);box(roof,43,17.5,39,21,1,29);
 for(let step=0;step<15;step++)box(stone,34,step*.85+3,67-step*2,9,1.2,2.1);
 // Octagonal lighthouse with gallery, dark lantern glazing and roof cap.
 const lighthouse=new THREE.Mesh(new THREE.CylinderGeometry(3.2,4.8,28,8),plaster);lighthouse.position.set(-35,30,57);root.add(lighthouse);
 const gallery=new THREE.Mesh(new THREE.CylinderGeometry(4.8,4.8,.8,16),stone);gallery.position.set(-35,44,57);root.add(gallery);
 const lantern=new THREE.Mesh(new THREE.CylinderGeometry(2.8,2.8,4,12),glass);lantern.position.set(-35,46,57);root.add(lantern);
 const cap=new THREE.Mesh(new THREE.ConeGeometry(4,2.4,12),roof);cap.position.set(-35,49.1,57);root.add(cap);
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;box(steel,-35+Math.cos(a)*4.2,45,57+Math.sin(a)*4.2,.12,2,.12);}
 // Steel water tower is a distinct silhouette at the far end of the island.
 for(const x of [-5,5])for(const z of [-5,5])box(steel,32+x,29,-70+z,.65,30,.65);
 const tank=new THREE.Mesh(new THREE.CylinderGeometry(8,8,12,24),plaster);tank.position.set(32,47,-70);root.add(tank);
 const tankRoof=new THREE.Mesh(new THREE.ConeGeometry(8.5,3,24),roof);tankRoof.position.set(32,54.5,-70);root.add(tankRoof);
 for(let y=20;y<=38;y+=9){box(steel,32,y,-70,11,.5,11);}
 batchStatic(root);root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 return {root,materials:[rock,plaster,stone,roof,glass,steel],pbrTargets:[{material:rock,asset:'coast_land_rocks_01',repeat:[3,4] as [number,number]},{material:plaster,asset:'white_plaster_rough_02',repeat:[1,1] as [number,number]}]};
}
