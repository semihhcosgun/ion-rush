import {t,onLocaleChange,type TranslationKey} from './i18n';
import {simplifyFootprint} from './footprint-detail';
import {cityFacades,cityWaterfront} from './city-panorama';
import {makeCoitHill} from './coit-hill';
import {makeAlcatraz} from './alcatraz-art';
import {departureAt,ASCENT_END} from './departure-profile';
export {departureAt} from './departure-profile';
import {makeBayEnvironment} from './sf-bay';
import * as THREE from 'three';
import {pathAt} from './path';
import {batchStatic} from './mesh-batch';

const smooth=THREE.MathUtils.smoothstep;
/** Tileable material grain; seeded so reloads never rearrange the city. */
function surfaceTexture(kind:'masonry'|'asphalt'){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d')!,pixels=g.createImageData(512,512);let seed=71;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const joint=kind==='masonry'&&(y%32<2||(x+(Math.floor(y/32)%2)*64)%128<2);
  const v=kind==='asphalt'?95+rand()*54:joint?130:205+rand()*35;const i=(y*512+x)*4;
  pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;
 }g.putImageData(pixels,0,0);
 if(kind==='asphalt'){g.strokeStyle='rgba(20,25,29,.28)';g.lineWidth=1;for(let j=0;j<12;j++){let x=rand()*512,y=rand()*512;g.beginPath();g.moveTo(x,y);for(let k=0;k<8;k++){x+=(rand()-.5)*28;y+=rand()*17;g.lineTo(x,y);}g.stroke();}}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='asphalt'?8:3,kind==='asphalt'?24:5);t.anisotropy=8;t.colorSpace=THREE.SRGBColorSpace;return t;
}
/** A compressed, fictional Golden Gate launch corridor, built from local geometry. */
export class SanFrancisco {
 root=new THREE.Group();land=new THREE.Group();
 sky:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
 sea:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 mist:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 materials:THREE.Material[]=[];
 pbrTargets:Array<{material:THREE.MeshStandardMaterial;asset:string;repeat?:[number,number]}>=[];
 cityMaterial!:THREE.MeshStandardMaterial;
 constructor(){
  const bay=makeBayEnvironment();this.land.add(bay.root);this.pbrTargets.push({material:bay.asphalt,asset:'asphalt_02',repeat:[3,1]});this.materials.push(...bay.materials);for(const material of bay.materials.slice(0,2))this.pbrTargets.push({material,asset:'coast_land_rocks_01'});this.root.name='San Francisco / Golden Gate departure';this.root.visible=false;this.root.add(this.land);
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(6800,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,uniforms:{air:{value:1},altitude:{value:0},globe:{value:0},departureFade:{value:1}},vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
   varying vec3 direction;uniform float air,altitude,globe,departureFade;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
   float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=mat2(.8,-.6,.6,.8)*p*2.07+7.3;a*=.5;}return v;}

   void main(){vec3 d=normalize(direction);float h=d.y;
    vec3 c=mix(vec3(.79,.84,.87),vec3(.075,.29,.54),smoothstep(-.06,.8,h));
    float sun=pow(max(0.,dot(d,normalize(vec3(-.6,.22,-1.)))),350.);
    float haze=pow(max(0.,dot(d,normalize(vec3(-.6,.22,-1.)))),12.);
    c+=vec3(1.,.66,.34)*haze*.17+vec3(1.,.88,.66)*sun*.8;
    float alpha=air;
    float radius=8500.;vec3 center=vec3(0.,-radius-max(altitude,1.),0.);
    float b=dot(d,center),disc=b*b-dot(center,center)+radius*radius;
    float horizon=-sqrt(max(0.,1.-pow(radius/(radius+max(altitude,1.)),2.)));
    float limb=exp(-abs(h-horizon)/.022);
    float halo=exp(-abs(h-horizon)/.05)*.22+limb*.58;
    vec3 earth=vec3(.008,.035,.075);
    float cover=0.;
    if(b>0.&&h<horizon+.018){
     float t=b-sqrt(max(0.,disc));vec3 n=normalize(d*t-center);vec2 p=n.xz*8.+vec2(3.2,1.7);
     float land=smoothstep(.54,.62,fbm(p*.85));
     earth=mix(vec3(.009,.065,.115),vec3(.09,.14,.10),land);
     float cloud=fbm(p*3.+vec2(fbm(p*1.8),0.)*2.);
     float strands=smoothstep(.48,.69,cloud);
     earth=mix(earth,vec3(.72,.80,.85),strands*.9);
     float light=.55+.45*max(0.,dot(n,normalize(vec3(-.6,1.,-.4))));earth*=light;
     earth=mix(earth,vec3(.10,.38,.68),pow(1.-max(0.,dot(n,-d)),7.)*.75);
     cover=1.-smoothstep(horizon-.018,horizon+.018,h);
    }
    float earthAlpha=globe*max(cover,halo)*departureFade;
    vec3 earthColor=earth+vec3(.08,.34,.72)*halo;
    c=(c*air*(1.-earthAlpha)+earthColor*earthAlpha)/max(.001,air*(1.-earthAlpha)+earthAlpha);
    alpha=air*(1.-earthAlpha)+earthAlpha;
    gl_FragColor=vec4(c,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}));this.sky.renderOrder=-9;this.root.add(this.sky);
  this.sea=new THREE.Mesh(new THREE.PlaneGeometry(7000,6500,80,80),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},fade:{value:1}},vertexShader:`varying vec2 vUv;varying vec3 local;uniform float time;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.025+time*.6)*.35+sin(p.y*.042-time*.4)*.22;local=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`
   varying vec2 vUv;varying vec3 local;uniform float time,fade;
   void main(){float w=sin(local.x*.11+sin(local.y*.043+time)*2.)*sin(local.y*.2-time*1.3);
    float glint=pow(max(0.,w),20.)*.16;
    vec3 c=mix(vec3(.035,.16,.21),vec3(.15,.34,.4),vUv.y)+glint*vec3(.7,.85,1.);
    float wake=exp(-pow((vUv.x-.36)/.002,2.))*smoothstep(.3,.8,vUv.y)*.08;c+=wake;
    float edge=smoothstep(0.,.12,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));gl_FragColor=vec4(c,fade*edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}));this.sea.rotation.x=-Math.PI/2;this.sea.position.set(0,-72,-1700);this.land.add(this.sea);
  const orange=new THREE.MeshStandardMaterial({color:0xb83e25,roughness:.53,metalness:.32});
  const trim=new THREE.MeshStandardMaterial({color:0x672b22,roughness:.65,metalness:.45});
  const masonry=surfaceTexture('masonry'),roadGrain=surfaceTexture('asphalt');
  const concrete=new THREE.MeshStandardMaterial({color:0xa7aaa1,map:masonry,bumpMap:masonry,bumpScale:.075,roughness:.9});
  const green=new THREE.MeshStandardMaterial({color:0x596953,roughness:1});
  const asphalt=new THREE.MeshStandardMaterial({color:0x565b60,map:roadGrain,bumpMap:roadGrain,bumpScale:.09,roughness:.92});
  this.pbrTargets.push({material:concrete,asset:'concrete_pavement_03'},{material:asphalt,asset:'asphalt_02'});
  this.materials.push(orange,trim,concrete,green,asphalt);
  const cube=new THREE.BoxGeometry(1,1,1);
  const box=(parent:THREE.Object3D,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const m=new THREE.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;};
  const bridge=new THREE.Group();bridge.name='Golden Gate / International Orange';this.land.add(bridge);
  for(let z=-160;z<=670;z+=10){
   const p=pathAt(z+400);

   box(bridge,asphalt,p.x,-13,-z,37,2,10.2);
   for(const side of [-1,1]){box(bridge,orange,p.x+side*19,-10,-z,.6,6,10.2);box(bridge,concrete,p.x+side*16,-11.8,-z,3,.25,10.2);}
  }
  const towers=[95,365];
  for(const z of towers){
   const p=pathAt(z+400),tower=new THREE.Group();tower.position.set(p.x,0,-z);bridge.add(tower);
   for(const side of [-1,1]){
    box(tower,concrete,side*20,-40,0,14,64,18);
    box(tower,orange,side*20,45,0,6.5,126,8);
    for(const dx of [-2.4,2.4])box(tower,trim,side*20+dx,46,4.1,.4,122,.3);
    box(tower,orange,side*20,112,0,7.5,8,9);box(tower,trim,side*20,117,0,6,.8,8);
    if(side===1)for(const y of [42,64,85,102])box(tower,orange,0,y,0,40,4.2,6);
   }
  }
  const cableStart=-100,cableEnd=710;
  const cableOffset=(z:number)=>20+14*(1-smooth(Math.min(z-cableStart,cableEnd-z),0,100));
  const sideSpan=(t:number)=>4+104*(.55*t+.45*t*t);
  const cableHeight=(z:number)=>z<95?sideSpan((z-cableStart)/(95-cableStart)):z>365?sideSpan((cableEnd-z)/(cableEnd-365)):27+81*Math.pow((z-230)/135,2);
  for(const side of [-1,1]){
   const points:THREE.Vector3[]=[];
   for(let z=cableStart;z<=cableEnd;z+=5){points.push(new THREE.Vector3(pathAt(z+400).x+side*cableOffset(z),cableHeight(z),-z));}
   bridge.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),182,.65,8,false),orange));
   // Cable ends penetrate the anchor blocks, which transfer their load to the shore.
   for(const z of [cableStart,cableEnd]){
    const x=pathAt(z+400).x+side*cableOffset(z);
    box(bridge,concrete,x,-5,-z,11,28,21);
    box(bridge,concrete,x,-30,-z,15,23,27);
    box(bridge,trim,x,9.1,-z,10,.4,20);
   }
   for(let z=cableStart+100;z<=cableEnd-100;z+=15){const h=cableHeight(z),p=pathAt(z+400);box(bridge,orange,p.x+side*20,(h-10)/2,-z,.14,h+10,.14);}
  }
  // Marin headlands and the peninsula remain below and outside every track face.

  // A low shoreline anchors the dense skyline to the bay instead of floating boxes.
  
  const windowCanvas=document.createElement('canvas');windowCanvas.width=64;windowCanvas.height=128;
  const wc=windowCanvas.getContext('2d')!;wc.fillStyle='#85949d';wc.fillRect(0,0,64,128);
  for(let y=3;y<128;y+=8)for(let x=3;x<64;x+=8){wc.fillStyle=(x+y)%5?'#384e5d':'#b1c2c6';wc.fillRect(x,y,4,5);}
  const windows=new THREE.CanvasTexture(windowCanvas);windows.colorSpace=THREE.SRGBColorSpace;windows.wrapS=windows.wrapT=THREE.RepeatWrapping;windows.anisotropy=8;
  const cityMat=new THREE.MeshStandardMaterial({map:windows,color:0xc5cccb,roughness:.7,metalness:.15});this.materials.push(cityMat);
  this.cityMaterial=cityMat;
  const city=new THREE.InstancedMesh(cube,cityMat,320),dummy=new THREE.Object3D();let seed=1994;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<320;i++){const x=310+rand()*1100,z=-450-rand()*1750,w=10+rand()*19,h=10+Math.pow(rand(),3)*100;dummy.position.set(x,-66+h/2,z);dummy.scale.set(w,h,12+rand()*22);dummy.rotation.set(0,0,0);dummy.updateMatrix();city.setMatrixAt(i,dummy.matrix);}city.instanceMatrix.needsUpdate=true;city.name='fallback skyline';this.land.add(city);
  const landmark=new THREE.MeshStandardMaterial({color:0xe0d5bc,roughness:.67});this.materials.push(landmark);
  const coitHill=makeCoitHill();this.land.add(coitHill.root);this.materials.push(...coitHill.materials);this.pbrTargets.push(...coitHill.pbrTargets);
  const alcatraz=makeAlcatraz();this.land.add(alcatraz.root);this.materials.push(...alcatraz.materials);this.pbrTargets.push(...alcatraz.pbrTargets);
  for(let i=0;i<8;i++){const boat=new THREE.Group();boat.position.set(-160-i*95,-70,-220-i*170);box(boat,concrete,0,1,0,8,3,27);box(boat,landmark,0,4,-3,5,4,11);this.land.add(boat);}
  // Location is legible in-world, not only in a menu caption.
  const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=256;const sc=signCanvas.getContext('2d')!;
  const drawSign=()=>{sc.fillStyle='#132e38';sc.fillRect(0,0,1024,256);sc.strokeStyle='#e2d3ac';sc.lineWidth=6;sc.strokeRect(12,12,1000,232);sc.textAlign='center';sc.fillStyle='#fff0cf';sc.font='bold 83px sans-serif';sc.fillText('SAN FRANCISCO',512,111);sc.font='30px sans-serif';sc.fillStyle='#9bddd7';sc.fillText(t('city.departure'),512,182,970);};drawSign();
  const signMap=new THREE.CanvasTexture(signCanvas);signMap.colorSpace=THREE.SRGBColorSpace;onLocaleChange(()=>{drawSign();signMap.needsUpdate=true;});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(30,7.5),new THREE.MeshBasicMaterial({map:signMap}));sign.position.set(pathAt(36).x,38,-36);bridge.add(sign);
  for(const side of [-1,1])box(bridge,orange,pathAt(436).x+side*16,16,-36,.7,60,.7);
  // Merge static bridge pieces while keeping sea and city instancing independent.
  batchStatic(bridge);bridge.position.z=-400;
  // The first 400 metres are an inhabited launch district, before the bridge.
  const street=new THREE.Group();street.name='RVLTN LABS / San Francisco launch district';this.land.add(street);
  const glass=new THREE.MeshStandardMaterial({color:0x214958,metalness:.65,roughness:.24});
  const ivory=new THREE.MeshStandardMaterial({color:0xc3bba9,map:masonry,bumpMap:masonry,bumpScale:.04,roughness:.85});
  const facades=[0xa5b5b0,0xb8a28d,0x929eae,0xc5bca5,0xa9ad99].map(color=>new THREE.MeshStandardMaterial({color,map:masonry,bumpMap:masonry,bumpScale:.08,roughness:.78}));
  this.materials.push(...facades);
  for(const material of [ivory,...facades])this.pbrTargets.push({material,asset:'white_plaster_rough_02'});
  const glow=new THREE.MeshBasicMaterial({color:0x91eee4});
  this.materials.push(glass,ivory,glow);
  const label=(text:string,sub:TranslationKey,w:number,h:number,x:number,y:number,z:number)=>{
   const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d')!;
   const draw=()=>{g.fillStyle='#112b34';g.fillRect(0,0,1024,256);g.fillStyle='#ecede1';g.textAlign='center';g.font='bold 90px sans-serif';g.fillText(text,512,116);g.fillStyle='#87dfd0';g.font='29px sans-serif';g.fillText(t(sub),512,194,970);};draw();
   const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;onLocaleChange(()=>{draw();map.needsUpdate=true;});const mat=new THREE.MeshBasicMaterial({map});this.materials.push(mat);
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);mesh.position.set(x,y,z);street.add(mesh);
  };
  box(street,asphalt,0,-5,-120,110,8,420);
  for(const side of [-1,1]){
   box(street,concrete,side*25,-.7,-120,17,1.4,420);
   // Glass entrance wings frame an open, traversable departure door.
   box(street,glass,side*30,22,-18,29,46,32);
   box(street,ivory,side*15,19,-34,2,40,3);
   box(street,glow,side*13.7,13,-35,.22,26,.3);
   for(let y=4;y<44;y+=7)box(street,trim,side*30,y,-34.4,28,.22,.4);
   for(let x=18;x<44;x+=5)box(street,trim,side*x,22,-34.5,.22,44,.4);
   for(let block=0;block<5;block++){
    const z=-55-block*48,h=18+(block%3)*8;
    box(street,facades[block],side*39,h/2,z,24,h,35);
    box(street,trim,side*39,h+.4,z,26,1.2,37);
    box(street,ivory,side*26.5,h-1,z,1.5,.6,36);
    box(street,trim,side*26.5,2,z,.8,3.5,35);
    for(let floor=0;floor<Math.floor(h/5);floor++)for(let k=0;k<4;k++){
     const bay=k%2===0?1.4:0;
     if(bay)box(street,facades[block],side*26.2,4+floor*5,z-12+k*8,2,3.9,4.8);
     box(street,glass,side*(26.8-bay),4+floor*5,z-12+k*8,.3,2.8,3.8);
     box(street,ivory,side*(26.6-bay),2.4+floor*5,z-12+k*8,.7,.3,4.6);
     box(street,ivory,side*(26.5-bay),4+floor*5,z-12+k*8,.4,2.9,.12);
    }
    // Sidewalk lamps, planters and rounded street trees.
    box(street,trim,side*20,5,z,.25,10,.25);box(street,trim,side*18.7,10,z,2.8,.2,.25);box(street,glow,side*17.5,9.85,z,1.1,.18,.6);
    box(street,concrete,side*29,1,z+21,5,2,5);box(street,trim,side*29,4,z+21,.6,6,.6);
    for(let leaf=0;leaf<9;leaf++){
     const a=leaf*2.4,tree=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),green);
     tree.position.set(side*29+Math.cos(a)*2,7+Math.sin(leaf*1.7)*1.7,z+21+Math.sin(a)*2);tree.scale.set(1.8,2.2,1.7);tree.rotation.set(a,a*.3,0);street.add(tree);
    }
    // Recessed shops, fabric awnings, rooftop vents and cornices break up the blocks.
    for(let k=-1;k<=1;k++){
     box(street,glass,side*26.3,2.7,z+k*10,.25,4,7);
     box(street,facades[(block+2)%5],side*24.7,5.2,z+k*10,3.5,.3,8);
     box(street,trim,side*23,4.85,z+k*10,.2,.65,8);
    }
    box(street,trim,side*37,h+1.5,z-7,5,3,6);
    box(street,concrete,side*44,h+2,z+10,2,4,2);
    if(block%2===0){
     for(let floor=1;floor<Math.floor(h/5);floor++){
      box(street,trim,side*25.5,floor*5+1,z+5,3,.2,5);
      for(let k=0;k<6;k++)box(street,trim,side*24.1,floor*5+1.6,z+3+k*.8,.08,1.2,.08);
      box(street,trim,side*24.1,floor*5+2.2,z+5,.1,.12,5);
     }
    }
   }
   // A pair of characteristic cream and burgundy cable cars, parked off the racing line.
   const car=new THREE.Group();car.position.set(side*21,0,-125-side*35);street.add(car);
   box(car,trim,0,2,0,3.8,2,10);box(car,ivory,0,4.3,0,3.6,2.6,9.5);box(car,trim,0,5.8,0,4.2,.5,10.5);
   for(let k=-3;k<=3;k+=2){box(car,glass,0,4.5,k,3.7,1.5,1.4);}
  }
  box(street,ivory,0,42,-31,32,8,8);
  label('RVLTN LABS','city.research',27,6,0,42,-35.1);
  label('GOLDEN GATE','city.marina',17,4,0,38,-230);
  for(const side of [-1,1])box(street,trim,side*10,19,-230,.35,40,.35);
  // Cross-street markings and rails give the departure a street-level rhythm.
  for(const z of [85,183])for(let x=-14;x<=14;x+=4)box(street,ivory,x,-.88,-z,2,.08,7);
  for(const side of [-1,1])for(const rail of [-.8,.8])box(street,trim,side*21+rail,-.9,-125,.07,.1,200);
  batchStatic(street);
  for(const group of [street,bridge])group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  this.mist=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{time:{value:0},density:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
   varying vec2 vUv;uniform float time,density;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
   void main(){vec2 p=vUv*vec2(5.,3.)+vec2(time*.045,0.);float cloud=n(p)*.6+n(p*2.2)*.3+n(p*5.)*.1;float edge=.35+.65*smoothstep(.05,.7,length(vUv-.5));gl_FragColor=vec4(.8,.87,.92,density*(.25+.65*cloud)*edge);}` }));this.mist.frustumCulled=false;this.mist.renderOrder=12;this.root.add(this.mist);
 }
 async loadAssets(){
  const loader=new THREE.TextureLoader();
  const assets=new Map<string,THREE.Texture[]>();
  await Promise.all(['white_plaster_rough_02','concrete_pavement_03','asphalt_02','coast_land_rocks_01'].map(async asset=>{
   const maps=await Promise.all(['Diffuse','nor_gl','Rough'].map(kind=>loader.loadAsync(`/textures/sf/${asset}_${kind}.jpg`)));
   maps.forEach((map,i)=>{map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(asset==='asphalt_02'?8:3,asset==='asphalt_02'?24:5);if(asset==='coast_land_rocks_01')map.repeat.set(65,45);map.anisotropy=8;if(i===0)map.colorSpace=THREE.SRGBColorSpace;});assets.set(asset,maps);
  }));
  for(const {material,asset,repeat} of this.pbrTargets){const maps=assets.get(asset)!;const [diffuse,normal,rough]=repeat?maps.map(map=>{const copy=map.clone();copy.repeat.set(...repeat);copy.needsUpdate=true;return copy;}):maps;material.map=diffuse;material.normalMap=normal;material.normalScale.set(.55,.55);material.roughnessMap=rough;material.bumpMap=null;material.needsUpdate=true;}
  const response=await fetch('/data/sf-buildings.json');if(!response.ok)throw new Error('SF building data unavailable');
  const rows=await response.json() as Array<{hgt_median_m:string;gnd_min_m:string;shape:{coordinates:number[][][][]}}>;
  const district=new THREE.Group();district.name='DataSF / measured building footprints';
  const facadeMaterials=cityFacades();const roofMaterial=new THREE.MeshStandardMaterial({color:0x777771,roughness:.95});this.materials.push(...facadeMaterials,roofMaterial);
  let buildingIndex=0;
  for(const row of rows)for(const polygon of row.shape.coordinates){
   const ring=polygon[0];if(ring.length<4)continue;
   const points=ring.map(([lon,lat])=>new THREE.Vector2((lon+122.44)*87980,(lat-37.81)*111320));
   const shape=new THREE.Shape(polygon.length===1?simplifyFootprint(points):points);for(const hole of polygon.slice(1))shape.holes.push(new THREE.Path(hole.map(([lon,lat])=>new THREE.Vector2((lon+122.44)*87980,(lat-37.81)*111320))));
   const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(3,Number(row.hgt_median_m)||9),bevelEnabled:false,steps:1});
   const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/12,uv.getY(i)/16);
   geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,facadeMaterials[buildingIndex++%facadeMaterials.length]);mesh.position.y=Number(row.gnd_min_m)||0;district.add(mesh);
   const roofGeometry=new THREE.ShapeGeometry(shape);roofGeometry.rotateX(-Math.PI/2);const roofMesh=new THREE.Mesh(roofGeometry,roofMaterial);roofMesh.position.y=mesh.position.y+Math.max(3,Number(row.hgt_median_m)||9)+.08;district.add(roofMesh);
  }
  // Preserve relative surveyed shapes/heights; compress the district into the game's bay panorama.
  batchStatic(district);district.scale.set(.3,.57,.3);district.rotation.y=Math.PI;district.position.set(1600,-69,-1550);this.land.add(district);const waterfront=cityWaterfront();this.land.add(waterfront.root);this.materials.push(...waterfront.materials);
  const fallback=this.land.getObjectByName('fallback skyline');if(fallback)fallback.visible=false;
 }
 update(z:number,time:number,origin:{x:number;y:number},camera:THREE.Camera){
  const p=departureAt(z);this.root.visible=z<3200;if(!this.root.visible)return;
  this.land.position.set(-origin.x,-origin.y,z);this.land.visible=p.city>.001;
  this.land.scale.setScalar(1);this.sky.position.copy(camera.position);this.sky.material.uniforms.air.value=p.air;this.sky.material.uniforms.altitude.value=p.altitude+90;this.sky.material.uniforms.globe.value=smooth(z,1200,1800);this.sky.material.uniforms.departureFade.value=1-smooth(z,2600,3200);
  this.sea.material.uniforms.time.value=time;this.sea.material.uniforms.fade.value=1-smooth(z,1300,1870);
  this.mist.material.uniforms.time.value=time;this.mist.material.uniforms.density.value=.06*(1-smooth(z,0,350))+p.cloud*.85;
  this.mist.visible=this.mist.material.uniforms.density.value>.001;
  for(const mat of this.materials){mat.transparent=p.city<1;mat.opacity=p.city;}
 }
}













