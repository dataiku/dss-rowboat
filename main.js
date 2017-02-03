const path = require('path')
const glob = require('glob')
const electron = require('electron')
const Store = require("./lib/datastore")
const http = require("http")
const https = require("https")
const ipc = require('electron').ipcMain

const app = electron.app
const BrowserWindow = electron.BrowserWindow
const Menu = electron.Menu


if (process.mas) app.setName('Dataiku DSS')

var mainWindow = null
var prefsWindow = null

var prefstore = new Store({
    configName : "user-preferences",
    defaults: {
        dssURL: null
    }
})

function createPreferencesWindow(){
  var windowOptions = {
      width: 300,
      minWidth: 300,
      height: 380,
      title: "Dataiku DSS",
    }
    if (process.platform === 'linux') {
        windowOptions.icon = path.join(__dirname, '/assets/app-icon/png/512.png')
    }

    prefsWindow = new BrowserWindow(windowOptions)
    //prefsWindow.openDevTools();
    prefsWindow.loadURL(path.join('file://', __dirname, '/prefs.html'))
}

function testURL(url, sender){

    if (url.indexOf("https://") < 0 && url.indexOf("http://") < 0) {
        url = "http://" + url;
    }

    function callback(res) {
        const statusCode = res.statusCode;
        console.info("Result statusCode: " + statusCode);
        if (statusCode == 200) {
            sender.send("url-test-reply", {
                success:true,
                url:url
            })
        } else {
            sender.send("url-test-reply", {
                success:false,
                error: "HTTP Code " + statusCode,
                url:url
            })
        }
        res.resume();
    }

    var promise = null;
    if (url.indexOf("https://") == 0) {
        promise = https.get(url + "/dip/api/get-configuration",callback);
    } else if (url.indexOf("http://") == 0) {
        promise = http.get(url + "/dip/api/get-configuration",callback);
    } else {
      throw Exception("Invalid URL " + url);
    }
    promise.on("error", function(e){
        console.warn("Got error", e);
        sender.send("url-test-reply", {
                success:false,
                error: "HTTP error " +e,
                url:url
            })
    })
}

function createMainWindow (currentURL) {
    var windowOptions = {
        width: 1280,
        minWidth: 680,
        height: 600,
        title: app.getName(),
        webPreferences : {
            nodeIntegration:false
        }
    }

    if (process.platform === 'linux') {
        windowOptions.icon = path.join(__dirname, '/assets/app-icon/png/512.png')
    }

    mainWindow = new BrowserWindow(windowOptions)
    mainWindow.loadURL(currentURL);

    mainWindow.on('closed', function () {
        mainWindow = null
    })
}

let dssPreferencesMenuItem = {
    label: 'Set DSS URL',
    click: function (item, focusedWindow) {
        if (mainWindow != null) {
            mainWindow.close();
            mainWindow = null;
            createPreferencesWindow();
        }
    }
}
let devtoolsMenuItem = {
    label: 'Toggle Developer Tools',
    accelerator: (function () {
        if (process.platform === 'darwin') {
            return 'Alt+Command+I'
        } else {
            return 'Ctrl+Shift+I'
        }
    })(),
    click: function (item, focusedWindow) {
        if (focusedWindow) {
            focusedWindow.toggleDevTools()
        }
    }
}

let windowAndHelp = [{
    label: 'Window',
    role: 'window',
    submenu: [{
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
    }, {
        label: 'Close',
        accelerator: 'CmdOrCtrl+W',
        role: 'close'
    }, {
        type: 'separator'
    }, {
        label: 'Reopen Window',
        accelerator: 'CmdOrCtrl+Shift+T',
        enabled: false,
        key: 'reopenMenuItem',
        click: function () {
          app.emit('activate')
        }
    }]
}, {
    label: 'Help',
  role: 'help',
    submenu: [{
        label: 'Documentation',
        click: function () {
          electron.shell.openExternal('https://www.dataiku.com/learn')
        }
    }]
}]

let menuTemplate = null;

if (process.platform === 'darwin') {
  const name = electron.app.getName()

  menuTemplate = [{
    label: name,
    submenu: [{
        label: `About ${name}`,
        role: 'about'
    }, {
        type: 'separator'
    },
    dssPreferencesMenuItem,
    devtoolsMenuItem,
    {
      type: 'separator'
    }, {
      label: 'Services',
      role: 'services',
      submenu: []
    }, {
      type: 'separator'
    }, {
      label: `Hide ${name}`,
      accelerator: 'Command+H',
      role: 'hide'
    }, {
      label: 'Hide Others',
      accelerator: 'Command+Alt+H',
      role: 'hideothers'
    }, {
      label: 'Show All',
      role: 'unhide'
    }, {
      type: 'separator'
    }, {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: function () {
        app.quit()
      }
    }]
  }]

    menuTemplate = menuTemplate.concat(windowAndHelp)
} else {
    menuTemplate = [{
        label: "DSS",
        submenu: [
            dssPreferencesMenuItem,
            devtoolsMenuItem
        ]
    }]
    menuTemplate = menuTemplate.concat(windowAndHelp)
}
app.on('ready', function () {
    const menu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(menu)
})


function onShow(){
    var currentURL = prefstore.get("dssURL")

    if (currentURL == null) {
        createPreferencesWindow();
    } else {
        createMainWindow(currentURL);
    }
}

ipc.on('test-url', function (event, arg) {
    var url = arg;
    console.info("IPC: testing URL", url);
    testURL(url, event.sender);
})

ipc.on('save-and-open-dss', function (event, arg) {
    var url = arg.url;
    prefstore.set("dssURL", url);

    createMainWindow(url);

    if (prefsWindow != null) {
        prefsWindow.close();
        prefsWindow = null;
    }
})

app.on('ready', function () {
    onShow()
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    if (mainWindow === null && prefsWindow === null) {
        onShow()
    }
})