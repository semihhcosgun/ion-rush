import {Capacitor,registerPlugin} from '@capacitor/core';

export interface RewardedAdStatus {ready:boolean;configured:boolean;privacyOptionsRequired?:boolean;reason?:string;}
export interface RewardedAdResult {rewarded:boolean;reason?:string;}
interface IonRewardedAdsPlugin {
  initialize():Promise<RewardedAdStatus>;
  status():Promise<RewardedAdStatus>;
  show():Promise<RewardedAdResult>;
  showPrivacyOptions():Promise<{shown:boolean}>;
}

const nativeAds=registerPlugin<IonRewardedAdsPlugin>('IonRewardedAds');
type ViteImportMeta=ImportMeta&{env?:{DEV?:boolean}};
const mockMode=()=>(import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('revive')==='1';
let current:RewardedAdStatus={ready:mockMode(),configured:mockMode(),reason:mockMode()?'local_preview':'web'};

export const rewardedAds={
  get current(){return current;},
  async initialize(){
    if(mockMode()){current={ready:true,configured:true,reason:'local_preview'};return current;}
    if(!Capacitor.isPluginAvailable('IonRewardedAds'))return current;
    try{current=await nativeAds.initialize();}catch{current={ready:false,configured:false,reason:'initialization_failed'};}
    return current;
  },
  async refresh(){
    if(mockMode())return current;
    if(!Capacitor.isPluginAvailable('IonRewardedAds'))return current;
    try{current=await nativeAds.status();}catch{current={ready:false,configured:false,reason:'status_failed'};}
    return current;
  },
  async show():Promise<RewardedAdResult>{
    if(mockMode()){await new Promise(resolve=>setTimeout(resolve,700));return {rewarded:true,reason:'local_preview'};}
    if(!Capacitor.isPluginAvailable('IonRewardedAds'))return {rewarded:false,reason:'web'};
    try{const result=await nativeAds.show();current.ready=false;return result;}catch{return {rewarded:false,reason:'show_failed'};}
  },
  async showPrivacyOptions(){
    if(!Capacitor.isPluginAvailable('IonRewardedAds'))return false;
    try{return (await nativeAds.showPrivacyOptions()).shown;}catch{return false;}
  }
};
