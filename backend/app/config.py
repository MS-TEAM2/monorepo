from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """환경 변수로 덮어쓴다. 비밀 값은 Key Vault → Container Apps 환경 변수로 주입한다."""

    # 실행 위치와 상관없이 항상 backend/.env 를 읽는다 (레포 루트에서 uv run 해도 같다).
    model_config = SettingsConfigDict(env_file=REPO_ROOT / "backend" / ".env", extra="ignore")

    model_path: Path = REPO_ROOT / "ai" / "artifacts" / "model.joblib"
    cors_origins: list[str] = ["http://localhost:3000"]
    # 휴대폰 앱에서 PC의 개발 서버(192.168.x.x:3000)를 열 때만 쓴다. 배포 환경에는 넣지 않는다.
    cors_origin_regex: str | None = None
    database_url: str | None = None


settings = Settings()
