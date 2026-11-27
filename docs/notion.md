# 기준 문서 (Notion)

API·테이블·생존모델 작업의 기준이 되는 문서다. **제목으로 검색하지 말고 아래 주소로 연다.**

| 문서 | 주소 | 반드시 읽는 작업 |
| --- | --- | --- |
| API 명세서 | https://app.notion.com/p/423e81557ede8031aae8e83cd4ca5b78 | 라우트·요청·응답·오류 코드·인증을 추가하거나 바꿀 때, openapi.yaml에 없는 API를 화면에 붙일 때. 해당 A번호와 1장(공통 규칙) |
| 테이블 정의서 | https://app.notion.com/p/423e81557ede80089915df2dff238caf | 테이블·모델·마이그레이션을 추가하거나 바꿀 때. 해당 테이블과 1장(공통 규칙) |
| 데이터 전처리 | https://app.notion.com/p/423e81557ede81878d0ed3237596f53e | 수집, 업종 매핑, 생존 라벨·피처 작업. `specs/survival-diagnosis/`도 함께 |
| 기획서 | https://app.notion.com/p/423e81557ede80edb379ebdce8ae7ac5 | 위 문서로 판단할 수 없을 때 |

- **쓰지 않는 문서:** `기획서(구)` 아래의 환승결제 `API 명세서`, `ERD`, `테이블`, `아키텍처`. 제목이 같으니 주의한다.
- 읽은 내용은 이번 세션에서 읽은 것만 인정한다.
- 티켓, 스펙, Notion, `docs/api/openapi.yaml`이 서로 다르면 멈추고 묻는다.

## 읽을 수 없을 때

Notion 도구가 없거나 로그인·권한 오류가 나면 **코드를 고치지 않고** 사용자에게 아래를 그대로 보여 주고 멈춘다.

> Notion 기준 문서를 읽을 수 없어 작업을 시작하지 않았습니다.
> API·테이블 작업은 Notion 문서를 먼저 읽어야 합니다. `docs/notion.md`의 **연결 방법**대로 연결한 뒤 다시 요청해 주세요.
>
> - 워크스페이스 멤버: Claude Code는 `/mcp` → notion 로그인, Codex는 `codex mcp login notion`
> - 게스트: AX 담당에게 토큰을 받아 `notion-bot` 등록
> - 연결했는데 문서가 안 열리면: AX 담당에게 그 페이지의 접근 권한을 요청

## 연결 방법

### 멤버

| 도구 | 방법 |
| --- | --- |
| Claude Code | `/mcp` → `notion` → 본인 계정으로 로그인. 처음이면 `.mcp.json` 서버 사용을 승인한다 |
| Codex | 프로젝트를 신뢰로 지정하고 `codex mcp login notion` |

### 게스트

게스트는 Notion MCP에 로그인할 수 없다. 팀 통합 토큰을 **AX 담당에게 따로 받아** 터미널에서 직접 등록한다. 토큰을 AI 프롬프트, Slack, Notion, 레포에 붙여넣지 않는다.

Claude Code: 아래 명령은 토큰을 화면과 셸 기록에 남기지 않고 입력받는다.

```bash
read -rs NOTION_TOKEN
claude mcp add -s user notion-bot -e NOTION_TOKEN="$NOTION_TOKEN" -- npx -y @notionhq/notion-mcp-server@2.6.1
unset NOTION_TOKEN
claude mcp list | grep notion-bot    # ✔ Connected 가 나오면 성공
```

Codex: `~/.codex/config.toml`에 추가한다. 이 파일은 레포 밖에 있어야 한다.

```toml
[mcp_servers.notion-bot]
command = "npx"
args = ["-y", "@notionhq/notion-mcp-server@2.6.1"]
env = { NOTION_TOKEN = "<받은 토큰>" }
```

등록한 뒤 AI 도구를 다시 시작한다. 봇이 문서를 못 찾으면 그 페이지에 봇 연결이 추가돼 있는지 AX 담당에게 확인한다.

## Claude Code 검사

`.claude/hooks/require-notion-docs.mjs`는 편집 도구가 아래 파일을 고치기 전에, 이번 세션의 기록에서 해당 문서를 성공적으로 읽었는지 확인한다. 읽지 않았으면 편집을 막고 위 안내를 보여 준다.

| 파일 | 필요한 문서 |
| --- | --- |
| `backend/app/`의 `main.py`·`router.py`·`schemas.py`, `docs/api/openapi.yaml` | API 명세서 |
| `backend/app/`의 `models.py`, `backend/migrations/versions/` | 테이블 정의서 |

셸 명령으로 고치는 것, Codex, 문서를 끝까지 읽었는지까지는 검사하지 못한다. 그때도 같은 규칙을 지킨다.
