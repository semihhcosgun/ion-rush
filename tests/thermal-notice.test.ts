import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptivePerformance} from '../src/adaptive-performance';
import {ThermalProtection} from '../src/thermal-protection';
import {PowerBudget} from '../src/power-budget';
import {ThermalNoticeSession,thermalBudget,budgetReduced} from '../src/thermal-notice';
import {catalogs} from '../src/locales';

test('actual thermal reductions include effects, resolution and frame pacing',()=>{
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(2,thermal);
 let before=thermalBudget(p);thermal.setState('fair');
 assert.equal(budgetReduced(before,thermalBudget(p)),true);
 before=thermalBudget(p);thermal.setState('serious');
 assert.equal(budgetReduced(before,thermalBudget(p)),true);
 before=thermalBudget(p);thermal.setState('critical');
 assert.equal(budgetReduced(before,thermalBudget(p)),true);
});
test('heat that adds no restriction to an existing power/FPS budget stays quiet',()=>{
 const thermal=new ThermalProtection(),power=new PowerBudget();power.setLowPower(true);
 const p=new AdaptivePerformance(2,thermal,power);let before=thermalBudget(p);
 thermal.setState('fair');assert.equal(budgetReduced(before,thermalBudget(p)),false);
 p.level=6;p.targetFps=30;before=thermalBudget(p);
 thermal.setState('serious');assert.equal(budgetReduced(before,thermalBudget(p)),true,'heat further caps resolution');
 const reduced=new AdaptivePerformance(.8,undefined,power);reduced.level=6;reduced.targetFps=30;
 before=thermalBudget(reduced);reduced.thermal.setState('serious');
 assert.equal(budgetReduced(before,thermalBudget(reduced)),false);
});
test('cooling or repeated state reads never count as a quality reduction',()=>{
 const thermal=new ThermalProtection(),p=new AdaptivePerformance(2,thermal);thermal.setState('fair');
 const before=thermalBudget(p);thermal.setState('fair');
 assert.equal(budgetReduced(before,thermalBudget(p)),false);
 thermal.setState('nominal');for(let i=0;i<30;i++)thermal.advance(1);
 assert.equal(budgetReduced(before,thermalBudget(p)),false);
});
test('manual quality ignores heat, returning to Automatic retains thermal restrictions',()=>{
 const thermal=new ThermalProtection();thermal.setState('serious');
 const manual=new AdaptivePerformance(2),automatic=new AdaptivePerformance(2,thermal);
 assert.equal(manual.ratio,1.5);assert.equal(manual.targetFps,60);
 assert.equal(budgetReduced(thermalBudget(manual),thermalBudget(automatic)),true);
});
test('pending notice waits for visible gameplay and is shown only once per app lifetime',()=>{
 const session=new ThermalNoticeSession();assert.equal(session.take(true),false);
 session.request();session.request();
 for(let i=0;i<10;i++)assert.equal(session.take(false),false,'menu, background or countdown cannot consume it');
 assert.equal(session.take(true),true);
 for(let race=0;race<5;race++){
  session.request();assert.equal(session.take(false),false);assert.equal(session.take(true),false);
 }
 const reopened=new ThermalNoticeSession();reopened.request();assert.equal(reopened.take(true),true);
});
test('all six locales provide distinct complete thermal notice copy',()=>{
 const messages=Object.values(catalogs).map(c=>c['hud.thermalNotice']);
 assert.equal(messages.length,6);assert.equal(new Set(messages).size,6);
 for(const message of messages){assert.ok(message.length>80);assert.ok(message.endsWith('.'));}
});
