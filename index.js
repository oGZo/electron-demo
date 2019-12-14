const { app, ipcMain, BrowserWindow } = require("electron");
const { batchHandlerGen } = require('./utils/render');
const statusUtils = require('./utils/status');
const debug = require('debug')('main');
let isStart = false;
ipcMain.on('gen', async function(...args){
    if(isStart){
      debug('exist task not start other task')
      return;
    }
    debug('start task')
    isStart = true;
    const start = Date.now();
    try {
      const { list, taskId } = args[1];
      // type 1. single task success 2. single task fail  3. exclude part task exec fail other over;
      await batchHandlerGen(list, (type, data) => {
        args[0].reply('batchTask', {
          type,
          data,
          taskId,
        });
      })
    } catch (error) {
      debug('batch error: %O', error)

    }finally{
      debug('render sumtime: %o', Date.now() - start);
      isStart = false;
    }

})

ipcMain.on('pauseTask', () => {
  debug('pause task');
  statusUtils.pause();
})
function createWindow() {
  // 创建浏览器窗口
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });
  ipcMain.on('openDevtools' ,() => {
    const con = win.webContents;
    if(!con.isDevToolsOpened()){
      con.openDevTools();
    }
  });
  // win.openDevTools();
  // 加载index.html文件
  win.loadFile("index.html");
}
app.on("ready", createWindow);
