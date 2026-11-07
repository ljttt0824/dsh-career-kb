import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const files = ['core.test.mjs', 'host.test.mjs', 'client.test.mjs', 'interop.test.mjs'].map((name) => path.join(here, name))
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)
