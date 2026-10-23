import test from 'node:test';
import assert from 'node:assert/strict';
import {Telemetry,telemetryStore} from '../src/telemetry';
const key='ion-telemetry-consent-v1';
test('default production preference does not overwrite saved refusal on either platform',async()=>{
 telemetryStore.removeItem(key);
 try{
  const fresh=new Telemetry();fresh.configured=true;fresh.testMode=false;
  assert.equal(fresh.enabled,true);assert.equal(telemetryStore.getItem(key),null);
  fresh.configured=false;await fresh.setChoice(false);
  const restored=new Telemetry();restored.configured=true;restored.testMode=false;
  assert.equal(restored.choice,'no');assert.equal(restored.enabled,false);
  restored.configured=false;await restored.setChoice(true);restored.configured=true;
  assert.equal(restored.enabled,true);assert.equal(telemetryStore.getItem(key),'yes');
 }finally{telemetryStore.removeItem(key);telemetryStore.removeItem('ion-telemetry-queue-v1');}
});
test('debug and QA telemetry do not inherit production default-on',()=>{
 const debug=new Telemetry();debug.choice=null;debug.configured=true;debug.testMode=true;
 assert.equal(debug.enabled,false);debug.qaUpload=true;assert.equal(debug.enabled,false);
 debug.choice='yes';assert.equal(debug.enabled,true);debug.qaUpload=false;assert.equal(debug.enabled,false);
});
