import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth)

// GET /notifications — list user notifications
r.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    res.json(notifications)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /notifications/unread-count
r.get('/unread-count', async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, read: false }
    })
    res.json({ count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /notifications/:id/read
r.patch('/:id/read', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { read: true }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /notifications/read-all
r.patch('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id },
      data: { read: true }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r

// Helper: create notification (used by other routes)
export async function createNotification(userId, title, message, type = 'info', link = null) {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type, link }
    })
  } catch (e) {
    console.error('Notification error:', e.message)
  }
}
