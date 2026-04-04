import { Router } from 'express'
import { askGemini } from '../gemini.js'
import { prisma } from '../prisma.js'

const r = Router()

r.post('/', async (req, res) => {
  try {
    const { businessId } = req.body
    if (!businessId) return res.status(400).json({ error: 'businessId er påkrevd' })

    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) return res.status(404).json({ error: 'Bedrift ikke funnet' })

    const prompt = `Du er en digital markedsføringsstrateg. Analyser denne bedriften og lag en innholdsstrategi.

Bedrift: ${business.name}
Bransje: ${business.industry}
Beskrivelse: ${business.summary}
Nettside-data: ${(business.rawData || '').slice(0, 5000)}

Lag en analyse i JSON med feltene:
- strengths: array med 3 styrker
- opportunities: array med 3 muligheter for sosiale medier
- targetAudience: beskrivelse av målgruppe
- toneOfVoice: anbefalt tone (f.eks. "Profesjonell men vennlig")
- contentPillars: array med 4 innholdskategorier å poste om
- postingFrequency: anbefalt frekvens per plattform

Svar KUN med gyldig JSON, ingen markdown.`

    const result = await askGemini(prompt)
    let analysis
    try {
      analysis = JSON.parse(result.replace(/```json\n?|```/g, '').trim())
    } catch {
      analysis = { raw: result }
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: { analysis: JSON.stringify(analysis) }
    })

    res.json({ business: updated, analysis })
  } catch (e) {
    console.error('Analyse error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default r
