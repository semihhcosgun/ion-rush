import {Group} from 'three';

/** Hidden pooled models keep their buffers but skip descendant matrix work.
 * Force a refresh on reappearance, including when the parent moved while hidden. */
export class VisibleModelGroup extends Group {
 private sleeping=false;
 override updateMatrixWorld(force?:boolean){
  if(!this.visible){this.sleeping=true;return;}
  super.updateMatrixWorld(force||this.sleeping);this.sleeping=false;
 }
}
