#!/bin/bash
# 使用 curl 下载作者数据，支持断点续传
# 运行方式: bash download_authors_curl.sh

cd "/Users/xavier/Desktop/code task/sciscinet_data"

TOKEN=$(cat ~/.cache/huggingface/token)
URL="https://huggingface.co/datasets/Northwestern-CSSI/sciscinet-v2/resolve/main/sciscinet_authors.parquet"

echo "开始下载 sciscinet_authors.parquet (约 2-3GB)..."
echo "支持断点续传，如果中断可重新运行此脚本继续下载"
echo ""

curl -L -C - \
  -H "Authorization: Bearer $TOKEN" \
  -o sciscinet_authors.parquet \
  --progress-bar \
  "$URL"

echo ""
echo "下载完成！"
ls -lh sciscinet_authors.parquet
