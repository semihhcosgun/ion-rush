import * as THREE from 'three';

const vertex=`varying vec2 tex;varying vec3 unit;varying vec3 objectUnit;varying vec3 viewDirection;
void main(){tex=uv;objectUnit=position;unit=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);viewDirection=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const noise=`
float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.27,.39));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const sun=new THREE.Vector3(.62,.4,.57).normalize();
export function planetSurface(surface:THREE.Texture,kind:'earth'|'luna'|'mars'){
 return new THREE.ShaderMaterial({transparent:kind==='luna',depthWrite:kind!=='luna',uniforms:{visibility:{value:1},surface:{value:surface},kind:{value:kind==='earth'?0:kind==='luna'?1:2},sun:{value:sun.clone()}},vertexShader:vertex,fragmentShader:`
 uniform float visibility;
 uniform sampler2D surface;uniform float kind;uniform vec3 sun;varying vec2 tex;varying vec3 unit;varying vec3 objectUnit;varying vec3 viewDirection;
 ${noise}
 void main(){
  vec3 N=normalize(unit),V=normalize(viewDirection),sampleColor=texture2D(surface,tex).rgb;
  float grey=dot(sampleColor,vec3(.2126,.7152,.0722));
  float fine=noise(objectUnit*175.)*.65+noise(objectUnit*430.)*.35;
  float ocean=(1.-smoothstep(.0,.06,sampleColor.r-sampleColor.b)) * smoothstep(.018,.14,sampleColor.b-sampleColor.r);
  float height=dot(texture2D(surface,tex,1.5).rgb,vec3(.2126,.7152,.0722));
  // Surface gradient in unit-sphere space, guarded at silhouettes and poles.
  vec3 dx=dFdx(unit),dy=dFdy(unit),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);
  float strength=kind<.5?.0008:(kind<1.5?.004:.003);
  vec3 grad=(dFdx(height)*r1+dFdy(height)*r2)/max(abs(det),.000000001)*sign(det);
  N=normalize(N-clamp(grad*strength,vec3(-.2),vec3(.2)));
  vec3 albedo=sampleColor;
  if(kind<.5){
   albedo=mix(sampleColor,mix(vec3(.007,.04,.13),vec3(.02,.25,.36),smoothstep(.02,.27,grey)),ocean*.65);
  }else if(kind<1.5){
   albedo=mix(vec3(.105,.14,.205),vec3(.66,.69,.72),smoothstep(.035,.65,grey));
   albedo*=.98+fine*.04;
  }else{
   albedo=mix(vec3(.13,.034,.019),vec3(.76,.32,.13),smoothstep(.035,.65,grey));
   albedo*=.97+fine*.06;
   float polar=smoothstep(.9,.985,abs(objectUnit.y));albedo=mix(albedo,vec3(.7,.73,.72),polar*.68);
  }
  float day=dot(N,sun),light=max(day,0.);float sky=smoothstep(-.22,.25,day);
  vec3 color=albedo*(.065+light*1.28)+albedo*vec3(.06,.095,.16)*sky;
  float rim=pow(clamp(1.-dot(normalize(unit),V),0.,1.),3.6);
  if(kind<.5){
   float spec=pow(max(dot(N,normalize(sun+V)),0.),65.);color+=vec3(.8,.91,1.)*spec*ocean*.5;
   color+=vec3(.07,.32,.72)*rim*(.07+sky*.48);
  }else if(kind>1.5){color+=vec3(.58,.17,.045)*rim*sky*.24;}
  gl_FragColor=vec4(max(color,vec3(0.)),visibility);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
}

export function planetAtmosphere(kind:'earth'|'mars'){
 return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,uniforms:{tint:{value:new THREE.Color(kind==='earth'?0x388dde:0xe67943)},sun:{value:sun.clone()},strength:{value:kind==='earth'?.55:.25}},vertexShader:vertex,fragmentShader:`
 uniform vec3 tint;uniform vec3 sun;uniform float strength;varying vec3 unit;varying vec3 viewDirection;
 void main(){vec3 N=normalize(unit),V=normalize(viewDirection);float rim=pow(clamp(1.-abs(dot(N,V)),0.,1.),3.5);float day=smoothstep(-.3,.65,dot(N,sun));gl_FragColor=vec4(tint,rim*strength*(.12+day*.88));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}

/** Separate thin cloud shell: existing cloud geography gains physical parallax. */
export function earthClouds(surface:THREE.Texture){
 return new THREE.Mesh(new THREE.SphereGeometry(1,64,40),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{surface:{value:surface},sun:{value:sun.clone()}},vertexShader:vertex,fragmentShader:`
 uniform sampler2D surface;uniform vec3 sun;varying vec2 tex;varying vec3 unit;varying vec3 viewDirection;
 void main(){vec3 c=texture2D(surface,tex).rgb;float lo=min(c.r,min(c.g,c.b)),hi=max(c.r,max(c.g,c.b));float mask=smoothstep(.24,.72,lo)*(1.-smoothstep(.12,.3,hi-lo));float daylight=max(dot(normalize(unit),sun),0.);float edge=smoothstep(0.,.16,dot(normalize(unit),normalize(viewDirection)));gl_FragColor=vec4(vec3(.64,.75,.9)*(.15+daylight*1.2),mask*.65*edge);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}));
}
