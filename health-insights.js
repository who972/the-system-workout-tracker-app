/* Local health context. No network, storage, diagnosis, rank or XP changes. */
(function(root){
 'use strict';
 const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 function summarize(data={},now=new Date()){
  const age=now.getTime()-Date.parse(data.syncedAt);
  let parts;try{parts=new Intl.DateTimeFormat('en-US',{timeZone:data.timeZone||undefined,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)}catch(e){return {state:'unavailable',text:'Health time zone is unavailable. Sync health data again.'}};
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const day=p.year+'-'+p.month+'-'+p.day;
  if(data.status!=='connected')return {state:'unavailable',text:'Connect Samsung Health through Health Connect to add activity context. Your normal missions remain available.'};
  if(!Number.isFinite(age)||age<0||age>6*60*60*1000||data.today?.date!==day)return {state:'stale',text:'Health data needs an update. Sync before using it to guide today’s training.'};
  const t=data.today||{},permissions=data.permissions||{},sentences=[];
  if(permissions.steps===true&&valid(t.steps))sentences.push(Math.round(t.steps).toLocaleString()+' steps shared today.');
  if(permissions.activeMinutes===true&&valid(t.activeMinutes))sentences.push(Math.round(t.activeMinutes)+' recorded exercise minutes today.');
  const sleep=root.SystemSleepTracker?.analyze(data,now);
  if(sleep?.state==='ready')sentences.push(root.SystemSleepTracker.briefing(data,now));
  const count=sentences.length;
  sentences.push('Check how you feel before choosing your session.');
  return {state:count?'current':'partial',text:count?sentences.join(' '):'Connected, but no usable activity context is shared for today. Your normal missions remain available.'};
 }
 const api={summarize};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SystemHealthInsights=api;
})(typeof window!=='undefined'?window:globalThis);
