.PHONY: setup run

# 1. Create and configure the Python virtual environment
setup:
	python -m venv .venv
	. .venv/bin/activate && python -m pip install --upgrade pip && pip install -r requirements.txt

# 2. Start the FastAPI server
run:
	. .venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8000 --reload
