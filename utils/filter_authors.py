"""
筛选 UMD 作者信息（下载完成后运行）
运行方式: python3 filter_authors.py
"""

from pathlib import Path
import pandas as pd
import pyarrow.parquet as pq
import os

DATA_DIR = Path('./sciscinet_data')

# 检查文件是否存在
authors_path = DATA_DIR / "sciscinet_authors.parquet"
if not authors_path.exists():
    print("错误: sciscinet_authors.parquet 不存在")
    print("请先运行: bash download_authors_curl.sh")
    exit(1)

# 加载 UMD 作者 ID
print("加载 UMD 作者 ID...")
df_paa = pd.read_parquet(DATA_DIR / "umd_paper_author_affiliation.parquet")
umd_author_ids = set(df_paa['authorid'].astype(str).values)
print(f"UMD 作者数量: {len(umd_author_ids):,}")

# 筛选作者
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
print("\n删除原始大文件...")
os.remove(authors_path)
print(f"✓ 已删除，释放空间")
print("\n完成!")
