import {Capacitor} from '@capacitor/core';
import {SFX_DURATION,type SfxKind} from './sfx-bank';

/** Approved recordings are preloaded intact, including in external-music mode. */
export const SFX_ASSETS={weaponJammed:'/audio/game-effects/weaponJammed.wav'} as const;
export type AssetSfxKind=keyof typeof SFX_ASSETS;
export type SoundEffectKind=SfxKind|AssetSfxKind;
export const isSoundEffect=(kind:string)=>Object.hasOwn(SFX_DURATION,kind)||Object.hasOwn(SFX_ASSETS,kind);
export async function loadSoundAsset(ctx:AudioContext,kind:AssetSfxKind){
 const response=await fetch(SFX_ASSETS[kind]);
 const nativeMedia=response.status===0&&Capacitor.getPlatform()==='ios';
 if(!response.ok&&!nativeMedia)throw new Error(`Sound effect ${kind} unavailable (${response.status})`);
 return ctx.decodeAudioData(await response.arrayBuffer());
}
