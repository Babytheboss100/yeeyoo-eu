import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth)

// GET /team/:projectId — list team members
r.get('/:projectId', async (req, res) => {
  try {
    const members = await prisma.teamMember.findMany({
      where: {
        projectId: req.params.projectId,
        OR: [
          { invitedBy: req.user.id },
          { userId: req.user.id }
        ]
      },
      include: {
        user: { select: { name: true } }
      }
    })
    // Flatten user_name for compatibility
    const result = members.map(m => ({
      ...m,
      user_name: m.user?.name || null
    }))
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /team/invite — invite member
r.post('/invite', async (req, res) => {
  const { projectId, email, role } = req.body
  if (!projectId || !email) return res.status(400).json({ error: 'Mangler prosjekt eller e-post' })

  const validRoles = ['admin', 'editor', 'viewer']
  const memberRole = validRoles.includes(role) ? role : 'editor'

  try {
    // Verify user owns the project
    const proj = await prisma.project.findFirst({
      where: { id: projectId, userId: req.user.id }
    })
    if (!proj) return res.status(403).json({ error: 'Ikke ditt prosjekt' })

    const inviteToken = crypto.randomBytes(20).toString('hex')

    // Check if invited user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })

    const member = await prisma.teamMember.upsert({
      where: {
        projectId_email: { projectId, email }
      },
      update: {
        role: memberRole,
        inviteToken
      },
      create: {
        projectId,
        userId: existingUser?.id || null,
        invitedBy: req.user.id,
        email,
        role: memberRole,
        status: existingUser ? 'active' : 'pending',
        inviteToken
      }
    })

    // Create notification for invited user if they exist
    if (existingUser) {
      await prisma.notification.create({
        data: {
          userId: existingUser.id,
          title: 'Teaminnbydelse',
          message: `${req.user.email} inviterte deg til prosjektet "${proj.name}"`,
          type: 'team',
          link: '/app?tab=settings'
        }
      })
    }

    res.json(member)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Allerede invitert' })
    res.status(500).json({ error: e.message })
  }
})

// DELETE /team/:id — remove member
r.delete('/:id', async (req, res) => {
  try {
    await prisma.teamMember.deleteMany({
      where: { id: req.params.id, invitedBy: req.user.id }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /team/:id/role — change role
r.patch('/:id/role', async (req, res) => {
  const { role } = req.body
  const validRoles = ['admin', 'editor', 'viewer']
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Ugyldig rolle' })

  try {
    // First verify ownership
    const member = await prisma.teamMember.findFirst({
      where: { id: req.params.id, invitedBy: req.user.id }
    })
    if (!member) return res.status(404).json({ error: 'Ikke funnet' })

    const updated = await prisma.teamMember.update({
      where: { id: req.params.id },
      data: { role }
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r
