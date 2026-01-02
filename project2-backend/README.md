# Project 2 Backend - SciSciNet LLM Agent API

Flask API with Claude-powered LLM Agent for UMD CS research data analysis.

## Setup

```bash
cd project2-backend
pip install -r requirements.txt

# Set your Claude API key
export ANTHROPIC_API_KEY=your-api-key

python app.py
```

Server runs at http://localhost:5001

## API Endpoints

- `POST /api/chat` - Chat with the LLM Agent
- `GET /api/data/papers-by-year` - Papers by year with Vega-Lite
- `GET /api/data/top-authors` - Top authors ranking
- `GET /api/data/citation-stats` - Citation statistics
- `GET /api/data/yearly-trend` - Yearly trends
- `GET /api/health` - Health check

## Agent Tools

The LLM Agent has access to:
- `query_papers_by_year()` - Paper counts by year
- `query_top_authors()` - Author rankings
- `query_citation_stats()` - Citation statistics
- `query_collaboration_stats()` - Collaboration metrics
- `query_yearly_trend()` - Trend analysis

## Example

```bash
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How many papers were published in 2023?"}'
```
