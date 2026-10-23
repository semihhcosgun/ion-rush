export const NOVA_ARTWORK=[
 '/textures/nova-store-pilot-v3.png',
 '/textures/nova-store-core.png',
 '/textures/nova-pack-reactor.png',
 '/textures/nova-pack-vault.png',
] as const;
export class NovaArtwork {
 private images=new Map<string,HTMLImageElement>();
 private pending?:Promise<void>;
 constructor(private createImage:()=>HTMLImageElement=()=>new Image()){}
 prepare(){
  if(this.pending)return this.pending;
  const missing=NOVA_ARTWORK.filter(url=>!this.images.has(url));
  if(!missing.length)return Promise.resolve();
  this.pending=Promise.allSettled(missing.map(async url=>{
   const image=this.createImage();image.loading='eager';image.decoding='sync';image.fetchPriority='low';image.src=url;
   await image.decode();this.images.set(url,image);
  })).then(results=>{
   const failed=results.find(result=>result.status==='rejected');
   if(failed?.status==='rejected')throw failed.reason;
  }).finally(()=>{this.pending=undefined;});
  return this.pending;
 }
}
// Keep decoded artwork alive between visits instead of decoding again on entry.
export const novaArtwork=new NovaArtwork();
