const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const source=fs.readFileSync('app.js','utf8');
function oneFunction(name){const a=source.indexOf('function '+name+'(');return source.slice(a,source.indexOf('\n',a));}
test('custom workouts and builder render names, IDs and attribute payloads as data',()=>{
 const d=new JSDOM('<div id="savedWorkouts"></div>',{runScripts:'outside-only'}),w=d.window;const payload='<img src=x onerror="window.compromised=true">',id="x');window.compromised=true;//";
 Object.assign(w,{getCustomWorkouts:()=>[{id,name:payload,xp:100,minutes:5,stat:payload,day:'any',exercises:[]}],loadCustomWorkout:value=>w.clicked=value,logCustomMission(){},deleteCustomWorkout(){}});
 vm.runInContext(oneFunction('escapeHtml')+'\n'+oneFunction('builderRow')+'\n'+oneFunction('renderSavedWorkouts'),d.getInternalVMContext());w.renderSavedWorkouts();assert.equal(w.document.querySelectorAll('img,[onerror],[onclick]').length,0);assert.match(w.document.getElementById('savedWorkouts').textContent,/<img/);w.document.querySelector('[data-workout-action]').click();assert.equal(w.clicked,id);
 const row=w.builderRow({name:'" onfocus="window.compromised=true',target:payload,sets:'" onfocus="evil()',rest:'" onfocus="evil()'});assert.equal(row.querySelectorAll('[onfocus],img').length,0);assert.equal(row.querySelector('.exercise-name').value,'" onfocus="window.compromised=true');d.window.close();
});
test('exercise history renders malicious imported names and weights as literal text',()=>{
 const d=new JSDOM('<div id="exerciseRecords"></div>',{runScripts:'outside-only'}),w=d.window;
 const payload='<img src=x onerror="window.compromised=true">';w.state={exerciseRecords:[{name:payload,sets:payload,reps:payload,weight:payload,date:payload}]};
 const a=source.indexOf('function renderExercises()'),b=source.indexOf('function renderHistory()',a);
 vm.runInContext(oneFunction('escapeHtml')+'\n'+source.slice(a,b),d.getInternalVMContext());w.renderExercises();assert.equal(w.document.querySelectorAll('img,[onerror]').length,0);assert.ok(w.document.getElementById('exerciseRecords').textContent.includes(payload));d.window.close();
});
test('exercise library uses inert text and dataset actions for user-defined exercises',()=>{
 const d=new JSDOM('<div id="exerciseLibraryGrid"></div><select id="libraryMuscle"><option value="all">All</option></select><select id="libraryEquipment"><option value="all">All</option></select><datalist id="exerciseLibraryNames"></datalist>',{runScripts:'outside-only'}),w=d.window;
 const payload='<img src=x onerror="window.compromised=true">',name="Exercise');window.compromised=true;//";
 Object.assign(w,{exerciseLibrary:()=>[{name,muscle:payload,equipment:payload,difficulty:payload,stat:payload,sets:3,target:payload,rest:45}],BUILTIN_EXERCISES:[],addLibraryExerciseToBuilder:value=>w.clicked=value,deleteLibraryExercise(){}});
 vm.runInContext(oneFunction('escapeHtml')+'\n'+oneFunction('renderExerciseLibrary'),d.getInternalVMContext());w.renderExerciseLibrary();assert.equal(w.document.querySelectorAll('img,[onerror],[onclick]').length,0);w.document.querySelector('[data-library-action="add"]').click();assert.equal(w.clicked,name);d.window.close();
});
