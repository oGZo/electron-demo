const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const uuid1 = require('uuid/v1');
const { sleep } = require('./time');
const { tryByTimesAndInterval } = require('./try');
const { execGenByPage } = require('./puppeteerPage');
const { renderMaxConcurrenceNum } = require('../config');
const statusUtils = require('../utils/status');
const debug = require('debug')('render');

// 生成图片
function genImg({ url, output, type = 'jpeg', quality = 60 }) {

    const gen = async page => {
        // 打开当前网页
        await page.goto(url, { waitUntil: 'networkidle2' });
        // 给资源缓冲时间
        await sleep(1);
        // 生成对应资源
        await page.screenshot({ path: output, type, quality, fullPage: true });
    }
    return execGenByPage(gen)
}

// 生成错题本
function genWrong({ url, output }) {

    const gen = async page => {
        const pdfOption = {
            format: "A4",
            printBackground: true,
        }
        await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 10000000
        });

        const getPageNum = async (sumNum = 0) => {
            let res = await page.pdf(pdfOption);
            const pageNum = await getPdfPageNum(res);
            sumNum += pageNum;
            debug(`pageNum:${pageNum}, url: %o`, url);
            const flag = await page.evaluate(num => {
                return vm.startRender(num);
            }, pageNum);
            if (!flag) {
                let num = await getPageNum(sumNum);
                sumNum += num;
            }
            return sumNum;
        }
        let sumNum = await getPageNum().catch((err) => {
            debug(`get sumPageNum fail url:${url} error: %O`, err);
            return 0;
        });
        if (!sumNum) {
            return;
        }
        // 让浏览器处理一会渲染
        await sleep(0.1);
        debug('start render pdf url:%o', url);
        await page.pdf({
            ...pdfOption,
            path: output
        });
        debug('end render pdf url:%o', url);
    }
    return execGenByPage(gen)
}

/**
 * 批量生成对应资源
 * @param {array} list  任务数组
 * @param {string} list[0].url   链接地址
 * @param {string} list[0].dir   输出文件所在路径
 * @param {string} list[0].filename  输出文件名称
 * @param {number} list[0].type 生成类型枚举 1. 学情报告 2. 错题本 
 * @param {*} sender 子任务异常时上报的方法
 */
function batchHandlerGen(list, sender = () => { }) {
    const LIST_MAX_NUM = renderMaxConcurrenceNum;
    let prevPromiseMap = {};
    let currentProcess = 0;
    let FailTaskList = []
    let maxPromiseNum = LIST_MAX_NUM < list.length ? LIST_MAX_NUM : list.length;
    // 检测目标目录 如果不存在则创建
    let outputDir = path.join(list[0].dir);
    if (!fs.existsSync(outputDir)) {
        shelljs.mkdir('-p', outputDir);
    }
    let tempDir = './.temp';

    // 临时文件目录, 每次任务前清除 该目录 防止大量临时文件占用用户空间
    if (fs.existsSync(tempDir)) {
        shelljs.rm('-rf', tempDir);
    }
    shelljs.mkdir('-p', tempDir);

    // 并串行
    for (let i = 0, len = list.length; i < len; i++) {
        let item = list[i];
        let curPromiseIndex = i % maxPromiseNum;

        const tasks = () => {
            // 暂停后所有操作都停止
            if(statusUtils.isPause()){
                return Promise.reject('pause');
            }
            let currentTaskIndex = currentProcess++;
            let start = Date.now();
            debug(`start task:${currentTaskIndex}`);
            const { url, dir, filename, type } = item;
            const genTypeMap = {
                1: genImg,
                2: genWrong
            }
            let output = path.join(dir, filename);
            // 生成文件方法
            let genFn = genTypeMap[type] || genImg;

            // 临时文件路径
            let tempOutput = path.join(tempDir, uuid1() + '---' + filename);

            let cur = {
                url,
                output: tempOutput,
            }
            const pro = tryByTimesAndInterval(3, async (remainTime) => {
                try {
                    await genFn(cur);
                    return true;
                } catch (err) {
                    console.log(err)
                    // 第三次失败通知任务发送者
                    if (remainTime == 1) {
                        sender(2, { err, item });
                    }
                    return false;
                }
            })
            return pro.then((flag) => {
                // 暂停后所有操作都停止
                if(statusUtils.isPause()){
                    return Promise.reject('pause');
                }
                let sumTime = Date.now() - start;
                if (flag) {
                    // 文件生成后 将文件移到目标目录
                    shelljs.mv(tempOutput, output);
                    sender(1, item);
                    debug(`end task:${currentTaskIndex}, renderTime: %o`, sumTime);
                } else {
                    FailTaskList.push(item);
                    debug(`task:${currentTaskIndex} render fail: %o`, new Date());
                }
            });
        }
        if (!prevPromiseMap[curPromiseIndex]) {
            prevPromiseMap[curPromiseIndex] = tasks();
        } else {
            prevPromiseMap[curPromiseIndex] = prevPromiseMap[curPromiseIndex].then(tasks);
        }
    }
    let promiseAll = Object.keys(prevPromiseMap).map(key => prevPromiseMap[key]);
    return Promise.all(promiseAll).then(res => {
        if (FailTaskList.length) {
            sender(3, {
                failList: FailTaskList
            });
        }
        return res;
    }).catch(err => {
        // 暂停后不抛出异常
        if(err !== 'pause'){
            throw err;
        }
        console.log(err);
    });
}

module.exports = {
    genImg,
    batchHandlerGen
}