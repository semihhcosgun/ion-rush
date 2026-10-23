import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {Telemetry,telemetryStore,type NativeTelemetry} from '../src/telemetry';

function harness(context: TestContext, status: {configured:boolean;testBuild:boolean;qaUpload:boolean}, platform='ios') {
  telemetryStore.removeItem('ion-telemetry-consent-v1');
  telemetryStore.removeItem('ion-telemetry-queue-v1');
  context.after(()=>{telemetryStore.removeItem('ion-telemetry-consent-v1');telemetryStore.removeItem('ion-telemetry-queue-v1');});
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{value:{addEventListener(){}},configurable:true});
  context.after(()=>{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');});
  context.mock.method(globalThis,'setInterval',()=>0 as unknown as ReturnType<typeof setInterval>);
  const enabled:boolean[]=[],events:{name:string;params:Record<string,string|number>}[]=[],errors:unknown[]=[];
  const native:NativeTelemetry={status:async()=>status,setEnabled:async v=>{enabled.push(v.enabled);},logEvent:async e=>{events.push(e);},recordError:async e=>{errors.push(e);}};
  const telemetry=new Telemetry(native,()=>platform);telemetry.choice=null;
  return {telemetry,enabled,events,errors};
}
test('production defaults on without saving a fake opt-in; disabling stops events and errors',async context=>{
  const h=harness(context,{configured:true,testBuild:false,qaUpload:false});
  await h.telemetry.init();assert.deepEqual(h.enabled,[true]);assert.equal(telemetryStore.getItem('ion-telemetry-consent-v1'),null);
  h.telemetry.emit('run_start',{run_id:'ios-test'});await h.telemetry.flush();
  assert.equal(h.events.length,1);assert.equal(h.events[0].params.is_test,0);assert.equal(h.events[0].params.app_version,'0.54.0');
  await h.telemetry.setChoice(false);h.telemetry.emit('run_end');h.telemetry.error('javascript_error',new Error('private message'));await h.telemetry.flush();
  assert.equal(h.events.length,1);assert.equal(h.errors.length,0);assert.equal(h.enabled.at(-1),false);
});
test('iOS simulator/debug builds expose a local inspector without upload',async context=>{
  const h=harness(context,{configured:false,testBuild:true,qaUpload:false});await h.telemetry.init();
  assert.equal(h.telemetry.available,false);
  await h.telemetry.setChoice(true);h.telemetry.emit('run_start');await h.telemetry.flush();
  const inspector=(window as unknown as {ionTelemetry:{events():{params:{is_test:number}}[]}}).ionTelemetry;
  assert.equal(inspector.events().length,1);assert.equal(inspector.events()[0].params.is_test,1);assert.equal(h.events.length,0);
});
test('explicit iOS QA builds upload test-tagged events only after consent',async context=>{
  const h=harness(context,{configured:true,testBuild:true,qaUpload:true});await h.telemetry.init();
  assert.equal(h.telemetry.enabled,false);h.telemetry.emit('turbo_used');await h.telemetry.flush();assert.equal(h.events.length,0);
  await h.telemetry.setChoice(true);h.telemetry.emit('run_start');await h.telemetry.flush();assert.equal(h.events.length,1);assert.equal(h.events[0].params.is_test,1);
});
test('Android continues to use the same bridge and browser builds do not call native status',async context=>{
  const h=harness(context,{configured:true,testBuild:false,qaUpload:false},'android');await h.telemetry.init();
  await h.telemetry.setChoice(true);h.telemetry.emit('run_start');await h.telemetry.flush();assert.equal(h.events.length,1);
  const web=new Telemetry({status:async()=>{throw new Error('must not call native');},setEnabled:async()=>{},logEvent:async()=>{},recordError:async()=>{}},()=> 'web');
  await web.init();assert.equal(web.available,false);
});

for(const platform of ['ios','android'])test(`${platform} restores explicit refusal on restart and supports re-enabling`,async context=>{
  const h=harness(context,{configured:true,testBuild:false,qaUpload:false},platform);
  await h.telemetry.setChoice(false);
  const calls:boolean[]=[],sent:unknown[]=[];
  const restored=new Telemetry({status:async()=>({configured:true,testBuild:false,qaUpload:false}),setEnabled:async v=>{calls.push(v.enabled);},logEvent:async e=>{sent.push(e);},recordError:async()=>{}},()=>platform);
  await restored.init();assert.equal(restored.choice,'no');assert.equal(restored.enabled,false);assert.deepEqual(calls,[false]);
  restored.emit('run_start');await restored.flush();assert.equal(sent.length,0);
  await restored.setChoice(true);restored.emit('run_start');await restored.flush();assert.equal(sent.length,1);
});
test('unknown saved preference fails closed instead of enabling collection',async context=>{
  const h=harness(context,{configured:true,testBuild:false,qaUpload:false});h.telemetry.choice='invalid';await h.telemetry.init();assert.equal(h.telemetry.enabled,false);assert.deepEqual(h.enabled,[false]);
});
