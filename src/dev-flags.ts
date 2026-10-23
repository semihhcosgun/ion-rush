type ViteImportMeta=ImportMeta&{env?:{DEV?:boolean;VITE_ION_SUPPORT_TEST?:string}};
export function andromedaPreviewMode(){return (import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('andromeda')==='1';}
export function meteorPreviewMode(){return (import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('meteor')==='1';}
export function shipPreviewMode(){return (import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('ship')==='1';}

/** Local-only tooling for repeatable marketing captures. Production builds always return false. */
export function marketingCaptureMode(){
  return (import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('capture')==='1';
}

/** Opens a local run shortly before its first rift for visual QA. */
export function riftPreviewMode():'blue'|'violet'|'black'|undefined{
  if((import.meta as ViteImportMeta).env?.DEV!==true||typeof location==='undefined')return undefined;
  const value=new URLSearchParams(location.search).get('rift');
  return value==='blue'||value==='violet'||value==='black'?value:value==='1'?'blue':undefined;
}

export function sfPreviewMode(){return (import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('sf')==='1';}

export function ascentPreviewMode(){return (import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('ascent')==='1';}

/** Opens the local build directly on the NOVA recovery screen. */
export function revivePreviewMode(){return (import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('revive')==='1';}

export function supportPreviewMode(){if((import.meta as ViteImportMeta).env?.VITE_ION_SUPPORT_TEST==='9800')return 'locked';if((import.meta as ViteImportMeta).env?.DEV!==true||typeof location==='undefined')return undefined;const mode=new URLSearchParams(location.search).get('support');return mode==='ready'||mode==='charging'||mode==='locked'?mode:undefined;}
