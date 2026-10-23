import * as THREE from 'three';

/** Partition the actual shell; adjoining pieces expose rough heated fracture faces. */
export function fractureMeteor(source:THREE.BufferGeometry){
 const flat=source.index?source.toNonIndexed():source.clone(),p=flat.attributes.position;
 const seeds=Array.from({length:12},(_,i)=>{const y=1-2*(i+.5)/12,a=i*2.399,r=Math.sqrt(1-y*y);return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);});
 const groups=seeds.map(()=>[] as number[][]);const center=new THREE.Vector3();
 for(let i=0;i<p.count;i+=3){center.set(0,0,0);const triangle:number[]=[];for(let k=0;k<3;k++){triangle.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));center.x+=p.getX(i+k);center.y+=p.getY(i+k);center.z+=p.getZ(i+k);}center.normalize();let best=0;for(let j=1;j<seeds.length;j++)if(center.dot(seeds[j])>center.dot(seeds[best]))best=j;groups[best].push(triangle);}
 flat.dispose();
 return groups.filter(g=>g.length).map((triangles,id)=>{
  const outside=triangles.flat(),inside:number[]=[],edges=new Map<string,{a:number[];b:number[];count:number}>();
  const key=(v:number[])=>v.map(n=>Math.round(n*100000)).join(',');
  for(const t of triangles)for(let k=0;k<3;k++){const a=t.slice(k*3,k*3+3),b=t.slice(((k+1)%3)*3,((k+1)%3)*3+3),edgeKey=[key(a),key(b)].sort().join('|'),e=edges.get(edgeKey);if(e)e.count++;else edges.set(edgeKey,{a,b,count:1});}
  for(const e of edges.values())if(e.count===1)inside.push(...e.b,...e.a,0,0,0);
  const centroid=new THREE.Vector3();for(let j=0;j<outside.length;j+=3)centroid.add(new THREE.Vector3(outside[j],outside[j+1],outside[j+2]));centroid.multiplyScalar(1/(outside.length/3));
  const values=new Float32Array([...outside,...inside]);for(let j=0;j<values.length;j+=3){values[j]-=centroid.x;values[j+1]-=centroid.y;values[j+2]-=centroid.z;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(values,3));geometry.addGroup(0,outside.length/3,0);geometry.addGroup(outside.length/3,inside.length/3,1);geometry.computeVertexNormals();
  return {geometry,centroid,id};
 });
}

/** Analytic ballistic arc with two diminishing bounces and a resting height. */
export function fragmentHeight(time:number,start:number,velocity:number){
 const gravity=15,ground=.12;let t=Math.max(0,time),h=Math.max(ground,start),v=velocity;
 for(let bounce=0;bounce<3;bounce++){
  const duration=(v+Math.sqrt(v*v+2*gravity*(h-ground)))/gravity;
  if(t<=duration)return Math.max(ground,h+v*t-.5*gravity*t*t);
  t-=duration;v=Math.abs(v-gravity*duration)*.3;h=ground;
 }return ground;
}
