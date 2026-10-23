import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {batchStatic} from './mesh-batch';
import {VisibleModelGroup} from './visible-model-group';
import {BIKE_FINISHES} from './bike-finishes';

/** Seven complete body kits, built once. Only the selected kit is drawn. */
export function attachBikeEvolution(bike:THREE.Group,ridingDetail=false){
 const enamel=new THREE.MeshPhysicalMaterial({color:0x086b65,metalness:.45,roughness:.26,clearcoat:.9,clearcoatRoughness:.18});
 const armour=new THREE.MeshPhysicalMaterial({color:0x17232e,metalness:.65,roughness:.31,clearcoat:.45});
 const alloy=new THREE.MeshStandardMaterial({color:0xaabac3,metalness:.86,roughness:.27});
 const accent=new THREE.MeshStandardMaterial({color:0x54dbbb,metalness:.7,roughness:.24});
 const light=new THREE.MeshStandardMaterial({color:0x6aefcf,emissive:0x6aefcf,emissiveIntensity:1.05,roughness:.28,metalness:.25});
 const glass=new THREE.MeshPhysicalMaterial({color:0x0b1a27,metalness:.24,roughness:.11,clearcoat:1,clearcoatRoughness:.06});
 const groups=Array.from({length:7},(_,i)=>{const g=new VisibleModelGroup();g.name='Evolution '+(i+1);bike.add(g);return g;});
 const sourceGeometry=new Set<THREE.BufferGeometry>();
 const mesh=(g:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0)=>{sourceGeometry.add(geometry);const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);g.add(m);return m;};
 const round=(g:THREE.Group,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,angle=0)=>{const o=mesh(g,new RoundedBoxGeometry(w,h,d,ridingDetail?1:2,Math.min(w,h,d)*.2),m,x,y,z);o.rotation.z=angle;return o;};
 const ring=(g:THREE.Group,m:THREE.Material,x:number,y:number,z:number,r:number,t=.014,arc=Math.PI*2)=>{const o=mesh(g,new THREE.TorusGeometry(r,t,ridingDetail?6:8,ridingDetail?24:48,arc),m,x,y,z);o.rotation.y=Math.PI/2;return o;};
 const tube=(g:THREE.Group,m:THREE.Material,x:number,y:number,z:number,r:number,length:number)=>{const o=mesh(g,new THREE.CylinderGeometry(r,r*.92,length,ridingDetail?12:24),m,x,y,z);o.rotation.x=Math.PI/2;return o;};
 // Bevelled, curved outlines form actual fairings rather than attached cubes.
 const panel=(g:THREE.Group,m:THREE.Material,x:number,points:[number,number][],depth=.065)=>{
  const shape=new THREE.Shape(),p=points.map(([z,y])=>new THREE.Vector2(-z,y));
  for(let i=0;i<p.length;i++){
   const prev=p[(i+p.length-1)%p.length],v=p[i],next=p[(i+1)%p.length];
   const a=v.clone().lerp(prev,.13),b=v.clone().lerp(next,.13);
   if(i===0)shape.moveTo(a.x,a.y);else shape.lineTo(a.x,a.y);
   shape.quadraticCurveTo(v.x,v.y,b.x,b.y);
  }
  shape.closePath();let edge=shape.getPoints(ridingDetail?2:5);edge.pop();if(THREE.ShapeUtils.isClockWise(edge))edge.reverse();
  const centre=edge.reduce((sum,v)=>sum.add(v),new THREE.Vector2()).divideScalar(edge.length),positions:number[]=[],indices:number[]=[];
  // A rounded cross-section gives the fairing real volume and moving highlights.
  const sections=[[-depth*.5-.012,.02],[-depth*.5-.008,.5],[-depth*.3,.85],[0,1],[depth*.3,.9],[depth*.5+.008,.6],[depth*.5+.012,.02]];
  for(const [offset,scale] of sections)for(const v of edge){const point=centre.clone().lerp(v,scale);positions.push(x+offset,point.y,-point.x);}
  const count=edge.length;
  for(let row=0;row<sections.length-1;row++)for(let j=0;j<count;j++){
   const a=row*count+j,b=row*count+(j+1)%count,c=(row+1)*count+j,d=(row+1)*count+(j+1)%count;
   indices.push(a,b,c,b,d,c);
  }
  const first=positions.length/3;positions.push(x+sections[0][0],centre.y,-centre.x);
  const last=positions.length/3;positions.push(x+sections[sections.length-1][0],centre.y,-centre.x);
  for(let j=0;j<count;j++){indices.push(first,(j+1)%count,j);const a=(sections.length-1)*count+j,b=(sections.length-1)*count+(j+1)%count;indices.push(a,b,last);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((_,i)=>i%3===0?[positions[i+2],positions[i+1]]:[]),2));geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(g,geometry,m);
 };
 const fin=(g:THREE.Group,m:THREE.Material,side:number,x:number,z:number,height:number)=>panel(g,m,side*x,[[z-.23,.84],[z+.26,.84+height],[z+.39,.83+height],[z+.2,.75],[z-.19,.74]],.045);
 const nose=(g:THREE.Group,wide=.32,sharp=false)=>{
  round(g,armour,0,.97,-1.1,wide*2,.25,.28);
  for(const side of [-1,1]){
   panel(g,enamel,side*(wide-.015),[[-1.28,.91],[-1.12,1.13],[-.86,1.03],[-.91,.82]],.045);
   round(g,light,side*wide*.5,.99,-1.255,wide*.62,.026,.026,side*(sharp?.18:0));
  }
  const windshield=round(g,glass,0,1.145,-.96,wide*1.4,.16,.055);windshield.rotation.x=-.38;
 };
 const wheelDetail=(g:THREE.Group,side:number,heavy=false)=>{
  for(const z of [-1.25,1.08]){
   ring(g,alloy,side*.145,.44,z,.315,.013);
   if(heavy){const arc=ring(g,armour,side*.14,.44,z,.565,.037,Math.PI*.78);arc.rotation.z=.36;}
  }
 };
 for(const side of [-1,1]){
  // IGNITION — a copper café racer with exposed induction and heat shields.
  const ignition=groups[0];
  ring(ignition,accent,side*.365,.57,.02,.235,.021);
  ring(ignition,alloy,side*.375,.57,.02,.196,.009);
  for(let j=0;j<6;j++)round(ignition,armour,side*.365,.45+j*.045,.03,.042,.019,.3);
  tube(ignition,armour,side*.375,.41,.86,.112,.62);
  for(const z of [.58,1.14])ring(ignition,accent,side*.375,.41,z,.116,.012).rotation.set(0,0,0);
  panel(ignition,alloy,side*.4,[[.53,.49],[1.1,.49],[1.16,.44],[.62,.43]],.022);
  panel(ignition,accent,side*.31,[[-.77,.92],[-.3,.98],[-.22,.94],[-.7,.87]],.022);
  wheelDetail(ignition,side);
  // RUNNER — a swept racing fairing, low belly and tapered tail.
  const runner=groups[1];
  panel(runner,armour,side*.32,[[-1.02,.74],[-.7,1.01],[-.2,.87],[.23,.6],[.03,.39],[-.58,.42]],.08);
  panel(runner,enamel,side*.365,[[-1.04,.77],[-.69,1.02],[-.29,.94],[.04,.71],[-.18,.6],[-.77,.59]],.055);
  panel(runner,alloy,side*.401,[[-.95,.69],[-.33,.68],[-.04,.73],[-.24,.61],[-.8,.58]],.016);
  round(runner,accent,side*.405,.79,-.53,.022,.023,.43,side*.06);
  panel(runner,enamel,side*.32,[[.53,.88],[.92,1.01],[1.48,1.02],[1.26,.79],[.77,.7]],.09);
  panel(runner,armour,side*.375,[[.78,.74],[1.46,.98],[1.39,.77],[.96,.64]],.035);
  round(runner,light,side*.27,.93,1.46,.13,.023,.03);
  wheelDetail(runner,side);
  // HUNTER — an angular nose, layered shoulder armour and machined intakes.
  const hunter=groups[2];
  panel(hunter,armour,side*.35,[[-1.13,.81],[-.72,1.03],[-.07,.87],[.24,.56],[-.02,.41],[-.64,.47]],.09);
  panel(hunter,enamel,side*.4,[[-1.12,.86],[-.65,1.08],[-.14,.93],[-.02,.68],[-.56,.61]],.07);
  for(let j=0;j<3;j++)round(hunter,armour,side*.445,.78+j*.062,-.39+j*.035,.025,.035,.27,side*.14);
  round(hunter,light,side*.451,.68,-.53,.018,.018,.36);
  panel(hunter,enamel,side*.36,[[.57,.88],[1.25,1.03],[1.46,.91],[1.26,.68],[.74,.62]],.11);
  fin(hunter,alloy,side,.41,1.13,.21);
  tube(hunter,armour,side*.43,.47,1,.1,.46);
  wheelDetail(hunter,side);
  // VANGUARD — a broad shoulder shield and paired aerospace reactor nacelles.
  const vanguard=groups[3];
  panel(vanguard,armour,side*.36,[[-1.08,.77],[-.7,1.06],[.05,.93],[.29,.51],[-.12,.38],[-.78,.45]],.1);
  panel(vanguard,enamel,side*.43,[[-1.01,.88],[-.63,1.11],[-.13,1.01],[.08,.77],[-.42,.64]],.1);
  panel(vanguard,alloy,side*.49,[[-.86,.85],[-.39,.94],[-.16,.87],[-.51,.8]],.018);
  tube(vanguard,armour,side*.48,.64,.91,.155,.7);
  tube(vanguard,alloy,side*.48,.64,1.235,.16,.075);
  tube(vanguard,light,side*.48,.64,1.281,.1,.02);
  fin(vanguard,enamel,side,.4,1.03,.25);
  round(vanguard,accent,side*.49,.81,.91,.18,.025,.46);
  wheelDetail(vanguard,side);
  // TITAN — substantial chamfered haunches, wheel armour and gold bracing.
  const titan=groups[4];
  panel(titan,armour,side*.39,[[-1.06,.68],[-.7,1.05],[.08,1],[.31,.48],[-.09,.32],[-.83,.39]],.13);
  panel(titan,enamel,side*.47,[[-.96,.84],[-.59,1.11],[-.06,.99],[.14,.62],[-.57,.57]],.12);
  panel(titan,accent,side*.54,[[-.83,.63],[-.1,.68],[.12,.55],[-.55,.49]],.024);
  round(titan,armour,side*.46,.76,1.04,.31,.33,.75,side*.09);
  panel(titan,enamel,side*.59,[[.65,.89],[1.29,1.07],[1.48,.86],[1.25,.59],[.71,.62]],.09);
  for(let j=0;j<3;j++)round(titan,alloy,side*.642,.71+j*.065,1.1,.023,.021,.28);
  tube(titan,armour,side*.46,.45,.99,.145,.54);
  tube(titan,accent,side*.46,.45,1.26,.15,.04);
  wheelDetail(titan,side,true);
  // PHANTOM — thin arrow fairings, swept blades and precise violet light rails.
  const phantom=groups[5];
  panel(phantom,armour,side*.33,[[-1.27,.69],[-.62,1.1],[.05,.91],[.22,.49],[-.59,.4]],.055);
  panel(phantom,enamel,side*.385,[[-1.18,.79],[-.57,1.08],[-.08,.89],[-.13,.61],[-.63,.58]],.055);
  panel(phantom,alloy,side*.417,[[-1.12,.76],[-.3,.8],[-.17,.75],[-.74,.67]],.012);
  round(phantom,light,side*.426,.78,-.52,.014,.015,.44);
  panel(phantom,enamel,side*.33,[[.53,.87],[1.13,.99],[1.57,1.04],[1.26,.68],[.76,.65]],.07);
  fin(phantom,armour,side,.44,1.12,.38);
  fin(phantom,accent,side,.468,1.17,.32);
  round(phantom,light,side*.48,1.04,1.24,.016,.021,.32);
  wheelDetail(phantom,side);
  // EVENT HORIZON — obsidian armour, gold inset blades and orbital stabilisers.
  const horizon=groups[6];
  panel(horizon,armour,side*.35,[[-1.2,.75],[-.63,1.11],[.11,.91],[.28,.49],[-.18,.36],[-.76,.44]],.1);
  panel(horizon,enamel,side*.43,[[-1.13,.86],[-.63,1.13],[-.14,.99],[.1,.73],[-.3,.61],[-.79,.64]],.075);
  panel(horizon,accent,side*.478,[[-1.04,.8],[-.51,.97],[-.31,.93],[-.73,.75]],.018);
  panel(horizon,enamel,side*.38,[[.5,.84],[.94,1.02],[1.54,1.08],[1.42,.7],[.81,.61]],.13);
  fin(horizon,accent,side,.46,1.15,.34);
  ring(horizon,armour,side*.56,.67,.92,.263,.034);
  ring(horizon,accent,side*.584,.67,.92,.265,.014);
  ring(horizon,light,side*.59,.67,.92,.218,.01);
  panel(horizon,alloy,side*.53,[[.41,.61],[1.31,.67],[1.39,.59],[.62,.53]],.03);
  wheelDetail(horizon,side,true);
 }
 nose(groups[1],.27);nose(groups[2],.32,true);nose(groups[3],.34);nose(groups[4],.36,true);nose(groups[5],.28,true);nose(groups[6],.33,true);
 round(groups[1],armour,0,.4,-.25,.55,.13,.77);
 round(groups[4],armour,0,.76,1.4,.66,.18,.14);
 round(groups[6],accent,0,1.04,1.4,.29,.045,.22);
 round(groups[6],light,0,1.07,1.4,.14,.018,.16);
 for(const group of groups){batchStatic(group);group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});group.visible=false;}
 sourceGeometry.forEach(g=>g.dispose());
 bike.userData.setEvolution=(value:number)=>{
  const level=Math.max(0,Math.min(7,Math.floor(Number.isFinite(value)?value:0))),f=BIKE_FINISHES[level];
  groups.forEach((g,i)=>g.visible=i===level-1);
  enamel.color.set(f.paint);enamel.metalness=f.metalness;enamel.roughness=f.roughness;
  armour.color.set(f.secondary);accent.color.set(f.accent);light.color.set(f.light);light.emissive.set(f.light);
  bike.userData.setLivery(level===7);bike.userData.setFinish?.(level);bike.userData.evolution=level;
 };
 bike.userData.setEvolution(0);
 return groups;
}
