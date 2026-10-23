import * as THREE from 'three';

/** Share byte-equivalent static vertex attributes without rounding or smoothing. */
export function exactVertices(source:THREE.BufferGeometry){
 const attrs=Object.entries(source.attributes);
 if(Object.keys(source.morphAttributes).length||attrs.some(([,a])=>!(a instanceof THREE.BufferAttribute)))return source;
 const count=source.attributes.position.count;
 const lookup=new Map<string,number>(),original:number[]=[],remap=new Uint32Array(count);
 for(let i=0;i<count;i++){
  let key='';for(const [,attr] of attrs)for(let k=0;k<attr.itemSize;k++)key+=`${Object.is(attr.array[i*attr.itemSize+k],-0)?"-0":attr.array[i*attr.itemSize+k]},`;
  let vertex=lookup.get(key);if(vertex===undefined){vertex=original.length;lookup.set(key,vertex);original.push(i);}remap[i]=vertex;
 }
 if(original.length===count)return source;
 const result=new THREE.BufferGeometry();
 for(const [name,attribute] of attrs){
  const array=attribute.array.slice(0,original.length*attribute.itemSize);
  original.forEach((old,i)=>{for(let k=0;k<attribute.itemSize;k++)array[i*attribute.itemSize+k]=attribute.array[old*attribute.itemSize+k];});
  result.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
 }
 const index=source.index,indices=new Array<number>(index?.count??count);
 for(let i=0;i<indices.length;i++)indices[i]=remap[index?index.getX(i):i];
 result.setIndex(indices);result.groups=source.groups.map(g=>({...g}));result.setDrawRange(source.drawRange.start,source.drawRange.count);
 return result;
}
