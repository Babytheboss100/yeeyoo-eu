import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth)

// GET /export/csv — download all posts as CSV
r.get('/csv', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { userId: req.user.id },
      include: {
        project: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const headers = ['Prosjekt', 'Plattform', 'AI-modell', 'Status', 'Opprettet', 'Planlagt', 'Innhold']
    const csvRows = posts.map(p => [
      p.project?.name || '-',
      p.platform,
      p.aiModel || '-',
      p.status,
      new Date(p.createdAt).toLocaleString('no-NO'),
      p.scheduledAt ? new Date(p.scheduledAt).toLocaleString('no-NO') : '-',
      `"${p.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ])

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="yeeyoo-innhold.csv"')
    res.send('\uFEFF' + csv)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /export/analytics — detailed analytics data
r.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.id

    // Posts by platform
    const allPosts = await prisma.post.findMany({
      where: { userId },
      include: { project: { select: { name: true, color: true } } }
    })

    // By platform
    const byPlatform = {}
    allPosts.forEach(p => {
      byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1
    })

    // By AI model
    const byModel = {}
    allPosts.forEach(p => {
      const model = p.aiModel || 'claude'
      byModel[model] = (byModel[model] || 0) + 1
    })

    // By status
    const byStatus = {}
    allPosts.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1
    })

    // By day (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentPosts = allPosts.filter(p => p.createdAt >= thirtyDaysAgo)
    const byDay = {}
    recentPosts.forEach(p => {
      const day = p.createdAt.toISOString().split('T')[0]
      byDay[day] = (byDay[day] || 0) + 1
    })

    // By project
    const byProject = {}
    allPosts.forEach(p => {
      if (p.project) {
        const key = p.project.name
        if (!byProject[key]) byProject[key] = { name: p.project.name, color: p.project.color, count: 0 }
        byProject[key].count++
      }
    })

    res.json({
      byPlatform: Object.entries(byPlatform).map(([platform, count]) => ({ platform, count })),
      byModel: Object.entries(byModel).map(([model, count]) => ({ model, count })),
      byDay: Object.entries(byDay).map(([day, count]) => ({ day, count })).sort((a,b) => a.day.localeCompare(b.day)),
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      byProject: Object.values(byProject).sort((a,b) => b.count - a.count)
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r
