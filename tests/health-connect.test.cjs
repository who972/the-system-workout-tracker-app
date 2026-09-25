const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'side-system.js'), 'utf8');
const healthCode = source.slice(source.indexOf("const HEALTH_DATA_KEY="), source.indexOf('function dailyPick('));
test('the complete side-mission script parses', () => { new vm.Script(source); });
function setup(bridge, alias = 'AndroidHealthConnect') {
  const storage = new Map();
  let date = '2026-09-24';
  const context = vm.createContext({
    window: { [alias]: bridge }, today: () => date,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    renderSideSystem() {}
  });
  vm.runInContext(healthCode, context);
  const provider = context.window.SystemHealthProvider;
  provider.setSteps(4321);
  return { provider, setDate: value => { date = value; } };
}
test('ordinary browser preserves manual steps and exposes no connected provider', async () => {
  const { provider } = setup(null);
  assert.equal(await provider.sync(), false);
  assert.equal(await provider.requestAccess(), false);
  assert.equal(provider.getToday().steps, 4321);
  assert.equal(provider.getStatus().connected, false);
});
test('permission result is awaited, and denial is not a connection', async () => {
  let complete;
  const { provider } = setup({ requestStepPermission: () => new Promise(r => { complete = r; }) });
  const pending = provider.requestAccess();
  assert.equal(provider.getStatus().connected, false);
  complete(false);
  assert.equal(await pending, false);
  assert.equal(provider.getToday().steps, 4321);
});
test('both bridge names accept async step totals and valid zero', async () => {
  for (const alias of ['AndroidHealthConnect', 'HealthConnectBridge']) {
    const { provider } = setup({ requestStepPermission: async () => true,
      getTodaySteps: async () => JSON.stringify({ steps: 0, date: '2026-09-24' }) }, alias);
    assert.equal(await provider.requestAccess(), true);
    assert.equal(await provider.sync(), true);
    assert.equal(provider.getToday().steps, 0);
    assert.equal(provider.getToday().source, 'health-connect');
    provider.setSteps(500);
    assert.equal(provider.getToday().source, 'manual');
  }
});
test('malformed, missing, negative, stale and permission-error totals preserve manual data', async () => {
  for (const result of [null, undefined, '', false, {}, {steps:null}, {steps:'100'}, {steps:-1},
    {steps:1.5}, {steps:Infinity}, {error:'permission-required'}, {steps:5,date:'2026-09-23'}, 'bad-json']) {
    const { provider } = setup({getTodaySteps: async () => result});
    assert.equal(await provider.sync(), false, JSON.stringify(result));
    assert.equal(provider.getToday().steps, 4321);
    assert.equal(provider.getToday().source, 'manual');
  }
});
test('permission revocation does not erase the last successful total', async () => {
  let revoked = false;
  const { provider } = setup({ getTodaySteps: async () => {
    if (revoked) throw Error('permission-required');
    return {steps:5678};
  }});
  assert.equal(await provider.sync(), true);
  revoked = true;
  assert.equal(await provider.sync(), false);
  assert.equal(provider.getToday().steps, 5678);
  assert.equal(provider.getStatus().connected, false);
});
test('late responses cannot overwrite newer manual steps or cross midnight', async () => {
  let complete;
  const { provider, setDate } = setup({ getTodaySteps: () => new Promise(r => { complete = r; }) });
  let pending = provider.sync();
  provider.setSteps(6000);
  complete({steps:8000});
  assert.equal(await pending, false);
  assert.equal(provider.getToday().steps, 6000);
  pending = provider.sync();
  setDate('2026-09-25');
  complete({steps:9000});
  assert.equal(await pending, false);
  assert.equal(provider.getToday().steps, 0);
});
test('transport correlates concurrent responses, propagates errors, and times out', async () => {
  const sent = [], timers = new Map();
  let timerId = 0;
  const window = {SystemHealthNative: {postMessage: value => sent.push(JSON.parse(value))}};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'health-connect.js'), 'utf8'), {
    window, setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  const access = window.AndroidHealthConnect.requestStepPermission();
  const steps = window.AndroidHealthConnect.getTodaySteps();
  const reply = (id, result) => window.SystemHealthNative.onmessage({data:JSON.stringify({id,result})});
  reply(sent[1].id, {steps:123});
  reply(sent[0].id, {granted:true});
  assert.equal(await access, true);
  assert.equal((await steps).steps, 123);
  const failed = window.AndroidHealthConnect.getTodaySteps();
  reply(sent[2].id, {error:'permission-required'});
  await assert.rejects(failed, /permission-required/);
  const timeout = window.AndroidHealthConnect.getTodaySteps();
  [...timers.values()][0]();
  await assert.rejects(timeout, /timeout/);
  reply(sent[3].id, {steps:999}); // Late response is ignored.
});
