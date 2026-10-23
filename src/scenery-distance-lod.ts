import * as THREE from 'three';
import {batchStatic} from './mesh-batch';
/** Preserve close architecture; distant copies omit trims and use plain building hulls. */
export class SceneryDistanceLOD {
 private groups:{high:THREE.Group;low:THREE.Group;min:number;max:number}[]=[];
 constructor(roots:THREE.Group[]){
  for(const root of roots){
   const high=new THREE.Group(),low=new THREE.Group();high.name='Detailed scenery';low.name='Distant silhouettes';
   let min=Infinity,max=-Infinity;
   for(const object of [...root.children]){
    if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))continue;
    object.updateMatrix();object.geometry.computeBoundingBox();const bounds=object.geometry.boundingBox!.clone().applyMatrix4(object.matrix),size=bounds.getSize(new THREE.Vector3());
    min=Math.min(min,bounds.min.z);max=Math.max(max,bounds.max.z);high.add(object);
    if(Math.min(size.x,size.y,size.z)<3&&Math.max(size.x,size.y,size.z)<200)continue;
    const copy=object.clone();
    if(object.geometry.type==='RoundedBoxGeometry'||object.geometry.type==='BoxGeometry'){
     const local=object.geometry.boundingBox!,span=local.getSize(new THREE.Vector3()),center=local.getCenter(new THREE.Vector3());
     const geo=new THREE.BoxGeometry(span.x,span.y,span.z);geo.translate(center.x,center.y,center.z);
     const source=object.geometry.getAttribute('color'),colors=new Float32Array(geo.attributes.position.count*3),c=new THREE.Color(1,1,1);
     if(source){c.setRGB(0,0,0);for(let i=0;i<source.count;i++){c.r+=source.getX(i)/source.count;c.g+=source.getY(i)/source.count;c.b+=source.getZ(i)/source.count;}}
     for(let i=0;i<geo.attributes.position.count;i++)c.toArray(colors,i*3);
     geo.setAttribute('color',new THREE.BufferAttribute(colors,3));copy.geometry=geo;
    }
    low.add(copy);
   }
   batchStatic(high);batchStatic(low);
   for(const [group,far] of [[high,false],[low,true]] as const)group.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;const material=(o.material as THREE.Material).clone();o.material=material;
    material.onBeforeCompile=shader=>{
     shader.vertexShader='varying float sceneryLodDepth;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nsceneryLodDepth=-(modelMatrix*vec4(transformed,1.)).z;');
     shader.fragmentShader='varying float sceneryLodDepth;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float fade=smoothstep(220.,300.,sceneryLodDepth);
      float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
      if(${far?'noise>=fade':'noise<fade'})discard;`);
    };material.customProgramCacheKey=()=>`scenery-lod-${far}`;
   });
   root.add(high,low);this.groups.push({high,low,min,max});
  }
 }
 update(z:number){for(const g of this.groups){g.high.visible=-g.max-z<316;g.low.visible=-g.min-z>204;}}
}
