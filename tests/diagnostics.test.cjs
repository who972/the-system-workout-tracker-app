const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const controls=Object.fromEntries(['diagnosticStart','diagnosticStop','diagnosticExport','diagnosticClear','diagnosticStatus','cloudSignIn'].map(id=>[id,{id,addEventListener(){}}]));
const listeners={},saved=[];
const ctx={Date,Set,URL,JSON,Number,Object,Array,Promise,performance:{now:()=>10},navigator:{onLine:true},innerWidth:740,innerHeight:360,location:{href:'https://appassets.androidplatform.net/assets/www/index.html'},document:{querySelectorAll:()=>Object.values(controls),getElementById:id=>controls[id],addEventListener:(k,fn)=>listeners[k]=fn},addEventListener:(k,fn)=>listeners[k]=fn,console:{error(){}},SystemAndroid:{exportBackup:(...args)=>saved.push(args)},fetch:async()=>({ok:false,status:401})};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../diagnostics.js','utf8'),ctx);
(async()=>{
const d=ctx.SystemTestDiagnostics;
d.record('save',{result:'ok'});assert.equal(d.report().events.length,0);
d.start();d.record('save',{result:'ok',password:'SECRET',token:'SECRET',health:123});d.record('SECRET',{result:'SECRET'});d.record('click',{control:'dynamic-user-SECRET',screen:'SECRET'});d.record('click',{screen:'profile'});
listeners.error({filename:'https://host/app.js?token=SECRET',lineno:32,message:'SECRET'});listeners.unhandledrejection({reason:'SECRET'});ctx.console.error('SECRET');
await ctx.fetch('https://wczmxbvdfctffhpohnne.supabase.co/auth/v1/token?secret=SECRET',{headers:{Authorization:'SECRET'},body:'SECRET'});
let s=JSON.stringify(d.report());assert(!s.includes('SECRET'));assert(s.includes('script-error'));assert(s.includes('401'));assert(s.includes('cloud'));
const count=d.report().events.length;d.stop();d.record('save',{result:'failed'});assert.equal(d.report().events.length,count+1);
await d.exportReport();assert.equal(saved.length,1);assert(!saved[0][1].includes('SECRET'));assert.equal(JSON.parse(saved[0][1]).recording,false);
d.start();for(let i=0;i<450;i++)d.record('save');assert.equal(d.report().events.length,400);assert(d.report().dropped>0);
const report=d.report();report.events[0].code='SECRET';assert(!JSON.stringify(d.report()).includes('SECRET'));
console.log('PASS diagnostics: off by default, allowlist privacy, request failures, bounded buffer, stop, export, report isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
