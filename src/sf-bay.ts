import {MARIN_DEM} from './sf-elevation';
import {solidTerrain} from './solid-terrain';
import * as THREE from 'three';
import {pathAt} from './path';
import {batchStatic} from './mesh-batch';

const smooth=THREE.MathUtils.smoothstep;
// Ground traffic bends west into the headlands while the playable ribbon climbs ahead.
export function coastalRoadX(z:number){
 if(z<=1070)return pathAt(z).x;
 return pathAt(1070).x-720*smooth(z,1070,1720);
}
function roadFrame(z:number){
 const dx=(coastalRoadX(z+.5)-coastalRoadX(z-.5)),length=Math.hypot(1,dx);
 return {x:coastalRoadX(z),nx:1/length,nz:dx/length,dx};
}
/** Authored, compressed coastal relief: open water, rocky headlands and a clear road cutting. */
export function headlandHeight(x:number,z:number){
 const lon=-122.4783+x/(87980*.65),lat=37.832+(-z-1070)/(111320*.65);
 const rad=lat*Math.PI/180;
 const u=((lon+180)/360*4096-654)*128,v=((1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*4096-1582)*128;
 let height=-15;
 if(u>=0&&u<127&&v>=0&&v<127){const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;const at=(a:number,b:number)=>MARIN_DEM[b*128+a];height=THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix,iy),at(ix+1,iy),fx),THREE.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),fx),fy);}
  // The DEM crop is not a cliff: blend its perimeter down below water before closing the mesh.
 const coast=smooth(-z,740,1060)*smooth(x,-2900,-2550)*(1-smooth(x,2550,2900))*(1-smooth(-z,4150,4540));
 const ground=THREE.MathUtils.lerp(-88,-72+height*.9,coast);
 const road=coastalRoadX(-z);
 const cutting=(1-smooth(Math.abs(x-road),40,95))*(1-smooth(-z,1360,1510));
 return THREE.MathUtils.lerp(ground,Math.min(ground,-15),cutting);
}

export function makeBayEnvironment(){
 const root=new THREE.Group();root.name='Marin headlands / coastal panorama';
 const terrain=new THREE.PlaneGeometry(5800,3800,180,130);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,-2640);
 const p=terrain.getAttribute('position'),colors:number[]=[];
 const grass=new THREE.Color('#73775b'),rock=new THREE.Color('#817966'),wet=new THREE.Color('#4a5352');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),h=headlandHeight(x,z);p.setY(i,h);
  const slope=Math.abs(headlandHeight(x+8,z)-h)+Math.abs(headlandHeight(x,z+8)-h);
  const c=grass.clone().lerp(rock,smooth(slope,2,17)).lerp(wet,1-smooth(h,-75,-30));
  c.multiplyScalar(.88+.12*Math.sin(x*.019+z*.015));colors.push(c.r,c.g,c.b);
 }
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
 const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96});
 const closedTerrain=solidTerrain(terrain);terrain.dispose();
 const hills=new THREE.Mesh(closedTerrain,terrainMat);hills.receiveShadow=true;root.add(hills);
 const stone=new THREE.MeshStandardMaterial({color:0x7b7768,roughness:.92});
 const concrete=new THREE.MeshStandardMaterial({color:0x93918a,roughness:.86});
 const roof=new THREE.MeshStandardMaterial({color:0x865d4b,roughness:.8});
 const cube=new THREE.BoxGeometry(1,1,1);
 const box=(mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const m=new THREE.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);root.add(m);return m;};
 // The surface road turns left and disappears under the headland; its endpoint is buried.
 const asphalt=new THREE.MeshStandardMaterial({color:0x565b60,roughness:.94});
 const paint=new THREE.MeshStandardMaterial({color:0xc7c3ae,roughness:.9});
 const strip=(left:number,right:number,y:number,material:THREE.Material)=>{
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let z=1060,i=0;z<=2200;z+=10,i++){
   const f=roadFrame(z);positions.push(f.x+left*f.nx,y,-z+left*f.nz,f.x+right*f.nx,y,-z+right*f.nz);uv.push(0,z/60,1,z/60);
   if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();root.add(new THREE.Mesh(g,material));
 };
 strip(-20,20,-12.35,concrete);strip(-18.5,18.5,-12,asphalt);
 for(const side of [-1,1]){
  strip(side*17.4-.12,side*17.4+.12,-11.97,paint);
  for(let z=1070;z<2200;z+=10){
   const f=roadFrame(z);
   const rail=box(concrete,f.x+side*19.4*f.nx,-10.8,-z+side*19.4*f.nz,.65,2.4,10*Math.hypot(1,f.dx)+.5);rail.rotation.y=-Math.atan(f.dx);
  }
 }
 for(let z=1080;z<2200;z+=24)for(const lane of [-9,0,9]){
  const f=roadFrame(z);const mark=box(paint,f.x+lane*f.nx,-11.96,-z+lane*f.nz,.15,.025,9);mark.rotation.y=-Math.atan(f.dx);
 }
 // Supports meet the terrain under the short shore approach instead of leaving a floating slab.
 for(let z=1080;z<1450;z+=48){const x=coastalRoadX(z),base=headlandHeight(x,-z);if(base<-16)box(concrete,x,(base-13)/2,-z,28,-13-base,5);}
 for(const s of [-1,1])box(concrete,pathAt(1070).x+s*22,-13,-1070,11,25,24);
 // Fort Baker's low waterfront buildings sit on the eastern headland.
 for(let i=0;i<24;i++){
  const x=170+(i%8)*26,z=-1440-Math.floor(i/8)*65,y=headlandHeight(x,z);
  box(concrete,x,y+4,z,17,8,31);const r=box(roof,x,y+9,z,19,2,33);r.rotation.z=(i%2?1:-1)*.06;
 }
 batchStatic(root);
 return {root,materials:[terrainMat,stone,concrete,roof,asphalt,paint],asphalt};
}





