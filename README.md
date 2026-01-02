# SciSciNet UMD CS Research Data Visualization & Analysis

A comprehensive web application for visualizing and analyzing UMD Computer Science research data from the SciSciNet dataset, featuring interactive visualizations and an AI-powered research assistant.

## Overview

This project consists of two main applications:

### Project 1: Interactive Research Data Visualization
- **Frontend**: React + TypeScript with D3.js visualizations
- **Backend**: Flask API serving processed research data
- **Features**:
  - Citation network visualization
  - Author collaboration network
  - Publication timeline analysis
  - Patent distribution histogram

### Project 2: AI Research Assistant
- **Frontend**: React + TypeScript chat interface with Vega-Lite charts
- **Backend**: Flask API with Claude LLM Agent
- **Features**:
  - Natural language queries about research data
  - Automatic data visualization generation
  - Multi-tool agent with research analytics capabilities

## Dataset

Uses the [SciSciNet dataset](https://huggingface.co/datasets/SciSciNet/SciSciNet) filtered for UMD Computer Science research:
- **87,738** UMD CS papers
- **126,892** internal citations
- **78,079** authors
- **425,782** paper-author relationships

## Project Structure

```
code_task_wo_data/
├── project1-backend/          # Flask API for visualization data
├── project1-frontend/         # React app with D3.js visualizations
├── project2-backend/          # Flask API with LLM Agent
├── project2-frontend/         # React chat interface
├── utils/                     # Data download and processing scripts
└── Coding_Test_Jan2.pdf      # Original requirements document
```

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn
- Anthropic API key (for Project 2)

### Project 1: Visualization Dashboard

**Backend Setup:**
```bash
cd project1-backend
pip install -r requirements.txt
python app.py
```
Server runs at http://localhost:5000

**Frontend Setup:**
```bash
cd project1-frontend
npm install
npm start
```
App runs at http://localhost:3000

### Project 2: AI Research Assistant

**Backend Setup:**
```bash
cd project2-backend
pip install -r requirements.txt

# Set your Claude API key
export ANTHROPIC_API_KEY=your-api-key-here

python app.py
```
Server runs at http://localhost:5001

**Frontend Setup:**
```bash
cd project2-frontend
npm install
npm start
```
App runs at http://localhost:3001

## Data Processing

The `utils/` directory contains scripts for downloading and processing the SciSciNet dataset:

```bash
cd utils

# Download raw data
python download_sciscinet.py

# Filter for UMD CS
python filter_refs.py
python filter_authors.py

# Or run all steps
bash process_all.sh
```

Processed data is saved to `sciscinet_data/` (excluded from git due to size).

## API Documentation

### Project 1 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/citation-network` | GET | Citation network graph data |
| `/api/collaboration-network` | GET | Author collaboration network |
| `/api/timeline` | GET | Publication timeline data |
| `/api/patent-histogram` | GET | Patent distribution data |

### Project 2 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Chat with LLM Agent |
| `/api/data/papers-by-year` | GET | Papers by year with Vega spec |
| `/api/data/top-authors` | GET | Top authors ranking |
| `/api/data/citation-stats` | GET | Citation statistics |
| `/api/data/yearly-trend` | GET | Yearly publication trends |
| `/api/health` | GET | Health check |

## Features

### Project 1: Visualization Dashboard

**Citation Network (T1)**
- Interactive network graph showing paper citations
- Force-directed layout with D3.js
- Hover to see paper details

**Collaboration Network (T1)**
- Author collaboration graph
- Node size represents publication count
- Edge weight represents co-authorship strength

**Timeline Analysis (T2)**
- Publication trends over time
- Interactive time-series visualization
- Yearly aggregation

**Patent Histogram (T2)**
- Distribution of patents by year
- Bar chart visualization
- Statistical overview

### Project 2: AI Research Assistant

**LLM Agent Tools:**
- `query_papers_by_year()` - Analyze publication trends
- `query_top_authors()` - Find most productive researchers
- `query_citation_stats()` - Calculate citation metrics
- `query_collaboration_stats()` - Analyze research collaborations
- `query_yearly_trend()` - Identify research trends

**Example Queries:**
- "How many papers were published in 2023?"
- "Who are the top 10 most productive authors?"
- "Show me the citation distribution"
- "What's the trend in publications over the last 5 years?"

## Technologies Used

### Frontend
- React 18
- TypeScript
- D3.js (visualization)
- Vega-Lite (charts)
- Axios (HTTP client)

### Backend
- Flask (web framework)
- Pandas (data processing)
- PyArrow (parquet files)
- Anthropic Claude API (LLM)
- CORS support

## Development Notes

- All frontend apps use React with TypeScript
- Backend APIs use Flask with CORS enabled
- Data files (`.parquet`) are excluded from version control
- LLM responses include automatic chart generation with Vega-Lite

## License

This project is created for educational and research purposes.

## Author

Zoe Wang (@Zoewang0213)

## Acknowledgments

- SciSciNet dataset from HuggingFace
- UMD Computer Science Department
- Anthropic Claude API
