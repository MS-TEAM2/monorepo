import tempfile
from pathlib import Path

from pydantic import SecretStr
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
    # 임시 원본(계약서) 보관. 비워 두면 로컬 디스크(temp_file_dir)를 쓴다.
    # 예: https://<계정>.blob.core.windows.net  — 접속은 관리 ID로 하므로 키를 넣지 않는다.
    blob_account_url: str | None = None
    blob_container: str = "temp-originals"
    temp_file_dir: Path = Path(tempfile.gettempdir()) / "ax-temp-files"

    # 소셜 로그인(A26·A27). 클라이언트 값이 없으면 그 공급자의 로그인은 503이다.
    # 배포 값의 Key Vault 비밀 이름은 infra/README.md를 따른다.
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    kakao_client_id: str | None = None
    kakao_client_secret: SecretStr | None = None
    # 공급자에 등록한 콜백 주소를 만드는 API 주소. 아래 세 값은 배포 환경에서 반드시 바꾼다.
    api_base_url: str = "http://localhost:8000"
    # 로그인 뒤에는 아래 두 곳으로만 돌려보낸다. 웹은 뒤에 /auth/callback을 붙인다.
    web_base_url: str = "http://localhost:3000"
    app_return_url: str = "axservice://auth/callback"
    # 로그인 시작에서 허용하는 약관 동의 버전. 웹의 TERMS_VERSION과 맞춘다.
    terms_versions: list[str] = ["draft-2026-11"]


settings = Settings()
