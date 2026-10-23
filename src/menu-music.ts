export const DEFAULT_MENU_TRACK='ion-heart' as const;
export const MENU_TRACK_VERSION=1 as const;
export const MENU_TRACKS = [
 {id:'ion-heart',title:'ION HEART',url:'/audio/ion-menu-ion-heart.wav'},
 {id:'before-the-jump',title:'Before the Jump',url:'/audio/ion-menu-loop.wav'},
 {id:'afterglow-station',title:'Afterglow Station',url:'/audio/ion-menu-afterglow.wav'},
] as const;
export type MenuTrackId = typeof MENU_TRACKS[number]['id'];
export function cleanMenuTrack(value:unknown):MenuTrackId{return MENU_TRACKS.some(track=>track.id===value)?value as MenuTrackId:DEFAULT_MENU_TRACK;}
/** Replace the previous default once; later explicit legacy selections still persist. */
export function restoreMenuTrack(value:unknown,version:unknown):MenuTrackId{return version!==MENU_TRACK_VERSION&&value==='before-the-jump'?DEFAULT_MENU_TRACK:cleanMenuTrack(value);}
export function menuTrackUrl(value:MenuTrackId){return MENU_TRACKS.find(track=>track.id===value)!.url;}
