import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const targetPath = path.resolve(__dirname, '../node_modules/phio/vendor/ftp-deploy/sftpSyncProvider.ts')

if (!fs.existsSync(targetPath)) {
    process.exit(0)
}

const raw = fs.readFileSync(targetPath, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const content = raw.replace(/\r\n/g, '\n')

// Already patched (or fixed upstream)
if (content.includes('this.client.rmdir(folderPath, true)')) {
    process.exit(0)
}

const targetSnippet = [
    '        if (this.dryRun === false) {',
    '            await retryRequest(this.logger, async () => await this.client.rmdir(folderPath));',
    '        }',
].join('\n')

// HashDiff drops child files under deleted folders assuming recursive deletion,
// so SFTPSyncProvider must pass recursive=true and tolerate already-removed dirs.
const replacementSnippet = [
    '        if (this.dryRun === false) {',
    '            try {',
    '                await retryRequest(this.logger, async () => await this.client.rmdir(folderPath, true));',
    '            } catch (e: any) {',
    '                const message = `${e?.message ?? e}`.toLowerCase();',
    '                if (message.includes("no such directory") || message.includes("no such file") || message.includes("not found")) {',
    '                    this.logger.standard("Directory not found or already removed - skipping...");',
    '                } else {',
    '                    throw e;',
    '                }',
    '            }',
    '        }',
].join('\n')

if (!content.includes(targetSnippet)) {
    console.warn(`[patch-phio] Skipping: expected rmdir call not found in ${targetPath}`)
    process.exit(0)
}

const updated = content.replace(targetSnippet, replacementSnippet).replace(/\n/g, eol)
fs.writeFileSync(targetPath, updated, 'utf8')
console.log('[patch-phio] Patched phio SFTPSyncProvider.removeFolder for recursive SFTP folder deletion.')

