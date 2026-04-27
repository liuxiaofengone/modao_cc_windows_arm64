import { WebContentsView, BrowserWindow, shell, Rectangle, screen } from 'electron';
import { getSharedSession } from './session-manager';
import { isModaoUrl } from './navigation-filter';

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isActive: boolean;
}

interface TabItem {
  id: string;
  view: WebContentsView;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export class TabManager {
  private tabs: Map<string, TabItem> = new Map();
  private tabOrder: string[] = [];
  private activeTabId: string | null = null;
  private mainWindow: BrowserWindow;
  private headerHeight: number;
  private sharedSession: Electron.Session;

  constructor(mainWindow: BrowserWindow, headerHeight = 68) {
    this.mainWindow = mainWindow;
    this.headerHeight = headerHeight;
    this.sharedSession = getSharedSession();
  }

  get contentBounds(): Rectangle {
    let w: number;
    let h: number;

    if (this.mainWindow.isMaximized()) {
      // Find which display the window is on (not just primary)
      const bounds = this.mainWindow.getBounds();
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const display = screen.getDisplayNearestPoint(center);
      const workArea = display.workAreaSize;
      w = workArea.width;
      h = workArea.height;
    } else {
      const size = this.mainWindow.getContentSize();
      w = size[0] || 1280;
      h = size[1] || 800;
    }

    return {
      x: 0,
      y: this.headerHeight,
      width: w,
      height: Math.max(1, h - this.headerHeight),
    };
  }

  createTab(url: string, activate = false): string {
    const id = 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    const view = new WebContentsView({
      webPreferences: {
        session: this.sharedSession,
        contextIsolation: true,
      },
    });

    view.webContents.on('page-title-updated', (_e, title) => {
      const tab = this.tabs.get(id);
      if (tab) { tab.title = title; this.notifyRenderer(); }
    });

    view.webContents.on('did-start-loading', () => {
      const tab = this.tabs.get(id);
      if (tab) { tab.isLoading = true; this.notifyRenderer(); }
    });

    view.webContents.on('did-stop-loading', () => {
      const tab = this.tabs.get(id);
      if (tab) {
        tab.isLoading = false;
        tab.canGoBack = view.webContents.navigationHistory.canGoBack();
        tab.canGoForward = view.webContents.navigationHistory.canGoForward();
        this.notifyRenderer();
      }
    });

    view.webContents.on('did-navigate', (_e, navUrl) => {
      const tab = this.tabs.get(id);
      if (tab) { tab.url = navUrl; this.notifyRenderer(); }
    });

    view.webContents.on('did-navigate-in-page', (_e, navUrl) => {
      const tab = this.tabs.get(id);
      if (tab) { tab.url = navUrl; this.notifyRenderer(); }
    });

    view.webContents.on('will-navigate', (event, navUrl) => {
      if (!isModaoUrl(navUrl)) {
        event.preventDefault();
        shell.openExternal(navUrl);
      } else {
        event.preventDefault();
        this.createTab(navUrl, true);
      }
    });

    view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
      if (isModaoUrl(newUrl)) {
        this.createTab(newUrl, true);
      } else {
        shell.openExternal(newUrl);
      }
      return { action: 'deny' };
    });

    const tab: TabItem = {
      id, view, url, title: url, isLoading: true,
      canGoBack: false, canGoForward: false,
    };

    this.tabs.set(id, tab);
    this.tabOrder.push(id);
    this.mainWindow.contentView.addChildView(view);

    view.setBounds({ x: -9999, y: -9999, width: 1, height: 1 } as Rectangle);
    view.webContents.loadURL(url);

    if (activate || this.tabOrder.length === 1) {
      this.setActiveTab(id);
    }

    this.notifyRenderer();
    return id;
  }

  setActiveTab(id: string): void {
    if (this.activeTabId) {
      const current = this.tabs.get(this.activeTabId);
      if (current) {
        current.view.setBounds({ x: -9999, y: -9999, width: 1, height: 1 } as Rectangle);
      }
    }

    const tab = this.tabs.get(id);
    if (tab) {
      const bounds = this.contentBounds;
      console.log('[TabManager] setActiveTab bounds:', JSON.stringify(bounds));
      tab.view.setBounds(bounds);
      this.activeTabId = id;
      this.notifyRenderer();
    }
  }

  closeTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;

    this.mainWindow.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.tabs.delete(id);
    this.tabOrder = this.tabOrder.filter((tid) => tid !== id);

    if (id === this.activeTabId && this.tabOrder.length > 0) {
      this.setActiveTab(this.tabOrder[this.tabOrder.length - 1]);
    }

    this.notifyRenderer();
  }

  updateLayout(): void {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (tab) {
      const bounds = this.contentBounds;
      console.log('[TabManager] updateLayout bounds:', JSON.stringify(bounds));
      tab.view.setBounds(bounds);
    }
  }

  getTabs(): TabInfo[] {
    return this.tabOrder.map((id) => {
      const tab = this.tabs.get(id)!;
      return {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        isLoading: tab.isLoading,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward,
        isActive: tab.id === this.activeTabId,
      };
    });
  }

  navigateActiveTab(url: string): void {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (tab) tab.view.webContents.loadURL(url);
  }

  goBackActiveTab(): void {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (tab && tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack();
    }
  }

  goForwardActiveTab(): void {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (tab && tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward();
    }
  }

  reloadActiveTab(): void {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (tab) tab.view.webContents.reload();
  }

  stopActiveTab(): void {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (tab) tab.view.webContents.stop();
  }

  private notifyRenderer(): void {
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('tabs-updated', this.getTabs());
    }
  }
}
