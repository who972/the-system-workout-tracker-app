const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const AccountData=require('../account-data.js');
function storage(seed={}){const s={...seed};Object.defineProperties(s,{setItem:{configurable:true,value:(k,v)=>s[k]=String(v)},removeItem:{value:k=>delete s[k]},getItem:{value:k=>s[k]??null},length:{get:()=>Object.keys(s).length},key:{value:i=>Object.keys(s)[i]}});return s;}
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function harness(seed={}){
 const local=storage(seed),session=storage(),writes=[],calls=[];
 const c={AccountData,localStorage:local,sessionStorage:session,navigator:{onLine:true},document:{getElementById:()=>null,addEventListener(){}},window:{},location:{reload:()=>calls.push('reload')},clearTimeout(){},setTimeout(){},systemBackup:()=>({localStorage:{...local}}),cloudStatus(){},renderCloudAccount(){},authProgress(){},authDelay:async()=>{},enterMainInterface:()=>calls.push('enter'),fetch:async(url,opts)=>({ok:true,text:async()=>{if(opts?.method==='POST')writes.push(JSON.parse(opts.body));return '[]'}})};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf("const CLOUD_CONFIG_KEY="),source.indexOf('function initCloudSync()')),c);
 vm.runInContext(source.slice(source.indexOf('async function completeAuthGate('),source.indexOf('function setAuthMode(')),c);
 return {c,local,session,writes,calls};
}
const login=id=>({access_token:'token-'+id,user:{id}});
test('production sign-out and B sign-in never upload A workouts; returning A restores local progress',async()=>{
 const h=harness({theSystemCloudSession:JSON.stringify(login('A')),systemWorkoutSessions:'private-A',theSystemLastSync:'2099-01-01'});
 AccountData.activateAccount(h.local,'A','A');h.c.cloudSignOut();await h.c.completeAuthGate(login('B'));
 assert.equal(h.local.systemWorkoutSessions,undefined);assert.equal(h.local.theSystemLastSync,undefined);assert.equal(h.calls.at(-1),'reload');
 await h.c.restoreCloudOnSignIn();assert.equal(h.writes[0].user_id,'B');assert.equal(h.writes[0].data.localStorage.systemWorkoutSessions,undefined);assert.equal(h.writes[0].data.localStorage.theSystemDeviceAccountsV1,undefined);
 h.local.setItem('systemWorkoutSessions','private-B');h.c.cloudSignOut();await h.c.completeAuthGate(login('A'));
 assert.equal(h.local.systemWorkoutSessions,'private-A');assert.equal(h.local.theSystemLastSync,'2099-01-01');
});
test('upgrade preserves signed-in legacy progress, unowned legacy progress never goes to new login',async()=>{
 const h=harness({theSystemCloudSession:JSON.stringify(login('A')),systemWorkoutSessions:'existing'});
 assert.equal(h.c.storeCloudSession(login('A')),false);assert.equal(h.local.systemWorkoutSessions,'existing');
 const unknown=harness({systemWorkoutSessions:'unattributed'});await unknown.c.completeAuthGate(login('B'));await unknown.c.restoreCloudOnSignIn();
 assert.equal(unknown.local.systemWorkoutSessions,undefined);assert.equal(JSON.parse(unknown.local.theSystemDeviceAccountsV1).unattributed.systemWorkoutSessions,'unattributed');
 assert.equal(unknown.writes[0].data.localStorage.systemWorkoutSessions,undefined);
});
test('B restores an older cloud backup despite A newer sync time; archives and session cannot be overwritten by backup',async()=>{
 const h=harness({theSystemDataOwnerV1:'A',systemWorkoutSessions:'A',theSystemLastSync:'2099-01-01'});
 await h.c.completeAuthGate(login('B'));const archive=h.local.theSystemDeviceAccountsV1;
 h.c.cloudRequest=async()=>[{updated_at:'2026-01-01',data:{localStorage:{systemWorkoutSessions:'B-cloud',theSystemDataOwnerV1:'attacker',theSystemDeviceAccountsV1:'{}',theSystemCloudSession:'bad',otherApp:'bad'}}}];
 assert.equal(await h.c.restoreCloudOnSignIn(),true);assert.equal(h.local.systemWorkoutSessions,'B-cloud');assert.equal(h.local.theSystemDataOwnerV1,'B');assert.equal(h.local.theSystemDeviceAccountsV1,archive);assert.equal(h.local.otherApp,undefined);assert.equal(h.c.getCloudSession().user.id,'B');
});
test('delayed A restore and upload cannot update B local data or timestamp',async()=>{
 const h=harness({theSystemDataOwnerV1:'A',theSystemCloudSession:JSON.stringify(login('A')),systemWorkoutSessions:'A'});let finish;
 h.c.cloudRequest=()=>new Promise(resolve=>finish=resolve);const restore=h.c.restoreCloudOnSignIn();h.c.storeCloudSession(login('B'));finish([{updated_at:'2099-01-01',data:{localStorage:{systemWorkoutSessions:'A-cloud'}}}]);await restore;assert.equal(h.local.systemWorkoutSessions,undefined);
 h.c.storeCloudSession(login('A'));const upload=h.c.autoCloudSync();h.c.storeCloudSession(login('B'));finish({});await upload;assert.equal(h.local.theSystemLastSync,undefined);
});
test('autosync refuses data without matching account owner; forgetting login remains session-only',async()=>{
 const h=harness({theSystemDataOwnerV1:'A',theSystemCloudSession:JSON.stringify(login('B')),systemWorkoutSessions:'A'});assert.equal(await h.c.autoCloudSync(),false);assert.equal(h.writes.length,0);
 h.c.storeCloudSession(login('B'),false);assert.equal(h.local.theSystemCloudSession,undefined);assert.equal(h.c.getCloudSession().user.id,'B');
});
test('manual exports exclude other accounts, device ownership, session tokens and unrelated storage',()=>{
 const h=harness({theSystemDataOwnerV1:'B',theSystemDeviceAccountsV1:JSON.stringify({A:{systemWorkoutSessions:'private-A'}}),theSystemCloudSession:JSON.stringify(login('B')),systemWorkoutSessions:'B',otherApp:'private'});
 vm.runInContext(source.slice(source.indexOf('function systemBackup()'),source.indexOf('\n',source.indexOf('function systemBackup()'))),h.c);
 const exported=h.c.systemBackup().localStorage;
 assert.equal(exported.systemWorkoutSessions,'B');for(const key of ['theSystemDataOwnerV1','theSystemDeviceAccountsV1','theSystemCloudSession','otherApp'])assert.equal(exported[key],undefined,key);
});
test('import preserves current account, other account archives and session, ignores legacy session fields',async()=>{
 const h=harness({theSystemDataOwnerV1:'B',theSystemDeviceAccountsV1:'{"A":{"systemWorkoutSessions":"A"}}',theSystemCloudSession:JSON.stringify(login('B')),otherApp:'keep'});
 const el={textContent:''};h.c.document.getElementById=()=>el;h.c.confirm=()=>true;
 vm.runInContext(source.slice(source.indexOf('async function importSystemBackup('),source.indexOf('// Account operations')),h.c);
 await h.c.importSystemBackup({text:async()=>JSON.stringify({app:'The System - Workout Tracker',localStorage:{systemWorkoutSessions:'imported',theSystemCloudSession:JSON.stringify(login('A')),theSystemDataOwnerV1:'A'}})});
 assert.equal(h.local.systemWorkoutSessions,'imported');assert.equal(h.c.getCloudSession().user.id,'B');assert.equal(h.local.theSystemDataOwnerV1,'B');assert.ok(h.local.theSystemDeviceAccountsV1.includes('A'));assert.equal(h.local.otherApp,'keep');
});
test('quota failure during account restore rolls back account owner and workouts',()=>{
 const saved=storage({theSystemDataOwnerV1:'A',systemWorkoutSessions:'A-data',theSystemDeviceAccountsV1:JSON.stringify({B:{systemWorkoutSessions:'B-data'}})});let fail=true;
 const proxy=new Proxy(saved,{get(target,key){if(key==='setItem')return(k,v)=>{if(k==='systemWorkoutSessions'&&v==='B-data'&&fail){fail=false;throw Error('Quota exceeded')}target.setItem(k,v)};return Reflect.get(target,key)}});
 assert.throws(()=>AccountData.activateAccount(proxy,'B','A'),/Quota/);assert.equal(saved.theSystemDataOwnerV1,'A');assert.equal(saved.systemWorkoutSessions,'A-data');assert.equal(JSON.parse(saved.theSystemDeviceAccountsV1).B.systemWorkoutSessions,'B-data');
});
test('invalid backup shape and values cannot remove the current workouts',()=>{
 const saved=storage({systemWorkoutSessions:'keep'});for(const input of [[],null,{systemWorkoutSessions:17}])assert.throws(()=>AccountData.applySnapshot(saved,input),/Invalid backup/);assert.equal(saved.systemWorkoutSessions,'keep');
});
