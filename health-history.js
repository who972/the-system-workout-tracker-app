/* Foreground-only Health Connect history. No local health archive or workout rewards. */
(() => {
  const metrics = [
    {key:'steps', label:'Steps', unit:'steps', scale:1},
    {key:'activeCalories', label:'Active calories', unit:'kcal', scale:1},
    {key:'totalCalories', label:'Total calories', unit:'kcal', scale:1},
    {key:'distanceMeters', label:'Distance', unit:'km', scale:0.001},
    {key:'heartRateAverage', label:'Average heart rate', unit:'bpm', scale:1, average:true},
    {key:'activeMinutes', label:'Exercise time', unit:'min', scale:1},
    {key:'sleepMinutes', label:'Sleep time', unit:'hr', scale:1/60}
  ];
  const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const format = (value, metric) => number(value) ? `${(value * metric.scale).toLocaleString(undefined,{maximumFractionDigits:metric.unit === 'km' || metric.unit === 'hr' ? 1 : 0})} ${metric.unit}` : 'No records';
  const datesFor = (days, end = localDay()) => {
    const date = new Date(`${end}T12:00:00`);
    if (![7,14,30].includes(days) || Number.isNaN(date.getTime()) || localDay(date) !== end) throw Error('Invalid history range');
    return Array.from({length:days},(_,index) => {
      const d = new Date(date); d.setDate(d.getDate() - days + 1 + index); return localDay(d);
    });
  };
  const seriesFor = (data, days, metric, end = localDay()) => {
    const rows = new Map((Array.isArray(data?.daily) ? data.daily : []).map(row=>[row.date,row]));
    return datesFor(days,end).map(date => {
      const row = rows.get(date), error = row?.errors?.[metric.key] || data?.errors?.[metric.key];
      return {date,partial:date === end,value:!error && number(row?.[metric.key]) ? row[metric.key] : null,error:error || null};
    });
  };
  const summaryFor = series => {
    const recorded = series.filter(row=>number(row.value));
    const completed = recorded.filter(row=>!row.partial);
    return {coverage:recorded.length,total:recorded.length ? recorded.reduce((sum,row)=>sum+row.value,0) : null,
      dailyAverage:completed.length ? completed.reduce((sum,row)=>sum+row.value,0)/completed.length : null,
      peak:recorded.length ? Math.max(...recorded.map(row=>row.value)) : null,completed:completed.length};
  };
  window.SystemHealthHistoryModel = {metrics, datesFor, seriesFor, summaryFor, format};
  window.SystemHealthHistoryInstall = module => {
    const document = module.ownerDocument;
    if (module.querySelector('.health-history-toolbar')) return;
    const values = module.querySelector('[data-values]');
    const content = document.createElement('div'); content.className = 'health-telemetry-content';
    values.before(content); content.append(values);
    const history = document.createElement('section'); history.className = 'health-history'; history.hidden = true;
    history.innerHTML = '<div class="health-history-heading"><strong data-history-heading>HEALTH // PROGRESS</strong><span data-history-state role="status"></span></div><div class="health-history-plot"><div data-history-chart></div><aside><strong data-history-value></strong><span data-history-day></span><span data-history-average></span><span data-history-coverage></span></aside></div>';
    content.append(history);
    const toolbar = document.createElement('div'); toolbar.className = 'health-history-toolbar';
    toolbar.innerHTML = '<div class="health-history-ranges" role="group" aria-label="Health date range"><button type="button" data-health-days="0" aria-pressed="true">TODAY</button><button type="button" data-health-days="7" aria-pressed="false">7 DAYS</button><button type="button" data-health-days="14" aria-pressed="false">14 DAYS</button><button type="button" data-health-days="30" aria-pressed="false">30 DAYS</button></div><label data-history-controls hidden><span class="health-history-sr">Progress metric</span><select aria-label="Progress metric"></select></label><button type="button" data-history-refresh hidden aria-label="Refresh health history">↻</button><button type="button" data-history-connect hidden>CONNECT</button>';
    module.prepend(toolbar);
    const select = toolbar.querySelector('select');
    metrics.forEach(metric=>{const option=document.createElement('option');option.value=metric.key;option.textContent=metric.label;select.append(option)});
    const footer = module.querySelector(':scope > small'), todayFooter = footer.textContent;
    const text = (selector,value) => { history.querySelector(selector).textContent = value; };
    let days = 0, data = null, generation = 0, busy = false, selected = null;
    const visible = () => module.closest('.os-module-stage')?.classList.contains('active') === true && !document.hidden;
    const busyState = value => { busy=value;toolbar.querySelector('[data-history-refresh]').disabled=value;history.setAttribute('aria-busy',String(value)); };
    const clear = message => {
      data=null;history.querySelector('[data-history-chart]').replaceChildren();
      text('[data-history-state]',message);text('[data-history-value]','—');text('[data-history-day]','');
      text('[data-history-average]','');text('[data-history-coverage]','');
    };
    const render = () => {
      if (!days || !data) return;
      const metric = metrics.find(row=>row.key===select.value) || metrics[0];
      const series = seriesFor(data,days,metric), summary = summaryFor(series);
      text('[data-history-heading]',metric.label.toUpperCase());
      const error = data.errors?.[metric.key];
      text('[data-history-state]',error === 'permission-required' ? 'Permission needed • tap CONNECT' : error ? 'Read failed • refresh to retry' : summary.coverage ? `${days} days • tap a day` : 'No records • check your health app’s sharing');
      text('[data-history-average]',summary.dailyAverage === null ? 'No completed-day average' : `Daily avg: ${format(summary.dailyAverage,metric)}`);
      text('[data-history-coverage]',`${summary.coverage}/${days} days recorded`);
      footer.textContent = metric.key === 'sleepMinutes' ? 'Sleep is split across calendar days. Gaps = no records. Today is partial.' : 'Daily average excludes today and missing records. Today is partial.';
      const chart = history.querySelector('[data-history-chart]');chart.replaceChildren();
      const ns = 'http://www.w3.org/2000/svg';
      const node = (tag,attrs={},label) => {const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(label)e.textContent=label;return e};
      const svg = node('svg',{viewBox:'0 0 620 170',role:'group','aria-label':`${metric.label}, last ${days} days. Select a day to see its reading.`});
      const max = Math.max(1,...series.filter(row=>number(row.value)).map(row=>row.value));
      const x = index=>48+index*548/(days-1), y = value=>140-116*value/max;
      for(const fraction of [0,.5,1]) {
        const lineY = 140-116*fraction;
        svg.append(node('line',{x1:44,y1:lineY,x2:602,y2:lineY,class:'health-chart-grid'}));
        svg.append(node('text',{x:40,y:lineY+4,'text-anchor':'end',class:'health-chart-axis'},(max*fraction*metric.scale).toLocaleString(undefined,{maximumFractionDigits:metric.unit==='hr'||metric.unit==='km'?1:0,notation:'compact'})));
      }
      for(let i=1;i<series.length;i++) if(number(series[i-1].value)&&number(series[i].value)) {
        svg.append(node('line',{x1:x(i-1),y1:y(series[i-1].value),x2:x(i),y2:y(series[i].value),class:'health-chart-line'}));
      }
      const choose = row => {
        selected=row.date;text('[data-history-day]',`${dateLabel(row.date)}${row.partial?' • today, partial':''}`);
        text('[data-history-value]',row.error==='permission-required'?'Permission needed':row.error?'Read failed':format(row.value,metric));
        svg.querySelectorAll('[data-chart-date]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.chartDate===selected)));
      };
      series.forEach((row,index)=>{
        const label = `${dateLabel(row.date)}: ${row.error==='permission-required'?'Permission needed':row.error?'Read failed':format(row.value,metric)}${row.partial?', today is partial':''}`;
        const point = node('g',{tabindex:0,role:'button','aria-label':label,'aria-pressed':'false','data-chart-date':row.date});
        point.append(node('title',{},label));
        point.append(node('rect',{x:x(index)-Math.min(14,274/(days-1)),y:8,width:Math.min(28,548/(days-1)),height:136,fill:'transparent'}));
        point.append(node('circle',{cx:x(index),cy:number(row.value)?y(row.value):140,r:days===30?3:4,class:number(row.value)?'health-chart-point':'health-chart-missing'}));
        point.onclick=()=>choose(row);point.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(row)}};
        svg.append(point);
      });
      for(const index of [0,Math.floor((days-1)/2),days-1])svg.append(node('text',{x:x(index),y:162,'text-anchor':index===0?'start':index===days-1?'end':'middle',class:'health-chart-axis'},dateLabel(series[index].date)));
      chart.append(svg);choose(series.find(row=>row.date===selected)||[...series].reverse().find(row=>number(row.value))||series.at(-1));
      svg.title = `Last read: ${new Date(data.syncedAt).toLocaleString()}`;
    };
    const refresh = async () => {
      if (!days) return;
      const token=++generation, requested=days, startedDay=localDay(), offset=new Date().getTimezoneOffset();
      clear('Reading history…');busyState(true);
      try {
        const bridge=window.AndroidHealthConnect;
        if(!bridge?.readHealthHistory){clear(bridge?'Install the latest app update to view history.':'History is available in the Android app.');return}
        const state=await bridge.getStatus();if(token!==generation)return;
        if(state.availability!=='available'){clear(state.availability==='provider-update-required'?'Install or update Health Connect.':'Health Connect is unavailable.');return}
        if(!state.permissions?.length){clear('Permission needed • tap CONNECT');return}
        const result=await bridge.readHealthHistory(requested);if(token!==generation)return;
        if(localDay()!==startedDay||new Date().getTimezoneOffset()!==offset||result.date!==startedDay){clear('Local day changed • refresh history.');return}
        if(result.error||result.days!==requested||!Array.isArray(result.daily))throw Error('invalid-history');
        data=result;render();
      }catch(error){if(token===generation)clear(error.message==='permission-required'?'Permission needed • tap CONNECT':'History read failed • refresh to retry.')}
      finally{if(token===generation)busyState(false)}
    };
    const invalidate = () => {generation++;busyState(false);clear('Choose a range to read history.');};
    const setRange = value => {
      if(![0,7,14,30].includes(value))return;
      invalidate();days=value;selected=null;module.classList.toggle('health-history-mode',days!==0);
      values.hidden=days!==0;history.hidden=days===0;
      toolbar.querySelectorAll('[data-health-days]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.healthDays)===days)));
      toolbar.querySelectorAll('[data-history-controls],[data-history-refresh],[data-history-connect]').forEach(e=>e.hidden=days===0);
      footer.textContent=days?'Gaps = no records. Today is partial.':todayFooter;
      if(days)refresh();
    };
    toolbar.querySelectorAll('[data-health-days]').forEach(b=>b.onclick=()=>setRange(Number(b.dataset.healthDays)));
    toolbar.querySelector('[data-history-refresh]').onclick=refresh;
    toolbar.querySelector('[data-history-connect]').onclick=()=>window.SystemHealthOpen?.();
    select.onchange=render;
    // Changing/closing modules or hiding the app invalidates pending responses and discards history.
    let wasVisible=false;
    const moduleObserver = new MutationObserver(()=>{
      const active=visible();
      if(wasVisible&&!active)invalidate();
      if(!wasVisible&&active&&days)refresh();
      wasVisible=active;
    });
    moduleObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)invalidate();else if(days&&visible())refresh()});
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-close],[data-exit],[data-connect],[data-refresh]')?.closest('#systemHealthConnectDialog'))invalidate()});
    const dialogReady = new MutationObserver(()=>{
      const dialog=document.getElementById('systemHealthConnectDialog');if(!dialog)return;
      dialog.addEventListener('close',()=>{if(days&&visible())refresh()});dialogReady.disconnect();
    });
    dialogReady.observe(document.body,{childList:true});
    const destroy = () => {moduleObserver.disconnect();dialogReady.disconnect();invalidate()};
    window.addEventListener('pagehide',destroy,{once:true});
    window.SystemHealthHistory={refresh,setRange,invalidate,destroy,getRange:()=>days,isBusy:()=>busy};
  };
})();
