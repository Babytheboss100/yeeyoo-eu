import { Router } from 'express'
import { askGemini } from '../gemini.js'
import { prisma } from '../prisma.js'

const r = Router()

const platformSpecs = {
  linkedin: { maxLen: 1300, style: 'profesjonell, innsiktsfull, tankeleder-stil. Bruk linjeskift for lesbarhet.' },
  instagram: { maxLen: 500, style: 'visuell, engasjerende, med emojier. Kort og punchig.' },
  facebook: { maxLen: 800, style: 'vennlig, samtale-aktig, lokalt fokus. Spør spørsmål for engasjement.' },
  tiktok: { maxLen: 300, style: 'trendy, kort, uformell. Hook i første setning. Bruk slang.' }
}

r.post('/', async (req, res) => {
  try {
    const { businessId, platforms } = req.body
    if (!businessId) return res.status(400).json({ error: 'businessId er påkrevd' })

    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) return res.status(404).json({ error: 'Bedrift ikke funnet' })

    const selectedPlatforms = platforms || ['linkedin', 'instagram', 'facebook', 'tiktok']
    const analysis = business.analysis ? JSON.parse(business.analysis) : {}

    const prompt = `Du er en sosiale medier-ekspert. Lag innlegg for denne bedriften.

Bedrift: ${business.name}
Bransje: ${business.industry}
Beskrivelse: ${business.summary}
${analysis.toneOfVoice ? `Tone: ${analysis.toneOfVoice}` : ''}
${analysis.contentPillars ? `Temaer: ${analysis.contentPillars.join(', ')}` : ''}

Lag ETT innlegg per plattform. Svar i JSON-array med objekter:
${selectedPlatforms.map(p => `- { "platform": "${p}", "content": "innlegg-tekst (maks ${platformSpecs[p]?.maxLen || 500} tegn, ${platformSpecs[p]?.style || 'engasjerende'})", "hashtags": "#relevante #hashtags" }`).join('\n')}

Regler:
- Skriv på norsk
- Hvert innlegg skal ha unik vinkling tilpasset plattformen
- Ikke bruk klammeparenteser eller plassholdere
- Gjør innleggene klare til å publisere

Svar KUN med gyldig JSON-array, ingen markdown.`

    const result = await askGemini(prompt)
    let postsData
    try {
      postsData = JSON.parse(result.replace(/```json\n?|```/g, '').trim())
    } catch {
      return res.status(500).json({ error: 'Klarte ikke parse AI-svar' })
    }

    if (!Array.isArray(postsData)) {
      return res.status(500).json({ error: 'Ugyldig format fra AI' })
    }

    const created = await Promise.all(
      postsData.map(p =>
        prisma.post.create({
          data: {
            businessId,
            platform: p.platform,
            content: p.content,
            hashtags: p.hashtags || ''
          }
        })
      )
    )

    res.json({ posts: created })
  } catch (e) {
    console.error('Generate error:', e)
    res.status(500).json({ error: e.message })
  }
})

export default r
