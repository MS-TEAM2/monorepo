// 실행: node --test .claude/hooks/require-notion-docs.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, test } from 'node:test'

const hook = resolve(import.meta.dirname, 'require-notion-docs.mjs')
const dir = mkdtempSync(join(tmpdir(), 'notion-hook-'))
after(() => rmSync(dir, { recursive: true }))

const API = '423e81557ede8031aae8e83cd4ca5b78'
const API_DASHED = '423e8155-7ede-8031-aae8-e83cd4ca5b78'
const TABLE = '423e81557ede80089915df2dff238caf'
const OLD_API = '422e81557ede80fe9d05ea5ceae63c03'

function read(name, input, result = '본문 unauthorized 401', isError = false) {
  return [
    { message: { content: [{ type: 'tool_use', id: 't1', name, input }] } },
    {
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 't1',
            is_error: isError,
            content: [{ type: 'text', text: result }],
          },
        ],
      },
    },
  ]
}

function run(file, lines = []) {
  const transcript = join(dir, 'transcript.jsonl')
  writeFileSync(transcript, lines.map((line) => JSON.stringify(line)).join('\n') + '\n{깨진 줄')
  return spawnSync('node', [hook], {
    input: JSON.stringify({ tool_input: { file_path: file }, transcript_path: transcript }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  })
}

const fetchDoc = (id) => read('mcp__notion__notion-fetch', { id: `https://app.notion.com/p/${id}` })

test('API·테이블과 무관한 파일은 막지 않는다', () => {
  for (const file of ['frontend/src/app/page.tsx', 'backend/app/explore/service.py', 'README.md'])
    assert.equal(run(file).status, 0, file)
})

test('읽지 않으면 막고 주소와 연결 방법을 알려 준다', () => {
  const result = run('backend/app/explore/router.py')
  assert.equal(result.status, 2)
  assert.match(result.stderr, new RegExp(API))
  assert.match(result.stderr, /\/mcp/)
  assert.match(result.stderr, /notion-bot/)
})

test('API 파일은 API 명세서를, 테이블 파일은 테이블 정의서를 요구한다', () => {
  const api = [
    'backend/app/main.py',
    'backend/app/schemas.py',
    join(dir, 'backend/app/auth/router.py'),
    'docs/api/openapi.yaml',
  ]
  const table = ['backend/app/diagnoses/models.py', 'backend/migrations/versions/0002_x.py']
  for (const file of api) {
    assert.equal(run(file, fetchDoc(API)).status, 0, file)
    assert.equal(run(file, fetchDoc(TABLE)).status, 2, file)
  }
  for (const file of table) {
    assert.equal(run(file, fetchDoc(TABLE)).status, 0, file)
    assert.equal(run(file, fetchDoc(API)).status, 2, file)
  }
})

test('notion-bot으로 본문을 읽은 것도 인정한다', () => {
  const lines = read('mcp__notion-bot__API-get-block-children', { block_id: API_DASHED })
  assert.equal(run('backend/app/schemas.py', lines).status, 0)
})

test('읽기로 치지 않는 것', () => {
  const cases = {
    '옛 환승결제 문서': fetchDoc(OLD_API),
    검색: read('mcp__notion__notion-search', { query: API }),
    수정: read('mcp__notion__notion-update-page', { page_id: API }),
    '다른 도구': read('Read', { file_path: API }),
    '도구 오류': read('mcp__notion__notion-fetch', { id: API }, '로그인 필요', true),
    '권한 오류': read('mcp__notion-bot__API-get-block-children', { block_id: API }, '{"object":"error","status":404}'),
    '빈 결과': read('mcp__notion__notion-fetch', { id: API }, ''),
    '결과 없음': fetchDoc(API).slice(0, 1),
  }
  for (const [name, lines] of Object.entries(cases))
    assert.equal(run('backend/app/schemas.py', lines).status, 2, name)
})
