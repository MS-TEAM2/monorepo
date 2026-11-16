"""FastAPI 앱에서 OpenAPI 명세를 뽑아 docs/api/openapi.yaml 과 맞춘다.

uv run python -m app.export_openapi          # 명세 파일 갱신
uv run python -m app.export_openapi --check  # CI: 코드와 명세가 다르면 실패
"""

import sys

import yaml

from app.config import REPO_ROOT
from app.main import app

SPEC_PATH = REPO_ROOT / "docs" / "api" / "openapi.yaml"


def render() -> str:
    return yaml.safe_dump(app.openapi(), sort_keys=False, allow_unicode=True)


def main() -> None:
    rendered = render()
    if "--check" in sys.argv:
        if not SPEC_PATH.exists() or SPEC_PATH.read_text(encoding="utf-8") != rendered:
            print(
                "docs/api/openapi.yaml 이 코드와 다릅니다. "
                "`uv run python -m app.export_openapi` 를 실행하고 커밋하세요.",
                file=sys.stderr,
            )
            sys.exit(1)
        print("OpenAPI 명세와 코드가 일치합니다")
        return
    SPEC_PATH.parent.mkdir(parents=True, exist_ok=True)
    SPEC_PATH.write_text(rendered, encoding="utf-8")
    print(f"갱신: {SPEC_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
