import * as THREE from 'three';
import {pathAt,tangentAt} from './path';
import {TUNE} from './config';
import type {Enemy} from './combat';
const forward=new THREE.Vector3(0,0,-1),axis=new THREE.Vector3(0,0,1);
// Synchronous scratch storage: callers still own every returned position.
const trackDirection=new THREE.Vector3(),trackRotation=new THREE.Quaternion(),surfaceRotation=new THREE.Quaternion();
export function trackPoint(z:number,surface:number,lane:number,height:number,out=new THREE.Vector3()){
 const p=pathAt(z),d=tangentAt(z);
 trackRotation.setFromUnitVectors(forward,trackDirection.set(d.x,d.y,-1).normalize()).multiply(surfaceRotation.setFromAxisAngle(axis,-surface*Math.PI/2));
 out.set(lane*TUNE.laneSpacing,height,0).applyQuaternion(trackRotation);
 out.x+=p.x;out.y+=p.y;out.z+=-z;return out;
}
function rawEnemyPose(e:Enemy){if(e.motion)return {lane:e.motion.lane,height:e.motion.height};const phase=e.age*.8+e.id;const flying=e.flight!=='level';return {lane:e.lane+(e.flight==='upperLeft'?-4:e.flight==='upperRight'?4:0)+(flying?Math.sin(phase)*.55:e.pursuing?Math.sin(phase)*.75:0),height:(e.flight==='high'?22:flying?15:7)+(flying?Math.sin(phase*.7)*1.2:e.pursuing?Math.sin(phase*.7)*.6:0)};}
export function enemyBasePoint(e:Enemy,out?:THREE.Vector3){const p=enemyPose(e);return trackPoint(e.z,e.pursuing?e.visualSurface:e.surface,p.lane,p.height,out);}
export function enemyPoint(e:Enemy,out?:THREE.Vector3){const p=enemyBasePoint(e,out);if(e.gravity?.id===e.id)p.add(e.gravity.offset);return p;}
export function enemyTrackZ(e:Enemy){return e.z-(e.gravity?.id===e.id?e.gravity.offset.z:0);}

/** Expanded circular keep-out zone encloses all four solid track faces and the whole hull. */
export const ENEMY_HULL_RADIUS=6;
export const ENEMY_TRACK_CLEARANCE=Math.SQRT2*4.1+ENEMY_HULL_RADIUS+1.5;
export function enemyPose(e:Enemy){if(e.training)return {lane:e.lane,height:7};const p=rawEnemyPose(e),x=p.lane*TUNE.laneSpacing;return {lane:p.lane,height:Math.max(p.height,Math.sqrt(Math.max(0,ENEMY_TRACK_CLEARANCE**2-x*x)))};}
