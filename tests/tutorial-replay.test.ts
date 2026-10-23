import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toggleTutorialReplay,takeTutorialReplay,cleanTutorialReplay} from '../src/tutorial-replay';
import {freshTutorial,type TutorialProgress} from '../src/onboarding';
test('clicking again cancels a queued replay without wiping completed or partial progress',()=>{
 for(const progress of [{version:1,completed:4,skipped:false},{version:1,completed:2,skipped:false},{version:1,completed:0,skipped:true}] as TutorialProgress[]){
  const save={tutorial:progress};const before=structuredClone(progress);
  assert.equal(toggleTutorialReplay(save),true);assert.deepEqual(save.tutorial,before);
  assert.equal(toggleTutorialReplay(save),false);assert.deepEqual(save.tutorial,before);assert.equal(takeTutorialReplay(save),false);
 }
});
test('pending and cancelled choices persist across reopening',()=>{
 const save={tutorial:{version:1,completed:4,skipped:false} as TutorialProgress};toggleTutorialReplay(save);
 let reopened=JSON.parse(JSON.stringify(save));assert.equal(reopened.tutorialReplayQueued,true);
 toggleTutorialReplay(reopened);reopened=JSON.parse(JSON.stringify(reopened));assert.equal(reopened.tutorialReplayQueued,false);assert.equal(reopened.tutorial.completed,4);
});
test('a queued replay resets progress only when the actual lesson starts and is consumed once',()=>{
 const save={tutorial:{version:1,completed:4,skipped:false} as TutorialProgress,tutorialReplayQueued:true};
 assert.equal(takeTutorialReplay(save),true);assert.deepEqual(save.tutorial,freshTutorial());assert.equal(save.tutorialReplayQueued,false);
 save.tutorial.completed=1;assert.equal(takeTutorialReplay(save),false);assert.equal(save.tutorial.completed,1);
});
test('legacy replays remain cancellable for pilots already beyond the guide',()=>{
 const migrated=cleanTutorialReplay(undefined,freshTutorial(),3,15000);assert.equal(migrated.tutorialReplayQueued,true);assert.equal(migrated.tutorial.skipped,true);
 toggleTutorialReplay(migrated);assert.equal(migrated.tutorialReplayQueued,false);assert.equal(takeTutorialReplay(migrated),false);assert.equal(migrated.tutorial.skipped,true);
});
test('new players and explicitly saved choices never use legacy replay migration',()=>{
 assert.deepEqual(cleanTutorialReplay(undefined,freshTutorial(),0,0),{tutorialReplayQueued:false,tutorial:freshTutorial()});
 assert.deepEqual(cleanTutorialReplay(false,freshTutorial(),3,15000),{tutorialReplayQueued:false,tutorial:freshTutorial()});
 const partial={version:1,completed:2,skipped:false} as TutorialProgress;assert.equal(cleanTutorialReplay(undefined,partial,3,15000).tutorialReplayQueued,false);
});
