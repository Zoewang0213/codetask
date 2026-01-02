"""
下载并筛选 UMD CS 论文引用关系
运行方式: python3 download_refs.py
"""

from huggingface_hub import hf_hub_download
from pathlib import Path
import pandas as pd
import pyarrow.parquet as pq
import os

DATA_DIR = Path('./sciscinet_data')
repo_id = 'Northwestern-CSSI/sciscinet-v2'

# 加载 UMD CS 论文 ID
print("加载 UMD CS 论文 ID...")
df_cs_ids = pd.read_parquet(DATA_DIR / "umd_cs_paper_ids.parquet")
umd_cs_paper_ids = set(df_cs_ids['paperid'].astype(str).values)
print(f"UMD CS 论文数量: {len(umd_cs_paper_ids):,}")

print()
print("="*60)
print("下载 sciscinet_paperrefs（引用关系）- 约 18GB")
print("这可能需要 10-30 分钟，取决于网速")
print("="*60)

# 下载 paperrefs
refs_path = hf_hub_download(
    repo_id=repo_id,
    filename='sciscinet_paperrefs.parquet',
    local_dir=DATA_DIR,
    repo_type='dataset'
)
print(f"✓ 下载完成: {refs_path}")

# 筛选 UMD CS 论文的引用关系
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
    print(f"✓ 保存 {len(df_refs):,} 条 UMD CS 内部引用关系到 umd_cs_paperrefs.parquet")

# 删除大文件
os.remove(refs_path)
print(f"✓ 已删除原始大文件，释放约 18GB 空间")
print("\n完成!")
