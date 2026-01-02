#!/bin/bash
# 一键处理所有数据
# 运行方式: bash process_all.sh

cd "/Users/xavier/Desktop/code task"

echo "=========================================="
echo "步骤 1/2: 筛选引用关系"
echo "=========================================="
python3 filter_refs.py

echo ""
echo "=========================================="
echo "步骤 2/2: 下载并筛选作者信息"
echo "=========================================="
python3 download_authors.py

echo ""
echo "=========================================="
echo "全部完成！"
echo "=========================================="
echo ""
echo "已生成的数据文件:"
ls -lh sciscinet_data/*.parquet
