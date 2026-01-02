"""
LLM Agent Tools - 数据查询工具
为 Agent 提供查询 SciSciNet UMD 数据的能力
"""

import pandas as pd
from pathlib import Path
from typing import Optional, List, Dict, Any

DATA_DIR = Path('../sciscinet_data')


def load_papers() -> pd.DataFrame:
    """加载论文数据"""
    return pd.read_parquet(DATA_DIR / "umd_cs_papers.parquet")


def load_authors() -> pd.DataFrame:
    """加载作者数据"""
    return pd.read_parquet(DATA_DIR / "umd_authors.parquet")


def load_paper_author() -> pd.DataFrame:
    """加载论文-作者关系"""
    return pd.read_parquet(DATA_DIR / "umd_paper_author_affiliation.parquet")


def load_refs() -> pd.DataFrame:
    """加载引用关系"""
    return pd.read_parquet(DATA_DIR / "umd_cs_paperrefs.parquet")


# ========== Tool Functions ==========

def query_papers_by_year(start_year: int = 2014, end_year: int = 2024) -> List[Dict]:
    """
    按年份统计论文数量
    返回每年的论文数、引用总数、专利总数
    """
    df = load_papers()
    df = df[(df['year'] >= start_year) & (df['year'] <= end_year)]

    result = df.groupby('year').agg({
        'paperid': 'count',
        'cited_by_count': 'sum',
        'patent_count': 'sum'
    }).reset_index()

    result.columns = ['year', 'paper_count', 'total_citations', 'total_patents']
    return result.to_dict('records')


def query_top_authors(top_n: int = 10, metric: str = 'paper_count') -> List[Dict]:
    """
    查询排名靠前的作者
    metric: 'paper_count', 'h_index', 或 'productivity'
    """
    df_paa = load_paper_author()
    df_authors = load_authors()

    # 统计每个作者的论文数
    author_papers = df_paa.groupby('authorid').size().reset_index(name='paper_count')
    author_papers['authorid'] = author_papers['authorid'].astype(str)

    # 合并作者信息
    df_authors['authorid'] = df_authors['authorid'].astype(str)
    merged = author_papers.merge(df_authors, on='authorid', how='left')

    # 按指标排序
    if metric == 'paper_count':
        merged = merged.sort_values('paper_count', ascending=False)
    elif metric == 'h_index':
        merged = merged.sort_values('h_index', ascending=False)
    elif metric == 'productivity':
        merged = merged.sort_values('productivity', ascending=False)

    top = merged.head(top_n)
    return top[['authorid', 'display_name', 'paper_count', 'h_index', 'productivity']].fillna(0).to_dict('records')


def query_citation_stats() -> Dict:
    """
    获取引用统计信息
    """
    df = load_papers()
    df_refs = load_refs()

    return {
        'total_papers': len(df),
        'total_internal_citations': len(df_refs),
        'avg_citations_per_paper': float(df['cited_by_count'].mean()),
        'max_citations': int(df['cited_by_count'].max()),
        'papers_with_patents': int((df['patent_count'] > 0).sum()),
        'total_patent_citations': int(df['patent_count'].sum())
    }


def query_papers_with_filters(
    year: Optional[int] = None,
    min_citations: Optional[int] = None,
    has_patents: Optional[bool] = None,
    limit: int = 20
) -> List[Dict]:
    """
    根据过滤条件查询论文
    """
    df = load_papers()

    if year:
        df = df[df['year'] == year]
    if min_citations:
        df = df[df['cited_by_count'] >= min_citations]
    if has_patents:
        df = df[df['patent_count'] > 0]

    df = df.sort_values('cited_by_count', ascending=False).head(limit)

    return df[['paperid', 'year', 'cited_by_count', 'patent_count']].to_dict('records')


def query_collaboration_stats() -> Dict:
    """
    获取合作统计信息
    """
    df_paa = load_paper_author()

    # 每篇论文的作者数
    authors_per_paper = df_paa.groupby('paperid').size()

    return {
        'total_authors': df_paa['authorid'].nunique(),
        'avg_authors_per_paper': float(authors_per_paper.mean()),
        'max_authors_on_paper': int(authors_per_paper.max()),
        'single_author_papers': int((authors_per_paper == 1).sum()),
        'multi_author_papers': int((authors_per_paper > 1).sum())
    }


def query_yearly_trend(metric: str = 'papers') -> List[Dict]:
    """
    查询年度趋势
    metric: 'papers', 'citations', 'patents'
    """
    df = load_papers()
    df = df[df['year'] >= 2000]  # 只看2000年后

    if metric == 'papers':
        result = df.groupby('year').size().reset_index(name='value')
    elif metric == 'citations':
        result = df.groupby('year')['cited_by_count'].sum().reset_index(name='value')
    elif metric == 'patents':
        result = df.groupby('year')['patent_count'].sum().reset_index(name='value')
    else:
        result = df.groupby('year').size().reset_index(name='value')

    result['metric'] = metric
    return result.to_dict('records')


# Tool 描述（供 Agent 使用）
TOOL_DESCRIPTIONS = {
    'query_papers_by_year': {
        'name': 'query_papers_by_year',
        'description': '按年份统计论文数量，返回每年的论文数、引用总数和专利总数',
        'parameters': {
            'start_year': {'type': 'int', 'description': '起始年份', 'default': 2014},
            'end_year': {'type': 'int', 'description': '结束年份', 'default': 2024}
        }
    },
    'query_top_authors': {
        'name': 'query_top_authors',
        'description': '查询排名靠前的作者，可按论文数、h-index或生产力排序',
        'parameters': {
            'top_n': {'type': 'int', 'description': '返回数量', 'default': 10},
            'metric': {'type': 'str', 'description': '排序指标: paper_count, h_index, productivity', 'default': 'paper_count'}
        }
    },
    'query_citation_stats': {
        'name': 'query_citation_stats',
        'description': '获取引用统计信息，包括总论文数、内部引用数、平均引用等',
        'parameters': {}
    },
    'query_papers_with_filters': {
        'name': 'query_papers_with_filters',
        'description': '根据条件筛选论文，支持年份、最低引用数、是否有专利',
        'parameters': {
            'year': {'type': 'int', 'description': '年份过滤', 'optional': True},
            'min_citations': {'type': 'int', 'description': '最低引用数', 'optional': True},
            'has_patents': {'type': 'bool', 'description': '是否有专利引用', 'optional': True},
            'limit': {'type': 'int', 'description': '返回数量限制', 'default': 20}
        }
    },
    'query_collaboration_stats': {
        'name': 'query_collaboration_stats',
        'description': '获取合作统计，包括作者数、平均作者数等',
        'parameters': {}
    },
    'query_yearly_trend': {
        'name': 'query_yearly_trend',
        'description': '查询年度趋势，可选择论文数、引用数或专利数',
        'parameters': {
            'metric': {'type': 'str', 'description': '指标: papers, citations, patents', 'default': 'papers'}
        }
    }
}

# 工具函数映射
TOOLS = {
    'query_papers_by_year': query_papers_by_year,
    'query_top_authors': query_top_authors,
    'query_citation_stats': query_citation_stats,
    'query_papers_with_filters': query_papers_with_filters,
    'query_collaboration_stats': query_collaboration_stats,
    'query_yearly_trend': query_yearly_trend
}


if __name__ == '__main__':
    # 测试工具
    print("Testing tools...")

    print("\n1. Papers by year:")
    result = query_papers_by_year(2020, 2024)
    for r in result:
        print(f"  {r['year']}: {r['paper_count']} papers")

    print("\n2. Top authors:")
    result = query_top_authors(5)
    for r in result:
        print(f"  {r['display_name']}: {r['paper_count']} papers, h-index: {r['h_index']}")

    print("\n3. Citation stats:")
    print(query_citation_stats())

    print("\n4. Collaboration stats:")
    print(query_collaboration_stats())
