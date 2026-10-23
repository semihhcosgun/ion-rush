/** Keep paid-grant polling frequent without repeating identical server lookups. */
export function createRefundLookup<T>(lookup:(ids:string[])=>Promise<{configured:boolean;revocations:T[]}>,now=Date.now){
  let cached:{key:string;expiresAt:number;records:T[]}|undefined;
  return async(knownIds:string[]):Promise<T[]>=>{
    const ids=[...new Set(knownIds.filter(id=>/^[a-f0-9]{64}$/.test(id)))].sort();
    if(!ids.length)return [];
    const key=JSON.stringify(ids);
    if(cached?.key===key&&cached.expiresAt>now())return [...cached.records];
    const records:T[]=[];
    for(let offset=0;offset<ids.length;offset+=200){
      const result=await lookup(ids.slice(offset,offset+200));
      if(!result.configured)return [];
      records.push(...result.revocations);
    }
    // Never cache unavailable/partial results. A new purchase ID bypasses the cache.
    cached={key,expiresAt:now()+300000,records};
    return [...records];
  };
}
