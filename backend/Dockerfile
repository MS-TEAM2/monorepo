# 빌드 컨텍스트는 레포 루트:  docker build -f backend/Dockerfile .
# ai/artifacts/model.joblib 이 있으면 이미지에 함께 들어간다 (모델을 백엔드 컨테이너에서 서빙).
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
COPY ai ai
COPY backend backend
RUN uv sync --locked --no-dev --package backend --no-editable

ENV PATH="/app/.venv/bin:$PATH" \
    MODEL_PATH=/app/ai/artifacts/model.joblib
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
