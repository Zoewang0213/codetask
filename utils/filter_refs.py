"""
筛选 UMD CS 论文引用关系（下载完成后运行）
运行方式: python3 filter_refs.py
"""

from pathlib import Path
import pandas as pd
import pyarrow.parquet as pq
import os

DATA_DIR = Path('./sciscinet_data')

# 检查文件是否存在
refs_path = DATA_DIR / "sciscinet_paperrefs.parquet"
if not refs_path.exists():
    print("错误: sciscinet_paperrefs.parquet 不存在")
    print("请先运行: bash download_refs_curl.sh")
    exit(1)

# 加载 UMD CS 论文 ID
print("加载 UMD CS 论文 ID...")
df_cs_ids = pd.read_parquet(DATA_DIR / "umd_cs_paper_ids.parquet")
umd_cs_paper_ids = set(df_cs_ids['paperid'].astype(str).values)
print(f"UMD CS 论文数量: {len(umd_cs_paper_ids):,}")

# 筛选引用关系
print("\n筛选 UMD CS 论文的内部引用关系...")
pf = pq.ParquetFile(refs_path)
print(f"总行数: {pf.metadata.num_rows:,}")

umd_refs = []
batch_size = 5000000
total = pf.metadata.num_rows

for i, batch in enumerate(pf.iter_batches(batch_size=batch_size)):
    df = batch.to_pandas()
    cols = df.columns.tolist()
    citing_col, cited_col = cols[0], cols[1]

    # 只保留 UMD CS 论文之间的内部引用
    mask = (df[citing_col].astype(str).isin(umd_cs_paper_ids)) & \
           (df[cited_col].astype(str).isin(umd_cs_paper_ids))
    filtered = df[mask]
    if len(filtered) > 0:
        umd_refs.append(filtered)

    processed = min((i + 1) * batch_size, total)
    found = sum(len(r) for r in umd_refs)
    pct = 100 * processed / total
    print(f"进度: {processed:,} / {total:,} ({pct:.1f}%) | 内部引用: {found:,}", end='\r')

print()
if umd_refs:
    df_refs = pd.concat(umd_refs, ignore_index=True)
    df_refs.to_parquet(DATA_DIR / "umd_cs_paperrefs.parquet")
    print(f"✓ 保存 {len(df_refs):,} 条 UMD CS 内部引用关系")

# 删除大文件
print("\n删除原始大文件...")
os.remove(refs_path)
print(f"✓ 已删除，释放约 18GB 空间")
print("\n完成!")
