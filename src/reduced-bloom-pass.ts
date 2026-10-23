import {Vector2} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Keep bloom in HDR, but use one quarter of the usual intermediate pixels.
 * The scene and final antialiasing retain their full rendering resolution.
 */
export class ReducedBloomPass extends UnrealBloomPass {
  constructor(resolution:Vector2,strength:number,radius:number,threshold:number){
    super(resolution.clone().multiplyScalar(.5),strength,radius,threshold);
    for(const target of [this.renderTargetBright,...this.renderTargetsHorizontal,...this.renderTargetsVertical]){
      target.depthBuffer=false;
      target.stencilBuffer=false;
    }
    this.setSize(resolution.x,resolution.y);
  }
  override setSize(width:number,height:number){
    // Composer supplies drawing-buffer dimensions, including pixel density.
    // Tiny/collapsed viewports must still allocate valid textures at every mip.
    super.setSize(Math.max(2,Math.floor(width*.5)),Math.max(2,Math.floor(height*.5)));
  }
}
