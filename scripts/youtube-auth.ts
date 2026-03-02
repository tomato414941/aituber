import { OAuth2Client } from 'google-auth-library'
import { createServer } from 'http'
import { writeFile, chmod } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'

const SECRETS_PATH = join(homedir(), '.secrets', 'youtube')
const REDIRECT_URI = 'http://localhost:8085/callback'
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl']

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  console.log('=== YouTube OAuth2 Setup ===\n')
  console.log('Prerequisites:')
  console.log('1. Create a Google Cloud project')
  console.log('2. Enable YouTube Data API v3')
  console.log('3. Create OAuth2 credentials (Web application)')
  console.log(`4. Add redirect URI: ${REDIRECT_URI}\n`)

  const clientId = await prompt('Client ID: ')
  const clientSecret = await prompt('Client Secret: ')

  if (!clientId || !clientSecret) {
    console.error('Client ID and Client Secret are required.')
    process.exit(1)
  }

  const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI)

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })

  console.log(`\nOpen this URL in your browser:\n${authUrl}\n`)

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:8085`)
      const code = url.searchParams.get('code')
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>Authorization successful!</h1><p>You can close this tab.</p>')
        server.close()
        resolve(code)
      } else {
        res.writeHead(400)
        res.end('Missing code parameter')
      }
    })

    server.listen(8085, () => {
      console.log('Waiting for authorization callback on port 8085...')
    })

    server.on('error', reject)
  })

  const { tokens } = await oauth2.getToken(code)

  if (!tokens.refresh_token) {
    console.error('No refresh token received. Try revoking access and re-authorizing.')
    process.exit(1)
  }

  const secrets = {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
  }

  await writeFile(SECRETS_PATH, JSON.stringify(secrets, null, 2))
  await chmod(SECRETS_PATH, 0o600)

  console.log(`\nCredentials saved to ${SECRETS_PATH}`)
  console.log('YouTube API automation is ready!')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
