import {MeshStandardMaterial,ShaderChunk} from 'three';

/** Same texture and UV transform: reuse the exact center sample, retaining both derivatives. */
export function shareBumpSample(material:MeshStandardMaterial){
 if(!material.map||material.map!==material.bumpMap||'isVideoTexture' in material.map)return false;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 const pars=ShaderChunk.bumpmap_pars_fragment
  .replace('vec2 dHdxy_fwd()', 'vec2 dHdxy_fwd(float centerHeight)')
  .replace('bumpScale * texture2D( bumpMap, vBumpMapUv ).x','bumpScale * centerHeight');
 const normal=ShaderChunk.normal_fragment_maps.replace('dHdxy_fwd()', 'dHdxy_fwd(sampledDiffuseColor.r)');
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',pars).replace('#include <normal_fragment_maps>',normal);
 };
 material.customProgramCacheKey=()=>`${key}/shared-bump-center-v1`;
 return true;
}

