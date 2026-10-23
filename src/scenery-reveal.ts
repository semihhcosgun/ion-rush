import * as THREE from 'three';

/** Gradual opaque coverage: retain depth testing and existing horizon shaders. */
export class SceneryReveal {
 readonly coverage={value:0};
 constructor(private root:THREE.Object3D,farStart=1e6,farEnd=1e6+1){
  const copies=new Map<THREE.Material,THREE.Material>();
  const copy=(source:THREE.Material)=>{
   const existing=copies.get(source);if(existing)return existing;
   const material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();
   material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);shader.uniforms.sceneryCoverage=this.coverage;
    shader.vertexShader='varying float sceneryDepth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nsceneryDepth=-mvPosition.z;');
    shader.fragmentShader='uniform float sceneryCoverage;varying float sceneryDepth;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
     float sceneryFar=1.-smoothstep(${farStart.toFixed(1)},${farEnd.toFixed(1)},sceneryDepth);
     float sceneryNoise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
     if(sceneryCoverage*sceneryFar<=sceneryNoise)discard;`);
   };
   material.customProgramCacheKey=()=>`${key}/scenery-reveal/${farStart}/${farEnd}`;
   copies.set(source,material);return material;
  };
  root.traverse(o=>{if(o instanceof THREE.Mesh)o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});
 }
 update(amount:number){this.coverage.value=THREE.MathUtils.clamp(amount,0,1);this.root.visible=this.coverage.value>0;}
}
