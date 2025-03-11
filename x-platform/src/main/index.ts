import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpcHandlers } from './ipc'
import { ServiceManager } from './service-manager'

let mainWindow: BrowserWindow | null = null
let serviceManager: ServiceManager | null = null

async function createWindow() {
  // Start service initialization but don't wait for it
  serviceManager = new ServiceManager()
  const serviceInitPromise = serviceManager.initialize()

  // Create the browser window immediately without waiting for services
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: 'hsl(228.82 85% 5%)',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the UI immediately - don't wait for services
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Complete service initialization in the background
  return serviceInitPromise
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.retrievai')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize window and start services in parallel
  const servicesPromise = createWindow()

  // Set up IPC handlers early - they'll work even if services aren't ready yet
  if (serviceManager && mainWindow) {
    try {
      setupIpcHandlers(
        serviceManager.getDocumentService(),
        serviceManager.getChatService(),
        serviceManager.getSettings(),
        mainWindow
      )
      console.log('IPC handlers successfully registered')

      // Notify renderer that the UI is ready (services may still be initializing)
      mainWindow.webContents.send('app:ready')
    } catch (error) {
      console.error('Failed to setup IPC handlers:', error)
    }
  }

  // Wait for services in the background
  servicesPromise
    .then(() => {
      console.log('All services initialized in background')
      // Notify renderer that services are ready
      mainWindow?.webContents.send('services:ready')
    })
    .catch((error) => {
      console.error('Service initialization failed:', error)
    })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup resources before app quits
app.on('before-quit', () => {})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
})
