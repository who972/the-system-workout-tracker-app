/* Sleep sessions stay on device. No scores, diagnoses or training changes. */
(function(root){
'use strict';
const labels={0:'Unknown',1:'Awake',2:'Sleeping',3:'Out of bed',4:'Light',5:'Deep',6:'REM',7:'Awake in bed'};
const asleep=new Set([2,4,5,6]);
const minutes=ms=>ms/60000;
function dayAt(time,zone){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function duration(value){if(value==null||!Number.isFinite(value))return 'Not shared';const n=Math.round(value);return Math.floor(n/60)+'h '+n%60+'m'}
function normalize(record,now,zone){
 if(!record||typeof record!=='object')return null;
 const start=Date.parse(record.startTime),end=Date.parse(record.endTime);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end>now)return null;
 const stages=(Array.isArray(record.stages)?record.stages:[]).filter(s=>s&&typeof s==='object').map(s=>({start:Math.max(start,Date.parse(s.startTime)),end:Math.min(end,Date.parse(s.endTime)),stage:s.stage})).filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start).sort((a,b)=>a.start-b.start||a.end-b.end);
 let last=start,covered=0,sleep=0,overlap=false;const totals={};
 for(const s of stages){
  if(s.start<last){overlap=true;break}
  last=s.end;const n=s.end-s.start;
  if(labels[s.stage]&&s.stage!==0){covered+=n;totals[s.stage]=(totals[s.stage]||0)+minutes(n);if(asleep.has(s.stage))sleep+=n}
 }
 const complete=!overlap&&Math.abs(end-start-covered)<1;
 return {startTime:record.startTime,endTime:record.endTime,start,end,id:String(record.id||''),source:String(record.source||''),sourceName:String(record.sourceName||record.source||'Health Connect'),wakeDate:dayAt(end,zone),sessionMinutes:minutes(end-start),asleepMinutes:complete?minutes(sleep):null,stages:overlap?[]:stages,stageTotals:overlap?{}:totals,stageCoverage:overlap?0:covered/(end-start)};
}
function analyze(data={},now=new Date()){
 const time=now.getTime(),age=time-Date.parse(data.syncedAt),zone=data.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 const result={state:'unavailable',message:'Connect Samsung Health through Health Connect to share sleep sessions.',days:[],latest:null};
 if(data.status!=='connected')return {...result,message:data.status==='error'?'Sleep could not refresh. Sync health data again.':result.message};
 if(data.permissions?.sleepMinutes!==true)return {...result,state:'permission',message:'Allow Sleep access in Health Connect and enable Samsung Health sleep sharing.'};
 if(!Number.isFinite(age)||age<0||age>6*3600000)return {...result,state:'stale',message:'Sleep data needs an update. Tap Sync health data.'};
 if(data.sleepReadError)return {...result,state:'error',message:'Sleep sessions could not be read. Other health categories are still available. Try syncing again.'};
 if(!Array.isArray(data.sleepSessions))return {...result,state:'update',message:'Update The System to load complete sleep sessions, then sync again.'};
 let today,candidates;
 try{today=dayAt(time,zone);candidates=data.sleepSessions.map(r=>normalize(r,time,zone)).filter(Boolean)}catch(e){return {...result,state:'error',message:'Sleep dates could not be read. Sync health data again.'}}
 // Resolve overlapping providers deterministically, preferring Samsung Health.
 // Do not add mirrored records from different apps or overlapping records twice.
 candidates.sort((a,b)=>Number(b.source==='com.sec.android.app.shealth')-Number(a.source==='com.sec.android.app.shealth')||b.stageCoverage-a.stageCoverage||b.sessionMinutes-a.sessionMinutes||a.source.localeCompare(b.source)||a.id.localeCompare(b.id)||a.start-b.start);
 const chosen=[];
 for(const s of candidates)if(!chosen.some(x=>s.start<x.end&&s.end>x.start))chosen.push(s);
 const dates=[];let cursor=new Date(today+'T12:00:00Z');
 for(let i=0;i<7;i++){dates.push(cursor.toISOString().slice(0,10));cursor.setUTCDate(cursor.getUTCDate()-1)}
 const days=dates.map(date=>{
  const sessions=chosen.filter(s=>s.wakeDate===date).sort((a,b)=>b.sessionMinutes-a.sessionMinutes||b.end-a.end);
  return {date,sessions,main:sessions[0]||null,sessionMinutes:sessions.length?sessions.reduce((n,s)=>n+s.sessionMinutes,0):null,asleepMinutes:sessions.length&&sessions.every(s=>s.asleepMinutes!==null)?sessions.reduce((n,s)=>n+s.asleepMinutes,0):null};
 });
 const recorded=days.filter(d=>d.main),latest=recorded[0]||null;
 return {state:latest?'ready':'empty',message:latest?'Sessions grouped by wake date. Main sleep is the longest session on that date.':'No completed sleep sessions shared in the last seven days. Wear your watch during sleep, sync Samsung Health, then sync here.',days,latest,today,zone,recordedDays:recorded.length,averageSessionMinutes:recorded.length?recorded.reduce((n,d)=>n+d.sessionMinutes,0)/recorded.length:null};
}
function briefing(data,now){
 const r=analyze(data,now);if(r.state!=='ready')return r.message;
 const s=r.latest.main;return 'Main sleep ending '+r.latest.date+': '+duration(s.sessionMinutes)+' in the recorded session.'+(s.asleepMinutes!==null?' Time asleep from shared stages: '+duration(s.asleepMinutes)+'.':' Complete sleep stages were not shared, so time asleep is unavailable.');
}
function render(host,data,now){
 const r=analyze(data,now);const doc=host.ownerDocument;host.replaceChildren();host.className='system-sleep-tracker';host.setAttribute('aria-label','Sleep tracker');
 function el(tag,text,parent=host){const e=doc.createElement(tag);e.textContent=text;parent.append(e);return e}
 el('h3','SLEEP // RECOVERY');el('p',r.message).className='health-sync-note';
 if(r.state!=='ready')return;
 const main=r.latest.main;const time=t=>new Intl.DateTimeFormat(undefined,{timeZone:r.zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(t));
 const summary=el('div','');summary.className='sleep-summary';
 el('strong',duration(main.sessionMinutes)+' recorded',summary);el('span','Main sleep • wake date '+r.latest.date,summary);
 el('span',time(main.start)+' → '+time(main.end),summary);el('span',main.sourceName,summary);
 el('p',main.asleepMinutes===null?'Time asleep unavailable • stages missing or incomplete':'Time asleep: '+duration(main.asleepMinutes),summary);
 if(main.stages.length){
  const track=el('div','');track.className='sleep-stage-track';track.setAttribute('aria-label','Sleep stage timeline; gaps mean stages were not shared');
  for(const s of main.stages){const part=el('span','',track);part.className='sleep-stage sleep-stage-'+(labels[s.stage]?s.stage:0);part.style.left=((s.start-main.start)/(main.end-main.start)*100)+'%';part.style.width=((s.end-s.start)/(main.end-main.start)*100)+'%';part.title=(labels[s.stage]||'Unknown')+' • '+duration(minutes(s.end-s.start))}
  el('p',Object.entries(main.stageTotals).map(([stage,n])=>labels[stage]+': '+duration(n)).join(' • ')||'Stage details unavailable').className='health-sync-note';
  if(main.stageCoverage<1)el('p','Stage coverage is incomplete. Gaps are not counted as sleep.').className='health-sync-note';
 }
 el('p',r.recordedDays+' of 7 wake dates recorded • average '+duration(r.averageSessionMinutes)+' in sessions per recorded day').className='health-sync-note';
 const wrap=el('div','');wrap.className='health-history-scroll';const table=el('table','',wrap);table.className='health-history';const header=el('tr','',el('thead','',table));for(const title of ['WAKE DATE','SESSION TIME','TIME ASLEEP','SESSIONS'])el('th',title,header);
 const body=el('tbody','',table);for(const day of r.days){const row=el('tr','',body);el('th',day.date,row);el('td',duration(day.sessionMinutes),row);el('td',duration(day.asleepMinutes),row);el('td',day.sessions.length?String(day.sessions.length):'—',row)}
 const details=el('details','');el('summary','View all shared sleep sessions',details);for(const day of r.days)for(const s of [...day.sessions].sort((a,b)=>b.end-a.end)){el('p',time(s.start)+' → '+time(s.end)+' • '+duration(s.sessionMinutes)+' • '+s.sourceName,details)}
 el('p','Recorded session time includes awake periods. Wearable sleep stages are estimates. Missing days are not zero sleep. Watch syncing may be delayed.').className='health-sync-note';
}
const api={analyze,briefing,render,duration};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SystemSleepTracker=api;
})(typeof window!=='undefined'?window:globalThis);
