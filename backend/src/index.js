import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
dotenv.config()

import scrapeRoutes from './routes/scrape.js'
import analyseRoutes from './routes/analyse.js'
import generateRoutes from './routes/generate.js'
import postsRoutes from './routes/posts.js'
import authRoutes from './routes/auth.js'
import paymentsRoutes from './routes/payments.js'
import projectsRoutes from './routes/projects.js'
import teamRoutes from './routes/team.js'
import notificationsRoutes from './routes/notifications.js'
import seoRoutes from './routes/seo.js'
import exportRoutes from './routes/export.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: ['https://yeeyoo-eu-frontend.onrender.com','https://yeeyoo-eu-frontend-lcqc.onrender.com','https://yeeyoo.eu','*'], credentials: true }))
app.set('trust proxy', 1)

// Stripe webhook needs raw body — mount BEFORE json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '5mb' }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

// Public routes (no auth required)
app.use('/api/scrape', scrapeRoutes)
app.use('/api/analyse', analyseRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/auth', authRoutes)

// Authenticated routes
app.use('/api/payments', paymentsRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/team', teamRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/seo', seoRoutes)
app.use('/api/export', exportRoutes)

app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.0.0' }))

app.listen(PORT, () => console.log(`Yeeyoo EU backend running on port ${PORT}`))
