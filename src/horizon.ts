import * as THREE from 'three';
export const VIEW=Object.freeze({trackSegments:128,roadFadeStart:700,roadFadeEnd:940,railFadeStart:320,railFadeEnd:460,objectFadeStart:480,objectFadeEnd:640,gateSlots:8});
/** Opaque screen-door fade avoids transparent road sorting and a hard horizon cut. */
export function horizonFade(material:THREE.Material,start:number,end:number){
 material.onBeforeCompile=shader=>{
  shader.uniforms.horizonStart={value:start};shader.uniforms.horizonEnd={value:end};
  shader.vertexShader='varying float horizonDepth;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec4 horizonPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
horizonPosition=instanceMatrix*horizonPosition;
#endif
horizonDepth=-(modelMatrix*horizonPosition).z;`);
  shader.fragmentShader='varying float horizonDepth;uniform float horizonStart;uniform float horizonEnd;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float horizonCoverage=1.-smoothstep(horizonStart,horizonEnd,horizonDepth);
   float horizonNoise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
   if(horizonCoverage<=horizonNoise)discard;`);
 };
 material.customProgramCacheKey=()=>`horizon-${start}-${end}`;return material;
}
