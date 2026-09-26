# AtlasOps Cmd Backend

## Setup
1. `python -m venv venv`
2. `.\venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
3. `pip install -r requirements.txt`

## Run
`uvicorn app.main:app --reload`

## Test
`pytest tests/`
