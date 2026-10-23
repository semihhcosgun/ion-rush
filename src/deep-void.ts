import * as THREE from 'three';
import {TemporalBackdrop} from './temporal-backdrop';

export const voidPresence=(z:number)=>THREE.MathUtils.smoothstep(z,27000,29500)*(1-THREE.MathUtils.smoothstep(z,39500,43000));

/** Fictional dark-matter filaments and abandoned structures, outside the course. */
export class DeepVoid {
 root=new THREE.Group();
 veil=new THREE.Mesh(new THREE.PlaneGeometry(11000,6500),new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{time:{value:0},presence:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
   uniform float time,presence;varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
   float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.07+3.1;a*=.5;}return v;}
   void main(){
    vec2 p=vUv*vec2(12.,8.);float drift=time*.008;
    vec2 warp=vec2(fbm(p+vec2(drift,0)),fbm(p+8.-vec2(0,drift)));
    float cloud=fbm(p+warp*2.5),detail=fbm(p*3.+warp*4.);
    float river=abs(cloud-.49),filament=exp(-river*115.)*smoothstep(.36,.67,detail);
    float mist=smoothstep(.31,.78,cloud)*(.25+.75*detail)*(.65+.35*noise(p*110.));
    float edge=smoothstep(0.,.16,vUv.x)*smoothstep(0.,.16,1.-vUv.x)*smoothstep(0.,.2,vUv.y)*smoothstep(0.,.2,1.-vUv.y);
    float corridor=1.-.8*exp(-pow((vUv.x-.5)/.14,2.))* (1.-smoothstep(.3,.65,vUv.y));
    vec3 color=mix(vec3(.025,.1,.16),vec3(.13,.055,.21),smoothstep(.33,.65,detail))*mist;
    color+=vec3(.11,.42,.55)*filament*.07;
    // A dark nucleus interrupts the surrounding luminous filaments.
    vec2 q=(vUv-vec2(.72,.65))*vec2(1.,1.65);float r=length(q);
    float arc=exp(-pow((r-.115)/.008,2.))*(.35+.65*fbm(q*32.+warp));
    color*=smoothstep(.087,.115,r);color+=vec3(.2,.33,.58)*arc*.18;
    gl_FragColor=vec4(color,edge*corridor*presence*.65);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}),
 );
 relics:Array<{root:THREE.Group;pass:number;x:number;y:number;materials:THREE.MeshStandardMaterial[]}>=[];
 readonly cachedVeil=new TemporalBackdrop(this.veil.material);
 private originalVeil=this.veil.material;
 updateBackdrop(renderer:THREE.WebGLRenderer,z:number,time:number){
  if(z<24000||z>43000)return;
  this.cachedVeil.update(renderer,time,voidPresence(z));
  this.veil.material=this.cachedVeil.initialized?this.cachedVeil.material:this.originalVeil;
 }
 warmModels(){const cached=this.veil.clone();cached.material=this.cachedVeil.material;return[this.veil,cached];}
 disposeBackdrop(){this.cachedVeil.dispose();this.originalVeil.dispose();}
 constructor(){
  this.root.name='The silent reach';this.root.visible=false;this.veil.renderOrder=-8;this.root.add(this.veil);
  for(let i=0;i<3;i++){
   const root=new THREE.Group();root.name='Fractured sentinel '+(i+1);
   const shell=new THREE.MeshStandardMaterial({color:0x182633,emissive:0x163144,emissiveIntensity:.3,metalness:.8,roughness:.68,transparent:true,opacity:0,fog:false});
   const seams=new THREE.MeshStandardMaterial({color:0x658594,emissive:0x5797ae,emissiveIntensity:1.3,metalness:.4,roughness:.5,transparent:true,opacity:0,fog:false});
   for(let j=0;j<3;j++){
    const arc=new THREE.Mesh(new THREE.TorusGeometry(170,11,8,48,Math.PI*.49),shell);arc.rotation.z=j*Math.PI*2/3;root.add(arc);
    const edge=new THREE.Mesh(new THREE.TorusGeometry(156,1.1,5,48,Math.PI*.46),seams);edge.rotation.z=j*Math.PI*2/3+.03;edge.position.z=3;root.add(edge);
    const fragment=new THREE.Mesh(new THREE.IcosahedronGeometry(17,0),shell);const a=(j+.7)*Math.PI*2/3;fragment.position.set(Math.cos(a)*205,Math.sin(a)*205,24+j*13);fragment.scale.set(.6,1.5,.8);root.add(fragment);
   }
   this.root.add(root);this.relics.push({root,pass:31700+i*3500,x:i%2?760:-680,y:170+i%2*130,materials:[shell,seams]});
  }
 }
 update(z:number,time:number,origin:{x:number;y:number},camera:THREE.Camera){
  const presence=voidPresence(z);this.root.visible=presence>.001;if(!this.root.visible)return;
  this.originalVeil.uniforms.time.value=time;this.originalVeil.uniforms.presence.value=presence;
  this.veil.position.set(-origin.x*.2,250-origin.y*.2,-4600);this.veil.quaternion.copy(camera.quaternion);
  for(let i=0;i<this.relics.length;i++){
   const relic=this.relics[i],distance=relic.pass-z;
   const fade=presence*THREE.MathUtils.smoothstep(distance,200,1000)*(1-THREE.MathUtils.smoothstep(distance,2800,4200));
   relic.root.visible=fade>.001;relic.root.position.set(relic.x-origin.x,relic.y-origin.y,-distance);
   relic.root.rotation.set(.25+i*.17,-.35+i*.3,i*.8+time*.012);
   for(const material of relic.materials)material.opacity=fade;
  }
 }
}
