# Data Processing Utilities

Scripts for downloading and processing SciSciNet data for UMD Computer Science visualization.

## Scripts

### Download Scripts
- `download_sciscinet.py` - Main script to download SciSciNet dataset from HuggingFace
- `download_authors.py` - Download author data
- `download_refs.py` - Download citation reference data
- `download_authors_curl.sh` - Alternative curl-based author download
- `download_refs_curl.sh` - Alternative curl-based refs download

### Filter Scripts
- `filter_authors.py` - Filter authors related to UMD CS papers
- `filter_refs.py` - Filter citation references for UMD CS papers
- `process_all.sh` - Run all processing steps

## Usage

1. First download the base data:
```bash
python download_sciscinet.py
```

2. Filter for UMD CS:
```bash
python filter_refs.py
python filter_authors.py
```

## Output Data

Processed data is saved to `../sciscinet_data/`:
- `umd_cs_papers.parquet` - 87,738 UMD CS papers
- `umd_cs_paperrefs.parquet` - 126,892 internal citations
- `umd_authors.parquet` - 78,079 authors
- `umd_paper_author_affiliation.parquet` - 425,782 paper-author relationships
