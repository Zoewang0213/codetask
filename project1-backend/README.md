# Project 1 Backend - SciSciNet UMD Visualization API

Flask API for UMD Computer Science research data visualization.

## Setup

```bash
cd project1-backend
pip install -r requirements.txt
python app.py
```

Server runs at http://localhost:5000

## API Endpoints

- `GET /api/citation-network` - Citation network data (T1)
- `GET /api/collaboration-network` - Author collaboration network (T1)
- `GET /api/timeline` - Publication timeline (T2)
- `GET /api/patent-histogram` - Patent distribution (T2)

## Data

Uses filtered UMD data from `../sciscinet_data/`:
- 87,738 UMD CS papers
- 126,892 citations
- 78,079 authors
