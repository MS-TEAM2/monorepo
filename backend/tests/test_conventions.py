"""backend/AGENTS.md 규칙 중 기계로 확인할 수 있는 것을 검사한다."""

import ast
import inspect
import re
from pathlib import Path

import pytest
from fastapi import APIRouter
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.main import API_PREFIX, app

APP_DIR = Path(__file__).resolve().parents[1] / "app"

# 도메인 폴더가 아니라 인프라 모듈(IN 소유)이다.
INFRA_DIRS = {"storage", "jobs"}
DOMAIN_FILES = {
    "__init__.py",
    "router.py",
    "schemas.py",
    "service.py",
    "models.py",
    "dependencies.py",
    "constants.py",
}

# 파일 이름 → import 하면 안 되는 최상위 패키지
FORBIDDEN_IMPORTS = {
    "router.py": {"sqlalchemy", "ai_core"},
    "schemas.py": {"sqlalchemy", "fastapi", "starlette"},
    "service.py": {"fastapi", "starlette"},
    "models.py": {"fastapi", "starlette", "pydantic"},
}

# 로그인 없이(선택 포함) 부를 수 있는 API. API 명세 2장의 인증 열과 맞춘다.
PUBLIC_ROUTES = {
    ("POST", "/predict"),
    ("POST", "/auth/token"),
    ("GET", "/auth/{provider}/start"),
    ("GET", "/auth/{provider}/callback"),
    ("GET", "/categories"),
    ("GET", "/regions/resolve"),
    ("GET", "/stores"),
    ("GET", "/areas/summary"),
    ("GET", "/data-status"),
    ("GET", "/food-safe/summary"),
}
NO_BODY_STATUSES = {204, 302}


def domain_dirs(root: Path = APP_DIR) -> list[Path]:
    return sorted(p.parent for p in root.glob("*/__init__.py") if p.parent.name not in INFRA_DIRS)


def imported_modules(source: str) -> set[str]:
    found = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
            found.update(f"{node.module}.{alias.name}" for alias in node.names)
    return found


def import_violations(filename: str, domain: str, source: str) -> list[str]:
    violations = []
    for module in imported_modules(source):
        parts = module.split(".")
        if parts[0] in FORBIDDEN_IMPORTS.get(filename, set()):
            violations.append(module)
        # 다른 도메인의 라우터는 가져오지 않는다.
        if len(parts) > 2 and parts[0] == "app" and parts[1] != domain and parts[2] == "router":
            violations.append(module)
    return sorted(violations)


# 이벤트 루프를 막는 동기 API. 앱 전체에서 쓰지 않는다.
BLOCKING_IMPORTS = {
    "requests",
    "urllib.request",
    "time.sleep",
    "sqlalchemy.create_engine",
    "sqlalchemy.orm.Session",
    "sqlalchemy.orm.sessionmaker",
    "sqlalchemy.orm.scoped_session",
    "psycopg.connect",
    "httpx.Client",
    "httpx2.Client",
}


def dotted_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{dotted_name(node.value)}.{node.attr}"
    return ""


def blocking_usage(source: str) -> list[str]:
    """동기 DB·HTTP·sleep 사용과, 스레드로 넘기지 않은 ai_core 호출을 찾는다."""
    tree = ast.parse(source)
    aliases = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                # `import a.b`는 이름 a를 만든다.
                aliases[a.asname or a.name.split(".")[0]] = (
                    a.name if a.asname else a.name.split(".")[0]
                )
        elif isinstance(node, ast.ImportFrom) and node.module:
            for a in node.names:
                aliases[a.asname or a.name] = f"{node.module}.{a.name}"

    def resolve(node: ast.AST) -> str:
        head, _, rest = dotted_name(node).partition(".")
        full = aliases.get(head, head)
        return f"{full}.{rest}" if rest else full

    found = {m for m in imported_modules(source) if m in BLOCKING_IMPORTS}
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and resolve(node) in BLOCKING_IMPORTS:
            found.add(resolve(node))
        if isinstance(node, ast.Call):
            name = resolve(node.func)
            # 대문자로 시작하면 입력값 같은 자료형이라 막지 않는다.
            if name.startswith("ai_core.") and not name.split(".")[-1][0].isupper():
                found.add(f"{name}() without asyncio.to_thread")
    return sorted(found)


def sync_db_functions(source: str) -> list[str]:
    """AsyncSession을 받는데 async가 아닌 함수."""
    return [
        node.name
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.FunctionDef)
        and any(
            a.annotation and "AsyncSession" in ast.unparse(a.annotation)
            for a in node.args.posonlyargs + node.args.args + node.args.kwonlyargs
        )
    ]


def lazy_relationships(source: str) -> list[str]:
    """비동기에서 지연 로딩은 오류가 나므로 relationship에 lazy="raise"를 요구한다."""
    return [
        f"line {node.lineno}"
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Call)
        and dotted_name(node.func).split(".")[-1] == "relationship"
        and not any(
            k.arg == "lazy" and isinstance(k.value, ast.Constant) and k.value.value == "raise"
            for k in node.keywords
        )
    ]


def forbidden_calls(source: str) -> list[str]:
    """금액 반올림 규칙과 다른 round(), 공통 오류 형식을 우회하는 HTTPException."""
    calls = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in {"round", "HTTPException"}:
                calls.append(f"{node.func.id} (line {node.lineno})")
    return calls


def domain_routes() -> list[APIRoute]:
    routes = []
    for directory in domain_dirs():
        if not (directory / "router.py").exists():
            continue
        module = __import__(f"app.{directory.name}.router", fromlist=["router"])
        assert isinstance(module.router, APIRouter)
        routes.extend(r for r in module.router.routes if isinstance(r, APIRoute))
    return routes


def api_operations() -> list[tuple[str, str]]:
    return [
        (method.upper(), path.removeprefix(API_PREFIX))
        for path, operations in app.openapi()["paths"].items()
        if path.startswith(API_PREFIX)
        for method in operations
    ]


def protected_operations() -> list[tuple[str, str]]:
    return [operation for operation in api_operations() if operation not in PUBLIC_ROUTES]


def test_domain_folders_use_agreed_file_names():
    unexpected = [
        str(path.relative_to(APP_DIR))
        for directory in domain_dirs()
        for path in directory.glob("*.py")
        # 순수 계산은 이름을 자유롭게 두되 아래 순수성 검사를 받는다.
        if path.name not in DOMAIN_FILES | {"calculations.py"}
    ]
    assert unexpected == []


def test_layers_do_not_import_forbidden_modules():
    violations = {
        str(path.relative_to(APP_DIR)): found
        for directory in domain_dirs()
        for path in directory.glob("*.py")
        if (found := import_violations(path.name, directory.name, path.read_text("utf-8")))
    }
    assert violations == {}


def test_domain_models_are_imported_by_migrations():
    env = (APP_DIR.parent / "migrations" / "env.py").read_text("utf-8")
    modules = imported_modules(env)
    missing = [
        d.name
        for d in domain_dirs()
        if (d / "models.py").exists() and f"app.{d.name}.models" not in modules
    ]
    assert missing == []


def test_calculations_are_pure():
    impure = {"fastapi", "starlette", "sqlalchemy", "app"}
    violations = {
        str(path.relative_to(APP_DIR)): found
        for path in APP_DIR.glob("*/calculations.py")
        if (
            found := {
                m for m in imported_modules(path.read_text("utf-8")) if m.split(".")[0] in impure
            }
        )
    }
    assert violations == {}


def test_no_forbidden_calls():
    violations = {
        str(path.relative_to(APP_DIR)): found
        for path in APP_DIR.rglob("*.py")
        if (found := forbidden_calls(path.read_text("utf-8")))
    }
    assert violations == {}


def test_routes_are_found():
    # 아래 검사가 빈 목록으로 통과하지 않게 한다.
    assert len(domain_routes()) >= 3
    assert ("POST", "/predict") in api_operations()


def test_every_domain_route_is_registered():
    registered = {path for path in app.openapi()["paths"]}
    missing = [
        r.path
        for r in domain_routes()
        if r.include_in_schema and not {r.path, API_PREFIX + r.path} & registered
    ]
    assert missing == []


def test_routes_declare_response_model():
    missing = [
        r.path
        for r in domain_routes()
        if r.response_model is None and r.status_code not in NO_BODY_STATUSES
    ]
    assert missing == []


def test_routes_are_async():
    assert [r.path for r in domain_routes() if not inspect.iscoroutinefunction(r.endpoint)] == []


@pytest.mark.parametrize("check", [blocking_usage, sync_db_functions, lazy_relationships])
def test_async_rules(check):
    # main.py의 모델 로드는 요청을 받기 전에 한 번 실행되므로 예외다.
    violations = {
        str(path.relative_to(APP_DIR)): found
        for path in APP_DIR.rglob("*.py")
        if path != APP_DIR / "main.py" and (found := check(path.read_text("utf-8")))
    }
    assert violations == {}


def test_protected_routes_require_login():
    with TestClient(app) as client:
        for method, path in protected_operations():
            url = API_PREFIX + re.sub(r"\{\w+\}", "00000000-0000-4000-8000-000000000001", path)
            response = client.request(method, url)
            assert response.status_code == 401, f"{method} {path}"


@pytest.mark.parametrize(
    ("filename", "source", "expected"),
    [
        ("service.py", "from fastapi import Depends", ["fastapi", "fastapi.Depends"]),
        ("router.py", "import sqlalchemy.orm", ["sqlalchemy.orm"]),
        ("service.py", "from app.contracts import router", ["app.contracts.router"]),
        ("service.py", "from sqlalchemy import select", []),
    ],
)
def test_import_check_detects_violations(filename, source, expected):
    assert import_violations(filename, "diagnoses", source) == expected


def test_call_check_detects_violations():
    source = "x = round(1.5)\nraise HTTPException(404)"
    assert forbidden_calls(source) == ["round (line 1)", "HTTPException (line 2)"]


@pytest.mark.parametrize(
    "source",
    [
        "import requests",
        "import time\ntime.sleep(1)",
        "from time import sleep",
        "from sqlalchemy.orm import Session",
        "import sqlalchemy as sa\nsa.create_engine('x')",
        "import httpx\nhttpx.Client()",
        "from ai_core.predict import predict\npredict(1, 2)",
        "from ai_core import predict as p\np.predict(1, 2)",
        "import ai_core.predict\nai_core.predict.predict(1, 2)",
    ],
)
def test_blocking_check_detects_violations(source):
    assert blocking_usage(source) != []


@pytest.mark.parametrize(
    "source",
    [
        "import asyncio\nfrom ai_core.predict import predict\nasyncio.to_thread(predict, 1, 2)",
        "from ai_core.survival import SurvivalInput\nSurvivalInput(1)",
        "import httpx\nhttpx.AsyncClient()",
        "from sqlalchemy.orm import Mapped, mapped_column",
    ],
)
def test_blocking_check_allows_async_code(source):
    assert blocking_usage(source) == []


def test_db_function_and_relationship_checks_detect_violations():
    assert sync_db_functions("def f(db: AsyncSession): ...") == ["f"]
    assert sync_db_functions("async def f(db: AsyncSession): ...") == []
    assert lazy_relationships("x = relationship()") == ["line 1"]
    assert lazy_relationships('x = relationship(lazy="raise")') == []
