import {PlaneGeometry} from 'three';
/** Far panels keep the exact top face of the near box, omitting its unseen thickness. */
export function distantRoadGeometry(){
 const geometry=new PlaneGeometry(1,1);
 geometry.rotateX(-Math.PI/2);geometry.translate(0,.5,0);
 return geometry;
}
