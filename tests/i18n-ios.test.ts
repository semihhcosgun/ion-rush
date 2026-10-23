import test from 'node:test';
import assert from 'node:assert/strict';
import {Capacitor} from '@capacitor/core';
import {supportedLocales,setLocale,t} from '../src/i18n';
import {catalogs} from '../src/locales';
import {iosCatalogs} from '../src/locales/ios';

test('Every language covers the same iOS service messages',()=>{
 for(const [locale,catalog] of Object.entries(iosCatalogs)){
  assert.deepEqual(Object.keys(catalog).sort(),Object.keys(iosCatalogs.en).sort(),locale);
  for(const [key,value] of Object.entries(catalog))assert.ok(value.trim(),`${locale}: iOS ${key}`);
 }
});

test('iOS platform copy stays localized and does not show Android service instructions',()=>{
 const platform=Capacitor.getPlatform;
 try{
  Capacitor.getPlatform=()=> 'ios';
  for(const locale of supportedLocales){
   setLocale(locale.id);
   assert.equal(t('store.terms'),iosCatalogs[locale.id]['store.terms']);
   assert.doesNotMatch(t('store.networkError'),/Google Play/);
   assert.match(t('store.processing'),/APP STORE/);
   assert.match(t('reminder.android'),/iOS/);
   for(const key of ['reminder.off','reminder.allowSettings'] as const){
    assert.equal(t(key),iosCatalogs[locale.id][key]);
    assert.doesNotMatch(t(key),/Android/);
   }
   assert.match(t('settings.privacyControl'),/iPhone/);
   assert.equal(t('settings.title'),catalogs[locale.id]['settings.title']);
  }
  Capacitor.getPlatform=()=> 'android';
  for(const locale of supportedLocales){setLocale(locale.id);assert.equal(t('store.terms'),catalogs[locale.id]['store.terms']);}
 }finally{Capacitor.getPlatform=platform;setLocale('en');}
});
