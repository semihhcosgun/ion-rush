import * as THREE from 'three';

const prepared=new WeakSet<THREE.Material>();
function expandChunks(source:string):string{
 return source.replace(/#include <([\w_]+)>/g,(_,name)=>{
  const chunk=(THREE.ShaderChunk as Record<string,string>)[name];
  if(chunk===undefined)throw Error('Unknown lighting shader chunk: '+name);
  const expanded=expandChunks(chunk);
  // Shared shadow structs must match the vertex stage, and depth comparisons
  // need full precision even when bounded surface lighting uses mediump.
  return name==='shadowmap_pars_fragment'?'precision highp float;\n'+expanded+'\nprecision mediump float;':expanded;
 });
}

/** PBR lighting uses bounded half-precision arithmetic. World transforms,
 * inter-stage values and custom procedural skies retain their high precision. */
export function prepareLightingMaterial(material:THREE.Material){
 if(!(material as THREE.MeshStandardMaterial).isMeshStandardMaterial||prepared.has(material))return;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.fragmentShader='precision mediump float;\n'+expandChunks(shader.fragmentShader)
   .replace(/\b(varying|uniform)\s+(float|vec[234]|mat[234])/g,'$1 highp $2');
 };
 material.customProgramCacheKey=()=>key+'/bounded-lighting-v1';
 material.needsUpdate=true;prepared.add(material);
}

export function prepareLighting(root:THREE.Object3D){
 root.traverse(object=>{
  const material=(object as THREE.Mesh).material;
  if(material)for(const item of Array.isArray(material)?material:[material])prepareLightingMaterial(item);
 });
}
