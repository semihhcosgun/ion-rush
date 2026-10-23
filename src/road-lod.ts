import * as THREE from 'three';
/** Complementary screen-door masks retain the full road silhouette during transitions. */
export class RoadLOD {
 readonly start={value:340};readonly end={value:440};
 readonly silhouetteStart={value:480};readonly silhouetteEnd={value:600};
 setEconomy(enabled:boolean){this.start.value=enabled?220:340;this.end.value=enabled?280:440;this.silhouetteStart.value=enabled?300:480;this.silhouetteEnd.value=enabled?380:600;}
 includes(depth:number,far:boolean){return far?depth>=this.start.value-16:depth<=this.end.value+16;}
 includesMiddle(depth:number){return this.includes(depth,true)&&depth<=this.silhouetteEnd.value+16;}
 includesSilhouette(depth:number){return depth>=this.silhouetteStart.value-16;}
 applySilhouette(material:THREE.Material,far:boolean){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
   previous.call(material,shader,renderer);
   shader.uniforms.roadSilhouetteStart=this.silhouetteStart;shader.uniforms.roadSilhouetteEnd=this.silhouetteEnd;
   shader.fragmentShader='uniform float roadSilhouetteStart;uniform float roadSilhouetteEnd;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    float silhouetteBlend=smoothstep(roadSilhouetteStart,roadSilhouetteEnd,horizonDepth);
    float silhouetteNoise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    if(${far?'silhouetteNoise>=silhouetteBlend':'silhouetteNoise<silhouetteBlend'})discard;`);
  };
  material.customProgramCacheKey=()=>`${key}/silhouette-${far}`;
 }
 apply(material:THREE.Material,far:boolean){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
   previous.call(material,shader,renderer);
   shader.uniforms.roadLodStart=this.start;shader.uniforms.roadLodEnd=this.end;
   shader.fragmentShader='uniform float roadLodStart;uniform float roadLodEnd;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    float roadBlend=smoothstep(roadLodStart,roadLodEnd,horizonDepth);
    float roadNoise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    if(${far?'roadNoise>=roadBlend':'roadNoise<roadBlend'})discard;`);
  };
  material.customProgramCacheKey=()=>`${key}/road-lod-${far}`;
 }
}
