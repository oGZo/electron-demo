const { app, ipcMain, BrowserWindow } = require("electron");
const puppeteer = require("puppeteer");

let browser = null;
puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
  ignoreHTTPSErrors: true,
  defaultViewport: {
      width: 800,
      height: 600,
      deviceScaleFactor: 2
  }
}).then(res => {
    browser = res;
})
let prePage = null;
async function generator(url) {
console.time('renderpdf');
    if(!prePage){
        prePage = await browser.newPage();
    }
    let page = prePage;
  await page.goto(url, {
    waitUntil: "networkidle0"
  });
  const pdfOption = {
    format: "A4",
    printBackground: true
  };
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.pdf({
    ...pdfOption,
    path: "wrong.pdf"
  });
  console.timeEnd('renderpdf');
//   page.close();
}


ipcMain.on('genPdf', function(...args){
    console.log(...args);
  generator('https://www.estudy.cn/activity/learnreportprint?infoNo=4a0e1593eee70f0f23ca&page_info=3');

})
function createWindow() {
//   console.log(puppeteer);
  // 创建浏览器窗口
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // 加载index.html文件
  win.loadFile("index.html");
}

app.on("ready", createWindow);
