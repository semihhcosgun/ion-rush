import {GarageShowroom} from './garage-showroom';
import {PowerBudget} from './power-budget';
import {thermalBudget,budgetReduced} from './thermal-notice';
import {RiderShadow} from './rider-shadow';
import {ThermalProtection,type ThermalState} from './thermal-protection';
import {VehicleGeometryLOD} from './vehicle-geometry-lod';
import {packStaticScene} from './packed-static-attributes';
import {prepareLighting} from './lighting-precision';
import {AnimatedInstances,AnimatedInstanceTransforms} from './animated-instances';
import {CelestialLOD} from './celestial-lod';
import {distantRoadGeometry} from './distant-road-geometry';
import {RoadLOD} from './road-lod';
import {uploadLivePrefix} from './gpu-upload';
import {SupportView} from './support-view';
import {ReviveFX} from './revive-fx';
import {StylizedCity} from './stylized-city';
import {GateInstances,GateTransformCache,type StaticGatePart} from './gate-instances';
import {VisibleModelGroup} from './visible-model-group';
import {RoadFrameCache} from './road-frame-cache';
import {shareBumpSample} from './shared-bump-sample';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {HudFXAAShader} from './hud-fxaa';
import {GpuTimer} from './gpu-timer';
import {AdaptivePerformance} from './adaptive-performance';
import {ascentAt,ASCENT_END} from './departure-profile';
import {SceneryReveal} from './scenery-reveal';
import {SOLAR_TEXTURES,solarPlanet,solarSun} from './solar-art';
import {DeepSpaceArt} from './deep-space-art';
import {SanFrancisco,departureAt} from './san-francisco';
import {HealthFX} from './health-fx';
import {jupiterSurface,jupiterRings} from './jupiter-art';
import {planetSurface,planetAtmosphere,earthClouds} from './planet-art';
import {TurboFX} from './turbo-fx';
import {overdriveEnabled,overdriveSurge} from './overdrive';
import {HeatVentFX} from './heat-vent-fx';
import {PhaseFX} from './phase-fx';
import {phaseActive} from './phantom';
import {orbitalSky} from './orbital-art';
import {VIEW,horizonFade} from './horizon';
import {makePickupVisual} from './pickup-visual';
import {transitPanel} from './art-direction';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ReducedBloomPass} from './reduced-bloom-pass';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SurvivalView} from './survival-view';
import {trackPoint,enemyPoint,enemyTrackZ} from './combat-space';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROUTES, BODIES, KINDS, TUNE, AIM, COMBAT, type Route } from './config';
import { random, type Race, type Gate } from './game';
import {OBSTACLE,RIDER,riderRadius,armAngle,blockPosition,laserActive,shutterPosition} from './obstacle-shapes';
import { pathAt, tangentAt } from './path';
import { CombatView } from './combat-view';
import {attachBikeEvolution} from './bike-evolution';
import { makeVesper } from './vehicle';
import { batchStatic } from './mesh-batch';
import {t} from './i18n';
import {ShipView} from './ship-view';
import {RiftView} from './rift-view';
import {LiquidTransit} from './liquid-transit';
import {MeteorView} from './meteor-view';

const DRAW_AUDIT=new URLSearchParams(location.search).has('drawAudit');
const MAX_RENDER_RATIO=2;
const Y = new THREE.Vector3(0,1,0), Z=new THREE.Vector3(0,0,1);
const boxGeo=new THREE.BoxGeometry(1,1,1),bevelGeo=new RoundedBoxGeometry(1,1,1,2,.065), sphereGeo=new THREE.SphereGeometry(1,64,40);
const BODY_REVEAL_START=6500,BODY_REVEAL_FULL=4300,BODY_DEPART_START=3800,BODY_DEPART_END=5600;
function bodyPresence(z:number,passAt:number){const ahead=passAt-z,approach=1-THREE.MathUtils.smoothstep(ahead,BODY_REVEAL_FULL,BODY_REVEAL_START),departure=1-THREE.MathUtils.smoothstep(-ahead,BODY_DEPART_START,BODY_DEPART_END);return Math.min(approach,departure);}
function metal(color:number, emissive=0, intensity=0) {return new THREE.MeshStandardMaterial({color,metalness:.72,roughness:.32,emissive,emissiveIntensity:intensity});}
const steel=metal(0x344957), dark=metal(0x101b27), pale=metal(0xaabdc2), orange=new THREE.MeshPhysicalMaterial({color:0xc34e26,metalness:.5,roughness:.29,clearcoat:1,clearcoatRoughness:.2}), cyan=metal(0x70ffee,0x26ffdb,2), red=metal(0xff704c,0xff421a,1.2);
const materials=[steel,dark,pale,orange,cyan,red];materials.forEach(m=>horizonFade(m,VIEW.objectFadeStart,VIEW.objectFadeEnd));
function box(parent:THREE.Object3D,mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,rz=0){const m=new THREE.Mesh(Math.min(sx,sy,sz)>.2?bevelGeo:boxGeo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;parent.add(m);return m;}
interface GateVisual { group:THREE.Group; gate:Gate; faces:THREE.Group[]; movers:THREE.Object3D[]; warnings:THREE.Mesh[]; energy:THREE.Group; extraEnergy:THREE.Group; }
export class World {
  private celestialLod=new CelestialLOD();
  supportView=new SupportView();
  deepSpace=new DeepSpaceArt();
  sanFrancisco=new URLSearchParams(location.search).get('city')==='classic'?new SanFrancisco():new StylizedCity();
  solarBodies=new Map<string,THREE.Mesh>();sunBody?:THREE.Mesh;
  reviveFX=new ReviveFX();healthFX=new HealthFX();survivalView=new SurvivalView();gun=new THREE.Group();gunFlash=new THREE.Group();turboFX=new TurboFX();heatVentFX=new HeatVentFX();phaseFX=new PhaseFX();combatView=new CombatView();riftView=new RiftView();
  fxaa=new ShaderPass(HudFXAAShader);
  requestFrame?:()=>void;
  invalidate(){this.frozenTime=NaN;this.requestFrame?.();}
  private hudShade=false;
  setHudShade(enabled:boolean){if(this.hudShade!==enabled){this.hudShade=enabled;this.frozenTime=NaN;this.requestFrame?.();}}
  composer:EffectComposer;bloom:ReducedBloomPass;outputPass:OutputPass;renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(58,1,.1,7500);
  shipView=new ShipView();
  meteorView=new MeteorView();
  private vehicleLod:VehicleGeometryLOD;
  bike=makeVesper();bikeAnchor=new THREE.Group();track=new THREE.Group();gates=new THREE.Group();
  liquidTransit:LiquidTransit;
  planet:THREE.Mesh;atmosphere:THREE.Mesh;stars:THREE.Points;moon:THREE.Mesh;jupiter?:THREE.Mesh;jupiterAtmosphere?:THREE.Mesh;
  private roadLod=new RoadLOD();trackFar:THREE.InstancedMesh;trackSilhouette:THREE.InstancedMesh;
  trackPanels:THREE.InstancedMesh;trackRails:THREE.InstancedMesh;trackMarks:THREE.InstancedMesh;
  garage=false;garageAngle=-.6;private garageShowroom?:GarageShowroom;
  gateVisuals:GateVisual[]=[];menu=true; route:Route=ROUTES[0];
  dummy=new THREE.Object3D();
  private viewport=new THREE.Vector2(1,1);
  private frozenRace?:Race;private frozenTime=NaN;private frozenZ=NaN;
  private fogAir=new THREE.Color(0xa3bac8);private liftAxis=new THREE.Vector3();private sunOffset=new THREE.Vector3();
  timer=0; cameraAngle=0;quality='auto';pixelRatio=Math.min(devicePixelRatio,1.5);
  readonly thermal=new ThermalProtection();
  readonly power=new PowerBudget();
  readonly riderShadow=new RiderShadow();
  adaptive=new AdaptivePerformance(Math.min(devicePixelRatio,2.5),this.thermal,this.power);performanceCallback?:(fps:number,ratio:number)=>void;
  look=new THREE.Vector3();up=new THREE.Vector3();camPos=new THREE.Vector3();
  disposed=false; resizeHandler=()=>this.resize();
  finish=new THREE.Group();
  lastTrackSegment=Infinity; lastTrackRace?:Race; sampleTime=0;
  private roadFrames=new RoadFrameCache(VIEW.trackSegments*2);
  environment:THREE.WebGLRenderTarget;
  roadQ=new THREE.Quaternion(); rollQ=new THREE.Quaternion(); tangent=new THREE.Vector3(); forward=new THREE.Vector3(0,0,-1); offset=new THREE.Vector3();
  textureCache=new Map<string,THREE.Texture>(); sky?:THREE.Mesh;
  panelMap=transitPanel(); assetsLoaded=false;
  belt=new THREE.Group();
  clouds?:THREE.Mesh; mars?:THREE.Mesh; marsAtmosphere?:THREE.Mesh; poolCounts=new Uint8Array(KINDS.length);
  burstPositions=new Float32Array(24*3);burstLife=0;burst=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x8fffe0,size:.12,transparent:true,opacity:0,depthWrite:false}));
  sun:THREE.DirectionalLight; lastOrigin={x:0,y:0};
  sceneryReveals:SceneryReveal[]=[];
  constructor(canvas:HTMLCanvasElement){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
    this.gpuTimer=new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.setClearColor(0x050b16);this.scene.fog=new THREE.FogExp2(0x17314c,.0018);
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xb6d9ff,0x192942,.85));
    const sun=this.sun=new THREE.DirectionalLight(0xffe4cc,3.1);sun.position.set(-20,35,-20);this.scene.add(sun);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-14;sun.shadow.camera.right=14;sun.shadow.camera.top=14;sun.shadow.camera.bottom=-14;sun.shadow.camera.near=1;sun.shadow.camera.far=80;sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const rim=new THREE.DirectionalLight(0x72c9de,1.4);rim.position.set(10,5,20);this.scene.add(rim);this.scene.add(sun.target);
    this.composer=new EffectComposer(this.renderer,new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:0}));this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new ReducedBloomPass(new THREE.Vector2(innerWidth,innerHeight),.24,.45,1.35);this.composer.addPass(this.bloom);this.outputPass=new OutputPass();this.composer.addPass(this.outputPass);this.fxaa.enabled=true;this.composer.addPass(this.fxaa);
    this.scene.add(this.track,this.gates,this.bikeAnchor,this.sanFrancisco.root);this.bikeAnchor.add(this.supportView.root,this.bike,this.riderShadow.mesh,this.shipView.craft,this.reviveFX.root);this.scene.add(this.shipView.core);this.scene.add(this.survivalView.root,this.healthFX.root);this.bikeAnchor.add(this.survivalView.shield);
    this.gun.position.set(0,1.32,-.75);this.bikeAnchor.add(this.gun,this.heatVentFX.root);box(this.gun,steel,0,0,0,1.55,.14,.3);
    for(const x of [-.68,.68]){box(this.gun,dark,x,0,-.55,.19,.2,1.1);box(this.gun,pale,x,.055,-.38,.24,.15,.58);box(this.gun,orange,x,.14,-.38,.13,.025,.37);box(this.gun,dark,x,0,-1.12,.24,.24,.2);box(this.gun,cyan,x,0,-1.225,.1,.09,.025);for(let j=0;j<3;j++)box(this.gun,steel,x,0,-.72-j*.12,.24,.23,.035);const flash=new THREE.Mesh(new THREE.ConeGeometry(.15,.4,8),cyan);flash.rotation.x=-Math.PI/2;flash.position.set(x,0,-1.38);this.gunFlash.add(flash);}batchStatic(this.gun);this.gun.add(this.gunFlash);this.gunFlash.visible=false;
    this.scene.add(this.finish);
    for(let s=0;s<4;s++){const face=new THREE.Group();face.rotation.z=-s*Math.PI/2;this.finish.add(face);for(const side of [-1,1])box(face,pale,side*4,6.1,0,.35,4.4,.6);box(face,cyan,0,8.3,0,8.35,.25,.6);for(let j=0;j<8;j++)box(face,j%2?pale:dark,j-3.5,4.04,0,1,.05,1.5);}
    this.finish.visible=false;
    const roadMetal=new THREE.MeshStandardMaterial({color:0x89a6c4,map:this.panelMap,bumpMap:this.panelMap,bumpScale:.018,metalness:.28,roughness:.52,envMapIntensity:.55});
    horizonFade(roadMetal,VIEW.roadFadeStart,VIEW.roadFadeEnd);
    shareBumpSample(roadMetal);this.roadLod.apply(roadMetal,false);
    const farGeometry=distantRoadGeometry();
    const farRoad=horizonFade(new THREE.MeshLambertMaterial({color:0x69859f}),VIEW.roadFadeStart,VIEW.roadFadeEnd);this.roadLod.apply(farRoad,true);this.roadLod.applySilhouette(farRoad,false);
    const silhouetteRoad=horizonFade(new THREE.MeshBasicMaterial({color:0x526a80}),VIEW.roadFadeStart,VIEW.roadFadeEnd);this.roadLod.applySilhouette(silhouetteRoad,true);
    this.trackSilhouette=new THREE.InstancedMesh(farGeometry,silhouetteRoad,4*VIEW.trackSegments);
    this.trackFar=new THREE.InstancedMesh(farGeometry,farRoad,4*VIEW.trackSegments);
    this.trackPanels=new THREE.InstancedMesh(boxGeo,roadMetal,4*VIEW.trackSegments);
    this.trackPanels.receiveShadow=true;this.bike.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});
    const railMaterial=cyan.clone();railMaterial.emissiveIntensity=.7;
    this.trackRails=new THREE.InstancedMesh(boxGeo,horizonFade(railMaterial,VIEW.railFadeStart,VIEW.railFadeEnd),8*VIEW.trackSegments);
    const markMaterial=horizonFade(metal(0x728c92),VIEW.roadFadeStart,VIEW.roadFadeEnd);this.roadLod.apply(markMaterial,false);
    this.trackMarks=new THREE.InstancedMesh(boxGeo,markMaterial,8*VIEW.trackSegments);
    this.track.add(this.trackPanels,this.trackFar,this.trackSilhouette,this.trackRails,this.trackMarks);
    for(const mesh of [this.trackPanels,this.trackFar,this.trackSilhouette,this.trackRails,this.trackMarks]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;}
    const rng=random(221);const positions=new Float32Array(700*3);const colors=new Float32Array(700*3);
    for(let i=0;i<700;i++){const a=rng()*Math.PI*2,b=Math.acos(2*rng()-1),r=850+rng()*400;positions.set([Math.sin(b)*Math.cos(a)*r,Math.cos(b)*r,Math.sin(b)*Math.sin(a)*r],i*3);const c=.45+rng()*.55;colors.set([c*.76,c*.88,c],i*3);}
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));starGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    this.stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:1.5,vertexColors:true,sizeAttenuation:true,fog:false}));this.stars.renderOrder=-8;(this.stars.material as THREE.PointsMaterial).depthWrite=false;this.scene.add(this.stars);
    const planetMat=new THREE.ShaderMaterial({uniforms:{base:{value:new THREE.Color(this.route.planet)},lightDir:{value:new THREE.Vector3(-.65,.6,.75).normalize()}},vertexShader:`varying vec3 vN; varying vec3 vP; void main(){vN=normal; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vN; varying vec3 vP; uniform vec3 base; uniform vec3 lightDir;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=vP*5.;float n=noise(p)*.35+noise(p*2.3)*.25+noise(p*5.7)*.18+noise(p*14.)*.12+noise(p*39.)*.07+noise(p*90.)*.03;float canyon=smoothstep(.38,.56,noise(vec3(p.x*1.8,p.y*5.,p.z)));float light=max(dot(normalize(vN),lightDir),0.);vec3 c=mix(base*.36,base*2.,n)*mix(.7,1.,canyon);c*=.16+light*1.3;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    this.planet=new THREE.Mesh(sphereGeo,planetMat);this.planet.position.set(125,100,-310);this.planet.scale.setScalar(110);this.scene.add(this.planet);
    const atmosphereMat=planetAtmosphere('earth');
    this.atmosphere=new THREE.Mesh(sphereGeo,atmosphereMat);this.atmosphere.position.copy(this.planet.position);this.atmosphere.scale.setScalar(113);this.scene.add(this.atmosphere);
    this.moon=new THREE.Mesh(sphereGeo,metal(0x606d7a));this.moon.position.set(-180,95,-540);this.moon.scale.setScalar(29);this.scene.add(this.moon);
    this.scene.add(this.belt);const rockGeo=new THREE.IcosahedronGeometry(1,2);const vertices=rockGeo.attributes.position;for(let i=0;i<vertices.count;i++){const n=1+Math.sin(vertices.getX(i)*13+vertices.getY(i)*9)*.12+Math.cos(vertices.getZ(i)*11)*.1;vertices.setXYZ(i,vertices.getX(i)*n,vertices.getY(i)*n,vertices.getZ(i)*n);}rockGeo.computeVertexNormals();const rockMat=new THREE.MeshStandardMaterial({color:0x5e5654,roughness:1,metalness:.1});
    for(let i=0;i<26;i++){const asteroid=new THREE.Mesh(rockGeo,rockMat);const a=i*.39;asteroid.position.set(-115+Math.sin(a)*55,-38+Math.cos(a*1.4)*26,-120-i*14);asteroid.scale.set(2+i%4*1.7,1.5+i%3,2.2+i%5);asteroid.rotation.set(i*.4,i*.7,i*.3);this.belt.add(asteroid);}
    this.scene.add(this.combatView.root,this.riftView.root,this.meteorView.root);
    this.burst.geometry.setAttribute('position',new THREE.BufferAttribute(this.burstPositions,3));this.burst.frustumCulled=false;this.scene.add(this.burst);
    batchStatic(this.bike);const ridingBike=makeVesper(true);batchStatic(ridingBike);attachBikeEvolution(this.bike);attachBikeEvolution(ridingBike,true);this.vehicleLod=new VehicleGeometryLOD(this.bike,ridingBike);this.bike.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    // Batching replaces meshes and evolution adds materials: bind the complete model.
    // Keep this before lighting wraps the compile hooks and before auxiliary FX.
    this.liquidTransit=new LiquidTransit(this.bikeAnchor,this.bike,this.gun,this.survivalView.shield);
    this.bike.add(this.turboFX.root,this.phaseFX.root);
    this.sceneryReveals=[new SceneryReveal(this.belt)];packStaticScene(this.scene);prepareLighting(this.scene);window.addEventListener('resize',this.resizeHandler);this.resize();this.showMenu(this.route);
  }
  thermalReductionCallback?:()=>void;
  setQuality(value:string){
    this.quality=value;this.power.setSaver(value==='low');
    const maxRatio=Math.min(devicePixelRatio,2.5);
    const normal=new AdaptivePerformance(maxRatio,undefined,this.power);
    this.adaptive=new AdaptivePerformance(maxRatio,value==='auto'?this.thermal:undefined,this.power);this.applyQuality();
    if(value==='auto'&&budgetReduced(thermalBudget(normal),thermalBudget(this.adaptive)))this.thermalReductionCallback?.();
  }
  setLowPower(value:boolean){if(this.power.setLowPower(value)){this.adaptive.resetSampling();this.applyQuality();}}
  setThermalState(state:ThermalState){
    const before=thermalBudget(this.adaptive);
    if(this.thermal.setState(state)&&this.quality==='auto'){
      this.adaptive.resetSampling();this.applyQuality();
      if(budgetReduced(before,thermalBudget(this.adaptive)))this.thermalReductionCallback?.();
    }
  }
  private applyQuality(){
    const effects=Math.max(this.power.active?2:0,this.quality==='low'?2:this.quality==='auto'?this.adaptive.effects:0);
    this.combatView.blasts.detail=effects;this.meteorView.detail=effects;
    this.roadLod.setEconomy(this.power.active||this.quality==='low'||this.quality==='auto'&&this.adaptive.effectiveLevel>=1);this.lastTrackSegment=Infinity;
    this.pixelRatio=Math.min(this.power.ratioCap,this.quality==='auto'?this.adaptive.ratio:this.quality==='low'?Math.min(devicePixelRatio,1):Math.min(devicePixelRatio,MAX_RENDER_RATIO));
    this.stars.geometry.setDrawRange(0,this.power.active||this.quality==='low'||(this.quality==='auto'&&this.adaptive.effectiveLevel>=3)?400:700);
    this.bloom.enabled=!this.power.active&&this.quality!=='low'&&(this.quality!=='auto'||this.adaptive.bloom);
    const shadowSize=Math.min(this.renderer.capabilities.maxTextureSize,this.quality==='auto'?this.adaptive.shadowSize:1024);
    if(this.sun.shadow.mapSize.x!==shadowSize){
      this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
      this.sun.shadow.mapSize.set(shadowSize,shadowSize);this.sun.shadow.needsUpdate=true;
    }
    this.resize();
  }
  resize(){const width=innerWidth,height=innerHeight;if(this.garage){this.bike.scale.setScalar(height<350?2.2:2.9);}this.viewport.set(width,height);this.frozenTime=NaN;this.fxaa.uniforms.resolution.value.set(1/Math.max(1,Math.floor(width*this.pixelRatio)),1/Math.max(1,Math.floor(height*this.pixelRatio)));this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.composer.setPixelRatio(this.pixelRatio);this.composer.setSize(width,height);const realtime=this.quality==='high'&&!this.power.active;this.renderer.shadowMap.enabled=realtime;this.sun.castShadow=realtime;
    if(!realtime&&this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}this.requestFrame?.();}
  renderDue(now:number){return this.adaptive.due(now);}
  resetPerformance(){this.adaptive.resetSampling();}
  async loadArtwork(progress:(p:number)=>void){
    await this.sanFrancisco.loadAssets();
    const entries=[['earth','/textures/earth-albedo.png'],['mars','/textures/mars-albedo.png'],['luna','/textures/luna-albedo.png'],['jupiter','/textures/jupiter-albedo.png'],...SOLAR_TEXTURES.map(id=>[id,`/textures/${id}-albedo.jpg`]),['saturn-rings','/textures/saturn-rings.png'],['andromeda','/textures/andromeda.png']];let loaded=0;
    const loader=new THREE.TextureLoader();await Promise.all(entries.map(async([key,url])=>{const texture=await loader.loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());texture.wrapS=THREE.RepeatWrapping;this.textureCache.set(key,texture);this.renderer.initTexture(texture);progress(++loaded/entries.length);}));
    (this.planet.material as THREE.Material).dispose();
    this.planet.material=planetSurface(this.textureCache.get('earth')!,'earth');
    (this.moon.material as THREE.Material).dispose();
    this.moon.material=planetSurface(this.textureCache.get('luna')!,'luna');
    this.mars=new THREE.Mesh(sphereGeo,planetSurface(this.textureCache.get('mars')!,'mars'));this.scene.add(this.mars);
    this.marsAtmosphere=new THREE.Mesh(sphereGeo,planetAtmosphere('mars'));this.scene.add(this.marsAtmosphere);
    const jovianSphere=new THREE.SphereGeometry(1,80,56);jovianSphere.scale(1,.935,1);
    this.jupiter=new THREE.Mesh(jovianSphere,jupiterSurface(this.textureCache.get('jupiter')!));this.jupiter.add(jupiterRings());this.scene.add(this.jupiter);
    const jovianAir=planetAtmosphere('earth');jovianAir.uniforms.tint.value.set(0xb2c4d2);jovianAir.uniforms.strength.value=.23;jovianAir.uniforms.sun.value.set(.35,.4,.85).normalize();
    this.jupiterAtmosphere=new THREE.Mesh(jovianSphere,jovianAir);this.scene.add(this.jupiterAtmosphere);
    for(const id of SOLAR_TEXTURES){if(id==='sun')continue;const mesh=solarPlanet(id,this.textureCache.get(id)!,this.textureCache.get('saturn-rings')!);this.solarBodies.set(id,mesh);this.scene.add(mesh);}
    this.sunBody=solarSun(this.textureCache.get('sun')!);this.scene.add(this.sunBody);
    this.clouds=earthClouds(this.textureCache.get('earth')!);this.scene.add(this.clouds);
    this.belt.children.forEach(o=>{((o as THREE.Mesh).material as THREE.MeshStandardMaterial).map=this.textureCache.get('luna')!;});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(7000,48,24),new THREE.MeshBasicMaterial({map:orbitalSky(),side:THREE.BackSide,color:0xffffff,depthWrite:false,fog:false,toneMapped:false}));this.sky.rotation.y=.8;this.sky.rotation.z=.12;this.sky.renderOrder=-10;this.scene.add(this.sky);
    const iceMaterial=this.deepSpace.ice.material as THREE.MeshStandardMaterial;iceMaterial.map=this.textureCache.get('luna')!;iceMaterial.bumpMap=this.textureCache.get('luna')!;iceMaterial.needsUpdate=true;
    this.deepSpace.galaxy.material.map=this.textureCache.get('andromeda')!;this.deepSpace.galaxy.material.needsUpdate=true;
    this.scene.add(this.deepSpace.root);packStaticScene(this.scene);prepareLighting(this.scene);this.assetsLoaded=true;this.setRoute(this.route);
  }
  setRoute(route:Route){this.route=route;}
  private aimGun(r:Race){
    const shotAge=COMBAT.fireInterval-r.combat.cooldown,recoil=r.combat.shots>0&&r.combat.cooldown>0?Math.exp(-shotAge*28):0;this.gun.position.z=-.75+recoil*.24;
    this.bikeAnchor.updateWorldMatrix(true,false);const origin=pathAt(r.z),offset=new THREE.Vector3(origin.x,origin.y,-r.z),base=this.bikeAnchor.localToWorld(this.gun.position.clone()).add(offset);
    const direction=(r.combat.aimWorld??trackPoint(r.z+75,r.surface,r.laneX,7)).clone().sub(base).normalize().applyQuaternion(this.bikeAnchor.quaternion.clone().invert());
    const yaw=THREE.MathUtils.clamp(Math.atan2(direction.x,-direction.z),r.touchAim?-1.45:-.95,r.touchAim?1.45:.95),pitch=THREE.MathUtils.clamp(Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),r.touchAim?-1.45:-.65,r.touchAim?1.45:.8);
    this.gun.rotation.set(pitch,-yaw,0,'YXZ');this.gun.updateWorldMatrix(true,false);r.combat.aimDirection=new THREE.Vector3(0,0,-1).applyQuaternion(this.gun.quaternion).applyQuaternion(this.bikeAnchor.quaternion);
    r.combat.muzzleWorld=this.gun.localToWorld(new THREE.Vector3(r.combat.shots%2?.68:-.68,0,-1.25)).add(offset);if(r.touchAim&&r.combat.aimWorld)r.combat.aimDirection=r.combat.aimWorld.clone().sub(r.combat.muzzleWorld).normalize();this.gunFlash.visible=!phaseActive(r)&&r.combat.shots>0&&shotAge<.055;this.gunFlash.children.forEach((flash,i)=>{flash.visible=i===r.combat.shots%2;flash.scale.setScalar((.8+recoil*1.5));});
  }
  private pendingAim=false;
  pointAt(r:Race,x:number,y:number){r.touchAim={x:THREE.MathUtils.clamp(x,0,1),y:THREE.MathUtils.clamp(y,0,1)};this.pendingAim=true;}
  flushAim(r:Race){if(!this.pendingAim)return;this.pendingAim=false;this.updateAim(r);this.aimGun(r);}
  aimScreen={x:.5,y:.4,onTarget:false};
  private updateAim(r:Race){
    this.camera.updateMatrixWorld();const origin=pathAt(r.z),offset=new THREE.Vector3(origin.x,origin.y,-r.z);
    const baseline=trackPoint(r.z+AIM.distance,r.surface,r.laneX,7).sub(offset).project(this.camera);
    const nx=r.touchAim?r.touchAim.x*2-1:THREE.MathUtils.clamp(baseline.x+r.aimX*AIM.screenX*2,-.9,.9),ny=r.touchAim?1-r.touchAim.y*2:THREE.MathUtils.clamp(baseline.y+r.aimY*AIM.screenY*2,-.85,.85);
    this.aimScreen={x:(nx+1)/2,y:(1-ny)/2,onTarget:false};let depth=r.z+AIM.distance,best=Infinity;
    // Depth convergence follows the selected screen ray, never changes its selected direction.
    for(const e of r.combat.enemies){if(!e.active||e.hp<=0||enemyTrackZ(e)-r.z<5||enemyTrackZ(e)-r.z>165)continue;const screen=enemyPoint(e).sub(offset).project(this.camera);const distance=Math.hypot((screen.x-nx)*this.viewport.x/2,(screen.y-ny)*this.viewport.y/2);if(screen.z<1&&distance<22&&distance<best){depth=-enemyPoint(e).z;best=distance;this.aimScreen.onTarget=true;}}
    const ray=new THREE.Vector3(nx,ny,.5).unproject(this.camera).sub(this.camera.position).normalize(),t=(-depth+r.z-this.camera.position.z)/ray.z;
    if(t>0)r.combat.aimWorld=this.camera.position.clone().addScaledVector(ray,t).add(offset);
  }
  showGarage(level:number){this.showMenu(ROUTES[0]);this.garageShowroom?.invalidate();this.garage=true;this.track.visible=false;this.planet.visible=false;this.atmosphere.visible=false;this.bikeAnchor.position.set(-6.3,innerHeight<350?5.25:4.7,0);this.bike.scale.setScalar(innerHeight<350?2.2:2.9);this.bike.rotation.y=this.garageAngle;this.bike.userData.setEvolution(level);this.invalidate();}
  rotateGarage(delta:number){this.garageAngle+=delta;this.bike.rotation.y=this.garageAngle;this.invalidate();}
  showMenu(route:Route){this.garage=false;this.sanFrancisco.root.visible=false;this.deepSpace.hide();if(this.sky)(this.sky.material as THREE.MeshBasicMaterial).color.setScalar(1);this.planet.visible=true;this.atmosphere.visible=true;for(const mesh of this.solarBodies.values())mesh.visible=false;if(this.sunBody)this.sunBody.visible=false;if(this.jupiter)this.jupiter.visible=false;if(this.jupiterAtmosphere)this.jupiterAtmosphere.visible=false;this.healthFX.reset();this.reviveFX.reset();this.turboFX.reset();this.phaseFX.reset();this.riftView.reset();this.menu=true;this.gun.visible=false;this.setRoute(route);this.gates.visible=false;this.finish.visible=false;this.track.visible=true;this.bike.visible=true;this.bike.scale.setScalar(2.7);this.bikeAnchor.position.set(10,4.35,4);this.bikeAnchor.rotation.set(0,0,0);this.bike.rotation.set(0,-.5,0);this.updateTrack(0);}
  private gateInstances:GateInstances[]=[];
  private animatedGateInstances:AnimatedInstances[]=[];
  private animatedGateTransforms=new AnimatedInstanceTransforms(this.gates);
  private gateTransforms=new GateTransformCache();
  clearGates(){
    this.gateInstances=[];
    for(const pool of this.animatedGateInstances)pool.dispose();
    this.animatedGateInstances=[];
    const disposed=new Set<THREE.BufferGeometry>();this.gates.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry!==boxGeo&&o.geometry!==bevelGeo&&!disposed.has(o.geometry)){o.geometry.dispose();disposed.add(o.geometry);}});this.gates.clear();this.gateVisuals=[];
  }
  async prepare(race:Race,onProgress:(p:number,label:string)=>void){
    this.healthFX.reset();this.reviveFX.reset();this.turboFX.reset();this.phaseFX.reset();this.setRoute(race.route);onProgress(.08,t('loading.orbit'));await new Promise(r=>requestAnimationFrame(r));
    for(let i=this.gateVisuals.length;i<KINDS.length*VIEW.gateSlots;i++){
      const gate:Gate={id:-1,z:0,safe:0,blocked:[0,1,2,3],kind:KINDS[Math.floor(i/VIEW.gateSlots)],phase:0,cluster:0,checkpoint:false};const group=new VisibleModelGroup();const faces:THREE.Group[]=[],movers:THREE.Object3D[]=[],warnings:THREE.Mesh[]=[];group.position.z=-gate.z;
      for(const s of gate.blocked){const face=new VisibleModelGroup();face.rotation.z=-s*Math.PI/2;group.add(face);faces.push(face);
        // Amber floor chevrons begin 30 metres before the physical obstacle.
        for(let k=0;k<3;k++)for(const sign of [-1,1]){const warning=box(face,red,sign*.42,4.11,9+k*6,.95,.035,.16,0);warning.rotation.y=sign*.55;warnings.push(warning);}
        let mover:THREE.Object3D;
        if(gate.kind==='mines'){mover=new THREE.Group();face.add(mover);for(const x of [-OBSTACLE.mines.x,OBSTACLE.mines.x]){const mine=new THREE.Mesh(new THREE.IcosahedronGeometry(OBSTACLE.mines.radius,1),red);mine.position.set(x,OBSTACLE.mines.y,0);mover.add(mine);box(face,red,x,4.1,4,1.7,.05,5);}}
        else if(gate.kind==='shutter'){for(const x of [-3.5,3.5])box(face,steel,x,4+OBSTACLE.shutter.postHeight/2,0,.35,OBSTACLE.shutter.postHeight,.6);mover=box(face,orange,0,OBSTACLE.shutter.y,0,OBSTACLE.shutter.width,OBSTACLE.shutter.height,OBSTACLE.shutter.depth);box(mover,red,0,-.42,.52,.9,.08,.04);}
        else if(gate.kind==='gap') {mover=new THREE.Group();face.add(mover);box(face,red,0,4.13,4,7.8,.07,.15);box(face,red,0,4.13,-4,7.8,.07,.15);}
        else if(gate.kind==='arm'){box(face,steel,-3.2,4.45,0,.35,.9,.6);mover=new THREE.Group();mover.position.set(OBSTACLE.arm.pivotX,OBSTACLE.arm.pivotY,0);face.add(mover);box(mover,red,OBSTACLE.arm.length/2,0,0,OBSTACLE.arm.length,OBSTACLE.arm.height,OBSTACLE.arm.depth);}
        else if(gate.kind==='laser'){for(const x of [-3.3,3.3]){box(face,steel,x,5.5,0,.42,3,.65);box(face,red,x,6.9,0,.65,.15,.8);}mover=new THREE.Group();face.add(mover);for(let k=0;k<3;k++)box(mover,red,0,OBSTACLE.laser.y+k*OBSTACLE.laser.spacing,0,OBSTACLE.laser.width,OBSTACLE.laser.height,OBSTACLE.laser.depth);}
        else if(gate.kind==='block'){mover=box(face,orange,0,OBSTACLE.block.y,0,OBSTACLE.block.width,OBSTACLE.block.height,OBSTACLE.block.depth);box(mover,dark,0,0,.505,.73,.66,.025);box(mover,red,0,0,.525,.36,.075,.02);for(const side of [-1,1])box(mover,pale,side*.4,0,.52,.06,.82,.04);box(mover,pale,0,.49,0,.85,.05,.85);}
        else {mover=box(face,steel,0,OBSTACLE.barrier.y,0,OBSTACLE.barrier.width,OBSTACLE.barrier.height,OBSTACLE.barrier.depth);box(face,dark,0,4.9,.47,5.8,1.2,.06);for(let k=-2;k<=2;k++)box(face,red,k*1.1,4.9,.52,.5,1.05,.035,.3);box(face,pale,0,5.7,0,6.3,.13,1);for(const side of [-1,1]){box(face,pale,side*3,4.85,.12,.2,1.5,1.1);box(face,dark,side*2.8,4.19,0,.65,.2,1.35);box(face,orange,side*2.75,5.65,.57,.25,.12,.05);}}
        mover.removeFromParent();batchStatic(face);face.add(mover);if(mover instanceof THREE.Group)batchStatic(mover);
        movers.push(mover);
      }
      const energy=makePickupVisual('energy');energy.position.set(Math.sin(gate.safe*Math.PI/2)*5,Math.cos(gate.safe*Math.PI/2)*5,12);group.add(energy);const extraEnergy=makePickupVisual('energy');this.gates.add(extraEnergy);
      this.gates.add(group);this.gateVisuals.push({group,gate,faces,movers,warnings,energy,extraEnergy});
      if(i%VIEW.gateSlots===0){onProgress(.12+.67*(i+1)/(KINDS.length*VIEW.gateSlots),t('loading.track'));await new Promise(r=>requestAnimationFrame(r));}
    }
    if(!this.gateInstances.length){
      const pools=new Map<string,StaticGatePart[]>();
      for(let i=0;i<this.gateVisuals.length;i++){
        const visual=this.gateVisuals[i];
        visual.faces.forEach((face,side)=>{
          let partIndex=0;
          for(const part of [...face.children]){
            if(!(part instanceof THREE.Mesh)||part===visual.movers[side])continue;
            const key=`${Math.floor(i/VIEW.gateSlots)}/${partIndex++}`;
            const entries=pools.get(key)??[];entries.push({part,face,gate:visual.group});pools.set(key,entries);
          }
        });
      }
      for(const entries of pools.values()){const pool=new GateInstances(entries);this.gateInstances.push(pool);this.gates.add(pool.mesh);}
    }
    if(!this.animatedGateInstances.length){
      const pools=new Map<string,THREE.Mesh[]>();
      const collect=(root:THREE.Object3D,prefix:string)=>{
        let index=0;
        root.traverse(part=>{if(part instanceof THREE.Mesh){const key=prefix+'/'+index++;const parts=pools.get(key)??[];parts.push(part);pools.set(key,parts);}});
      };
      this.gateVisuals.forEach((v,i)=>{
        collect(v.energy,'energy');collect(v.extraEnergy,'energy');
        v.movers.forEach(m=>collect(m,'mover/'+Math.floor(i/VIEW.gateSlots)));
      });
      for(const parts of pools.values()){const pool=new AnimatedInstances(parts);this.animatedGateInstances.push(pool);this.gates.add(pool.mesh);}
    }
    packStaticScene(this.scene);prepareLighting(this.scene);
    onProgress(.84,'');this.gates.visible=true;this.menu=false;this.garage=false;this.gun.visible=true;this.bike.scale.setScalar(RIDER.scale);this.bike.rotation.set(0,0,0);this.bikeAnchor.position.set(0,4.25,0);this.bikeAnchor.rotation.set(0,0,0);this.cameraAngle=0;
    await this.renderer.compileAsync(this.scene,this.camera);
    // Warm the actual chase camera, shadow programs and HDR targets inside loading.
    this.render(0,race);await this.renderer.compileAsync(this.scene,this.camera);await new Promise(requestAnimationFrame);this.render(0,race);
    this.deepSpace.voidArt.cachedVeil.prepare(this.renderer);
    // compileAsync prepares programs, but hidden enemy buffers still need a draw.
    // Upload shared model buffers while the loading screen covers the canvas.
    const warmTarget=new THREE.WebGLRenderTarget(32,32),previousTarget=this.renderer.getRenderTarget();
    const progress=this.combatView.arrivalProgress[0],savedProgress=progress.value;
    const warmRoot=new THREE.Group();this.scene.add(warmRoot);
    try{
      progress.value=1;this.camera.updateWorldMatrix(true,false);
      warmRoot.position.set(0,0,-20).applyMatrix4(this.camera.matrixWorld);
      warmRoot.quaternion.copy(this.camera.quaternion);
      this.renderer.setRenderTarget(warmTarget);
      const warmModels=[...this.combatView.warmModels(),...this.deepSpace.voidArt.warmModels(),this.deepSpace.hole,this.deepSpace.galaxy,...this.solarBodies.values(),this.moon,this.mars,this.jupiter,this.marsAtmosphere,this.jupiterAtmosphere,this.supportView.root,this.meteorView.root,this.riftView.root,this.shipView.craft,this.shipView.core,this.survivalView.root,this.heatVentFX.root,this.turboFX.root,this.phaseFX.root].filter(model=>model!==undefined);
      for(const model of warmModels){
        const preview=model.clone(true);
        preview.traverse(object=>{object.visible=true;object.frustumCulled=false;});
        warmRoot.add(preview);
        this.renderer.render(this.scene,this.camera);warmRoot.remove(preview);
        await new Promise(requestAnimationFrame);
      }
    }finally{
      progress.value=savedProgress;warmRoot.removeFromParent();
      this.renderer.setRenderTarget(previousTarget);warmTarget.dispose();
    }
    // Prepare the actual economy shader variants before a live quality transition.
    // applyQuality invalidates the frozen-frame cache; each tier really draws.
    if(this.quality==='auto'){
      const initialLevel=this.adaptive.level;
      try{
        for(const level of [...new Set([3,4,6,initialLevel])]){
          this.adaptive.level=level;this.applyQuality();
          // Hidden encounters need the same shadow/effect shader variants as the road.
          // Compile while loading, instead of on the first support/meteor appearance.
          await this.renderer.compileAsync(this.scene,this.camera);
          this.render(0,race);await new Promise(requestAnimationFrame);
        }
      }finally{this.adaptive.level=initialLevel;this.applyQuality();}
    }
    onProgress(1,t('loading.ready'));
  }
  updateTrack(z:number,race?:Race){
    const segment=Math.floor(z/8),base=segment*8,origin=pathAt(z);this.track.position.set(-origin.x,-origin.y,z-base);
    if(segment===this.lastTrackSegment&&race===this.lastTrackRace)return;
    this.lastTrackSegment=segment;this.lastTrackRace=race;
    const first=segment-4;const gaps=race?.gates.filter(g=>g.kind==='gap')??[];let panel=0,farPanel=0,silhouettePanel=0,rail=0,mark=0;
    for(let i=0;i<VIEW.trackSegments;i++){const at=(first+i)*8;if(at-base>VIEW.roadFadeEnd+16)continue;
      const cached=this.roadFrames.get(first+i),center=cached.center;this.roadQ.copy(cached.rotation);
      for(let s=0;s<4;s++){
        const a=-s*Math.PI/2;this.rollQ.setFromAxisAngle(Z,a);this.dummy.quaternion.copy(this.roadQ).multiply(this.rollQ);
        const gap=gaps.some(g=>g.blocked.includes(s)&&Math.abs(at-g.z)<4);
        // Omit absent panels. Zero-height instances produce invalid lighting normals
        // which spread through HDR bloom and can black out the entire frame.
        if(gap)continue;
        this.offset.set(Math.sin(-a)*3.93,Math.cos(a)*3.93,0).applyQuaternion(this.roadQ);this.dummy.position.set(center.x,center.y,base-at).add(this.offset);this.dummy.scale.set(OBSTACLE.gap.width,.2,OBSTACLE.gap.depth);this.dummy.updateMatrix();if(this.roadLod.includes(at-base,false))this.trackPanels.setMatrixAt(panel++,this.dummy.matrix);if(this.roadLod.includesMiddle(at-base))this.trackFar.setMatrixAt(farPanel++,this.dummy.matrix);if(this.roadLod.includesSilhouette(at-base))this.trackSilhouette.setMatrixAt(silhouettePanel++,this.dummy.matrix);
        for(const side of [-1,1]){
          if(at-base>VIEW.railFadeEnd+16)continue;
          this.offset.set(side*3.78,4.08,0).applyQuaternion(this.dummy.quaternion);this.dummy.position.set(center.x,center.y,base-at).add(this.offset);this.dummy.scale.set(.10,.06,8.05);this.dummy.updateMatrix();this.trackRails.setMatrixAt(rail++,this.dummy.matrix);
          if(!this.roadLod.includes(at-base,false))continue;
          this.offset.set(side*1.08,4.025,0).applyQuaternion(this.dummy.quaternion);this.dummy.position.set(center.x,center.y,base-at).add(this.offset);this.dummy.scale.set(.035,.02,2.4);this.dummy.updateMatrix();this.trackMarks.setMatrixAt(mark++,this.dummy.matrix);
        }
      }
    }
    this.trackPanels.count=panel;this.trackFar.count=farPanel;this.trackSilhouette.count=silhouettePanel;this.trackRails.count=rail;this.trackMarks.count=mark;
    for(const mesh of [this.trackPanels,this.trackFar,this.trackSilhouette,this.trackRails,this.trackMarks])uploadLivePrefix(mesh.instanceMatrix,mesh.count);
  }
  private auditAt=0;
  private auditDraws=false;
  private drawTotals=new Map<string,number>();
  private audited=new WeakSet<THREE.Object3D>();
  gpuTimer:GpuTimer;
  profile={updateMs:0,submitMs:0,calls:0,triangles:0};
  render(dt:number,race?:Race){
    const profileStart=performance.now();
    if(this.disposed)return;
    if(this.garage){this.garageShowroom??=new GarageShowroom(this.environment.texture);this.garageShowroom.render(this.renderer,this.garageAngle,this.bike.userData.evolution??0);return;}
    if(dt===0&&race&&this.frozenRace===race&&this.frozenTime===race.time&&this.frozenZ===race.z)return;
    this.frozenRace=race;this.frozenTime=dt===0?race?.time??NaN:NaN;this.frozenZ=race?.z??NaN;
    const launch=departureAt(this.menu?ASCENT_END:race?.z??ASCENT_END);
    this.sanFrancisco.root.visible=!this.menu&&!!race&&race.z<3200;
    for(const reveal of this.sceneryReveals)reveal.update(this.garage?0:this.menu?1:launch.orbit);
    this.stars.visible=launch.orbit>.001;(this.stars.material as THREE.PointsMaterial).transparent=true;(this.stars.material as THREE.PointsMaterial).opacity=launch.orbit;
    const fog=this.scene.fog as THREE.FogExp2;fog.color.set(0x17314c).lerp(this.fogAir,launch.air);fog.density=.0018-launch.air*.00162;
    if(this.disposed)return;this.timer+=dt;this.bike.userData.animate?.(this.timer);
    if(this.menu){
      this.riderShadow.update(0,true);
      this.camera.position.set(this.garage?3:13,this.garage?8.1:10,this.garage?13:16);this.camera.up.copy(Y);this.look.set(0,this.garage?6.1:5,this.garage?0:-8);this.camera.lookAt(this.look);
      this.bikeAnchor.position.y=this.garage?(innerHeight<350?5.25:4.7):4.35+Math.sin(this.timer*1.6)*.08;this.moon.visible=false;if(this.mars)this.mars.visible=false;if(this.marsAtmosphere)this.marsAtmosphere.visible=false;this.belt.position.z=0;
      this.planet.position.set(-45,48,-185);this.planet.scale.setScalar(59);this.atmosphere.position.copy(this.planet.position);this.atmosphere.scale.setScalar(60.65);
    }else if(race){
      const a=race.angle;
      const surface=((Math.round(a/(Math.PI/2))%4)+4)%4,at=Math.round(race.z/8)*8;
      const groundPresent=!race.riftTransit&&!race.gates.some(g=>g.kind==='gap'&&g.blocked.includes(surface)&&Math.abs(at-g.z)<4);
      this.riderShadow.update(race.ship.lift,groundPresent,a);
      this.cameraAngle=THREE.MathUtils.damp(this.cameraAngle,a,8,dt);
      const origin=pathAt(race.z);this.lastOrigin=origin;const direction=tangentAt(race.z);this.tangent.set(direction.x,direction.y,-1).normalize();this.roadQ.setFromUnitVectors(this.forward,this.tangent);
      const hullRadius=riderRadius(a);
      this.bikeAnchor.position.set(Math.sin(a)*hullRadius,Math.cos(a)*hullRadius,0).applyQuaternion(this.roadQ);this.rollQ.setFromAxisAngle(Z,-a);this.bikeAnchor.quaternion.copy(this.roadQ).multiply(this.rollQ);
      this.offset.set(race.laneX*TUNE.laneSpacing,0,0).applyQuaternion(this.bikeAnchor.quaternion);this.bikeAnchor.position.add(this.offset);this.bikeAnchor.position.addScaledVector(this.liftAxis.set(0,1,0).applyQuaternion(this.bikeAnchor.quaternion),race.ship.lift*8);this.bike.rotation.z=-(race.lane-race.laneX)*.14;
      this.bike.position.y=Math.sin(this.timer*12)*.018+race.ship.suspension;this.bike.rotation.x=race.ship.landingPitch;
      this.up.set(Math.sin(this.cameraAngle),Math.cos(this.cameraAngle),0).applyQuaternion(this.roadQ);
      const rear=pathAt(race.z-12),ahead=pathAt(race.z+27);
      this.camera.position.set(rear.x-origin.x,rear.y-origin.y,12).addScaledVector(this.up,9.7+race.ship.lift*8);
      this.look.set(ahead.x-origin.x,ahead.y-origin.y,-27).addScaledVector(this.up,3.4+race.ship.lift*8);this.camera.up.copy(this.up);this.camera.lookAt(this.look);this.updateAim(race);this.aimGun(race);
      const transitPhase=race.riftTransit?Math.min(1,race.riftTransit.elapsed/1.8):0,warp=race.riftTransit?Math.sin(Math.PI*transitPhase):0;
      const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const surge=overdriveSurge(race.boost>0&&overdriveEnabled(race)?race.overdrive.earned:0,race.overdrive.flash);
      const previousFov=this.camera.fov;this.camera.fov=THREE.MathUtils.damp(this.camera.fov,race.riftChallenge?65:race.riftTransit?58+warp*2:race.boost>0?61+(reducedMotion?0:surge.fov):58,surge.pulse>0?16:7,dt);if(race.riftChallenge||race.riftTransit)this.camera.position.addScaledVector(this.up,Math.sin(this.timer*(race.riftTransit?12:17))*(race.riftTransit?.13:.09));if(this.camera.fov!==previousFov)this.camera.updateProjectionMatrix();this.bloom.strength=.24+warp*.5+(race.riftChallenge?.12:0);
      const spaceOrigin={x:origin.x,y:origin.y-ascentAt(race.z).height};this.placeJourney(race.z,spaceOrigin);this.sanFrancisco.update(race.z,this.timer,origin,this.camera);this.deepSpace.update(race.z,this.timer,spaceOrigin,this.camera);this.riftView.render(race,origin,this.timer);
      if(this.sky)(this.sky.material as THREE.MeshBasicMaterial).color.setScalar(1-.65*THREE.MathUtils.smoothstep(race.z,20400,28000));
      this.updateTrack(race.z,race);
      this.finish.visible=false;this.poolCounts.fill(0);for(const v of this.gateVisuals){v.group.visible=false;v.extraEnergy.visible=false;}
      for(const gate of race.gates){const distance=gate.z-race.z;if(distance<=-20||distance>=VIEW.objectFadeEnd)continue;const kind=KINDS.indexOf(gate.kind);const slot=this.poolCounts[kind]++;if(slot>=VIEW.gateSlots)throw new Error('Obstacle visual pool capacity exceeded');const v=this.gateVisuals[kind*VIEW.gateSlots+slot];v.gate=gate;v.group.visible=true;v.faces.forEach((face,s)=>{face.visible=gate.blocked.includes(s);face.position.set(0,0,0);face.scale.x=gate.lane===undefined?1:OBSTACLE.barrier.narrowScale;if(gate.lane!==undefined)face.translateX(gate.lane*TUNE.laneSpacing);});v.energy.position.set((gate.energyLane??0)*TUNE.laneSpacing,6.15,12).applyAxisAngle(Z,-gate.safe*Math.PI/2);const gp=pathAt(v.gate.z),gd=tangentAt(v.gate.z);v.group.position.set(gp.x-origin.x,gp.y-origin.y,-distance);this.tangent.set(gd.x,gd.y,-1).normalize();v.group.quaternion.setFromUnitVectors(this.forward,this.tangent);
        v.energy.visible=!race.collected.has(v.gate.id)&&distance>6;v.energy.rotation.set(0,0,-gate.safe*Math.PI/2);v.energy.userData.animate?.(race.time,gate.id*.37);
        v.movers.forEach(m=>{if(v.gate.kind==='shutter')m.position.y=shutterPosition(race.time,v.gate.phase);if(v.gate.kind==='laser')m.visible=laserActive(race.time,v.gate.phase);if(v.gate.kind==='arm')m.rotation.z=armAngle(race.time,v.gate.phase);if(v.gate.kind==='block')m.position.x=blockPosition(race.time,v.gate.phase);});
      }
      let bonusSlot=0;
      for(const bonus of race.training||race.ship.active?[]:race.bonusEnergy){const distance=bonus.z-race.z;if(distance<=-6||distance>=VIEW.objectFadeEnd||race.bonusCollected.has(bonus.id))continue;
        const visual=this.gateVisuals[bonusSlot++]?.extraEnergy;if(!visual)break;
        const p=pathAt(bonus.z),d=tangentAt(bonus.z);this.tangent.set(d.x,d.y,-1).normalize();visual.quaternion.setFromUnitVectors(this.forward,this.tangent);
        visual.position.set(bonus.lane*TUNE.laneSpacing,6.15,0).applyAxisAngle(Z,-bonus.surface*Math.PI/2).applyQuaternion(visual.quaternion);
        visual.position.x+=p.x-origin.x;visual.position.y+=p.y-origin.y;visual.position.z-=distance;visual.rotateZ(-bonus.surface*Math.PI/2);visual.visible=true;visual.userData.animate?.(race.time,bonus.id*.37+.8);
      }
      this.bike.visible=true;
    }
    this.vehicleLod.setRiding(!this.menu&&(this.quality!=='high'||this.power.active));
    this.gateTransforms.beginFrame();
    for(const pool of this.gateInstances)pool.update(this.gateTransforms);
    this.animatedGateTransforms.beginFrame();
    for(const pool of this.animatedGateInstances)pool.update(this.animatedGateTransforms);
    if(this.clouds){this.clouds.visible=this.planet.visible;this.clouds.position.copy(this.planet.position);this.clouds.scale.copy(this.planet.scale).multiplyScalar(1.006);this.clouds.rotation.copy(this.planet.rotation);this.clouds.rotation.y+=this.timer*.00005;}
    this.meteorView.render(race,this.menu,this.lastOrigin);
    if(race&&!this.menu&&race.meteors.impactPulse>0){const p=race.meteors.impactPulse/.55;this.camera.position.x+=Math.sin(race.time*71)*p*.075;this.camera.position.y+=Math.sin(race.time*89)*p*.05;}
    this.shipView.update(this.menu?undefined:race,this.lastOrigin,this.timer);
    this.supportView.update(this.menu?undefined:race,this.bikeAnchor,this.lastOrigin,this.camera);
    for(const wheel of this.bike.userData.flightWheels??[])wheel.rotation.z=(this.menu?0:race?.ship.wheelFold??0)*Math.PI/2;
    this.phaseFX.update(!this.menu&&!!race&&!!phaseActive(race),race?.phase.remaining??0,race?.time??0,this.bike,this.gun);
    this.liquidTransit.update(this.menu?undefined:race);
    if(!this.menu){this.healthFX.update(dt,this.bikeAnchor,this.camera);this.reviveFX.update(dt);}
    this.heatVentFX.update(this.menu||race?.ship.active?0:race?.combat.ignition.flash??0);this.turboFX.update(dt,!this.menu&&!!race&&race.boost>0,this.timer,this.menu||race?.training||race?.ship.active||race?.riftTransit?0:race?.overdrive.flash??0,this.menu||race?.training||race?.ship.active||race?.riftTransit?0:race?.overdrive.earned??0);this.combatView.render(race,this.menu,this.camera);this.survivalView.render(race,this.menu);
    if(this.burstLife>0){this.burstLife=Math.max(0,this.burstLife-dt);const t=1-this.burstLife/.4;this.burst.position.copy(this.bikeAnchor.position);for(let i=0;i<24;i++){const a=i*2.4;this.burstPositions[i*3]=Math.cos(a)*t*1.8;this.burstPositions[i*3+1]=.8+Math.sin(a)*t;this.burstPositions[i*3+2]=Math.sin(i*4.1)*t*1.8;}this.burst.geometry.attributes.position.needsUpdate=true;(this.burst.material as THREE.PointsMaterial).opacity=this.burstLife/.4;this.burst.visible=!this.menu;}else this.burst.visible=false;
    const cityLight=launch.air>.01;this.sun.position.copy(this.bikeAnchor.position).add(this.sunOffset.set(cityLight?-65:-12,cityLight?85:24,cityLight?35:8));this.sun.target.position.copy(this.bikeAnchor.position);const shadowSize=cityLight?100:14;const shadowChanged=this.sun.shadow.camera.right!==shadowSize;this.sun.shadow.camera.left=-shadowSize;this.sun.shadow.camera.right=shadowSize;this.sun.shadow.camera.top=shadowSize;this.sun.shadow.camera.bottom=-shadowSize;this.sun.shadow.camera.far=cityLight?300:80;if(shadowChanged)this.sun.shadow.camera.updateProjectionMatrix();
    this.auditDraws=DRAW_AUDIT&&!!race&&race.time-this.auditAt>5;
    if(this.auditDraws){this.auditAt=race!.time;this.drawTotals.clear();this.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||this.audited.has(o))return;this.audited.add(o);
      const previous=o.onBeforeRender;o.onBeforeRender=(...args)=>{previous.apply(o,args);if(!this.auditDraws)return;
        let path=o.material instanceof THREE.Material?o.material.name:'';let parent:THREE.Object3D|null=o;
        while(parent){if(parent.name)path=parent.name+'/'+path;parent=parent.parent;}
        const count=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof THREE.InstancedMesh?o.count:1);
        this.drawTotals.set(path||'unnamed', (this.drawTotals.get(path||'unnamed')??0)+count);
      };
    });}
    for(const body of [this.planet,this.moon,this.mars,this.jupiter,this.atmosphere,this.marsAtmosphere,this.jupiterAtmosphere,this.clouds,this.sunBody,...this.solarBodies.values(),this.belt])if(body?.visible)this.celestialLod.update(body,this.camera);
    const submitStart=performance.now();this.renderer.info.autoReset=false;this.renderer.info.reset();this.gpuTimer.begin();
    if(race&&!this.menu)this.deepSpace.voidArt.updateBackdrop(this.renderer,race.z,this.timer);
    this.fxaa.uniforms.hudShade.value=this.hudShade?(race?.health===1?2:1):0;
    this.composer.render(dt);
    this.gpuTimer.end();
    if(this.auditDraws)console.info('ION_DRAWS '+JSON.stringify([...this.drawTotals].sort((a,b)=>b[1]-a[1]).slice(0,12)));
    this.profile={updateMs:submitStart-profileStart,submitMs:performance.now()-submitStart,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};
  }
  pulse(type:string,value?:number){this.frozenTime=NaN;if(type==='revive'){this.reviveFX.trigger(matchMedia('(prefers-reduced-motion: reduce)').matches);return;}if(type==='health'){if((value??0)>0)this.healthFX.trigger();return;}if(!['energy','shield','hit','goal','riftEnter','riftComplete'].includes(type))return;this.burstLife=type.startsWith('rift')?.8:.4;(this.burst.material as THREE.PointsMaterial).color.set(type==='hit'?0xff7040:type==='riftComplete'?0xd083ff:0x85ffe0);}
  placeJourney(z:number,origin:{x:number;y:number}){
    BODIES.forEach(body=>{
      const mesh=body.id==='earth'?this.planet:body.id==='luna'?this.moon:body.id==='mars'?this.mars:body.id==='jupiter'?this.jupiter:this.solarBodies.get(body.id);if(!mesh)return;
      const presence=bodyPresence(z,body.passAt)*departureAt(z).orbit;
      mesh.visible=presence>.001;
      mesh.position.set(body.x-origin.x,body.y-origin.y,z-body.passAt);
      // A distant body begins below a pixel, then resolves continuously into its
      // real size. This reads as an approach through space instead of a spawned mesh.
      // The Moon keeps its physical radius: perspective alone controls its
      // apparent size. Reveal it through the atmosphere without inflating it.
      mesh.scale.setScalar(body.id==='luna'?body.radius:body.radius*(.025+.975*presence));
      if(body.id==='luna'){
        const lunarMaterial=mesh.material as THREE.ShaderMaterial;
        if(lunarMaterial.uniforms?.visibility)lunarMaterial.uniforms.visibility.value=presence;
      }
      if(body.id==='earth')mesh.rotation.y=.8;else if(body.id==='jupiter')mesh.rotation.y=-.05+this.timer*.0003;
      const material=mesh.material as THREE.ShaderMaterial;if(material.uniforms?.time)material.uniforms.time.value=this.timer;
    });
    if(this.sunBody){const sunPresence=THREE.MathUtils.smoothstep(z,1800,3800)*(1-THREE.MathUtils.smoothstep(z,6800,7900));this.sunBody.visible=sunPresence>.001;this.sunBody.position.set(1500-origin.x,650-origin.y,z-8600);this.sunBody.scale.setScalar(550*(.04+.96*sunPresence));this.sunBody.rotation.y=this.timer*.002;}
    this.atmosphere.visible=this.planet.visible;this.atmosphere.position.copy(this.planet.position);this.atmosphere.scale.copy(this.planet.scale).multiplyScalar(1.028);if(this.jupiter&&this.jupiterAtmosphere){(this.jupiter.material as THREE.ShaderMaterial).uniforms.time.value=this.timer;this.jupiterAtmosphere.visible=this.jupiter.visible;this.jupiterAtmosphere.position.copy(this.jupiter.position);this.jupiterAtmosphere.rotation.copy(this.jupiter.rotation);this.jupiterAtmosphere.scale.copy(this.jupiter.scale).multiplyScalar(1.012);}
    if(this.mars&&this.marsAtmosphere){this.marsAtmosphere.visible=this.mars.visible;this.marsAtmosphere.position.copy(this.mars.position);this.marsAtmosphere.scale.copy(this.mars.scale).multiplyScalar(1.021);}
    
    this.belt.position.set(-origin.x,-origin.y,z-3900);
  }
  measure(now:number){
    if(this.quality!=='auto'||this.menu)return;
    if(this.adaptive.presented(now))this.applyQuality();
    if(this.adaptive.averageMs>0)this.performanceCallback?.(1000/this.adaptive.averageMs,this.pixelRatio);
  }
  dispose(){this.phaseFX.dispose();this.garageShowroom?.dispose();this.deepSpace.voidArt.disposeBackdrop();this.combatView.disposeGeometry();this.vehicleLod.dispose();for(const pool of this.animatedGateInstances)pool.dispose();this.celestialLod.dispose();this.gpuTimer.dispose();this.disposed=true;window.removeEventListener('resize',this.resizeHandler);const geometries=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}if(o instanceof THREE.Sprite)mats.add(o.material);});geometries.forEach(g=>g.dispose());mats.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});m.dispose();});textures.forEach(t=>t.dispose());this.textureCache.forEach(t=>t.dispose());this.environment.dispose();this.bloom.dispose();this.outputPass.dispose();this.fxaa.dispose();this.composer.dispose();materials.forEach(m=>m.dispose());this.renderer.dispose();}
}










