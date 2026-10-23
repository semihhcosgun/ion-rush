import type {BufferAttribute} from 'three';

/** Packed dynamic pools rewrite their live prefix each frame; unused capacity is not drawn. */
export function uploadLivePrefix(attribute:BufferAttribute,items:number){
 if(items<=0)return;
 attribute.clearUpdateRanges();
 attribute.addUpdateRange(0,items*attribute.itemSize);
 attribute.needsUpdate=true;
}
