let isPause = false;
// 控制暂停
module.exports = {
    // 暂停
    pause(){
        isPause = true;
    },
    // 是否暂停
    isPause() {
        return isPause;
    },
    // 开始
    start() {
        isPause = false;
    }
}