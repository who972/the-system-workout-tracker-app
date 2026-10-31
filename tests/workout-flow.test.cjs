const assert=require('node:assert/strict');
const {ExerciseClock}=require('../workout-flow.js');
let now=0;const cues=[];const c=new ExerciseClock({now:()=>now,cue:x=>cues.push(x)});
const step=ms=>{now+=ms;c.tick();};
c.load([{seconds:30,rest:20},{seconds:30,rest:20}]);c.start();
assert.equal(c.phase,'prepare');step(3000);assert.equal(c.phase,'work');step(12000);c.toggle();const left=c.left;step(60000);assert.equal(c.left,left);c.extend();assert.equal(c.left,left+15);c.toggle();step((left+15)*1000);assert.equal(c.phase,'rest');
c.extend();step(20000);assert.equal(c.phase,'rest');step(15000);assert.equal(c.phase,'prepare');step(3000);assert.equal(c.index,1);assert.equal(c.phase,'work');step(30000);assert.equal(c.phase,'review');step(60000);assert.equal(c.phase,'review');assert.equal(cues.filter(x=>x==='ready').length,1);
c.load([{seconds:10,rest:0},{seconds:10,rest:0}]);c.start();step(3000);c.advance();assert.equal(c.phase,'prepare');step(3000);c.toggle();c.advance();assert.equal(c.phase,'work');c.stop();step(999999);assert.equal(c.phase,'ready');
// Delayed/background ticks must never skip several work periods.
c.load([{seconds:10,rest:10},{seconds:10,rest:10}]);c.start();step(999999);assert.equal(c.phase,'work');assert.equal(c.index,0);step(999999);assert.equal(c.phase,'rest');assert.equal(c.index,0);
c.load([{seconds:10,rest:0}]);c.start();const prior=cues.filter(x=>x==='countdown').length;c.tick();c.tick();assert.equal(cues.filter(x=>x==='countdown').length,prior+1);
console.log('PASS automatic sets, rest, pause/resume, extension, manual advance, review boundary, exit and delayed ticks');
