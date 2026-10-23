import * as THREE from 'three';
/** Brief non-circular warp flare; hull appears in scattered fragments during the pulse. */
export function warpFlare(color:number){return new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{age:{value:0},tint:{value:new THREE.Color(color)}},vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 p;uniform float age;uniform vec3 tint;void main(){float pulse=sin(clamp(age/.8,0.,1.)*3.14159265);float core=exp(-dot(p,p)*26.);float slit=exp(-abs(p.x)*50.-abs(p.y)*3.);float streak=exp(-abs(p.y)*65.-abs(p.x)*4.);float border=1.-smoothstep(.65,1.,max(abs(p.x),abs(p.y)));gl_FragColor=vec4(tint*2.+vec3(.5),min(1.,core+slit*.6+streak*.45)*pulse*border*.8);}`}));}
export function warpMaterial(material:THREE.Material,progress:{value:number}){
 const copy=material.clone();copy.onBeforeCompile=shader=>{shader.uniforms.warpProgress=progress;shader.fragmentShader='uniform float warpProgress;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 if(warpProgress<1.){float warpNoise=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy/2.),vec2(.06711056,.00583715))));
 if(warpProgress<warpNoise)discard;}`);};copy.customProgramCacheKey=()=> 'warp-material-v2';return copy;
}
