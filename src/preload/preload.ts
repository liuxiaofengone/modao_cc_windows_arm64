import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__modaoAPI', {
  createTab: (url?: string) => ipcRenderer.invoke('create-tab', url),
  switchTab: (tabId: string) => ipcRenderer.invoke('switch-tab', tabId),
  closeTab: (tabId: string) => ipcRenderer.invoke('close-tab', tabId),
  navigate: (url: string) => ipcRenderer.invoke('navigate', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  reload: () => ipcRenderer.invoke('reload'),
  stop: () => ipcRenderer.invoke('stop'),
  onTabsUpdated: (callback: (tabs: any[]) => void) => {
    ipcRenderer.on('tabs-updated', (_event, tabs) => callback(tabs));
  },
  removeTabsListener: () => {
    ipcRenderer.removeAllListeners('tabs-updated');
  },
});

contextBridge.exposeInMainWorld('__electronAPI', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
});
