import {contactShadow} from './art-direction';

/** Two triangles on the road, without a shadow-map render or texture sample. */
export class RiderShadow {
 readonly mesh=contactShadow();
 update(lift:number,groundPresent:boolean,angle=0){
  const height=Math.max(0,lift)*8;
  // The anchor rises with the rider; the shadow must stay on the road.
  this.mesh.position.y=-.13-height;
  this.mesh.scale.setScalar(1+Math.min(height,8)*.06);
  const aligned=1-Math.min(1,Math.abs(Math.sin(angle*2))/.45);
  this.mesh.material.uniforms.opacity.value=.38*Math.exp(-height*.35)*aligned;
  this.mesh.visible=groundPresent&&aligned>.01&&height<8;
 }
}
