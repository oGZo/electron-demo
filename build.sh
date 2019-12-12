# 检查是否安装asar
if ! command -v asar; then
  npm i asar -g
fi
# 如果不存在app目录，创建app目录
if [ ! -d "app" ]; then
  mkdir app
fi
if [ -d "dist" ]; then
  rm -rf dist/*
fi

mkdir dist

ENV=$1
echo $ENV
if [ $ENV ]; then
  npm run build --env=$ENV
else 
  npm run build
fi
# 复制src中package.json,main目录移动到dist
cp ./package.json index.html ./dist/
# 打包
asar p dist ./app/app.asar 