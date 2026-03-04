#!/bin/bash

# 获取脚本所在目录并切换过去
cd "$(dirname "$0")"

echo "======================================"
echo "    正在启动 语流 (YuLiu) 2.0 服务     "
echo "======================================"

# 检查 node_modules 是否存在，不存在则安装依赖
if [ ! -d "node_modules" ]; then
    echo "检测到初次运行，正在安装依赖..."
    npm install
fi

echo "正在启动本地服务器并自动打开浏览器..."
# 启动 vite 并自动打开浏览器
npm run dev -- --open
