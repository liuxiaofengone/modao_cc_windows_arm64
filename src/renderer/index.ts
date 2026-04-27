const modaoAPI = (window as any).__modaoAPI;
const electronAPI = (window as any).__electronAPI;

console.log('[Renderer] modaoAPI:', !!modaoAPI, 'electronAPI:', !!electronAPI);

const tabBar = document.getElementById('tab-bar')!;
const btnNewTab = document.getElementById('btn-new-tab') as HTMLButtonElement;
const btnMinimize = document.getElementById('btn-minimize') as HTMLButtonElement;
const btnMaximize = document.getElementById('btn-maximize') as HTMLButtonElement;
const btnClose = document.getElementById('btn-close') as HTMLButtonElement;

let tabs: any[] = [];

function renderTabs(): void {
  console.log('[Renderer] renderTabs, count:', tabs.length);

  // Remove old tab elements, keep the new-tab button
  tabBar.querySelectorAll('.tab').forEach((el) => el.remove());

  // Insert tabs before the new-tab button
  tabs.forEach((tab) => {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.isActive ? ' active' : '') + (tab.isLoading ? ' loading' : '');
    el.title = tab.url;
    el.dataset.tabId = tab.id;

    el.innerHTML =
      '<img class="tab-icon" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23a0a0b0\'%3E%3Cpath d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z\'/%3E%3C/svg%3E" alt="">' +
      '<span class="tab-title">' + escapeHtml(tab.title) + '</span>' +
      '<button class="tab-close" data-close="' + tab.id + '">&times;</button>';

    el.addEventListener('click', (e) => {
      const closeBtn = (e.target as HTMLElement).closest('.tab-close');
      if (closeBtn) {
        e.stopPropagation();
        const tabId = (closeBtn as HTMLElement).dataset.close!;
        modaoAPI.closeTab(tabId);
        return;
      }
      modaoAPI.switchTab(tab.id);
    });

    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        modaoAPI.closeTab(tab.id);
      }
    });

    tabBar.insertBefore(el, btnNewTab);
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (modaoAPI) {
  modaoAPI.onTabsUpdated((updatedTabs: any[]) => {
    console.log('[Renderer] tabs-updated received, count:', updatedTabs.length);
    tabs = updatedTabs;
    renderTabs();
  });
}

btnNewTab.addEventListener('click', () => {
  console.log('[Renderer] newTab clicked');
  modaoAPI?.createTab();
});

btnMinimize.addEventListener('click', () => {
  electronAPI?.minimize();
});

btnMaximize.addEventListener('click', () => {
  electronAPI?.maximize();
});

btnClose.addEventListener('click', () => {
  electronAPI?.close();
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 't':
        e.preventDefault();
        modaoAPI?.createTab();
        break;
      case 'w':
        e.preventDefault();
        modaoAPI?.closeTab(tabs.find((t) => t.isActive)?.id);
        break;
      case 'Tab':
        e.preventDefault();
        const activeIdx = tabs.findIndex((t) => t.isActive);
        if (e.shiftKey) {
          const prev = activeIdx > 0 ? tabs[activeIdx - 1] : tabs[tabs.length - 1];
          if (prev) modaoAPI?.switchTab(prev.id);
        } else {
          const next = activeIdx < tabs.length - 1 ? tabs[activeIdx + 1] : tabs[0];
          if (next) modaoAPI?.switchTab(next.id);
        }
        break;
      case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (tabs[idx]) modaoAPI?.switchTab(tabs[idx].id);
        break;
    }
  }
});
