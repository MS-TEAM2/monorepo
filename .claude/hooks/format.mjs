// Claude Code가 파일을 고친 직후 그 파일만 포맷한다. 실패해도 작업을 막지 않는다.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

try {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const file = input?.tool_input?.file_path
  if (file) {
    const path = relative(root, resolve(root, file))
    const run = (command, args) =>
      spawnSync(command, args, { cwd: root, stdio: 'ignore', timeout: 15000 })
    if (/^(backend|ai)\/.*\.py$/.test(path)) {
      run('uv', ['run', '--quiet', 'ruff', 'check', '--fix', '--select', 'I', path])
      run('uv', ['run', '--quiet', 'ruff', 'format', path])
    } else if (/^(frontend|mobile|packages)\/.*\.(ts|tsx|mts|mjs|js|css|json)$/.test(path) && !path.endsWith('schema.d.ts')) {
      run('pnpm', ['exec', 'prettier', '--write', path])
    }
  }
} catch {
  // 포맷 훅은 조용히 넘어간다
}
process.exit(0)
