import 'dotenv/config'

import { spawnSync } from 'node:child_process'

const username = process.env.PB_TYPEGEN_USERNAME || process.env.PB_TYPEGEN_EMAIL
const required = ['PB_TYPEGEN_URL', 'PB_TYPEGEN_PASSWORD']
const missing = required.filter((key) => !process.env[key])

if (!username) {
    missing.push('PB_TYPEGEN_USERNAME')
}

if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    console.error('Create a .env file in the repo root (or set them in your shell) and try again.')
    process.exit(1)
}

const outFile = 'pb_hooks/lib/pocketbase-types.ts'

const result = spawnSync(
    'npx',
    [
        'pocketbase-typegen',
        '--url',
        process.env.PB_TYPEGEN_URL,
        '--email',
        username,
        '--password',
        process.env.PB_TYPEGEN_PASSWORD,
        '-o',
        outFile,
    ],
    {
        stdio: 'inherit',
        shell: true,
    },
)

process.exit(result.status ?? 1)
