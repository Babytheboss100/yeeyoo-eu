import { Router } from 'express'
import { prisma } from '../prisma.js'

const r = Router()

// GET all posts (optionally filter by businessId)
r.get('/', async (req, res) => {
  try {
    const where = req.query.businessId ? { businessId: req.query.businessId } : {}
    const posts = await prisma.post.findMany({
      where,
      include: { business: { select: { name: true, url: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ posts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET calendar view — posts with scheduledAt in a month range
r.get('/calendar', async (req, res) => {
  try {
    const { year, month, businessId } = req.query
    const y = parseInt(year) || new Date().getFullYear()
    const m = parseInt(month) || new Date().getMonth() + 1
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 1)
    const where = { scheduledAt: { gte: start, lt: end } }
    if (businessId) where.businessId = businessId
    const posts = await prisma.post.findMany({
      where,
      include: { business: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' }
    })
    res.json({ posts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH schedule a post
r.patch('/:id/schedule', async (req, res) => {
  try {
    const { scheduledAt } = req.body
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
    })
    res.json({ post })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST auto-distribute posts across current month
r.post('/auto-schedule', async (req, res) => {
  try {
    const { businessId } = req.body
    if (!businessId) return res.status(400).json({ error: 'businessId er påkrevd' })
    const posts = await prisma.post.findMany({
      where: { businessId, scheduledAt: null },
      orderBy: { createdAt: 'asc' }
    })
    if (!posts.length) return res.json({ posts: [] })

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startDay = Math.max(now.getDate(), 1)
    const availableDays = daysInMonth - startDay + 1
    const gap = Math.max(1, Math.floor(availableDays / posts.length))

    const updated = await Promise.all(
      posts.map((p, i) => {
        const day = Math.min(startDay + i * gap, daysInMonth)
        const hour = 9 + (i % 3) * 4 // 09:00, 13:00, 17:00
        const scheduled = new Date(year, month, day, hour, 0, 0)
        return prisma.post.update({
          where: { id: p.id },
          data: { scheduledAt: scheduled }
        })
      })
    )
    res.json({ posts: updated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH approve
r.patch('/:id/approve', async (req, res) => {
  try {
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: { status: 'approved' }
    })
    res.json({ post })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH reject
r.patch('/:id/reject', async (req, res) => {
  try {
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: { status: 'rejected' }
    })
    res.json({ post })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r
