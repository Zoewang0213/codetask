"""
下载并筛选 UMD 作者信息
运行方式: python3 download_authors.py
"""

from huggingface_hub import hf_hub_download
from pathlib import Path
import pandas as pd
import pyarrow.parquet as pq
import os

DATA_DIR = Path('./sciscinet_data')
repo_id = 'Northwestern-CSSI/sciscinet-v2'

# 加载 UMD 论文-作者关系，获取作者 ID
print("加载 UMD 作者 ID...")
df_paa = pd.read_parquet(DATA_DIR / "umd_paper_author_affiliation.parquet")
umd_author_ids = set(df_paa['authorid'].astype(str).values)
print(f"UMD 作者数量: {len(umd_author_ids):,}")

print()
print("="*60)
print("下载 sciscinet_authors（作者信息）")
print("="*60)

# 下载 authors
authors_path = hf_hub_download(
    repo_id=repo_id,
    filename='sciscinet_authors.parquet',
    local_dir=DATA_DIR,
    repo_type='dataset'
)
print(f"✓ 下载完成: {authors_path}")

# 筛选 UMD 作者
print("\n筛选 UMD 作者...")
pf = pq.ParquetFile(authors_path)
print(f"总行数: {pf.metadata.num_rows:,}")
print(f"列名: {pf.schema.names}")

umd_authors = []
batch_size = 2000000
total = pf.metadata.num_rows

for i, batch in enumerate(pf.iter_batches(batch_size=batch_size)):
    df = batch.to_pandas()
    author_col = [c for c in df.columns if 'authorid' in c.lower()][0]

    filtered = df[df[author_col].astype(str).isin(umd_author_ids)]
    if len(filtered) > 0:
        umd_authors.append(filtered)

    processed = min((i + 1) * batch_size, total)
    found = sum(len(r) for r in umd_authors)
    pct = 100 * processed / total
    print(f"进度: {processed:,} / {total:,} ({pct:.1f}%) | UMD作者: {found:,}", end='\r')

print()
if umd_authors:
    df_authors = pd.concat(umd_authors, ignore_index=True)
    df_authors.to_parquet(DATA_DIR / "umd_authors.parquet")
    print(f"✓ 保存 {len(df_authors):,} 条 UMD 作者信息到 umd_authors.parquet")
    print(f"  列: {df_authors.columns.tolist()}")

# 删除大文件
os.remove(authors_path)
print(f"✓ 已删除原始大文件")
print("\n完成!")
