import * as THREE from 'three';
import {jupiterSurface} from './jupiter-art';
import {planetAtmosphere} from './planet-art';

export const SOLAR_TEXTURES=['mercury','venus','saturn','uranus','neptune','sun'] as const;
export type SolarPlanet=Exclude<typeof SOLAR_TEXTURES[number],'sun'>;

function rings(kind:'saturn'|'uranus'|'neptune',map?:THREE.Texture){
 const inner=kind==='saturn'?1.2:1.55,outer=kind==='saturn'?2.32:2.05;
 const geometry=new THREE.RingGeometry(inner,outer,192,1);geometry.rotateX(-Math.PI/2);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{map:{value:map??null},textured:{value:kind==='saturn'?1:0},inner:{value:inner},outer:{value:outer},sun:{value:new THREE.Vector3(.35,.4,.85).normalize()}},
  vertexShader:`varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D map;uniform float textured,inner,outer;uniform vec3 sun;varying vec3 point;
   void main(){float r=length(point.xz),u=(r-inner)/(outer-inner);vec4 dust;
    if(textured>.5){dust=texture2D(map,vec2(u,.5));dust.rgb*=1.6;dust.a*=.86;}
    else{float lines=exp(-pow((u-.16)/.009,2.))+exp(-pow((u-.47)/.006,2.))+exp(-pow((u-.84)/.012,2.));dust=vec4(.45,.57,.6,lines*.26);}
    float along=dot(point,sun),clearance=length(point-sun*along);float light=mix(1.,smoothstep(.94,1.04,clearance),step(along,0.));
    dust.rgb*=.12+.88*light;dust.a*=smoothstep(0.,.018,u)*(1.-smoothstep(.985,1.,u));
    gl_FragColor=dust;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name=kind+'-rings';return mesh;
}

export function solarPlanet(kind:SolarPlanet,map:THREE.Texture,ringMap:THREE.Texture){
 const rocky=kind==='mercury';
 const geometry=new THREE.SphereGeometry(1,64,40);geometry.scale(1,kind==='saturn'?.902:kind==='uranus'?.977:kind==='neptune'?.983:1,1);
 const mesh=new THREE.Mesh(geometry,jupiterSurface(map,{polarMap:false,relief:rocky?.003:.0002,rim:rocky?0:.2,drift:rocky?0:.001}));mesh.name=kind;
 mesh.rotation.set(0,.2,kind==='saturn'?.47:kind==='uranus'?1.71:kind==='neptune'?.49:0);
 if(!rocky){const air=planetAtmosphere('earth');air.uniforms.tint.value.set(kind==='venus'?0xe8b977:kind==='saturn'?0xd9c59b:kind==='uranus'?0x78d9df:0x557ee8);air.uniforms.strength.value=kind==='venus'?.48:.27;air.uniforms.sun.value.set(.35,.4,.85).normalize();const shell=new THREE.Mesh(geometry,air);shell.scale.setScalar(kind==='venus'?1.023:1.014);mesh.add(shell);}
 if(kind==='saturn'||kind==='uranus'||kind==='neptune'){const ring=rings(kind,ringMap);ring.material.uniforms.sun.value.applyQuaternion(mesh.quaternion.clone().invert());mesh.add(ring);}
 return mesh;
}

export function solarSun(map:THREE.Texture){
 const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,64,40),new THREE.MeshBasicMaterial({map,color:0xffd4a0,toneMapped:false,fog:false}));sphere.name='sun';
 const glow=new THREE.Mesh(new THREE.SphereGeometry(1.12,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
 vertexShader:`varying vec3 n,v;void main(){vec4 w=modelMatrix*vec4(position,1.);n=normalize(mat3(modelMatrix)*normal);v=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`varying vec3 n,v;void main(){float edge=pow(clamp(1.-abs(dot(normalize(n),normalize(v))),0.,1.),3.);gl_FragColor=vec4(vec3(1.,.39,.08),edge*.4);}`}));sphere.add(glow);return sphere;
}
