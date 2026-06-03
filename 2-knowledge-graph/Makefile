.PHONY: install dev test test-cov lint format typecheck up down logs seed clean

install:
	pip install -e .[dev]

dev:
	uvicorn app.main:app --reload --port 8000

test:
	pytest

test-cov:
	pytest --cov=app --cov-report=term-missing

lint:
	ruff check app tests

format:
	ruff format app tests
	ruff check --fix app tests

typecheck:
	mypy app

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api

seed:
	python -m scripts.seed

clean:
	docker compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
