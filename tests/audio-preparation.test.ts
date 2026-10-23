import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Sound} from '../src/audio';
test('audio bank yields before synthesis and concurrent requests share one preparation',async t=>{
 const sound=new Sound();sound.musicEnabled=false;let buffers=0,decodes=0,fetches=0;
 t.mock.method(globalThis,'fetch',async()=>{fetches++;return new Response(new ArrayBuffer(4));});
 sound.context={sampleRate:8000,decodeAudioData:async()=>{decodes++;return {duration:.245};},createBuffer:(_channels:number,length:number)=>{buffers++;return {copyToChannel:(samples:Float32Array)=>assert.equal(samples.length,length)};}} as unknown as AudioContext;
 const ready=sound.prepare();assert.equal(buffers,0);assert.equal(sound.prepare(),ready);
 await ready;assert.ok(buffers>0);const total=buffers;
 await sound.prepare();assert.equal(buffers,total);
 assert.equal(fetches,1);assert.equal(decodes,1,'Approved effect is decoded only once');
 await sound.setMusicMode(true);assert.equal(decodes,1,'Mode changes reuse the intact effect');
});
