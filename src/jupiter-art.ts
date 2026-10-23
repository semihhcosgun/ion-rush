import * as THREE from 'three';

/** Optically thin dust: a narrow main ring inside a softer gossamer envelope. */
export function jupiterRings(){
 const geometry=new THREE.RingGeometry(1.12,2.5,192,1);
 geometry.rotateX(-Math.PI/2);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:`varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
   varying vec3 point;
   void main(){
    float r=length(point.xz);
    float mainBand=smoothstep(1.64,1.72,r)*(1.-smoothstep(1.80,1.84,r));
    float halo=smoothstep(1.12,1.32,r)*(1.-smoothstep(1.63,1.80,r));
    float gossamer=smoothstep(1.78,1.90,r)*(1.-smoothstep(2.02,2.5,r));
    float grain=.94+.04*sin(r*90.)+.02*sin(r*210.);
    vec3 sun=normalize(vec3(.35,.4,.85));
    float along=dot(point,sun);
    float clearance=length(point-sun*along);
    float shadow=mix(1.,smoothstep(.94,1.08,clearance),step(along,0.));
    float opacity=(mainBand*.19+halo*.025+gossamer*.014)*grain;
    vec3 dust=mix(vec3(.37,.29,.21),vec3(.91,.79,.62),shadow);
    gl_FragColor=vec4(dust,opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});
 const rings=new THREE.Mesh(geometry,material);rings.name='jupiter-dust-rings';return rings;
}

/** Hubble cloud detail with gentle differential drift and cloud-top relief. */
export function jupiterSurface(surface:THREE.Texture,options:{polarMap?:boolean;relief?:number;rim?:number;drift?:number}={}){
 return new THREE.ShaderMaterial({uniforms:{surface:{value:surface},time:{value:0},polarMap:{value:options.polarMap===false?0:1},relief:{value:options.relief??.00045},rimStrength:{value:options.rim??.17},drift:{value:options.drift??.0012},sun:{value:new THREE.Vector3(.35,.4,.85).normalize()}},vertexShader:`
  varying vec2 tex;varying vec3 unit;varying vec3 viewDirection;
  void main(){tex=uv;unit=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);viewDirection=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}
 `,fragmentShader:`
  uniform sampler2D surface;uniform float time,polarMap,relief,rimStrength,drift;uniform vec3 sun;
  varying vec2 tex;varying vec3 unit;varying vec3 viewDirection;
  void main(){
   vec3 N=normalize(unit),V=normalize(viewDirection);
   vec2 uv=vec2(tex.x+sin(tex.y*46.)*sin(time*.035)*drift,mix(tex.y,clamp(tex.y,.075,.925),polarMap));
   vec3 albedo=texture2D(surface,uv).rgb;
   // Hubble's map has no observations beyond 80 degrees. Blend to a quiet cap
   // inside that boundary instead of wrapping its black no-data margins onto the globe.
   float polar=(1.-smoothstep(.055,.13,min(tex.y,1.-tex.y)))*polarMap;
   if(polarMap>.5){
   vec3 cap=(texture2D(surface,vec2(.15,uv.y)).rgb+texture2D(surface,vec2(.45,uv.y)).rgb+texture2D(surface,vec2(.75,uv.y)).rgb)/3.;
   albedo=mix(albedo,cap,polar);
   }
   albedo=max(vec3(.01),(albedo-vec3(.22))*1.12+vec3(.22));
   float height=dot(albedo,vec3(.2126,.7152,.0722));
   vec3 dx=dFdx(unit),dy=dFdy(unit),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);
   vec3 grad=(dFdx(height)*r1+dFdy(height)*r2)*sign(det)/max(abs(det),1e-9);
   N=normalize(N-clamp(grad*relief,vec3(-.075),vec3(.075)));
   float day=dot(N,sun),light=max(day,0.);
   float rim=pow(clamp(1.-dot(normalize(unit),V),0.,1.),3.);
   vec3 color=albedo*(.025+light*1.35)+albedo*vec3(.055,.065,.08)*smoothstep(-.2,.4,day);
   color+=vec3(.36,.46,.56)*rim*smoothstep(-.18,.5,day)*rimStrength;
   gl_FragColor=vec4(max(color,vec3(0.)),1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }
 `});
}
