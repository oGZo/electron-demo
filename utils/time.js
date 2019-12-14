
const sleep = time => new Promise(resolve => setTimeout(resolve, time * 1000 || 0));

module.exports = {
    sleep
}
