import {uploadLivePrefix} from './gpu-upload';
import * as THREE from 'three';

export const BLAST_DURATION=1.45;
const COUNT=12,PUFFS=9,SPARKS=24;
interface Blast{active:boolean;age:number;x:number;y:number;z:number;seed:number;detail:number;}
/** Independent fixed pool: wreck VFX outlive the recycled enemy model. */
export class BlastFX{
 detail=0;
 root=new THREE.Group();slots:Blast[]=Array.from({length:COUNT},()=>({active:false,age:0,x:0,y:0,z:0,seed:0,detail:0}));
 puffs:THREE.InstancedMesh;sparks:THREE.InstancedMesh;shards:THREE.InstancedMesh;rings:THREE.Mesh[]=[];
 private sparkAxis=new THREE.Vector3(0,0,1);private sparkDirection=new THREE.Vector3();
 private sparkPaths=Array.from({length:COUNT},()=>Array.from({length:SPARKS},()=>({a:0,x:0,y:0,z:0,q:new THREE.Quaternion()})));
 private dummy=new THREE.Object3D();private ages=new Float32Array(COUNT*PUFFS);private seeds=new Float32Array(COUNT*PUFFS);private modes=new Float32Array(COUNT*PUFFS);private color=new THREE.Color();
 constructor(){
  const geo=new THREE.PlaneGeometry(1,1);geo.setAttribute('blastAge',new THREE.InstancedBufferAttribute(this.ages,1));geo.setAttribute('blastSeed',new THREE.InstancedBufferAttribute(this.seeds,1));geo.setAttribute('blastMode',new THREE.InstancedBufferAttribute(this.modes,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:`attribute float blastAge;attribute float blastSeed;attribute float blastMode;varying vec2 p;varying float age;varying float seed;varying float mode;void main(){p=uv*2.-1.;age=blastAge;seed=blastSeed;mode=blastMode;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 p;varying float age;varying float seed;varying float mode;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.27+noise(p*4.1)*.13+noise(p*8.3)*.05;}
  void main(){float r=length(p);float n=fbm(p*5.+vec2(seed,seed*.71)+vec2(age*.9,-age*1.4));float edge=1.-smoothstep(.4,.98,r+(n-.5)*.34);float fade=1.-smoothstep(.55,1.45,age);float heat=clamp(1.1-age*1.65+(n-.5)*1.8-r*.55,0.,1.);vec3 c=mix(vec3(.11,.12,.15),vec3(.38,.29,.22),n);float alpha=edge*fade*.55;
  if(mode<.5){c=mix(vec3(.18,.012,.003),vec3(2.8,.42,.015),smoothstep(.1,.7,heat));c=mix(c,vec3(4.,2.,.6),smoothstep(.78,1.,heat));alpha=edge*(.65+.35*smoothstep(.25,.65,n))*(1.-smoothstep(.22,.92,age))*.88;}
  if(mode>1.5){float rays=pow(abs(sin(atan(p.y,p.x)*4.)),20.);alpha=(exp(-r*8.)+rays*exp(-r*5.)*.35)*(1.-smoothstep(0.,.16,age));c=vec3(6.,4.8,2.8);}
  gl_FragColor=vec4(c,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`});
  this.puffs=new THREE.InstancedMesh(geo,material,COUNT*PUFFS);this.puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.puffs.frustumCulled=false;this.puffs.renderOrder=3;this.root.add(this.puffs);
  this.sparks=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.055,1),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false}),COUNT*SPARKS);this.sparks.frustumCulled=false;this.root.add(this.sparks);
  this.shards=new THREE.InstancedMesh(new THREE.BoxGeometry(.24,.09,.4),new THREE.MeshStandardMaterial({color:0x485667,metalness:.8,roughness:.38}),COUNT*8);this.shards.frustumCulled=false;this.root.add(this.shards);
  for(let i=0;i<COUNT;i++){const ring=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{age:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform float age;void main(){float r=length(p);float band=exp(-pow((r-.78)*48.,2.));gl_FragColor=vec4(1.,.47,.13,band*.28*(1.-smoothstep(.03,.38,age)));}'}));ring.visible=false;this.rings.push(ring);this.root.add(ring);}
 }
 trigger(x:number,y:number,z:number,seed:number){const slot=this.slots.find(s=>!s.active)??this.slots.reduce((a,b)=>a.age>b.age?a:b);Object.assign(slot,{active:true,age:0,x,y,z,seed,detail:this.detail});
  const paths=this.sparkPaths[this.slots.indexOf(slot)];
  for(let j=0;j<SPARKS;j++){const p=paths[j],a=j*2.399+seed,v=1-2*(j+.5)/SPARKS,h=Math.sqrt(1-v*v);p.a=a;p.x=Math.cos(a)*h;p.y=v;p.z=Math.sin(a)*h;p.q.setFromUnitVectors(this.sparkAxis,this.sparkDirection.set(p.x,p.y,p.z));}
 }
 reset(){this.slots.forEach(s=>s.active=false);this.puffs.count=this.sparks.count=this.shards.count=0;this.rings.forEach(r=>r.visible=false);}
 update(dt:number,origin:{x:number;y:number;z:number},camera:THREE.Quaternion){
  let puff=0,spark=0,shard=0;
  for(let i=0;i<COUNT;i++){const b=this.slots[i],ring=this.rings[i];ring.visible=false;if(!b.active)continue;b.age+=Math.max(0,dt);if(b.age>=BLAST_DURATION){b.active=false;continue;}const t=b.age,x=b.x-origin.x,y=b.y-origin.y,z=b.z-origin.z;
   for(let j=0;j<PUFFS;j++){if(b.detail===1&&!(329&(1<<j))||b.detail>=2&&!(329&(1<<j)))continue;const a=j*2.399+b.seed,smoke=j<3,flash=j===8,travel=(1-Math.exp(-t*4))*(smoke?2.8:2.1),size=flash?12:smoke?3.8+t*4:2.3+t*4;
    this.dummy.position.set(x+Math.cos(a)*travel,y+Math.sin(a)*travel+(smoke?t*1.4:0),z+(smoke?-.6:.4)+Math.sin(a*3)*.5);this.dummy.quaternion.copy(camera);this.dummy.rotateZ(a*.4);this.dummy.scale.set(size,size,1);this.dummy.updateMatrix();this.puffs.setMatrixAt(puff,this.dummy.matrix);this.ages[puff]=smoke?t*(1+b.detail*.25):t;this.seeds[puff]=b.seed+j*7.13;this.modes[puff]=flash?2:smoke?1:0;puff++;
   }
   const sparkCount=b.detail>=2?6:b.detail===1?10:SPARKS;
   for(let k=0;k<sparkCount;k++){const j=Math.floor(k*SPARKS/sparkCount),path=this.sparkPaths[i][j],a=path.a,speed=11+(j%5)*3,travel=speed*(1-Math.exp(-t*1.8))/1.8;
    this.dummy.position.set(x+path.x*travel,y+path.y*travel-t*t*.9,z+path.z*travel);this.dummy.quaternion.copy(path.q);this.dummy.scale.setScalar(Math.max(0,1-t/1.1));this.dummy.scale.z*=.4+speed*.045;this.dummy.updateMatrix();this.sparks.setMatrixAt(spark,this.dummy.matrix);this.color.setRGB(3,1.1*(1-t/BLAST_DURATION)+.1,.12);this.sparks.setColorAt(spark++,this.color);
    if(j<8){this.dummy.rotation.set(a+t*3,a*.7+t*5,t*4);this.dummy.scale.setScalar((.7+(j%3)*.35)*(1-Math.pow(t/BLAST_DURATION,4)));this.dummy.updateMatrix();this.shards.setMatrixAt(shard++,this.dummy.matrix);}
   }
   ring.visible=t<.5;ring.position.set(x,y,z+.8);ring.quaternion.copy(camera);ring.scale.setScalar(2+t*35);(ring.material as THREE.ShaderMaterial).uniforms.age.value=t;
  }
  this.puffs.count=puff;this.sparks.count=spark;this.shards.count=shard;for(const mesh of [this.puffs,this.sparks,this.shards])uploadLivePrefix(mesh.instanceMatrix,mesh.count);if(puff>0)for(const key of ['blastAge','blastSeed','blastMode'])uploadLivePrefix(this.puffs.geometry.getAttribute(key) as THREE.BufferAttribute,puff);if(spark>0&&this.sparks.instanceColor)uploadLivePrefix(this.sparks.instanceColor,spark);
 }
}
