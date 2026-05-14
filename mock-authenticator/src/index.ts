import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { SF_TOKEN_URL } from './constants'
import { saveTokens, loadTokens, clearTokens } from './db'
import { startRefreshLoop } from './refresh'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CLIENT_ID = process.env.SF_CLIENT_ID
const PORT = 3000

if (!CLIENT_ID) {
  console.error('Error: SF_CLIENT_ID environment variable is required.')
  process.exit(1)
}

const app = express()
app.use(cors())
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(
  '/vendor/htmx',
  express.static(
    path.join(__dirname, '..', 'node_modules', 'htmx.org', 'dist')
  )
)
app.use(
  '/vendor/alpine',
  express.static(
    path.join(__dirname, '..', 'node_modules', 'alpinejs', 'dist')
  )
)

app.get('/', (_req, res) => {
  const tokens = loadTokens()
  res.render('index', { tokens, deviceFlow: null })
})

app.post('/start', async (_req, res) => {
  const body = new URLSearchParams({
    response_type: 'device_code',
    client_id: CLIENT_ID!,
    scope: 'api refresh_token',
  })

  const deviceRes = await fetch(SF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!deviceRes.ok) {
    const text = await deviceRes.text()
    res.render('error', { message: `Device code request failed: ${text}` })
    return
  }

  const data = (await deviceRes.json()) as {
    device_code: string
    user_code: string
    verification_uri: string
    interval: number
  }

  res.render('index', { tokens: null, deviceFlow: data })
})

app.post('/poll', express.urlencoded({ extended: false }), async (req, res) => {
  const { device_code, interval } = req.body as {
    device_code: string
    interval: string
  }

  const body = new URLSearchParams({
    grant_type: 'device',
    client_id: CLIENT_ID!,
    code: device_code,
  })

  const tokenRes = await fetch(SF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = (await tokenRes.json()) as Record<string, string>

  if (data.access_token) {
    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      instance_url: data.instance_url,
    })
    res.header('HX-Redirect', '/')
    res.send()
    return
  }

  if (data.error === 'authorization_pending' || data.error === 'slow_down') {
    const nextInterval = data.error === 'slow_down' ? Number(interval) + 5 : Number(interval)
    res.render('poll-status', { status: 'pending', device_code, interval: nextInterval })
    return
  }

  res.status(400).render('poll-status', { status: 'error', error: data.error ?? 'Unknown error' })
})

// Matches the shape expected by getCredentials() in @screenly/edge-apps.
// Set screenly_oauth_tokens_url=http://localhost:3000/ in mock-data.yml.
app.get('/access_token/', (_req, res) => {
  const tokens = loadTokens()
  if (!tokens) {
    res.status(404).json({ error: 'No tokens stored. Please authenticate first.' })
    return
  }
  res.json({
    token: tokens.access_token,
    metadata: { instance_url: tokens.instance_url },
  })
})

app.post('/clear', (_req, res) => {
  clearTokens()
  res.redirect('/')
})

app.listen(PORT, () => {
  console.log(`Mock authenticator running at http://localhost:${PORT}`)
  startRefreshLoop()
})
