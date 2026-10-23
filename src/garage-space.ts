import * as THREE from 'three';

/** Static star field, aligned to screen coordinates across the preview and its surroundings. */
export function garageSpaceMaterial(){return new THREE.ShaderMaterial({
 depthTest:false,depthWrite:false,
 uniforms:{origin:{value:new THREE.Vector2()},viewSize:{value:new THREE.Vector2(1,1)},pixelRatio:{value:1}},
 vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`
 uniform vec2 origin,viewSize;uniform float pixelRatio;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
 float stars(vec2 p,float size,float seed){
  vec2 cell=floor(p/size),f=fract(p/size),center=vec2(hash(cell+seed),hash(cell+seed+7.));
  float chance=hash(cell+seed+17.),d=length((f-center)*size),radius=mix(.35,.85,hash(cell+seed+29.));
  float core=1.-smoothstep(radius*.15,radius+.35,d);
  return step(.86,chance)*(core*.55+exp(-d*d*.45)*.07)*mix(.3,1.,hash(cell+seed+39.));
 }
 void main(){
  vec2 p=gl_FragCoord.xy/pixelRatio+origin,uv=p/viewSize;
  float cloud=noise(uv*4.)*.5+noise(uv*9.+11.)*.3+noise(uv*19.)*.2;
  float band=exp(-pow((uv.y-.3-uv.x*.35)*3.5,2.));
  vec3 color=vec3(.003,.008,.018)+vec3(.002,.005,.011)*cloud*band;
  float star=stars(p,24.,3.)+stars(p,51.,61.);
  color+=vec3(.65,.82,1.)*star;
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`
});}
