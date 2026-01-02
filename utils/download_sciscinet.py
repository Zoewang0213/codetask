"""
SciSciNet 数据筛选脚本
目标：只下载/筛选 University of Maryland, College Park 的计算机科学数据
使用 Hugging Face + 流式处理，避免下载全部数据
"""

import os
from pathlib import Path

# 输出目录
DATA_DIR = Path("./sciscinet_data")
DATA_DIR.mkdir(exist_ok=True)

def install_dependencies():
    """安装必要的依赖"""
    import subprocess
    packages = [
        "huggingface_hub",
        "pandas",
        "pyarrow",
        "requests",
    ]
    for pkg in packages:
        subprocess.run(["pip", "install", "-q", pkg])
    print("✓ 依赖安装完成")


def step1_download_small_files():
    """
    第一步：只下载小的元数据文件
    - affiliations (机构) - 找 UMD 的 ID
    - fields (领域) - 找 Computer Science 的 ID
    """
    from huggingface_hub import hf_hub_download

    print("\n" + "="*50)
    print("第一步：下载元数据文件（很小）")
    print("="*50)

    repo_id = "Northwestern-CSSI/sciscinet-v2"

    small_files = [
        "sciscinet_affiliations.parquet",  # 机构信息
        "sciscinet_fields.parquet",        # 领域信息
    ]

    for filename in small_files:
        print(f"\n下载: {filename}")
        try:
            path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                local_dir=DATA_DIR,
                repo_type="dataset"
            )
            print(f"✓ 保存到: {path}")
        except Exception as e:
            print(f"✗ 失败: {e}")


def step2_find_umd_and_cs_ids():
    """
    第二步：从下载的文件中找到 UMD 和 CS 的 ID
    """
    import pandas as pd

    print("\n" + "="*50)
    print("第二步：查找 UMD 和 Computer Science 的 ID")
    print("="*50)

    # 查找 UMD
    affiliations_file = DATA_DIR / "sciscinet_affiliations.parquet"
    if affiliations_file.exists():
        df_aff = pd.read_parquet(affiliations_file)
        print(f"\n机构总数: {len(df_aff)}")
        print(f"列名: {df_aff.columns.tolist()}")

        # 搜索 Maryland
        umd_mask = df_aff.apply(lambda row: row.astype(str).str.contains('Maryland', case=False).any(), axis=1)
        umd_rows = df_aff[umd_mask]

        print(f"\n包含 'Maryland' 的机构 ({len(umd_rows)} 个):")
        print(umd_rows.to_string())

        # 保存 UMD 相关机构
        umd_rows.to_csv(DATA_DIR / "umd_affiliations.csv", index=False)
        print(f"\n✓ 已保存到: {DATA_DIR / 'umd_affiliations.csv'}")
    else:
        print("✗ affiliations 文件不存在，请先运行 step1")

    # 查找 Computer Science
    fields_file = DATA_DIR / "sciscinet_fields.parquet"
    if fields_file.exists():
        df_fields = pd.read_parquet(fields_file)
        print(f"\n领域总数: {len(df_fields)}")
        print(f"列名: {df_fields.columns.tolist()}")

        # 搜索 Computer Science
        cs_mask = df_fields.apply(lambda row: row.astype(str).str.contains('Computer', case=False).any(), axis=1)
        cs_rows = df_fields[cs_mask]

        print(f"\n包含 'Computer' 的领域 ({len(cs_rows)} 个):")
        print(cs_rows.to_string())

        # 保存 CS 相关领域
        cs_rows.to_csv(DATA_DIR / "cs_fields.csv", index=False)
        print(f"\n✓ 已保存到: {DATA_DIR / 'cs_fields.csv'}")
    else:
        print("✗ fields 文件不存在，请先运行 step1")


def step3_stream_filter_papers(umd_affiliation_id, cs_field_id=None):
    """
    第三步：流式处理大文件，只筛选 UMD 的论文
    不下载完整文件，而是分块读取并筛选

    参数:
    - umd_affiliation_id: UMD 的机构 ID (从 step2 获得)
    - cs_field_id: Computer Science 的领域 ID (可选)
    """
    import pandas as pd
    import pyarrow.parquet as pq
    from huggingface_hub import hf_hub_url, hf_hub_download

    print("\n" + "="*50)
    print("第三步：流式筛选 UMD 论文数据")
    print("="*50)
    print(f"UMD Affiliation ID: {umd_affiliation_id}")
    if cs_field_id:
        print(f"CS Field ID: {cs_field_id}")

    repo_id = "Northwestern-CSSI/sciscinet-v2"

    # 下载 paper-author-affiliations 文件来筛选 UMD 的论文
    print("\n下载 paper-author-affiliations 文件（这个文件较大，需要一些时间）...")

    try:
        paa_path = hf_hub_download(
            repo_id=repo_id,
            filename="sciscinet_paperauthoraffiliations.parquet",
            local_dir=DATA_DIR,
            repo_type="dataset"
        )
        print(f"✓ 下载完成: {paa_path}")

        # 分块读取并筛选
        print("\n筛选 UMD 相关记录...")

        # 使用 pyarrow 分块读取
        parquet_file = pq.ParquetFile(paa_path)

        umd_records = []
        total_rows = parquet_file.metadata.num_rows

        for i, batch in enumerate(parquet_file.iter_batches(batch_size=1000000)):
            df_batch = batch.to_pandas()

            # 筛选包含 UMD affiliation 的记录
            # 根据实际列名调整
            affiliation_col = None
            for col in df_batch.columns:
                if 'affiliation' in col.lower():
                    affiliation_col = col
                    break

            if affiliation_col:
                umd_batch = df_batch[df_batch[affiliation_col].astype(str) == str(umd_affiliation_id)]
                if len(umd_batch) > 0:
                    umd_records.append(umd_batch)

            processed = min((i + 1) * 1000000, total_rows)
            print(f"  处理进度: {processed:,} / {total_rows:,} ({100*processed/total_rows:.1f}%)", end='\r')

        print()

        if umd_records:
            df_umd = pd.concat(umd_records, ignore_index=True)
            output_path = DATA_DIR / "umd_paper_author_affiliations.parquet"
            df_umd.to_parquet(output_path)
            print(f"\n✓ 找到 {len(df_umd)} 条 UMD 相关记录")
            print(f"✓ 保存到: {output_path}")

            # 获取 UMD 论文 ID 列表
            paper_col = None
            for col in df_umd.columns:
                if 'paper' in col.lower():
                    paper_col = col
                    break

            if paper_col:
                umd_paper_ids = df_umd[paper_col].unique()
                print(f"✓ UMD 论文数量: {len(umd_paper_ids)}")

                # 保存论文 ID 列表
                pd.DataFrame({'paperid': umd_paper_ids}).to_csv(
                    DATA_DIR / "umd_paper_ids.csv", index=False
                )
                return umd_paper_ids
        else:
            print("\n✗ 未找到 UMD 相关记录，请检查 affiliation_id 是否正确")

    except Exception as e:
        print(f"✗ 错误: {e}")
        import traceback
        traceback.print_exc()

    return None


def step4_download_umd_papers(umd_paper_ids):
    """
    第四步：根据论文 ID 列表，下载其他相关数据
    """
    import pandas as pd
    from huggingface_hub import hf_hub_download
    import pyarrow.parquet as pq

    print("\n" + "="*50)
    print("第四步：下载 UMD 论文的详细信息")
    print("="*50)

    if umd_paper_ids is None:
        # 从文件加载
        ids_file = DATA_DIR / "umd_paper_ids.csv"
        if ids_file.exists():
            umd_paper_ids = pd.read_csv(ids_file)['paperid'].values
        else:
            print("✗ 未找到论文 ID 列表，请先运行 step3")
            return

    umd_paper_ids_set = set(str(pid) for pid in umd_paper_ids)
    print(f"UMD 论文数量: {len(umd_paper_ids_set)}")

    repo_id = "Northwestern-CSSI/sciscinet-v2"

    # 需要筛选的大文件
    files_to_filter = [
        "sciscinet_papers.parquet",           # 论文基本信息
        "sciscinet_paperfields.parquet",      # 论文-领域
        "sciscinet_paperreferences.parquet",  # 引用关系
    ]

    for filename in files_to_filter:
        print(f"\n处理: {filename}")

        try:
            file_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                local_dir=DATA_DIR,
                repo_type="dataset"
            )

            # 分块读取并筛选
            parquet_file = pq.ParquetFile(file_path)
            filtered_records = []

            for batch in parquet_file.iter_batches(batch_size=500000):
                df_batch = batch.to_pandas()

                # 找到 paperid 列
                paper_col = None
                for col in df_batch.columns:
                    if 'paperid' in col.lower():
                        paper_col = col
                        break

                if paper_col:
                    mask = df_batch[paper_col].astype(str).isin(umd_paper_ids_set)
                    filtered = df_batch[mask]
                    if len(filtered) > 0:
                        filtered_records.append(filtered)

                print(f"  已处理批次，当前筛选到 {sum(len(r) for r in filtered_records)} 条记录", end='\r')

            print()

            if filtered_records:
                df_filtered = pd.concat(filtered_records, ignore_index=True)
                output_name = f"umd_{filename}"
                output_path = DATA_DIR / output_name
                df_filtered.to_parquet(output_path)
                print(f"✓ 保存 {len(df_filtered)} 条记录到: {output_path}")

        except Exception as e:
            print(f"✗ 错误: {e}")


# ============== 主程序 ==============
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║     SciSciNet - University of Maryland 数据筛选脚本          ║
╚══════════════════════════════════════════════════════════════╝

步骤:
1. 下载小文件 (affiliations, fields)
2. 查找 UMD 和 CS 的 ID
3. 流式筛选 UMD 论文
4. 下载筛选后的详细数据
""")

    print("请选择操作:")
    print("1. 安装依赖")
    print("2. 执行第一步：下载元数据文件")
    print("3. 执行第二步：查找 UMD 和 CS 的 ID")
    print("4. 执行第三步：筛选 UMD 论文（需要输入 UMD ID）")
    print("5. 执行第四步：下载 UMD 论文详细数据")
    print("6. 执行全部步骤 (1-3)")

    choice = input("\n请输入选项: ").strip()

    if choice == "1":
        install_dependencies()
    elif choice == "2":
        step1_download_small_files()
    elif choice == "3":
        step2_find_umd_and_cs_ids()
    elif choice == "4":
        umd_id = input("请输入 UMD 的 affiliation_id: ").strip()
        cs_id = input("请输入 CS 的 field_id (可选，按回车跳过): ").strip()
        step3_stream_filter_papers(umd_id, cs_id if cs_id else None)
    elif choice == "5":
        step4_download_umd_papers(None)
    elif choice == "6":
        install_dependencies()
        step1_download_small_files()
        step2_find_umd_and_cs_ids()
        print("\n" + "="*50)
        print("前三步完成！")
        print("请查看输出的 CSV 文件，找到 UMD 的 affiliation_id")
        print("然后运行选项 4 继续筛选")
    else:
        print("无效选项")
