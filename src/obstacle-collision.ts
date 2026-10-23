import {Matrix3,Matrix4,Quaternion,Sphere,Vector3} from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {TUNE} from './config';
import {pathAt,tangentAt} from './path';
import {OBSTACLE,armAngle,blockPosition,laserActive,riderRadius,shutterPosition} from './obstacle-shapes';
import type {Gate} from './game';

export interface RiderPose {z:number;angle:number;laneX:number;time:number;}
const forward=new Vector3(0,0,-1),axis=new Vector3(0,0,1);
const direction=new Vector3(),position=new Vector3(),rotation=new Quaternion(),roll=new Quaternion();
const matrix=new Matrix4(),basis=new Matrix3(),localRotation=new Quaternion(),localMatrix=new Matrix4();
const riderFrame=new Matrix4(),faceFrame=new Matrix4();
const bike=new OBB(),pilot=new OBB(),contact=new OBB(),hazard=new OBB(),mine=new Sphere();

function roadFrame(z:number,angle:number,out:Matrix4){
  const p=pathAt(z),d=tangentAt(z);
  rotation.setFromUnitVectors(forward,direction.set(d.x,d.y,-1).normalize()).multiply(roll.setFromAxisAngle(axis,-angle));
  return out.makeRotationFromQuaternion(rotation).setPosition(p.x,p.y,-z);
}
function box(out:OBB,frame:Matrix4,x:number,y:number,z:number,width:number,height:number,depth:number,angle=0){
  // Separate lower hull and helmet/torso bounds avoid an oversized rectangle
  // around empty space beside the rider. Decorative scarf/antenna aren't solid.
  out.center.set(x,y,z).applyMatrix4(frame);
  localMatrix.makeRotationFromQuaternion(localRotation.setFromAxisAngle(axis,angle));
  matrix.copy(frame).multiply(localMatrix);basis.setFromMatrix4(matrix);
  out.rotation.copy(basis);out.halfSize.set(width/2,height/2,depth/2);
}
function touches(x:number,y:number,z:number,width:number,height:number,depth:number,angle=0){
  box(hazard,faceFrame,x,y,z,width,height,depth,angle);
  return bike.intersectsOBB(hazard)||pilot.intersectsOBB(hazard);
}

/** Tests the same road frame, surface angle and lane position drawn on screen. */
export function gateIntersectsRider(g:Gate,z:number,angle:number,laneX:number,time:number){
  roadFrame(z,angle,riderFrame);
  position.set(laneX*TUNE.laneSpacing,riderRadius(angle),0).applyMatrix4(riderFrame);
  riderFrame.setPosition(position);
  // Bounds sit slightly inside the 1.28-scale VESPER/NOVA silhouette.
  box(bike,riderFrame,0,.78,-.04,1.2,1.5,4.35);
  box(pilot,riderFrame,0,2.05,.10,.72,1.06,.85);
  for(const surface of g.blocked){
    roadFrame(g.z,surface*Math.PI/2,faceFrame);
    const scale=g.lane===undefined?1:OBSTACLE.barrier.narrowScale;
    const lane=(g.lane??0)*TUNE.laneSpacing;
    if(g.kind==='gap'){
      // A hole tests support beneath the bike, rather than a solid wall reaching
      // out to its front/rear wheel. Stay airborne when rounding a corner.
      box(contact,riderFrame,0,.05,0,.22,.1,.1);
      box(hazard,faceFrame,lane,4.3,0,OBSTACLE.gap.width*scale,.4,OBSTACLE.gap.depth);
      if(contact.intersectsOBB(hazard))return true;
    }else if(g.kind==='mines'){
      for(const side of [-1,1]){
        mine.center.set(lane+side*OBSTACLE.mines.x*scale,OBSTACLE.mines.y,0).applyMatrix4(faceFrame);
        mine.radius=OBSTACLE.mines.radius;
        if(bike.intersectsSphere(mine)||pilot.intersectsSphere(mine))return true;
      }
    }else if(g.kind==='block'){
      const b=OBSTACLE.block;
      if(touches(lane+blockPosition(time,g.phase)*scale,b.y,0,b.width*scale,b.height,b.depth))return true;
    }else if(g.kind==='arm'){
      const a=OBSTACLE.arm,theta=armAngle(time,g.phase);
      // The bar rotates about its left pivot, not about the centre lane.
      if(touches(lane+(a.pivotX+Math.cos(theta)*a.length/2)*scale,a.pivotY+Math.sin(theta)*a.length/2,0,a.length*scale,a.height,a.depth,theta))return true;
    }else if(g.kind==='shutter'){
      const s=OBSTACLE.shutter;
      if(touches(lane,shutterPosition(time,g.phase),0,s.width*scale,s.height,s.depth))return true;
    }else if(g.kind==='laser'){
      if(laserActive(time,g.phase)){const l=OBSTACLE.laser;for(let beam=0;beam<3;beam++)if(touches(lane,l.y+beam*l.spacing,0,l.width*scale,l.height,l.depth))return true;}
    }else{
      const b=OBSTACLE.barrier;
      if(touches(lane,b.y,0,b.width*scale,b.height,b.depth)||touches(lane,5.7,0,6.3*scale,.13,1))return true;
    }
  }
  return false;
}

/** Conservative broad phase only; it never directly causes damage. */
export function gateContactReach(g:Gate){return g.kind==='gap'?OBSTACLE.gap.depth/2+.6:g.kind==='mines'?2.8+.6:2.8+.75+.6;}

/** Sample the travelled interval so a fast step can't skip a thin obstacle. */
export function obstacleContact(g:Gate,from:RiderPose,to:RiderPose){
  const reach=gateContactReach(g),travel=to.z-from.z;
  if(to.z<g.z-reach||from.z>g.z+reach)return false;
  const start=travel>0?Math.max(0,(g.z-reach-from.z)/travel):0;
  const end=travel>0?Math.min(1,(g.z+reach-from.z)/travel):1;
  const samples=Math.max(1,Math.ceil((end-start)*Math.max(Math.abs(travel)/.35,Math.abs(to.angle-from.angle)/.04,Math.abs(to.laneX-from.laneX)/.08,(to.time-from.time)*120)));
  for(let i=0;i<=samples;i++){
    const t=start+(end-start)*i/samples;
    if(gateIntersectsRider(g,from.z+travel*t,from.angle+(to.angle-from.angle)*t,from.laneX+(to.laneX-from.laneX)*t,from.time+(to.time-from.time)*t))return true;
  }
  return false;
}

// Existing callers use this to ask about a settled face/lane at the gate.
export function isDangerous(g:Gate,surface:number,time:number,laneX=0){return g.blocked.includes(surface)&&gateIntersectsRider(g,g.z,surface*Math.PI/2,laneX,time);}
