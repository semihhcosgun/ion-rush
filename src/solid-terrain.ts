import * as THREE from 'three';

/** Close an indexed heightfield with outward-facing perimeter walls and a seabed. */
export function solidTerrain(surface:THREE.BufferGeometry,baseY=-512){
 const index=surface.getIndex();if(!index)throw new Error('Terrain must be indexed');
 const p=surface.getAttribute('position'),uv=surface.getAttribute('uv'),color=surface.getAttribute('color');
 const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
 for(let layer=0;layer<2;layer++)for(let i=0;i<p.count;i++){
  if(p.getY(i)<=baseY)throw new Error('Terrain base must be below every surface vertex');
  positions.push(p.getX(i),layer?baseY:p.getY(i),p.getZ(i));
  uvs.push(uv?.getX(i)??0,layer?0:uv?.getY(i)??0);
  colors.push(color?.getX(i)??1,color?.getY(i)??1,color?.getZ(i)??1);
 }
 const edges=new Map<string,{a:number;b:number;count:number}>();
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
  indices.push(a,b,c,a+p.count,c+p.count,b+p.count);
  for(const [from,to] of [[a,b],[b,c],[c,a]]){const key=from<to?`${from}:${to}`:`${to}:${from}`;const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a:from,b:to,count:1});}
 }
 for(const {a,b,count} of edges.values())if(count===1)indices.push(b,a,a+p.count,b,a+p.count,b+p.count);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 // Side faces need their own UVs; reusing the top edge UV collapses the rock texture into stripes.
 const result=geometry.toNonIndexed(),rp=result.getAttribute('position'),ruv=result.getAttribute('uv');
 for(let i=0;i<rp.count;i+=3){
  const ys=[rp.getY(i),rp.getY(i+1),rp.getY(i+2)];if(!ys.includes(baseY)||ys.every(y=>y===baseY))continue;
  const dx=Math.max(rp.getX(i),rp.getX(i+1),rp.getX(i+2))-Math.min(rp.getX(i),rp.getX(i+1),rp.getX(i+2));
  for(let j=i;j<i+3;j++)ruv.setXY(j,(dx>.001?rp.getX(j)/5800:rp.getZ(j)/3800),rp.getY(j)/3800);
 }
 result.setIndex(Array.from({length:rp.count},(_,i)=>i));geometry.dispose();return result;
}

