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
