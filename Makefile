.PHONY: setup run-local run-remote clean

# === 1. Create virtual environment & install dependencies ===
setup:
	python -m venv .venv
	. .venv/bin/activate && python -m pip install --upgrade pip && pip install -r requirements.txt
	@echo "Setup complete. Activate with: source .venv/bin/activate"

# === 2. Run LOCAL version (only accessible from the Pi itself) ===
run-local:
	. .venv/bin/activate && uvicorn local_ver.backend.server:app --host 192.168.1.121 --port 8080 --reload

# === 3. Run REMOTE version (accessible from other devices in the network) ===
run-remote:
	. .venv/bin/activate && uvicorn remote_ver.backend.server:app --host 0.0.0.0 --port 8080 --reload

# === 4. Clean up Python cache files ===
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo " Cleaned up Python cache files."
