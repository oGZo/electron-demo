const path = require('path');
// 主程序打包配置
const mainConfig = {
  mode: 'production',
  entry: path.join(__dirname, './index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js'
  },
  node: {
    __dirname: false
  },
  target: 'electron-main'
};
module.exports = mainConfig;
