import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { sendVerificationEmail } from '../services/email.js'

const r = Router()

const SENDGRID_CONFIGURED = Boolean(process.env.SENDGRID_API_KEY)

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' })

// Log login to database
async function logLogin(user, req, method = 'email') {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown'
    const ua = req.headers['user-agent'] || 'unknown'

    // Get country from IP using free API (non-blocking)
    let country = null
    try {
      const geo = await fetch(`https://ipapi.co/${ip}/country_name/`, { signal: AbortSignal.timeout(3000) })
      if (geo.ok) country = await geo.text()
      if (country?.includes('<')) country = null // HTML error page
    } catch {}

    await prisma.loginLog.create({
      data: {
        userId: user.id,
        email: user.email,
        ipAddress: ip,
        userAgent: ua.substring(0, 500),
        country,
        method
      }
    })
  } catch (e) {
    console.error('Login log failed:', e.message)
  }
}

// Invite-only mode: check if email is whitelisted
const INVITE_ONLY = process.env.INVITE_ONLY === 'true' // default OFF
async function checkWhitelist(email) {
  if (!INVITE_ONLY) return true
  // Admins bypass whitelist
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  })
  if (user?.isAdmin) return true
  // Check whitelist
  const entry = await prisma.inviteWhitelist.findFirst({
    where: { email: { equals: email.toLowerCase() } }
  })
  return entry?.approved === true
}

// Helper: find or create user from OAuth provider
async function findOrCreateOAuthUser({ sub, email, name, provider }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    // Existing user — always allow
  } else if (!await checkWhitelist(email)) {
    throw new Error('invite_only')
  }

  // 1. Check by provider sub
  const subField = provider === 'vipps' ? 'vippsSub' : 'googleSub'
  const bySub = await prisma.user.findFirst({ where: { [subField]: sub } })
  if (bySub) return bySub

  // 2. Check by email (link accounts)
  const byEmail = await prisma.user.findUnique({ where: { email } })
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { [subField]: sub, authProvider: provider }
    })
    return byEmail
  }

  // 3. Create new
  const newUser = await prisma.user.create({
    data: { name, email, [subField]: sub, authProvider: provider, emailVerified: true }
  })
  return newUser
}

// ─── EMAIL/PASSWORD ───────────────────────────────────────────────────────────

r.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'Mangler felt' })
  try {
    if (!await checkWhitelist(email)) {
      return res.status(403).json({ error: 'invite_only', message: 'Vi er i lukket beta. Sok om tilgang.' })
    }
    const hash = await bcrypt.hash(password, 10)
    const skipVerification = !SENDGRID_CONFIGURED
    const verifyToken = skipVerification ? null : crypto.randomBytes(32).toString('hex')
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hash,
        authProvider: 'email',
        emailVerified: skipVerification,
        verifyToken
      },
      select: { id: true, name: true, email: true }
    })
    if (skipVerification) {
      // No SendGrid — activate immediately and return token
      logLogin(user, req, 'email')
      res.status(201).json({
        token: signToken(user),
        user
      })
    } else {
      sendVerificationEmail(email, name, verifyToken)
      res.status(201).json({
        needsVerification: true,
        message: 'Sjekk e-posten din for a aktivere kontoen.',
        user
      })
    }
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'E-post allerede i bruk' })
    res.status(500).json({ error: e.message })
  }
})

r.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    if (!await checkWhitelist(email)) {
      return res.status(403).json({ error: 'invite_only', message: 'Vi er i lukket beta. Sok om tilgang.' })
    }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Feil e-post eller passord' })
    if (!user.passwordHash) {
      const provider = user.authProvider === 'vipps' ? 'Vipps' : 'Google'
      return res.status(401).json({ error: `Denne kontoen bruker ${provider}-innlogging` })
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Feil e-post eller passord' })
    // Block unverified email users (only if SendGrid is configured)
    if (SENDGRID_CONFIGURED && user.authProvider === 'email' && user.emailVerified === false) {
      return res.status(403).json({
        error: 'E-posten din er ikke bekreftet. Sjekk innboksen din.',
        needsVerification: true,
        email: user.email
      })
    }
    logLogin(user, req, 'email')
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

r.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, authProvider: true, isAdmin: true, createdAt: true }
    })
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' })
    res.json(user)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── EMAIL VERIFICATION ───────────────────────────────────────────────────────

r.get('/verify', async (req, res) => {
  const { token } = req.query
  const frontend = process.env.FRONTEND_URL || 'https://yeeyoo.eu'
  if (!token) return res.redirect(`${frontend}?error=missing_token`)

  try {
    const user = await prisma.user.findFirst({ where: { verifyToken: token } })
    if (!user) return res.redirect(`${frontend}?error=invalid_token`)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null }
    })

    logLogin(user, req, 'email-verify')
    const jwt_token = signToken(user)
    res.redirect(`${frontend}?oauth_token=${jwt_token}&verified=true`)
  } catch (e) {
    console.error('Verify error:', e)
    res.redirect(`${frontend}?error=verify_failed`)
  }
})

r.post('/resend-verification', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'E-post mangler' })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.json({ message: 'Hvis kontoen finnes, er e-post sendt.' })
    if (user.emailVerified) return res.json({ message: 'E-post allerede bekreftet.' })

    const verifyToken = crypto.randomBytes(32).toString('hex')
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken }
    })
    sendVerificationEmail(email, user.name, verifyToken)
    res.json({ message: 'Verifiseringsmail sendt. Sjekk innboksen din.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GOOGLE LOGIN ─────────────────────────────────────────────────────────────

const pendingStates = new Map()

function createState() {
  const state = crypto.randomBytes(20).toString('hex')
  pendingStates.set(state, Date.now())
  setTimeout(() => pendingStates.delete(state), 600000)
  return state
}

r.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google ikke konfigurert' })
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`
  const state = createState()
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

r.get('/google/callback', async (req, res) => {
  const { code, state, error: gErr } = req.query
  const frontend = process.env.FRONTEND_URL || 'https://yeeyoo.eu'
  if (gErr) return res.redirect(`${frontend}?error=google_denied`)
  if (!state || !pendingStates.has(state)) return res.redirect(`${frontend}?error=invalid_state`)
  pendingStates.delete(state)
  if (!code) return res.redirect(`${frontend}?error=no_code`)

  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`

    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) { console.error('Google token:', await tokenRes.text()); return res.redirect(`${frontend}?error=google_token`) }
    const { access_token } = await tokenRes.json()

    // Fetch userinfo
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    })
    if (!userRes.ok) return res.redirect(`${frontend}?error=google_userinfo`)
    const gi = await userRes.json()

    const user = await findOrCreateOAuthUser({
      sub: gi.sub,
      email: gi.email,
      name: gi.name || gi.email.split('@')[0],
      provider: 'google',
    })

    logLogin(user, req, 'google')
    res.redirect(`${frontend}?oauth_token=${signToken(user)}&oauth_name=${encodeURIComponent(user.name)}`)
  } catch (e) {
    console.error('Google error:', e)
    res.redirect(`${frontend}?error=${e.message==='invite_only'?'invite_only':'google_server'}`)
  }
})

// ─── STATUS ──────────────────────────────────────────────────────────────────
r.get('/providers', (req, res) => {
  res.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    inviteOnly: INVITE_ONLY,
  })
})

// ─── BETA SIGNUP (public — no auth needed) ───────────────────────────────────
r.post('/request-access', async (req, res) => {
  const { email, message } = req.body
  if (!email) return res.status(400).json({ error: 'E-post mangler' })
  try {
    const note = message
      ? `Beta-soknad: ${message.substring(0, 500)}`
      : 'Sokt via beta-skjema (ingen melding)'
    await prisma.inviteWhitelist.upsert({
      where: { email: email.toLowerCase() },
      update: { note },
      create: { email: email.toLowerCase(), approved: false, note }
    })
    res.json({ message: 'Takk! Vi sender deg en invitasjon nar plassen din er klar.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── ADMIN: Whitelist management ─────────────────────────────────────────────
r.get('/whitelist', requireAuth, async (req, res) => {
  try {
    const entries = await prisma.inviteWhitelist.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(entries)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

r.post('/whitelist', requireAuth, async (req, res) => {
  const { email, approved = true } = req.body
  if (!email) return res.status(400).json({ error: 'E-post mangler' })
  try {
    const entry = await prisma.inviteWhitelist.upsert({
      where: { email: email.toLowerCase() },
      update: { approved },
      create: { email: email.toLowerCase(), approved, note: 'Lagt til av admin' }
    })
    res.json(entry)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

r.delete('/whitelist/:id', requireAuth, async (req, res) => {
  try {
    await prisma.inviteWhitelist.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r
