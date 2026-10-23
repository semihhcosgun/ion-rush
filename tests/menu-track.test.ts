import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSave,writeSave} from '../src/storage';
import {cleanMenuTrack,restoreMenuTrack,MENU_TRACK_VERSION} from '../src/menu-music';

test('menu selection migrates old saves, rejects unknown tracks and survives save/read without changing music mute',async t=>{
 let value:string|null=JSON.stringify({music:false,journey:{nova:8}});
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;}}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
 const save=await readSave();assert.equal(save.menuTrack,'ion-heart');assert.equal(save.music,false);
 save.menuTrack='afterglow-station';await writeSave(save);const restored=await readSave();assert.equal(restored.menuTrack,'afterglow-station');assert.equal(restored.music,false);assert.equal(restored.journey.nova,8);
 assert.equal(cleanMenuTrack('../../other.wav'),'ion-heart');assert.equal(cleanMenuTrack(null),'ion-heart');
 save.menuTrack='before-the-jump';await writeSave(save);assert.equal((await readSave()).menuTrack,'before-the-jump','Explicit old-track selection after migration must survive');
 value=JSON.stringify({...save,menuTrack:'unavailable'});assert.equal((await readSave()).menuTrack,'ion-heart');
});

test('ION HEART replaces the old default once while preserving alternatives and later explicit selections',()=>{
 assert.equal(restoreMenuTrack('before-the-jump',undefined),'ion-heart');
 assert.equal(restoreMenuTrack('afterglow-station',undefined),'afterglow-station');
 assert.equal(restoreMenuTrack('before-the-jump',MENU_TRACK_VERSION),'before-the-jump');
 assert.equal(restoreMenuTrack('ion-heart',MENU_TRACK_VERSION),'ion-heart');
 assert.equal(restoreMenuTrack(null,undefined),'ion-heart');
 assert.equal(restoreMenuTrack('../../external.wav',undefined),'ion-heart');
});
