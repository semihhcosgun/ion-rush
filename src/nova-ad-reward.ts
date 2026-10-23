export interface NovaAdQuota {day:string;used:number}
export const NOVA_AD_LIMIT=3;
export function novaAdQuota(value:NovaAdQuota|undefined,now=new Date()):NovaAdQuota{
  const day=now.toISOString().slice(0,10);
  // A backwards clock change must not restore spent rewards.
  if(value&&value.day>=day)return {day:value.day,used:Math.min(NOVA_AD_LIMIT,Math.max(0,Math.floor(value.used)||0))};
  return {day,used:0};
}
export function earnNovaAd(value:NovaAdQuota|undefined,now=new Date()):NovaAdQuota|null{
  const quota=novaAdQuota(value,now);
  return quota.used<NOVA_AD_LIMIT?{...quota,used:quota.used+1}:null;
}
