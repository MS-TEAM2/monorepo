// API·테이블 파일을 고치기 전에, 이번 세션에서 Notion 기준 문서를 읽었는지 확인한다.
// 규칙과 연결 방법: docs/notion.md
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const API = { name: 'API 명세서', id: '423e81557ede8031aae8e83cd4ca5b78' }
const TABLE = { name: '테이블 정의서', id: '423e81557ede80089915df2dff238caf' }

function requiredDoc(path) {
  if (/^backend\/app\/(.+\/)?(main|router|schemas)\.py$/.test(path)) return API
  if (path === 'docs/api/openapi.yaml') return API
  if (/^backend\/app\/(.+\/)?models\.py$/.test(path)) return TABLE
  if (/^backend\/migrations\/versions\/.+\.py$/.test(path)) return TABLE
  return null
}

// 페이지 본문을 읽는 Notion 도구만 인정한다 (검색·수정·제목 조회는 제외)
const isRead = (name) =>
  /^mcp__.*notion/i.test(name) && /(notion-fetch|get-block-children|page-markdown)$/i.test(name)

const text = (content) =>
  typeof content === 'string'
    ? content
    : (content ?? []).map((part) => part?.text ?? '').join('\n')

function failed(block) {
  if (block.is_error) return true
  const body = text(block.content).trim()
  if (!body) return true
  return body.length < 4000 && /"object"\s*:\s*"error"|APIResponseError|object_not_found/.test(body)
}

function wasRead(transcript, doc) {
  const pending = new Set()
  for (const line of transcript.split('\n')) {
    if (!line.trim()) continue
    let content
    try {
      content = JSON.parse(line)?.message?.content
    } catch {
      continue
    }
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block?.type === 'tool_use' && isRead(block.name ?? '')) {
        const input = JSON.stringify(block.input ?? {}).replaceAll('-', '').toLowerCase()
        if (input.includes(doc.id)) pending.add(block.id)
      } else if (block?.type === 'tool_result' && pending.has(block.tool_use_id)) {
        if (!failed(block)) return true
      }
    }
  }
  return false
}

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const file = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path
const path = file ? relative(root, resolve(root, file)).replaceAll('\\', '/') : ''
const doc = requiredDoc(path)
if (!doc) process.exit(0)

let transcript = ''
try {
  transcript = readFileSync(input.transcript_path, 'utf8')
} catch {
  // 기록을 읽을 수 없으면 읽었는지 알 수 없으므로 막는다
}
if (wasRead(transcript, doc)) process.exit(0)

console.error(`Notion ${doc.name}를 이번 세션에서 읽지 않아 ${path} 편집을 막았습니다.

1. Notion 도구로 이 주소를 열어 해당 A번호·테이블과 공통 규칙을 읽으세요. 제목으로 검색하지 마세요.
   https://app.notion.com/p/${doc.id}
2. 읽을 수 없으면 다른 방법으로 고치지 말고 멈춘 뒤, 사용자에게 아래를 안내하세요 (docs/notion.md).
   - 멤버: Claude Code는 /mcp → notion 로그인
   - 게스트: AX 담당에게 토큰을 받아 notion-bot 등록
   - 연결했는데 안 열리면: AX 담당에게 페이지 접근 권한 요청
3. 읽은 내용이 티켓·스펙과 다르면 구현하지 말고 무엇이 다른지 물으세요.`)
process.exit(2)
