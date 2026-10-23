import {Quaternion,Vector3} from 'three';
import {pathAt,tangentAt} from './path';

/** Bounded ring: a road sample is immutable and can be reused as the window advances. */
export class RoadFrameCache {
 private entries:Array<{segment:number;center:ReturnType<typeof pathAt>;rotation:Quaternion}|undefined>;
 private forward=new Vector3(0,0,-1);
 private direction=new Vector3();
 constructor(capacity:number){this.entries=new Array(capacity);}
 get(segment:number){
  const slot=((segment%this.entries.length)+this.entries.length)%this.entries.length;
  let entry=this.entries[slot];
  if(entry?.segment===segment)return entry;
  const z=segment*8,d=tangentAt(z);
  this.direction.set(d.x,d.y,-1).normalize();
  entry={segment,center:pathAt(z),rotation:new Quaternion().setFromUnitVectors(this.forward,this.direction)};
  this.entries[slot]=entry;return entry;
 }
}
