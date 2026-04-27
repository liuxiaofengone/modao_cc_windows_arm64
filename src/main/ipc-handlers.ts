import { ipcMain, BrowserWindow } from 'electron';
import { TabManager } from './tab-manager';
import { ensureHttps } from './navigation-filter';

export function registerIpcHandlers(tabManager: TabManager, mainWindow: BrowserWindow): void {
  ipcMain.handle('create-tab', (_event, url?: string) => {
    const targetUrl = ensureHttps(url || 'https://modao.cc/workspace/');
    return tabManager.createTab(targetUrl, true);
  });

  ipcMain.handle('switch-tab', (_event, tabId: string) => {
    tabManager.setActiveTab(tabId);
  });

  ipcMain.handle('close-tab', (_event, tabId: string) => {
    tabManager.closeTab(tabId);
  });

  ipcMain.handle('navigate', (_event, url: string) => {
    tabManager.navigateActiveTab(ensureHttps(url));
  });

  ipcMain.handle('go-back', () => {
    tabManager.goBackActiveTab();
  });

  ipcMain.handle('go-forward', () => {
    tabManager.goForwardActiveTab();
  });

  ipcMain.handle('reload', () => {
    tabManager.reloadActiveTab();
  });

  ipcMain.handle('stop', () => {
    tabManager.stopActiveTab();
  });

  ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window-close', () => {
    mainWindow.close();
  });
}
