"""
Project 1 Backend - Flask API
提供数据可视化所需的 API 接口
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from data_processor import (
    get_citation_network,
    get_collaboration_network,
    get_timeline_data,
    get_patent_histogram,
    get_papers_by_year
)

app = Flask(__name__)
CORS(app)  # 允许跨域请求


@app.route('/')
def index():
    """API 首页"""
    return jsonify({
        'name': 'SciSciNet UMD Visualization API',
        'version': '1.0',
        'endpoints': {
            '/api/citation-network': 'GET - 获取引用网络数据',
            '/api/collaboration-network': 'GET - 获取合作网络数据',
            '/api/timeline': 'GET - 获取时间线数据',
            '/api/patent-histogram': 'GET - 获取专利分布数据',
            '/api/papers/<year>': 'GET - 获取某年的论文'
        }
    })


@app.route('/api/citation-network')
def citation_network():
    """
    获取引用网络数据 (T1)
    Query params:
        - start_year: 起始年份 (默认 2019)
        - max_nodes: 最大节点数 (默认 500)
    """
    start_year = request.args.get('start_year', 2019, type=int)
    max_nodes = request.args.get('max_nodes', 500, type=int)

    data = get_citation_network(start_year=start_year, max_nodes=max_nodes)
    return jsonify(data)


@app.route('/api/collaboration-network')
def collaboration_network():
    """
    获取合作网络数据 (T1)
    Query params:
        - start_year: 起始年份 (默认 2019)
        - max_authors: 最大作者数 (默认 300)
    """
    start_year = request.args.get('start_year', 2019, type=int)
    max_authors = request.args.get('max_authors', 300, type=int)

    data = get_collaboration_network(start_year=start_year, max_authors=max_authors)
    return jsonify(data)


@app.route('/api/timeline')
def timeline():
    """
    获取时间线数据 (T2)
    Query params:
        - start_year: 起始年份 (默认 2014)
    """
    start_year = request.args.get('start_year', 2014, type=int)

    data = get_timeline_data(start_year=start_year)
    return jsonify(data)


@app.route('/api/patent-histogram')
def patent_histogram():
    """
    获取专利分布数据 (T2)
    Query params:
        - year: 年份 (可选，不传则返回全部)
    """
    year = request.args.get('year', type=int)

    data = get_patent_histogram(year=year)
    return jsonify(data)


@app.route('/api/papers/<int:year>')
def papers_by_year(year):
    """获取某年的论文列表"""
    data = get_papers_by_year(year)
    return jsonify(data)


if __name__ == '__main__':
    print("启动 Flask API 服务...")
    print("访问 http://localhost:5000 查看 API 文档")
    app.run(debug=True, port=5000)
