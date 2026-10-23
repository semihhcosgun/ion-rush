import * as THREE from 'three';

const sceneCopies=new WeakMap<THREE.BufferGeometry,THREE.BufferGeometry>();

/** Keep positions and topology exact; normal/UV error stays below 1 / 32767.
 * Apply before upload, after baking transforms. Live/deforming attributes stay float. */
export function packStaticAttributes(geometry:THREE.BufferGeometry){
 let saved=0;
 if(Object.keys(geometry.morphAttributes).length)return saved;
 for(const name of ['normal','uv']){
  const source=geometry.getAttribute(name);
  if(!(source instanceof THREE.BufferAttribute)||!(source.array instanceof Float32Array)||source.usage!==THREE.StaticDrawUsage||source.gpuType!==THREE.FloatType)continue;
  const lower=name==='normal'?-1:0;
  if(source.array.some(value=>!Number.isFinite(value)||value<lower||value>1))continue;
  const scale=name==='normal'?32767:65535;
  const data=name==='normal'?new Int16Array(source.array.length):new Uint16Array(source.array.length);
  for(let i=0;i<data.length;i++)data[i]=Math.round(source.array[i]*scale);
  const packed=new THREE.BufferAttribute(data,source.itemSize,true);packed.name=source.name;
  saved+=source.array.byteLength-data.byteLength;geometry.setAttribute(name,packed);
 }
 return saved;
}

export function packStaticScene(root:THREE.Object3D){
 let saved=0;
 root.traverse(object=>{
  const mesh=object as THREE.Mesh,geometry=mesh.geometry;
  if(!geometry||object.name==='NOVA scarf')return;
  let packed=sceneCopies.get(geometry);
  if(!packed){
   // Reusable primitive templates may still feed later obstacle batches.
   // Never change their attribute types underneath the geometry builder.
   const candidate=geometry.clone();
   // Keep live position/index identities, including effects that own their arrays.
   for(const [name,attribute] of Object.entries(geometry.attributes))candidate.setAttribute(name,attribute);
   candidate.setIndex(geometry.index);
   const bytes=packStaticAttributes(candidate);
   if(bytes){packed=candidate;saved+=bytes;sceneCopies.set(packed,packed);}
   else{candidate.dispose();packed=geometry;}
   sceneCopies.set(geometry,packed);
  }
  mesh.geometry=packed;
 });
 return saved;
}
