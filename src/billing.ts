import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {createRefundLookup} from './refund-lookup';

export const NOVA_PACKS=[
  {id:'example_nova_5',nova:5,tier:'spark' as const},
  {id:'example_nova_15',nova:15,tier:'reactor' as const},
  {id:'example_nova_40',nova:40,tier:'vault' as const},
] as const;

export type NovaProductId=(typeof NOVA_PACKS)[number]['id'];
export interface BillingProduct {id:NovaProductId;nova:number;price:string;available:boolean;}
export interface PurchaseClaim {id:string;productId:NovaProductId;nova:number;}
export interface BillingStatus {ready:boolean;configured:boolean;products:BillingProduct[];reason?:string;}
export interface PurchaseResult {purchased:boolean;pending?:boolean;reason?:string;}

interface IonBillingPlugin {
  initialize():Promise<BillingStatus>;
  products():Promise<BillingStatus>;
  purchase(options:{productId:NovaProductId}):Promise<PurchaseResult>;
  sync(options:{userInitiated:boolean}):Promise<{synced:boolean}>;
  addListener(eventName:'claimsChanged',callback:()=>void):Promise<PluginListenerHandle>;
  claims(options:{knownIds:string[]}):Promise<{claims:PurchaseClaim[]}>;
  completeClaims(options:{ids:string[]}):Promise<{completed:number}>;
  revocations(options:{knownIds:string[]}):Promise<{configured:boolean;revocations:PurchaseClaim[]}>;
}

const nativeBilling=registerPlugin<IonBillingPlugin>('IonBilling');
const androidRefundLookup=createRefundLookup<PurchaseClaim>(ids=>nativeBilling.revocations({knownIds:ids}));
type ViteImportMeta=ImportMeta&{env?:{DEV?:boolean}};
const previewMode=()=>(import.meta as ViteImportMeta).env?.DEV===true&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('store')==='1';
const previewPrices:Record<NovaProductId,string>={example_nova_5:'PLAY TEST',example_nova_15:'PLAY TEST',example_nova_40:'PLAY TEST'};
let mockClaims:PurchaseClaim[]=[];
const offlineProducts=():BillingProduct[]=>NOVA_PACKS.map(pack=>({id:pack.id,nova:pack.nova,price:previewMode()?previewPrices[pack.id]:'—',available:previewMode()}));
let current:BillingStatus={ready:previewMode(),configured:previewMode(),products:offlineProducts(),reason:previewMode()?'local_preview':'web'};

function normalize(status:BillingStatus):BillingStatus{
  const byId=new Map((status.products??[]).map(product=>[product.id,product]));
  return {...status,products:NOVA_PACKS.map(pack=>{
    const product=byId.get(pack.id);
    return {id:pack.id,nova:pack.nova,price:product?.price||'—',available:product?.available===true};
  })};
}

export const billing={
  get current(){return current;},
  async initialize(){
    if(previewMode()){current={ready:true,configured:true,products:offlineProducts(),reason:'local_preview'};return current;}
    if(!Capacitor.isPluginAvailable('IonBilling')){current={ready:false,configured:false,products:offlineProducts(),reason:'not_configured'};return current;}
    try{current=normalize(await nativeBilling.initialize());}catch{current={ready:false,configured:true,products:offlineProducts(),reason:'initialization_failed'};}
    return current;
  },
  async refresh(){
    if(previewMode()||!Capacitor.isPluginAvailable('IonBilling'))return current;
    try{current=normalize(await nativeBilling.products());}catch{current={...current,ready:false,reason:'refresh_failed'};}
    return current;
  },
  async purchase(productId:NovaProductId):Promise<PurchaseResult>{
    const pack=NOVA_PACKS.find(item=>item.id===productId);
    if(!pack)return {purchased:false,reason:'unknown_product'};
    if(previewMode()){
      await new Promise(resolve=>setTimeout(resolve,650));
      mockClaims.push({id:`preview-${productId}-${Date.now()}`,productId,nova:pack.nova});
      return {purchased:true,reason:'local_preview'};
    }
    if(!Capacitor.isPluginAvailable('IonBilling'))return {purchased:false,reason:'web'};
    try{return await nativeBilling.purchase({productId});}catch{return {purchased:false,reason:'purchase_failed'};}
  },
  async observeClaims(callback:()=>void){
    if(['android','ios'].includes(Capacitor.getPlatform())&&Capacitor.isPluginAvailable('IonBilling'))return nativeBilling.addListener('claimsChanged',callback);
  },
  async sync(userInitiated=false){
    if(previewMode()||!Capacitor.isPluginAvailable('IonBilling'))return false;
    try{return (await nativeBilling.sync({userInitiated})).synced;}catch{return false;}
  },
  async claims(knownIds:string[]=[]):Promise<PurchaseClaim[]>{
    if(previewMode())return [...mockClaims];
    if(!Capacitor.isPluginAvailable('IonBilling'))return [];
    return (await nativeBilling.claims({knownIds})).claims??[];
  },
  async revocations(knownIds:string[]):Promise<PurchaseClaim[]>{
    if(previewMode()||!['android','ios'].includes(Capacitor.getPlatform())||!Capacitor.isPluginAvailable('IonBilling'))return [];
    if(Capacitor.getPlatform()==='ios')return (await nativeBilling.revocations({knownIds})).revocations??[];
    // Android tokens use SHA-256 IDs. Chunking preserves old purchase history
    // without sending Apple transactions or truncating heavy buyers' history.
    return androidRefundLookup(knownIds);
  },
  async completeClaims(ids:string[]){
    if(previewMode()){const done=new Set(ids);mockClaims=mockClaims.filter(claim=>!done.has(claim.id));return;}
    if(!Capacitor.isPluginAvailable('IonBilling'))return;
    await nativeBilling.completeClaims({ids});
  }
};
