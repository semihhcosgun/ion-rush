import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyText,goalText,resolveLocale,routeText,supportedLocales,t,setLocale,upper,formatNumber} from '../src/i18n';
import {catalogs,type Locale} from '../src/locales';

test('English is the complete default locale and interpolation is deterministic',()=>{
  assert.deepEqual(supportedLocales,[{id:'en',label:'English'},{id:'tr',label:'Türkçe'},{id:'es',label:'Español'},{id:'pt-BR',label:'Português (Brasil)'},{id:'de',label:'Deutsch'},{id:'fr',label:'Français'}]);
  assert.equal(resolveLocale('en'),'en');
  assert.equal(resolveLocale('unsupported'),'en');
  assert.equal(routeText('earth','name'),'EARTH');
  assert.equal(goalText('clean'),'Clear 3 obstacles');
  assert.equal(enemyText('drone'),'RAIDER DRONE');
  assert.equal(t('event.hit',{health:2}),'IMPACT · 2 HEALTH LEFT');
});


import {en} from '../src/locales/en';
import {tr} from '../src/locales/tr';
import {ALIEN_KINDS,ALIEN_LORE,alienLore} from '../src/alien-catalog';

test('Turkish covers every message and preserves interpolation parameters',()=>{
 assert.deepEqual(Object.keys(tr).sort(),Object.keys(en).sort());
 for(const key of Object.keys(en) as (keyof typeof en)[]){assert.ok(tr[key].trim(),key);assert.deepEqual([...tr[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...en[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),key);}
});
test('Turkish switching covers grammar, numbers and alien lore; switching back restores English',()=>{
 try{setLocale('tr');assert.equal(resolveLocale('tr-TR'),'tr');assert.equal(routeText('earth','name'),'DÜNYA');assert.equal(t('event.hit',{health:2}),'DARBE · 2 CAN KALDI');assert.equal(upper('İlerisi için'),'İLERİSİ İÇİN');assert.equal(formatNumber(50000),'50.000');for(const kind of ALIEN_KINDS){const lore=alienLore(kind);assert.ok(lore.name&&lore.detail&&lore.counter);}assert.equal(alienLore('drone').role,'İzci');}finally{setLocale('en');}assert.equal(t('settings.title'),'SETTINGS');assert.equal(alienLore('drone').role,'Scout');
});

test('Every language covers all messages, HTML structure and interpolation parameters',()=>{
 const params=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
 const tags=(s:string)=>[...s.matchAll(/<\/?([a-z]+)\s*\/?\s*>/g)].map(m=>m[0].replace(/\s|\/$/g,''));
 for(const [locale,catalog] of Object.entries(catalogs)){
  assert.deepEqual(Object.keys(catalog).sort(),Object.keys(en).sort(),locale);
  for(const key of Object.keys(en) as (keyof typeof en)[]){
   assert.ok(catalog[key].trim(),`${locale}: ${key}`);
   assert.deepEqual(params(catalog[key]),params(en[key]),`${locale}: ${key}`);
   if(locale!=='tr')assert.deepEqual(tags(catalog[key]),tags(en[key]),`${locale}: ${key}`);
  }
 }

});

test('Device language tags and saved Brazilian Portuguese resolve to canonical supported locales',()=>{
 for(const [input,expected] of [['ES-mx','es'],['es_419','es'],['pt','pt-BR'],['PT_br','pt-BR'],['pt-BR','pt-BR'],['pt-PT','pt-BR'],['de-AT','de'],['fr-CA','fr'],[' tr_TR ','tr'],['constructor','en'],['__proto__','en'],['ja-JP','en']] as const)assert.equal(resolveLocale(input),expected,input);
 for(const value of [null,undefined,2,{},''])assert.equal(resolveLocale(value),'en');
});

test('New languages switch gameplay, number formatting and every alien archive entry',()=>{
 const expected:Record<'es'|'pt-BR'|'de'|'fr',{earth:string;settings:string;hit:string}>={
  es:{earth:'TIERRA',settings:'AJUSTES',hit:'IMPACTO · 2 DE VIDA RESTANTE'},
  'pt-BR':{earth:'TERRA',settings:'CONFIGURAÇÕES',hit:'IMPACTO · 2 DE VIDA RESTANTE'},
  de:{earth:'ERDE',settings:'EINSTELLUNGEN',hit:'TREFFER · 2 LP ÜBRIG'},
  fr:{earth:'TERRE',settings:'PARAMÈTRES',hit:'IMPACT · 2 PV RESTANTS'},
 };
 try{
  for(const [id,copy] of Object.entries(expected)){
   setLocale(id);assert.equal(routeText('earth','name'),copy.earth);assert.equal(t('settings.title'),copy.settings);assert.equal(t('event.hit',{health:2}),copy.hit);
   assert.equal(formatNumber(50000.9),new Intl.NumberFormat(id).format(50000));
   assert.equal(upper(catalogs[id as Locale]['lesson.skip']),catalogs[id as Locale]['lesson.skip'].toLocaleUpperCase(id));
   for(const kind of ALIEN_KINDS){const lore=alienLore(kind);for(const field of ['name','role','region','detail','counter','rarity'] as const)assert.ok(lore[field].trim(),`${id}: ${kind}.${field}`);assert.notEqual(lore.detail,ALIEN_LORE[kind].detail,`${id}: ${kind}`);assert.equal(lore.pattern,ALIEN_LORE[kind].pattern);}
  }
 }finally{setLocale('en');}
});

