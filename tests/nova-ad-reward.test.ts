import {test} from 'node:test';
import assert from 'node:assert/strict';
import {novaAdQuota,earnNovaAd} from '../src/nova-ad-reward';
test('three rewards survive reopening and reset on the next UTC day',()=>{
  const now=new Date('2026-09-15T12:00:00Z');
  let quota=novaAdQuota(undefined,now);
  for(let i=0;i<3;i++)quota=earnNovaAd(JSON.parse(JSON.stringify(quota)),now)!;
  assert.equal(earnNovaAd(quota,now),null);
  assert.equal(novaAdQuota(quota,new Date('2026-09-16T00:00:00Z')).used,0);
  assert.equal(earnNovaAd(quota,new Date('2026-09-14T12:00:00Z')),null);
});
