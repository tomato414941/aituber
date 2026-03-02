import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const SECRETS_PATH = join(homedir(), '.secrets', 'youtube')
const REDIRECT_URI = 'http://localhost:8085/callback'

interface YouTubeSecrets {
  client_id: string
  client_secret: string
  refresh_token: string
}

async function getAuthClient(): Promise<OAuth2Client> {
  const raw = await readFile(SECRETS_PATH, 'utf-8')
  const secrets: YouTubeSecrets = JSON.parse(raw)
  const oauth2 = new OAuth2Client(
    secrets.client_id,
    secrets.client_secret,
    REDIRECT_URI,
  )
  oauth2.setCredentials({ refresh_token: secrets.refresh_token })
  return oauth2
}

async function createBroadcast(): Promise<void> {
  const auth = await getAuthClient()
  const yt = google.youtube({ version: 'v3', auth })

  const title =
    process.env.YOUTUBE_BROADCAST_TITLE || 'あいちゃんの配信'
  const privacy = process.env.YOUTUBE_BROADCAST_PRIVACY || 'unlisted'
  const now = new Date()

  // 1. Create broadcast
  const broadcast = await yt.liveBroadcasts.insert({
    part: ['snippet', 'status', 'contentDetails'],
    requestBody: {
      snippet: {
        title: `${title} ${now.toISOString().slice(0, 16)}`,
        scheduledStartTime: now.toISOString(),
      },
      status: {
        privacyStatus: privacy as 'unlisted' | 'public' | 'private',
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: false,
        enableAutoStop: true,
        latency: 'ultraLow',
      },
    },
  })

  const broadcastId = broadcast.data.id!

  // 2. Find existing RTMP stream or create one
  const streams = await yt.liveStreams.list({
    part: ['id', 'snippet', 'cdn'],
    mine: true,
  })

  let streamKey: string
  let streamId: string

  const existing = streams.data.items?.find(
    (s) => s.cdn?.ingestionType === 'rtmp',
  )

  if (existing) {
    streamId = existing.id!
    streamKey = existing.cdn!.ingestionInfo!.streamName!
  } else {
    const newStream = await yt.liveStreams.insert({
      part: ['snippet', 'cdn'],
      requestBody: {
        snippet: { title: 'AITuber Stream' },
        cdn: {
          frameRate: '30fps',
          ingestionType: 'rtmp',
          resolution: '1080p',
        },
      },
    })
    streamId = newStream.data.id!
    streamKey = newStream.data.cdn!.ingestionInfo!.streamName!
  }

  // 3. Bind broadcast to stream
  await yt.liveBroadcasts.bind({
    id: broadcastId,
    part: ['id', 'contentDetails'],
    streamId,
  })

  // Output for shell eval
  console.log(`BROADCAST_ID=${broadcastId}`)
  console.log(`STREAM_KEY=${streamKey}`)
}

async function transitionToLive(broadcastId: string): Promise<void> {
  const auth = await getAuthClient()
  const yt = google.youtube({ version: 'v3', auth })

  // Poll until stream is active (max 5 min)
  for (let i = 0; i < 60; i++) {
    const bcast = await yt.liveBroadcasts.list({
      part: ['contentDetails'],
      id: [broadcastId],
    })
    const streamId =
      bcast.data.items?.[0]?.contentDetails?.boundStreamId
    if (streamId) {
      const streams = await yt.liveStreams.list({
        part: ['status'],
        id: [streamId],
      })
      const status = streams.data.items?.[0]?.status?.streamStatus
      if (status === 'active') break
      console.error(`[broadcast] Stream status: ${status}, waiting...`)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }

  // testing -> live
  await yt.liveBroadcasts.transition({
    broadcastStatus: 'testing',
    id: broadcastId,
    part: ['status'],
  })

  console.error('[broadcast] Transitioning to testing...')
  await new Promise((r) => setTimeout(r, 10000))

  await yt.liveBroadcasts.transition({
    broadcastStatus: 'live',
    id: broadcastId,
    part: ['status'],
  })

  console.error('[broadcast] Broadcast is LIVE')
}

async function transitionToComplete(
  broadcastId: string,
): Promise<void> {
  const auth = await getAuthClient()
  const yt = google.youtube({ version: 'v3', auth })

  await yt.liveBroadcasts.transition({
    broadcastStatus: 'complete',
    id: broadcastId,
    part: ['status'],
  })

  console.error('[broadcast] Broadcast completed')
}

// CLI dispatcher
const [action, ...args] = process.argv.slice(2)

switch (action) {
  case 'create':
    await createBroadcast()
    break
  case 'live':
    if (!args[0]) {
      console.error('Usage: broadcast.ts live <broadcastId>')
      process.exit(1)
    }
    await transitionToLive(args[0])
    break
  case 'complete':
    if (!args[0]) {
      console.error('Usage: broadcast.ts complete <broadcastId>')
      process.exit(1)
    }
    await transitionToComplete(args[0])
    break
  default:
    console.error(
      'Usage: broadcast.ts <create|live|complete> [broadcastId]',
    )
    process.exit(1)
}
