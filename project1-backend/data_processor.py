"""
数据预处理模块
将 parquet 数据转换为前端可用的 JSON 格式
"""

import pandas as pd
from pathlib import Path
import json

DATA_DIR = Path('../sciscinet_data')

def load_papers():
    """加载论文数据"""
    return pd.read_parquet(DATA_DIR / "umd_cs_papers.parquet")

def load_refs():
    """加载引用关系"""
    return pd.read_parquet(DATA_DIR / "umd_cs_paperrefs.parquet")

def load_authors():
    """加载作者数据"""
    return pd.read_parquet(DATA_DIR / "umd_authors.parquet")

def load_paper_author():
    """加载论文-作者关系"""
    return pd.read_parquet(DATA_DIR / "umd_paper_author_affiliation.parquet")

def get_citation_network(start_year=2019, max_nodes=500):
    """
    获取引用网络数据 (T1)
    只保留过去5年的论文，限制节点数量
    """
    df_papers = load_papers()
    df_refs = load_refs()

    # 筛选过去5年的论文
    recent_papers = df_papers[df_papers['year'] >= start_year]
    recent_paper_ids = set(recent_papers['paperid'].astype(str).values)

    # 筛选这些论文之间的引用关系
    df_refs['citing_paperid'] = df_refs['citing_paperid'].astype(str)
    df_refs['cited_paperid'] = df_refs['cited_paperid'].astype(str)

    mask = (df_refs['citing_paperid'].isin(recent_paper_ids)) & \
           (df_refs['cited_paperid'].isin(recent_paper_ids))
    recent_refs = df_refs[mask]

    # 计算每篇论文的引用数（被引用次数）
    cited_counts = recent_refs['cited_paperid'].value_counts().to_dict()

    # 选择被引用最多的论文作为核心节点
    top_papers = sorted(cited_counts.items(), key=lambda x: -x[1])[:max_nodes]
    top_paper_ids = set([p[0] for p in top_papers])

    # 构建节点
    nodes = []
    paper_info = recent_papers.set_index(recent_papers['paperid'].astype(str))

    for pid in top_paper_ids:
        if pid in paper_info.index:
            row = paper_info.loc[pid]
            nodes.append({
                'id': pid,
                'year': int(row['year']) if pd.notna(row['year']) else None,
                'cited_by_count': int(row['cited_by_count']) if pd.notna(row['cited_by_count']) else 0,
                'patent_count': int(row['patent_count']) if pd.notna(row['patent_count']) else 0,
                'title': str(row.get('title', ''))[:100] if pd.notna(row.get('title', '')) else ''
            })

    # 构建边（只保留核心节点之间的边）
    edges = []
    for _, row in recent_refs.iterrows():
        if row['citing_paperid'] in top_paper_ids and row['cited_paperid'] in top_paper_ids:
            edges.append({
                'source': row['citing_paperid'],
                'target': row['cited_paperid']
            })

    return {'nodes': nodes, 'links': edges}

def get_collaboration_network(start_year=2019, max_authors=300):
    """
    获取作者合作网络数据 (T1)
    """
    df_papers = load_papers()
    df_paa = load_paper_author()
    df_authors = load_authors()

    # 筛选过去5年的论文
    recent_papers = df_papers[df_papers['year'] >= start_year]
    recent_paper_ids = set(recent_papers['paperid'].astype(str).values)

    # 获取这些论文的作者关系
    df_paa['paperid'] = df_paa['paperid'].astype(str)
    df_paa['authorid'] = df_paa['authorid'].astype(str)

    recent_paa = df_paa[df_paa['paperid'].isin(recent_paper_ids)]

    # 计算每个作者的论文数
    author_paper_count = recent_paa.groupby('authorid')['paperid'].nunique().to_dict()

    # 选择论文最多的作者
    top_authors = sorted(author_paper_count.items(), key=lambda x: -x[1])[:max_authors]
    top_author_ids = set([a[0] for a in top_authors])

    # 构建合作关系（同一篇论文的作者）
    collaborations = {}
    for pid, group in recent_paa.groupby('paperid'):
        authors = [a for a in group['authorid'].values if a in top_author_ids]
        for i in range(len(authors)):
            for j in range(i + 1, len(authors)):
                key = tuple(sorted([authors[i], authors[j]]))
                collaborations[key] = collaborations.get(key, 0) + 1

    # 构建节点
    nodes = []
    df_authors['authorid'] = df_authors['authorid'].astype(str)
    author_info = df_authors.set_index('authorid')

    for aid in top_author_ids:
        if aid in author_info.index:
            row = author_info.loc[aid]
            nodes.append({
                'id': aid,
                'name': str(row.get('display_name', ''))[:50] if pd.notna(row.get('display_name', '')) else '',
                'paper_count': author_paper_count.get(aid, 0),
                'h_index': float(row['h_index']) if pd.notna(row.get('h_index')) else 0
            })

    # 构建边
    edges = []
    for (a1, a2), weight in collaborations.items():
        edges.append({
            'source': a1,
            'target': a2,
            'weight': weight
        })

    return {'nodes': nodes, 'links': edges}

def get_timeline_data(start_year=2014):
    """
    获取时间线数据 (T2)
    过去10年的论文数量
    """
    df_papers = load_papers()
    recent = df_papers[df_papers['year'] >= start_year]

    yearly = recent.groupby('year').agg({
        'paperid': 'count',
        'cited_by_count': 'sum',
        'patent_count': 'sum'
    }).reset_index()

    yearly.columns = ['year', 'paper_count', 'total_citations', 'total_patents']

    return yearly.to_dict('records')

def get_patent_histogram(year=None):
    """
    获取专利分布数据 (T2)
    """
    df_papers = load_papers()

    if year:
        df_papers = df_papers[df_papers['year'] == year]

    # 只保留有专利的论文
    with_patents = df_papers[df_papers['patent_count'] > 0]

    # 统计各专利数量的分布
    patent_dist = with_patents['patent_count'].value_counts().sort_index()

    result = [{'patent_count': int(k), 'paper_count': int(v)}
              for k, v in patent_dist.items()]

    return result

def get_papers_by_year(year):
    """获取某年的论文列表"""
    df_papers = load_papers()
    year_papers = df_papers[df_papers['year'] == year]

    return year_papers[['paperid', 'year', 'cited_by_count', 'patent_count']].head(100).to_dict('records')


if __name__ == '__main__':
    # 测试
    print("测试数据处理...")

    print("\n1. 引用网络:")
    citation = get_citation_network()
    print(f"   节点: {len(citation['nodes'])}, 边: {len(citation['links'])}")

    print("\n2. 合作网络:")
    collab = get_collaboration_network()
    print(f"   节点: {len(collab['nodes'])}, 边: {len(collab['links'])}")

    print("\n3. 时间线:")
    timeline = get_timeline_data()
    print(f"   年份数: {len(timeline)}")
    for t in timeline[-5:]:
        print(f"   {t['year']}: {t['paper_count']} 篇论文")

    print("\n4. 专利分布:")
    patents = get_patent_histogram()
    print(f"   分布项: {len(patents)}")
