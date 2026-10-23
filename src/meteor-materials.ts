import * as THREE from 'three';

const noise=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.07)*.28+noise(p*4.13)*.15;}
vec2 cells(vec2 p){vec2 i=floor(p),f=fract(p);float a=9.,b=9.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(hash(i+g),hash(i+g+19.3));float d=length(g+o-f);if(d<a){b=a;a=d;}else b=min(b,d);}return vec2(a,b-a);}
`;

/** Continuous world-length UVs: no repeated rectangles or seams along the burn. */
export function meteorRoadMaterial(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,uniforms:{time:{value:0},heat:{value:0},warning:{value:1},fill:{value:0},span:{value:80},age:{value:0},seed:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
varying vec2 vUv;uniform float time,heat,warning,fill,span,age,seed;
${noise}
void main(){
 vec2 p=vec2((vUv.x-.5)*2.,vUv.y*span);vec2 q=p*vec2(3.2,.7)+seed;
 float rough=fbm(q*1.7);float taper=smoothstep(0.,4.,p.y)*(1.-smoothstep(span-9.,span,p.y));
 float width=(.73+.12*noise(vec2(p.y*.53,seed)))*taper;
 float edge=1.-smoothstep(width-.13,width+.08,abs(p.x)+(rough-.5)*.2);
 vec2 rock=cells(q+vec2(fbm(q)*.8,0.));float crack=1.-smoothstep(.012,.067,rock.y);
 float grit=noise(q*27.);float inner=1.-smoothstep(.3,.92,abs(p.x));
 float pool=smoothstep(.58,.78,fbm(q*.8))*inner;
 float thermal=heat*(.65+.35*fbm(q*.6));float glow=(crack*.85+pool*.48)*thermal;
 float flow=.84+.16*sin(time*3.2+q.y*2.+rough*6.);
 vec3 basalt=mix(vec3(.018,.023,.028),vec3(.095,.071,.055),rough)*(.75+grit*.45);
 basalt+=vec3(.075,.045,.022)*smoothstep(.06,.14,rock.y)*(1.-smoothstep(.14,.25,rock.y));
 vec3 color=basalt+mix(vec3(1.6,.12,.012),vec3(2.8,.9,.15),pool)*glow*flow;
 float rails=smoothstep(.78,.86,abs(p.x))*(1.-smoothstep(.9,.98,abs(p.x)));
 float dash=smoothstep(.35,.45,fract(p.y*.35-time*.6));
 float chevron=pow(max(0.,sin(p.y*1.8-abs(p.x)*3.-time*3.)),16.);
 float warningAlpha=(rails*dash*.8+chevron*.13+.035*fill)*taper;
 float reveal=1.-smoothstep(age*250.,age*250.+8.,p.y);
 float fade=1.-smoothstep(6.,8.,age);
 gl_FragColor=vec4(mix(color,vec3(1.,.43,.1),warning),mix(edge*.96*reveal*fade,warningAlpha,warning));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});}

export function meteorRockMaterial(){
 const mat=new THREE.MeshStandardMaterial({color:0x50483e,roughness:.96,metalness:.08});
 mat.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 rockP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrockP=position;');
  s.fragmentShader='varying vec3 rockP;\n'+noise+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 weight=pow(abs(normalize(rockP)),vec3(4.));weight/=max(.001,weight.x+weight.y+weight.z);
   float n=fbm(rockP.yz*7.)*weight.x+fbm(rockP.zx*7.)*weight.y+fbm(rockP.xy*7.)*weight.z;
   float fine=noise(rockP.xy*73.+rockP.z*17.);vec2 c=cells(rockP.xy*3.5+rockP.z*.6);
   float fissure=(1.-smoothstep(.008,.032,c.y))*smoothstep(.42,.67,n);
   float leading=pow(max(0.,dot(normalize(rockP),normalize(vec3(.25,-1.,.4)))),3.);
   diffuseColor.rgb*=.35+n*.85+fine*.14;
  `).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(2.8,.36,.025)*fissure+vec3(1.3,.13,.009)*leading*(.2+n*.7);');
 };mat.customProgramCacheKey=()=> 'meteor-basalt-v3';return mat;
}

export function meteorWakeMaterial(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},strength:{value:1}},vertexShader:`uniform float time;varying vec2 vUv;varying vec3 vN,vEye;void main(){vUv=uv;vec3 p=position;float w=uv.y*uv.y;p.x+=sin(uv.y*13.-time*8.)*.18*w;p.z+=cos(uv.y*17.-time*6.)*.15*w;vec4 view=modelViewMatrix*vec4(p,1.);vN=normalize(normalMatrix*normal);vEye=-view.xyz;gl_Position=projectionMatrix*view;}`,fragmentShader:`
 varying vec2 vUv;varying vec3 vN,vEye;uniform float time,strength;
 ${noise}
 void main(){vec2 p=vec2(vUv.x*12.,vUv.y*14.-time*7.);float n=fbm(p);float strands=smoothstep(.3,.73,n);
 float side=pow(abs(dot(normalize(vN),normalize(vEye))),1.4);
 float alpha=side*strands*(1.-smoothstep(.15,1.,vUv.y))*smoothstep(0.,.1,vUv.y)*strength;
 vec3 color=mix(vec3(2.7,1.1,.22),vec3(1.1,.095,.009),smoothstep(.02,.5,vUv.y));
 gl_FragColor=vec4(color,alpha*.7);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});}

/** Soft turbulent volume on a tapered mesh, with no solid cone silhouette. */
export function meteorPlasmaMaterial(smoke=false){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending,uniforms:{time:{value:0},strength:{value:1}},vertexShader:`varying vec2 vUv;varying vec3 vN,vEye;void main(){vUv=uv;vec4 local=vec4(position,1.);vec3 n=normal;
 #ifdef USE_INSTANCING
 local=instanceMatrix*local;n=mat3(instanceMatrix)*n;
 #endif
 vec4 p=modelViewMatrix*local;vN=normalize(normalMatrix*n);vEye=-p.xyz;gl_Position=projectionMatrix*p;}`,fragmentShader:`
 varying vec2 vUv;varying vec3 vN,vEye;uniform float time,strength;
 ${noise}
 void main(){float facing=pow(max(0.,dot(normalize(vN),normalize(vEye))),1.4);float n=fbm(vUv*vec2(8.,12.)+vec2(time*.3,-time*2.5));
 float edge=sin(vUv.y*3.14159);float a=facing*edge*smoothstep(.2,.7,n)*strength;
 ${smoke?'vec3 c=mix(vec3(.08,.07,.075),vec3(.25,.20,.16),n);a*=.32;':'vec3 c=mix(vec3(1.4,.09,.005),vec3(3.,1.4,.35),pow(n,2.));a*=.85;'}
 gl_FragColor=vec4(c,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});}
