/* Opt-in, local-only diagnostics. Never collect text, URLs, payloads or storage. */
(() => {
  'use strict';
  const LIMIT = 400;
  let active = false, started = null, events = [], dropped = 0;
  const codes = new Set(['test-start','test-stop','click','submit','online','offline','visibility','script-error','promise-error','console-error','request','health','save','workout-complete']);
  const allowedIds = new Set(Array.from(document.querySelectorAll('[id]'), el => el.id));
  function record(code, details = {}) {
    if (!active || !codes.has(code)) return;
    const event = {time: new Date().toISOString(), code};
    if (['home','train','progress','missions','nutrition','profile'].includes(details.screen)) event.screen = details.screen;
    if (allowedIds.has(details.control)) event.control = details.control;
    if (['ok','failed','cancelled','timeout','unavailable'].includes(details.result)) event.result = details.result;
    if (['cloud','other','health'].includes(details.service)) event.service = details.service;
    if (Number.isInteger(details.status) && details.status >= 0 && details.status <= 599) event.status = details.status;
    if (Number.isFinite(details.ms)) event.ms = Math.max(0, Math.min(300000, Math.round(details.ms)));
    if (Number.isInteger(details.line)) event.line = Math.max(0, Math.min(100000, details.line));
    if (['app.js','diagnostics.js','health-connect.js','train-together.js','competitive-credits.js','side-system.js','account-data.js'].includes(details.file)) event.file = details.file;
    if (events.length === LIMIT) { events.shift(); dropped++; }
    events.push(event);
  }
  const status = message => { const el = document.getElementById('diagnosticStatus'); if (el) el.textContent = message; };
  function update() {
    const start = document.getElementById('diagnosticStart'), stop = document.getElementById('diagnosticStop'), exp = document.getElementById('diagnosticExport');
    if (start) start.disabled = active;
    if (stop) stop.disabled = !active;
    if (exp) exp.disabled = !started;
    status(active ? 'Recording this test on this device. Stop before exporting.' : started ? 'Test stopped. Export your report to share it here.' : 'Recording is off. Reports stay on this device until you share them.');
  }
  function start() { if (active) return; events = []; dropped = 0; started = new Date().toISOString(); active = true; record('test-start'); update(); }
  function stop() { record('test-stop'); active = false; update(); }
  function report() {
    return {format:'the-system-diagnostics-v1', build:'0.71 / build 71', started, recording:active, dropped, online:navigator.onLine, viewport:{width:innerWidth,height:innerHeight}, events:events.map(e => ({...e}))};
  }
  async function exportReport() {
    if (!started) return;
    stop();
    const name = 'The-System-Test-' + started.replace(/[:.]/g,'-') + '.json';
    const json = JSON.stringify(report(), null, 2);
    try {
      if (window.SystemAndroid?.exportBackup) {
        window.SystemAndroid.exportBackup(name,json);
        status('Choose where to save the test report, then attach that file in this chat.');
        return;
      }
      const blob = new Blob([json],{type:'application/json'});
      const file = typeof File === 'function' ? new File([blob],name,{type:'application/json'}) : null;
      if (file && navigator.canShare?.({files:[file]})) {
        await navigator.share({files:[file],title:'The System test report'});
      } else {
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
      }
      status('Report exported. Attach the JSON file in this chat.');
    } catch (_) { status('Report was not exported. Your test is still available; tap Export Report to try again.'); }
  }
  window.SystemTestDiagnostics = Object.freeze({record,start,stop,report,exportReport});
  document.addEventListener('click', e => {
    const el = e.target.closest?.('button,[role="button"],a');
    if (!el || el.id.startsWith('diagnostic')) return;
    // Only original static IDs; never labels, hrefs or dynamic account/item IDs.
    record('click', {control:el.id, screen:el.dataset?.view});
  },true);
  document.addEventListener('submit',e => record('submit',{control:e.target.id}),true);
  addEventListener('online',() => record('online'));
  addEventListener('offline',() => record('offline'));
  document.addEventListener('visibilitychange',() => record('visibility'));
  addEventListener('error',e => {
    let file; try { file = new URL(e.filename).pathname.split('/').pop(); } catch (_) {}
    record('script-error',{file,line:e.lineno});
  });
  addEventListener('unhandledrejection',() => record('promise-error'));
  const originalError = console.error;
  console.error = function(...args) { record('console-error'); return originalError.apply(this,args); };
  if (window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = async function(input,init) {
      const time = performance.now();
      let service='other';
      try { const url = new URL(typeof input === 'string' ? input : input.url,location.href); if (url.hostname === 'wczmxbvdfctffhpohnne.supabase.co') service='cloud'; } catch (_) {}
      try { const response = await originalFetch.call(this,input,init); record('request',{service,status:response.status,result:response.ok?'ok':'failed',ms:performance.now()-time}); return response; }
      catch (error) { record('request',{service,status:0,result:'failed',ms:performance.now()-time}); throw error; }
    };
  }
  document.getElementById('diagnosticStart')?.addEventListener('click',start);
  document.getElementById('diagnosticStop')?.addEventListener('click',stop);
  document.getElementById('diagnosticExport')?.addEventListener('click',exportReport);
  document.getElementById('diagnosticClear')?.addEventListener('click',() => {active=false;started=null;events=[];dropped=0;update();});
  update();
})();
