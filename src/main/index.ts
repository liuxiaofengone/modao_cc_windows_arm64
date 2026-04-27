import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { TabManager } from './tab-manager';
import { registerIpcHandlers } from './ipc-handlers';

app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow: BrowserWindow | null = null;
let tabManager: TabManager | null = null;
let tray: Tray | null = null;

const DEFAULT_URL = 'https://modao.cc/workspace/';
const HEADER_HEIGHT = 68; // titlebar 32 + tabbar 36

function createTray(): void {
  const iconPath = path.join(__dirname, '../../resources/icon-tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        showWindow();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.exit(0);
      },
    },
  ]);

  tray.setToolTip('墨刀 Modao');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    showWindow();
  });
}

function showWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  tabManager = new TabManager(mainWindow, HEADER_HEIGHT);
  registerIpcHandlers(tabManager, mainWindow);

  tabManager.createTab(DEFAULT_URL, true);

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleLayoutUpdate() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      tabManager?.updateLayout();
      resizeTimer = null;
    }, 250);
  }

  mainWindow.on('resize', () => {
    scheduleLayoutUpdate();
  });

  mainWindow.on('maximize', () => {
    // Maximize transition is ~250ms on Windows, retry to catch final size
    scheduleLayoutUpdate();
    setTimeout(() => tabManager?.updateLayout(), 300);
  });

  mainWindow.on('unmaximize', () => {
    scheduleLayoutUpdate();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    tabManager = null;
  });
}

app.whenReady().then(() => {
  createTray();
  createWindow();

  app.on('activate', () => {
    showWindow();
  });
});

// Never quit on window-all-closed — stay in tray
app.on('window-all-closed', () => {
  // Do nothing, keep running in tray
});
