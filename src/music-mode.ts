import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {SFX_DURATION,type SfxKind,synthEffect} from './sfx-bank';

export interface MusicModeNative {
 configure(options:{enabled:boolean}):Promise<void>;
 play(options:{kind:string;volume:number;musicMode:boolean}):Promise<void>;
 engine(options:{running:boolean;volume:number;rate:number;music:boolean;menu?:boolean;menuTrack?:string}):Promise<void>;
 stop():Promise<void>;
 getStatus():Promise<ExternalMusicStatus>;
 addListener(event:'externalMusicChanged',listener:(status:ExternalMusicStatus)=>void):Promise<PluginListenerHandle>;
}
export const nativeMusicAudio=registerPlugin<MusicModeNative>('IonMusicAudio');
export const usesNativeMusicAudio=()=>Capacitor.isNativePlatform();
export function cleanAudioSettings(value:{musicMode?:unknown;effectsVolume?:unknown;musicSuggestions?:unknown}){
 // Persist the offer preference. Activating the mode needs a fresh user choice.
 return {musicMode:false,musicSuggestions:value.musicSuggestions!==false,effectsVolume:typeof value.effectsVolume==='number'&&Number.isFinite(value.effectsVolume)?Math.max(0,Math.min(1,value.effectsVolume)):.65};
}
export const musicOfferEligible=(settings:{musicSuggestions?:boolean;musicMode?:boolean},playing:boolean)=>settings.musicSuggestions!==false&&playing;
const critical=new Set(['hit','meteorWarning','incoming','denied','weaponJammed','shieldHit','shieldExpired','supportBlocked']);
export function musicModeGain(kind:string,volume:number){return volume*(critical.has(kind)?1:kind==='uiClick'?.55:kind==='shot'?.78:kind==='enemyShot'?.85:.82);}
export function musicModeDuration(kind:SfxKind){
 if(critical.has(kind)||kind==='lessonComplete'||kind==='supportReady')return SFX_DURATION[kind];
 return Math.min(SFX_DURATION[kind],kind==='supportCalled'?.8:kind==='meteorImpact'?.35:kind==='kill'||kind==='revive'?.28:.18);
}
export function musicModeSamples(kind:SfxKind,rate:number,variation=0){
 const original=synthEffect(kind,rate,variation),length=Math.ceil(musicModeDuration(kind)*rate),data=original.slice(0,length);
 if(length<original.length){const fade=Math.min(Math.round(rate*.018),length);for(let i=length-fade;i<length;i++)data[i]*=(length-1-i)/fade;}
 return data;
}

export type ExternalMusicStatus={supported:boolean;playing:boolean};
export interface ExternalMusicPlugin {getStatus():Promise<ExternalMusicStatus>;addListener(event:'externalMusicChanged',listener:(status:ExternalMusicStatus)=>void):Promise<PluginListenerHandle>;}
// Detection only offers the switch. It never changes the audio preference.
export class ExternalMusicMonitor {
 private listener?:PluginListenerHandle;private revision=0;private stopped=false;
 constructor(private changed:(status:ExternalMusicStatus)=>void,private plugin:ExternalMusicPlugin=nativeMusicAudio){}
 async start(){
  try{const listener=await this.plugin.addListener('externalMusicChanged',status=>{this.revision++;this.accept(status);});if(this.stopped){await listener.remove();return;}this.listener=listener;}catch{}
  await this.refresh();
 }
 async refresh(){if(this.stopped)return;const revision=++this.revision;try{const status=await this.plugin.getStatus();if(revision===this.revision)this.accept(status);}catch{}}
 private accept(status:ExternalMusicStatus){if(!this.stopped&&typeof status?.playing==='boolean'&&typeof status.supported==='boolean')this.changed(status);}
 async stop(){this.stopped=true;this.revision++;await this.listener?.remove();}
}
export function monitorExternalMusic(changed:(status:ExternalMusicStatus)=>void){if(!Capacitor.isNativePlatform())return;const monitor=new ExternalMusicMonitor(changed);void monitor.start();return monitor;}
export const musicModeSwitchVisible=(detected:boolean,enabled:boolean,supported:boolean)=>detected||enabled||!supported;

export const MUSIC_OFFER_DURATION_MS=8000;
// Dismissal belongs to this run, never to the persistent settings preference.
export class MusicOfferSession {
 private deadline?:number;
 private dismissed=false;
 remaining(screen:string,eligible:boolean,now:number){
  if(this.dismissed)return 0;
  if(this.deadline!==undefined&&now>=this.deadline){this.dismiss();return 0;}
  if(screen!=='race'||!eligible)return 0;
  this.deadline??=now+MUSIC_OFFER_DURATION_MS;
  return this.deadline-now;
 }
 dismiss(){this.dismissed=true;}
 beginRun(){this.reset();}
 reset(){this.deadline=undefined;this.dismissed=false;}
}
