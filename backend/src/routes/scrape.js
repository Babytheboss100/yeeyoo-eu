import { Router } from 'express'
import fetch from 'node-fetch'
import { askGemini } from '../gemini.js'
import { prisma } from '../prisma.js'

const r = Router()

r.post('/', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'URL er påkrevd' })

    // Scrape via Jina Reader
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain' }
    })
    if (!jinaRes.ok) throw new Error(`Jina feil: ${jinaRes.status}`)
    const rawText = await jinaRes.text()

    // Extract business info via Gemini
    const prompt = `Analyser denne nettsiden og trekk ut forretningsinformasjon. Svar i JSON med feltene: name (firmanavn), industry (bransje), summary (kort oppsummering av hva bedriften gjør, maks 3 setninger).

Nettside-innhold:
${rawText.slice(0, 8000)}

Svar KUN med gyldig JSON, ingen markdown.`

    const geminiResult = await askGemini(prompt)
    let info
    try {
      info = JSON.parse(geminiResult.replace(/```json\n?|```/g, '').trim())
    } catch {
      info = { name: 'Ukjent bedrift', industry: 'Ukjent', summary: geminiResult.slice(0, 300) }
    }

    const business = await prisma.business.create({
      data: {
        url,
        name: info.name || 'Ukjent',
        industry: info.industry || 'Ukjent',
        summary: info.summary || '',
        rawData: rawText.slice(0, 15000)
      }
    })

    res.json({ business })
  } catch (e) {
    console.error('Scrape error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default r
