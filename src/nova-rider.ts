import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** NOVA's approved store portrait, modelled in the VESPER riding pose.
 * Keep the silhouette and materials here independent of the motorcycle paint.
 * All rigid parts can be batched; only the scarf updates during a frame.
 */
export function makeNovaRider(ridingDetail=false){
 const root=new THREE.Group();root.name='NOVA rider';
 const orange=new THREE.MeshPhysicalMaterial({name:'NOVA orange enamel',color:0xf9500d,roughness:.31,metalness:.04,clearcoat:1,clearcoatRoughness:.22});
 const cream=new THREE.MeshStandardMaterial({name:'NOVA warm ivory',color:0xffe9c2,roughness:.43,metalness:0});
 const leather=new THREE.MeshStandardMaterial({name:'NOVA black gloves and boots',color:0x15171a,roughness:.32,metalness:.04});
 const sole=new THREE.MeshStandardMaterial({name:'NOVA black soles',color:0x090b0e,roughness:.63});
 const pack=new THREE.MeshStandardMaterial({name:'NOVA flight pack',color:0x17191d,roughness:.48,metalness:.2});
 const visorMaterial=new THREE.MeshPhysicalMaterial({name:'NOVA obsidian visor',color:0x03090c,roughness:.095,metalness:.28,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:1.5});
 const scarfMaterial=new THREE.MeshPhysicalMaterial({name:'NOVA turquoise scarf',color:0x31d5cc,roughness:.38,metalness:0,sheen:.65,sheenColor:0x75f9ef,sheenRoughness:.5,side:THREE.DoubleSide});
 const sphere=new THREE.SphereGeometry(1,ridingDetail?24:40,ridingDetail?16:28);
 const mesh=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,position:THREE.Vector3)=>{
  const part=new THREE.Mesh(geometry,material);part.name=name;part.position.copy(position);part.castShadow=true;part.receiveShadow=true;root.add(part);return part;
 };
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 const ellipsoid=(name:string,material:THREE.Material,position:THREE.Vector3,size:THREE.Vector3)=>{const part=mesh(name,sphere,material,position);part.scale.copy(size);return part;};
 const segment=(name:string,material:THREE.Material,a:THREE.Vector3,b:THREE.Vector3,radius:number)=>{
  const part=mesh(name,new THREE.CapsuleGeometry(radius,Math.max(.001,a.distanceTo(b)-2*radius),ridingDetail?6:10,ridingDetail?16:24),material,a.clone().add(b).multiplyScalar(.5));
  part.quaternion.setFromUnitVectors(v(0,1,0),b.clone().sub(a).normalize());return part;
 };
 const cuff=(name:string,material:THREE.Material,position:THREE.Vector3,direction:THREE.Vector3,radius:number,length:number)=>{
  const part=mesh(name,new THREE.CylinderGeometry(radius,radius*.98,length,ridingDetail?24:40,1),material,position);
  part.quaternion.setFromUnitVectors(v(0,1,0),direction.clone().normalize());return part;
 };
 const sweep=(name:string,material:THREE.Material,points:THREE.Vector3[],startRadius:number,endRadius:number)=>{
  const curve=new THREE.CatmullRomCurve3(points),segments=ridingDetail?20:40,sides=ridingDetail?16:24,frames=curve.computeFrenetFrames(segments,false);
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let row=0;row<=segments;row++){
   const t=row/segments,point=curve.getPointAt(t),radius=THREE.MathUtils.lerp(startRadius,endRadius,t);
   for(let col=0;col<=sides;col++){
    const angle=col/sides*Math.PI*2,normal=frames.normals[row].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[row],Math.sin(angle));
    positions.push(point.x+normal.x*radius,point.y+normal.y*radius,point.z+normal.z*radius);normals.push(normal.x,normal.y,normal.z);uvs.push(col/sides,t);
    if(row<segments&&col<sides){const a=row*(sides+1)+col;indices.push(a,a+1,a+sides+1,a+1,a+sides+2,a+sides+1);}
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  return mesh(name,geometry,material,v(0,0,0));
 };

 // The uninterrupted ivory torso and lacquered orange limbs are the mascot's suit.
 const torso=ellipsoid('NOVA ivory torso',cream,v(0,1.265,.30),v(.238,.335,.194));torso.rotation.x=-.58;
 cuff('NOVA neck',cream,v(0,1.45,.07),v(0,1,-.5),.102,.13);
 const backpack=mesh('NOVA black flight pack',new RoundedBoxGeometry(.265,.35,.16,4,.025),pack,v(0,1.30,.535));backpack.rotation.x=-.58;
 const antennaBase=v(-.115,1.45,.56),antennaTip=v(-.115,2.075,.65);
 segment('NOVA ivory antenna',cream,antennaBase,antennaTip,.021);
 cuff('NOVA antenna socket',pack,antennaBase,antennaTip.clone().sub(antennaBase),.033,.11);

 // A tall oval shell, a narrow crown stripe, and a front-only rounded visor.
 // The stripe is a surface strip, not a second intersecting helmet sphere.
 const head=v(0,1.705,-.075),radii=v(.291,.345,.302);
 mesh('NOVA orange helmet',new THREE.SphereGeometry(1,ridingDetail?40:80,ridingDetail?28:56),orange,head).scale.copy(radii);
 const stripePositions:number[]=[],stripeIndices:number[]=[],stripeUvs:number[]=[];
 for(let row=0;row<=72;row++){
  const angle=-.92+row/72*3.68;
  for(let col=0;col<=6;col++){
   const x=(col/6*2-1)*.052,ring=Math.sqrt(1-(x/radii.x)**2);
   stripePositions.push(x,(radii.y+.0015)*Math.cos(angle)*ring,(radii.z+.0015)*Math.sin(angle)*ring);stripeUvs.push(col/6,row/72);
   if(row<72&&col<6){const a=row*7+col;stripeIndices.push(a,a+7,a+1,a+1,a+7,a+8);}
  }
 }
 const stripeGeometry=new THREE.BufferGeometry();stripeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stripePositions,3));stripeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(stripeUvs,2));stripeGeometry.setIndex(stripeIndices);stripeGeometry.computeVertexNormals();
 // Surface coordinates use x right, y up, with the front facing negative Z.
 mesh('NOVA crown stripe',stripeGeometry,cream,head);
 const visorPositions:number[]=[],visorNormals:number[]=[],visorUvs:number[]=[],visorIndices:number[]=[];
 const columns=ridingDetail?32:64,rows=ridingDetail?32:64,left=.755,bottom=-.38,top=.655,corner=.17;
 for(let row=0;row<=rows;row++){
  const y=bottom+(top-bottom)*row/rows;
  const edge=Math.max(0,bottom+corner-y,y-(top-corner));
  const width=left-corner+Math.sqrt(Math.max(0,corner*corner-edge*edge));
  for(let col=0;col<=columns;col++){
   const x=(col/columns*2-1)*width,z=-Math.sqrt(Math.max(.001,1-x*x-y*y));
   visorPositions.push(x*(radii.x+.003),y*(radii.y+.003),z*(radii.z+.004));visorUvs.push(col/columns,row/rows);
   const normal=v(x/(radii.x+.003),y/(radii.y+.003),z/(radii.z+.004)).normalize();visorNormals.push(normal.x,normal.y,normal.z);
   if(row<rows&&col<columns){const a=row*(columns+1)+col;visorIndices.push(a,a+columns+1,a+1,a+1,a+columns+1,a+columns+2);}
  }
 }
 const visorGeometry=new THREE.BufferGeometry();visorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(visorPositions,3));visorGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(visorNormals,3));visorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(visorUvs,2));visorGeometry.setIndex(visorIndices);
 mesh('NOVA black visor',visorGeometry,visorMaterial,head);
 for(const side of [-1,1]){
  const earProfile=[[0,-.027],[.09,-.027],[.1,-.024],[.106,-.017],[.108,-.005],[.108,.012],[.104,.024],[.097,.031],[.075,.034],[0,.034]].map(([r,y])=>new THREE.Vector2(r,y));
  const ear=mesh('NOVA ivory earpiece',new THREE.LatheGeometry(earProfile,ridingDetail?24:48),cream,v(side*.288,1.69,-.052));ear.quaternion.setFromUnitVectors(v(0,1,0),v(side,0,0));

  const shoulder=v(side*.193,1.422,.12),elbow=v(side*.335,1.207,-.245),wrist=v(side*.405,1.16,-.725);
  sweep('NOVA orange arm',orange,[shoulder,shoulder.clone().lerp(elbow,.7),elbow,elbow.clone().lerp(wrist,.3),wrist],.091,.071);
  ellipsoid('NOVA rounded shoulder',orange,shoulder,v(.091,.091,.091));
  const gloveStart=elbow.clone().lerp(wrist,.32),axis=wrist.clone().sub(elbow);
  sweep('NOVA long black glove',leather,[gloveStart,gloveStart.clone().lerp(wrist,.5),wrist],.081,.078);
  cuff('NOVA ivory glove trim',cream,gloveStart,axis,.086,.026);
  ellipsoid('NOVA gripping glove',leather,wrist,v(.09,.073,.105));
  const thumb=ellipsoid('NOVA glove thumb',leather,wrist.clone().add(v(-side*.062,-.04,-.016)),v(.04,.039,.072));thumb.rotation.x=-.32;

  const hip=v(side*.137,1.052,.505),knee=v(side*.38,.79,.07),ankle=v(side*.43,.515,.505);
  sweep('NOVA orange leg',orange,[hip,hip.clone().lerp(knee,.65),knee,knee.clone().lerp(ankle,.35),ankle],.104,.086);
  const bootTop=knee.clone().lerp(ankle,.2);
  sweep('NOVA tall black boot shaft',leather,[bootTop,bootTop.clone().lerp(ankle,.5),ankle],.101,.097);
  // Rounded riding boots, with the same black integrated sole as the portrait.
  ellipsoid('NOVA black boot instep',leather,v(side*.43,.515,.39),v(.112,.105,.196));
  ellipsoid('NOVA black boot toe',leather,v(side*.43,.485,.259),v(.112,.078,.126));
  mesh('NOVA black boot sole',new RoundedBoxGeometry(.226,.037,.425,4,.016),sole,v(side*.43,.429,.356));
 }

 const collar=mesh('NOVA scarf collar',new THREE.TorusGeometry(.106,.026,12,48),scarfMaterial,v(0,1.463,.058));collar.rotation.x=Math.PI/2+.32;
 // A tapered, curved ribbon flowing from the neck, with smooth animated normals.
 const scarfGeometry=new THREE.PlaneGeometry(1,1,6,32),scarf=mesh('NOVA scarf',scarfGeometry,scarfMaterial,v(0,0,0));
 scarf.frustumCulled=false;
 const scarfPositions=scarfGeometry.attributes.position;
 const animate=(time:number)=>{
  for(let row=0;row<=32;row++){
   const t=row/32,flow=Math.sin(time*5.8-t*5)*.065*t,centerX=-.06-.21*t+Math.sin(t*5+time*3)*.045*t;
   const centerY=1.465+.13*Math.sin(t*2.7)+flow,centerZ=.16+1.02*t,width=.15+.10*Math.sin(t*Math.PI)-.07*t;
   for(let col=0;col<=6;col++){
    const u=col/6-.5;
    scarfPositions.setXYZ(row*7+col,centerX+u*width,centerY+Math.sin(u*Math.PI)*.026+u*Math.sin(t*7-time*4)*.045*t,centerZ+u*.035);
   }
  }
  scarfPositions.needsUpdate=true;scarfGeometry.computeVertexNormals();
 };
 animate(0);
 const setLivery=(horizon:boolean)=>{
  orange.color.set(horizon?0x593078:0xf9500d);cream.color.set(horizon?0xe2d5f2:0xffe9c2);scarfMaterial.color.set(horizon?0xb8a1ff:0x31d5cc);
 };
 root.userData.animate=animate;root.userData.setLivery=setLivery;
 return {root,animate,setLivery};
}
