const path = require('path');
const puppeteer = require('puppeteer');
const { renderMaxConcurrenceNum } = require('../config');
let browser = null;
let window = null;
let browserSwitchId = null;
const SURVIVAL_TIME = 60 * 60 * 1000; // 存活一个小时
// const SURVIVAL_TIME = 1 * 60 * 1000; // 存活一个小时
let browserPromiseResolve = () => {};
let browserPromise = null;
let firstEnter = true;
const initBrowserPromise = () => {
    firstEnter = true;
    browserPromise = new Promise(resolve => {
        browserPromiseResolve = resolve;
    })
}

initBrowserPromise();

let ChromiumPath = path.join(__dirname, "..",".local-chromium", "win64-650583", "chrome-win","chrome.exe");
let opts = {};
if(process.env.NODE_ENV === 'production'){
  opts = {
    executablePath: ChromiumPath,
  };
}

const useBrowser = async () => {
    if(!firstEnter){
        await browserPromise;
        return;
    }
    firstEnter = false;
    console.log('launch browser')
    browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        ignoreHTTPSErrors: true,
        defaultViewport: {
            width: 800,
            height: 600,
            deviceScaleFactor: 2
        },
        ...opts
    });
   
    closeBrowserTimeout();
    browserSwitchId = setTimeout(() => {
        closeBrowserTimeout();
        browser.close();
        initBrowserPromise();
        console.log('destory browser')
        // 销毁浏览器之后也销毁缓存
        Object.keys(PageCacheMap).forEach(key => {
            delete PageCacheMap[key];
        })
        browser = null;
    }, SURVIVAL_TIME);
    browserPromiseResolve();
}

const PageCacheMap = {};
const MAX_PAGE_NUM = renderMaxConcurrenceNum; // Math.floor(require('os').cpus().length / 2);
// const MAX_PAGE_NUM = Math.floor(require('os').cpus().length / 2);
const PAGE_STATUS_IN_USE = 1;
const PAGE_STATUS_OUT_USE = 0;
// 处理page实例个数 并按一定策略 返回可用的page Promise
const getPagePromiseByStrategy = () => {
    let pageCacheKeys = Object.keys(PageCacheMap);
    let length = pageCacheKeys.length;
    // console.log(JSON.stringify(PageCacheMap, null, 2), 'page');
    // 未有page时
    if(!length){
        // console.log('start 0');
        return PageCacheMap[length] = {
            // promise: prevPromise,
            page: getPage(),
            status: PAGE_STATUS_IN_USE,
            curUseNum: 0,  
        }
    }

    pageCacheKeys.sort((a, b) => {
        return PageCacheMap[a].curUseNum - PageCacheMap[b].curUseNum;
    })
    // 按使用次数对page排序
    let noUsePageKeyList = pageCacheKeys.filter((key) => PageCacheMap[key].status === PAGE_STATUS_OUT_USE);


    // 当pagelist 小于MAX_PAGE_NUM且所有的page都在使用时
    if(length < MAX_PAGE_NUM && !noUsePageKeyList.length) {
        // console.log('start 1');
        return PageCacheMap[length] = {
            // promise: prevPromise,
            page: getPage(),
            status: PAGE_STATUS_IN_USE,
            curUseNum: 0,
        }
    }
    // 当有page未使用时 使用第一个未使用的page缓存
    if(noUsePageKeyList.length){
        // console.log('start 2');
        let curPageKey = noUsePageKeyList[0];
        let curCachePage = PageCacheMap[curPageKey];
        // curCachePage.promise = prevPromise;
        curCachePage.status = PAGE_STATUS_IN_USE;
        return curCachePage;
    }
    // console.log('start 3');
    // 当所有page缓存都已使用
    let curPageKey = pageCacheKeys[0];
    let curCachePage = PageCacheMap[curPageKey];
    // 接着上一个任务执行 不管其成功还是失败
    // curCachePage.promise = curCachePage.promise.then(thenFn).catch(thenFn);
    return curCachePage;

}
// 获取页面page实例promise
const getPage = async() => {
    await useBrowser();
    // console.time('get userAgent')
    const userAgent = await browser.userAgent();
    // console.timeEnd('get userAgent')

    const page = await browser.newPage();
    // console.time('set userAgent')
    // 添加无头浏览器标识
    await page.setUserAgent(`${userAgent} headless`);
    // console.timeEnd('set userAgent')
    return page;
}
const closeBrowserTimeout = () => {
    clearTimeout(browserSwitchId);
}
// 以当前page实例 的promise为入参 执行入参 gen方法；
const execGenByPage = async (gen) => {
    let curResolve = null;
    let curReject = null;
    // 当前请求的promise 方便  page复用
    const curPromise = new Promise((resolve, reject) => {
        curResolve = resolve;
        curReject = reject;
    })
    const curPage = getPagePromiseByStrategy(curPromise);

    curPage.curUseNum += 1;
    let prevGenPromise = curPage.promise;
    curPage.promise = curPromise;
    try{
        // 等待上一次page的网页操作完成
        await prevGenPromise;
        // 等他网页实例创建完成
        const page = await curPage.page;
        await gen(page);
        curResolve();
    }catch(err){
        curReject(err);
        throw err;
    }finally{
        curPage.curUseNum -= 1;
        curPage.status = PAGE_STATUS_OUT_USE;
    }
}

module.exports = {
    execGenByPage,
    useBrowser,
};