"""
Project 2 Backend - Flask API for LLM Agent
提供聊天接口和数据查询
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from agent import SciSciNetAgent, generate_vega_lite_spec
from tools import (
    query_papers_by_year,
    query_top_authors,
    query_citation_stats,
    query_collaboration_stats,
    query_yearly_trend,
    query_papers_with_filters
)

app = Flask(__name__)
CORS(app)

# 初始化 Agent（延迟加载，需要 API key）
_agent = None


def get_agent():
    global _agent
    if _agent is None:
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        _agent = SciSciNetAgent(api_key)
    return _agent


@app.route('/')
def index():
    return jsonify({
        'name': 'SciSciNet UMD LLM Agent API',
        'version': '1.0',
        'endpoints': {
            '/api/chat': 'POST - Chat with the agent',
            '/api/data/papers-by-year': 'GET - Papers by year',
            '/api/data/top-authors': 'GET - Top authors',
            '/api/data/citation-stats': 'GET - Citation statistics',
            '/api/data/collaboration-stats': 'GET - Collaboration statistics',
            '/api/data/yearly-trend': 'GET - Yearly trends'
        }
    })


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    与 Agent 对话

    Request body:
    {
        "message": "用户问题"
    }

    Response:
    {
        "text": "回复文本",
        "vega_lite": {...} or null,
        "data": [...]
    }
    """
    try:
        data = request.get_json()
        message = data.get('message', '')

        if not message:
            return jsonify({'error': 'Message is required'}), 400

        agent = get_agent()
        result = agent.chat(message)

        return jsonify(result)

    except ValueError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': f'Agent error: {str(e)}'}), 500


@app.route('/api/data/papers-by-year')
def papers_by_year():
    """获取按年份统计的论文数据"""
    start_year = request.args.get('start_year', 2014, type=int)
    end_year = request.args.get('end_year', 2024, type=int)

    data = query_papers_by_year(start_year, end_year)

    # 自动生成 Vega-Lite 可视化
    vega_spec = generate_vega_lite_spec(
        data,
        chart_type='bar',
        x_field='year',
        y_field='paper_count',
        title='UMD CS Papers by Year'
    )

    return jsonify({
        'data': data,
        'vega_lite': vega_spec
    })


@app.route('/api/data/top-authors')
def top_authors():
    """获取排名靠前的作者"""
    top_n = request.args.get('top_n', 10, type=int)
    metric = request.args.get('metric', 'paper_count')

    data = query_top_authors(top_n, metric)

    # 为排名生成条形图
    vega_spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "title": f"Top {top_n} Authors by {metric.replace('_', ' ').title()}",
        "width": 500,
        "height": 300,
        "data": {"values": data},
        "mark": {"type": "bar", "tooltip": True},
        "encoding": {
            "y": {
                "field": "display_name",
                "type": "nominal",
                "sort": f"-x",
                "title": "Author"
            },
            "x": {
                "field": metric,
                "type": "quantitative",
                "title": metric.replace('_', ' ').title()
            },
            "color": {"value": "#4a90d9"}
        }
    }

    return jsonify({
        'data': data,
        'vega_lite': vega_spec
    })


@app.route('/api/data/citation-stats')
def citation_stats():
    """获取引用统计"""
    data = query_citation_stats()
    return jsonify({'data': data})


@app.route('/api/data/collaboration-stats')
def collaboration_stats():
    """获取合作统计"""
    data = query_collaboration_stats()
    return jsonify({'data': data})


@app.route('/api/data/yearly-trend')
def yearly_trend():
    """获取年度趋势"""
    metric = request.args.get('metric', 'papers')
    data = query_yearly_trend(metric)

    vega_spec = generate_vega_lite_spec(
        data,
        chart_type='line',
        x_field='year',
        y_field='value',
        title=f'Yearly Trend: {metric.title()}'
    )

    return jsonify({
        'data': data,
        'vega_lite': vega_spec
    })


@app.route('/api/health')
def health():
    """健康检查"""
    has_api_key = bool(os.getenv('ANTHROPIC_API_KEY'))
    return jsonify({
        'status': 'ok',
        'api_key_configured': has_api_key
    })


if __name__ == '__main__':
    print("启动 LLM Agent API 服务...")
    print("访问 http://localhost:5001 查看 API 文档")
    print("\n注意: 请确保设置了 ANTHROPIC_API_KEY 环境变量")
    print("export ANTHROPIC_API_KEY=your-api-key")
    app.run(debug=True, port=5001)
