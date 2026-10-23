import {Capacitor} from '@capacitor/core';
import {en} from './locales/en';
import {catalogs,resolveLocale,type Locale} from './locales';
import {iosCatalogs} from './locales/ios';

export {resolveLocale};
export type {Locale};
export type TranslationKey=keyof typeof en;

let activeLocale:Locale='en';
const localeListeners=new Set<()=>void>();
export function onLocaleChange(listener:()=>void){localeListeners.add(listener);return ()=>localeListeners.delete(listener);}

export const supportedLocales=(Object.keys(catalogs) as Locale[]).map(id=>({id,label:catalogs[id]['language.name']}));
export function setLocale(locale:string){activeLocale=resolveLocale(locale);for(const listener of localeListeners)listener();if(typeof document!=='undefined'){document.documentElement.lang=activeLocale;document.querySelector('#world')?.setAttribute('aria-label',t('canvas.label'));const title=document.querySelector('#rotate-title'),body=document.querySelector('#rotate-body');if(title)title.textContent=t('rotate.title');if(body)body.textContent=t('rotate.body');}}
export function upper(text:string){return text.toLocaleUpperCase(activeLocale);}
export function getLocale(){return activeLocale;}
export function t(key:TranslationKey,values:Record<string,string|number>={}){
  const catalog=catalogs[activeLocale] as Record<TranslationKey,string>;
  const iosCopy=Capacitor.getPlatform()==='ios'?iosCatalogs[activeLocale][key]:undefined;
  return (iosCopy??catalog[key]??en[key]).replace(/\{(\w+)\}/g,(_,name:string)=>String(values[name]??`{${name}}`));
}
export function formatNumber(value:number){return Math.floor(value).toLocaleString(activeLocale==='en'?'en-US':activeLocale);}
export function routeText(id:string,field:'name'|'label'|'subtitle'|'description'|'difficulty'){
  return t(`route.${id}.${field}` as TranslationKey);
}
export function goalText(id:string){return t(`goal.${id}` as TranslationKey);}
export function enemyText(id:string){return t(`enemy.${id}` as TranslationKey);}
export function obstacleText(id:string){return t(`obstacle.${id}` as TranslationKey);}
export function pilotTitleText(energy:number){return t(energy>=150?'pilot.star':energy>=60?'pilot.moon':energy>=20?'pilot.orbit':'pilot.rookie');}

