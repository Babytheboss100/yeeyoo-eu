import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth)

// GET all projects for user
r.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' }
    })
    res.json(projects)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST create project
r.post('/', async (req, res) => {
  const { name, slug, color, tone, audience, keywords, about } = req.body
  try {
    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        color: color || '#5555ff',
        tone: tone || 'profesjonell',
        audience: audience || '',
        keywords: keywords || '',
        about: about || ''
      }
    })
    res.json(project)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT update project
r.put('/:id', async (req, res) => {
  const { name, color, tone, audience, keywords, about } = req.body
  try {
    const project = await prisma.project.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { name, color, tone, audience, keywords, about }
    })
    // Return the updated project
    const updated = await prisma.project.findUnique({ where: { id: req.params.id } })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE project
r.delete('/:id', async (req, res) => {
  try {
    await prisma.project.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r
