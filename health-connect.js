/* Android's origin-restricted message transport; ordinary browsers keep manual entry. */
(() => {
  const transport = window.SystemHealthNative;
  if (!transport || typeof transport.postMessage !== 'function') return;
  const pending = new Map();
  let sequence = 0;
  transport.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.result?.error) request.reject(new Error(message.result.error));
    else request.resolve(message.result);
  };
  function call(method) {
    return new Promise((resolve, reject) => {
      const id = String(++sequence);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('health-connect-timeout'));
      }, method === 'requestStepPermission' ? 120000 : 30000);
      pending.set(id, { resolve, reject, timer });
      try { transport.postMessage(JSON.stringify({ id, method })); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  window.AndroidHealthConnect = {
    requestStepPermission: async () => (await call('requestStepPermission'))?.granted === true,
    getTodaySteps: () => call('getTodaySteps')
  };
})();
