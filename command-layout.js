/* Reserve the actual dock/header height before sizing Central Command panels. */
(() => {
  const install = () => {
    const deck = document.getElementById('commandDeck'), dock = deck?.querySelector('.os-dock');
    if (!dock) return;
    const header = deck.querySelector('.os-topbar');
    const measure = () => {
      const dockSpace = `${Math.ceil(dock.getBoundingClientRect().height) + 8}px`;
      const headerSpace = `${Math.ceil(header?.getBoundingClientRect().bottom || 20) + 8}px`;
      if (deck.style.getPropertyValue('--command-dock-space') !== dockSpace) deck.style.setProperty('--command-dock-space',dockSpace);
      if (deck.style.getPropertyValue('--command-header-space') !== headerSpace) deck.style.setProperty('--command-header-space',headerSpace);
    };
    if(window.ResizeObserver){const observer = new ResizeObserver(measure);observer.observe(dock);if(header)observer.observe(header);}
    window.addEventListener('resize',measure);measure();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
