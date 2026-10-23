import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {NovaArtwork,NOVA_ARTWORK} from '../src/nova-artwork';
test('all artwork is decoded before readiness and concurrent visits share preparation',async()=>{
 const images:{src:string;loading:string;decoding:string;fetchPriority:string;finish:()=>void}[]=[];
 const artwork=new NovaArtwork(()=>{
  let finish!:()=>void;const decoded=new Promise<void>(resolve=>finish=resolve);
  const image={src:'',loading:'',decoding:'',fetchPriority:'',finish,decode:()=>decoded};images.push(image);return image as unknown as HTMLImageElement;
 });
 const first=artwork.prepare(),second=artwork.prepare();assert.equal(first,second);assert.equal(images.length,4);
 let ready=false;void first.then(()=>ready=true);
 for(const image of images.slice(0,3))image.finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,false);
 images[3].finish();await first;assert.equal(ready,true);await artwork.prepare();assert.equal(images.length,4);
 assert.deepEqual(images.map(i=>i.src),NOVA_ARTWORK);assert.ok(images.every(i=>i.decoding==='sync'&&i.loading==='eager'));
});
test('a failed asset can retry without discarding decoded pictures or duplicating pending work',async()=>{
 let count=0,failed=false;
 const artwork=new NovaArtwork(()=>({decode:async()=>{count++;if(count===2&&!failed){failed=true;throw new Error('decode interrupted');}}}) as HTMLImageElement);
 await assert.rejects(artwork.prepare(),/decode interrupted/);assert.equal(count,4);
 await artwork.prepare();assert.equal(count,5);await artwork.prepare();assert.equal(count,5);
});
test('every predecoded store asset is packaged locally for offline entry',()=>{
 for(const url of NOVA_ARTWORK)assert.equal(existsSync(new URL('../public'+url,import.meta.url)),true,url);
});
