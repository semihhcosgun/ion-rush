import {VIEW,horizonFade} from './horizon';
import * as THREE from 'three';

export type PickupVisualKind='energy'|'health'|'shield';

type AnimatedPickup=THREE.Group&{userData:{animate?:(time:number,phase?:number)=>void}};

function fade<T extends THREE.Material>(material:T){return horizonFade(material,VIEW.objectFadeStart,VIEW.objectFadeEnd) as T;}

function extruded(shape:THREE.Shape,depth:number,bevel:number,material:THREE.Material){
 const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:8,steps:1});
 geometry.center();geometry.computeVertexNormals();
 return new THREE.Mesh(geometry,material);
}

function healthShape(){
 const shape=new THREE.Shape(),p=[[-.28,.88],[.28,.88],[.28,.3],[.88,.3],[.88,-.3],[.28,-.3],[.28,-.88],[-.28,-.88],[-.28,-.3],[-.88,-.3],[-.88,.3],[-.28,.3]];
 p.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return shape;
}

function shieldShape(){
 const shape=new THREE.Shape();shape.moveTo(-.82,.7);shape.quadraticCurveTo(0,1.08,.82,.7);shape.lineTo(.69,-.22);shape.quadraticCurveTo(.55,-.76,0,-1.03);shape.quadraticCurveTo(-.55,-.76,-.69,-.22);shape.closePath();return shape;
}

function energyShape(){
 const shape=new THREE.Shape();shape.moveTo(.15,1.02);shape.lineTo(-.67,-.08);shape.lineTo(-.14,-.08);shape.lineTo(-.3,-.98);shape.lineTo(.73,.18);shape.lineTo(.17,.18);shape.closePath();return shape;
}

/** Volumetric collectibles with a readable silhouette, physical depth and a calm orbital motion. */
export function makePickupVisual(kind:PickupVisualKind){
 const root=new THREE.Group() as AnimatedPickup;root.name=`pickup-${kind}`;
 const model=new THREE.Group();model.name='pickup-volume';root.add(model);
 const accent=kind==='health'?0xff5b55:kind==='shield'?0x55c8ff:0xffc84f;
 const glowColor=kind==='health'?0xff302d:kind==='shield'?0x178cff:0xffa719;
 const chassis=fade(new THREE.MeshPhysicalMaterial({color:0x12293a,metalness:.78,roughness:.22,clearcoat:.75,clearcoatRoughness:.16}));
 const metal=fade(new THREE.MeshPhysicalMaterial({color:accent,emissive:glowColor,emissiveIntensity:.48,metalness:.56,roughness:.2,clearcoat:1,clearcoatRoughness:.12}));
 const light=fade(new THREE.MeshStandardMaterial({color:0xeaffff,emissive:accent,emissiveIntensity:1.7,metalness:.12,roughness:.18}));
 const aura=fade(new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));
 const shape=kind==='health'?healthShape():kind==='shield'?shieldShape():energyShape();

 const housing=extruded(shape,.54,.09,chassis);housing.scale.set(1.14,1.14,1);housing.name='pickup-housing';model.add(housing);
 const face=extruded(shape,.28,.065,metal);face.position.z=.27;face.scale.set(.91,.91,1);face.name='pickup-face';model.add(face);
 const rear=extruded(shape,.2,.05,metal);rear.position.z=-.31;rear.scale.set(.82,.82,1);model.add(rear);

 if(kind==='health'){
  const core=extruded(healthShape(),.15,.045,light);core.scale.set(.5,.5,1);core.position.z=.52;core.name='health-core';model.add(core);
  for(const z of [-.43,.43]){const collar=new THREE.Mesh(new THREE.TorusGeometry(1.02,.045,8,48),z>0?light:metal);collar.position.z=z;collar.scale.y=.98;model.add(collar);}
 }else if(kind==='shield'){
  const inset=extruded(shieldShape(),.12,.04,light);inset.scale.set(.58,.58,1);inset.position.z=.48;inset.name='shield-core';model.add(inset);
  const crown=new THREE.Mesh(new THREE.SphereGeometry(.68,24,16,0,Math.PI*2,0,Math.PI/2),aura);crown.scale.set(1.03,1.25,.42);crown.rotation.x=Math.PI/2;crown.position.z=.36;crown.renderOrder=2;model.add(crown);
 }else{
  const core=extruded(energyShape(),.16,.04,light);core.scale.set(.54,.54,1);core.position.z=.48;core.name='energy-core';model.add(core);
  const gimbalA=new THREE.Mesh(new THREE.TorusGeometry(1.08,.055,8,56),metal);gimbalA.rotation.x=.58;gimbalA.name='energy-gimbal-a';model.add(gimbalA);
  const gimbalB=new THREE.Mesh(new THREE.TorusGeometry(1.08,.028,8,56),aura);gimbalB.rotation.y=.72;gimbalB.name='energy-gimbal-b';model.add(gimbalB);
  for(const side of [-1,1]){const node=new THREE.Mesh(new THREE.SphereGeometry(.105,16,10),light);node.position.set(side*1.02,0,0);model.add(node);}
 }

 const halo=new THREE.Mesh(new THREE.TorusGeometry(1.28,.022,6,64),aura);halo.name='pickup-halo';halo.renderOrder=2;model.add(halo);
 const spark=new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),light);spark.name='pickup-spark';spark.scale.set(1,1,.65);model.add(spark);
 model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});

 root.userData.animate=(time:number,phase=0)=>{
  const t=time+phase;model.rotation.y=Math.sin(t*.72)*.31;model.rotation.x=Math.sin(t*.53+1.1)*.075;
  halo.rotation.z=t*.48;halo.scale.setScalar(1+Math.sin(t*2.15)*.035);
  spark.scale.setScalar(.72+Math.sin(t*2.8)*.12);
  if(kind==='energy'){
   const a=model.getObjectByName('energy-gimbal-a');const b=model.getObjectByName('energy-gimbal-b');if(a)a.rotation.z=t*.72;if(b)b.rotation.z=-t*.54;
  }
 };
 root.userData.animate(0);
 return root;
}
