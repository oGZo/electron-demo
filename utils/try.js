const { sleep } = require('./time');
/**
 * @name tryByTimesAndInterval
 * @description 通过次数和时间间隔 以及是否继续尝试来达到重试目的
 * @param {number} maxTimes 最大重试次数
 * @param {function} isGoOn  判断是否继续尝试的的方法 支持返回结果为promise 该方法执行结果为boolean值: true 为达到结果无需继续尝试 false为可继续尝试
 * @param {*} interval  隔多久重试一次
 * @returns {boolean} 返回重试的
 */
const tryByTimesAndInterval = async (maxTimes, isGoOn, interval = 1) => {
    let isGo = await isGoOn(maxTimes);
    if (isGo) {
      return true;
    }
    if (maxTimes > 1) {
      await sleep(interval);
      await tryByTimesAndInterval(maxTimes - 1, isGoOn, interval);
    } else {
      return isGo;
    }
};

module.exports = {
    tryByTimesAndInterval
}