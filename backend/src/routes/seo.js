import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth)

// ─── Get SEO profile for a project ──────────────────────────────────────────
r.get('/:projectId', async (req, res) => {
  try {
    const profile = await prisma.seoProfile.findFirst({
      where: {
        projectId: req.params.projectId,
        userId: req.user.id
      }
    })
    res.json(profile || null)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Generate SEO profile using Gemini Flash 2.0 ───────────────────────────
r.post('/generate', async (req, res) => {
  const { projectId, companyName, companyOffer, industry, locations, targetCustomer, competitors } = req.body

  if (!projectId || !companyName || !industry) {
    return res.status(400).json({ error: 'Bedriftsnavn og bransje er pakrevd' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI API-nokkel mangler' })

  const system = `Du er en norsk SEO-ekspert med dyp kunnskap om norsk marked, Google-sok i Norge, og digital markedsforing for norske bedrifter. Du svarer ALLTID med gyldig JSON — ingen markdown, ingen forklaringer utenfor JSON.`

  const user = `Analyser denne bedriften og generer en komplett SEO-profil:

BEDRIFT: ${companyName}
TILBUD: ${companyOffer || 'Ikke spesifisert'}
BRANSJE: ${industry}
LOKASJON/OMRADER: ${locations || 'Norge'}
TYPISK KUNDE: ${targetCustomer || 'Ikke spesifisert'}
KONKURRENTER: ${competitors || 'Ikke spesifisert'}

Generer dette som JSON med NOYAKTIG denne strukturen:
{
  "keywords": [
    { "keyword": "sokeord her", "volume": 1200, "difficulty": "lav", "intent": "informasjonell" },
    ... (10 totalt, med realistiske norske sokevolum-estimater)
  ],
  "metaTitle": "SEO-optimert tittel under 60 tegn med viktigste sokeord",
  "metaDescription": "SEO-optimert metabeskrivelse under 155 tegn med CTA og sokeord",
  "blogIdeas": [
    { "title": "Blogginnlegg tittel optimert for sokeord", "targetKeyword": "hovedsokeord", "outline": "Kort beskrivelse av vinkling og innhold" },
    ... (3 totalt)
  ],
  "actionChecklist": [
    { "action": "Konkret SEO-tiltak", "impact": "hoy", "effort": "lav" },
    ... (5 totalt — prioriter quick wins)
  ]
}

VIKTIG:
- Sokevolum skal vaere realistiske estimater for NORSKE Google-sok
- Difficulty: "lav", "middels" eller "hoy"
- Intent: "informasjonell", "transaksjonell", "navigasjon" eller "kommersiell"
- Impact: "hoy", "middels" eller "lav"
- Effort: "lav", "middels" eller "hoy"
- Svar KUN med JSON, ingen annen tekst`

  try {
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 2000, responseMimeType: 'application/json' }
      })
    })

    if (!aiRes.ok) {
      const e = await aiRes.json()
      throw new Error(e.error?.message || 'Gemini API feil')
    }

    const aiData = await aiRes.json()
    const rawText = aiData.candidates[0].content.parts[0].text

    // Parse JSON from response (handle possible markdown wrapping)
    let seoData
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      seoData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
    } catch {
      throw new Error('Kunne ikke parse AI-respons som JSON')
    }

    // Upsert SEO profile
    const profile = await prisma.seoProfile.upsert({
      where: { projectId },
      update: {
        companyName,
        companyOffer: companyOffer || '',
        industry,
        locations: locations || '',
        targetCustomer: targetCustomer || '',
        competitors: competitors || '',
        keywords: seoData.keywords,
        metaTitle: seoData.metaTitle,
        metaDescription: seoData.metaDescription,
        blogIdeas: seoData.blogIdeas,
        actionChecklist: seoData.actionChecklist
      },
      create: {
        userId: req.user.id,
        projectId,
        companyName,
        companyOffer: companyOffer || '',
        industry,
        locations: locations || '',
        targetCustomer: targetCustomer || '',
        competitors: competitors || '',
        keywords: seoData.keywords,
        metaTitle: seoData.metaTitle,
        metaDescription: seoData.metaDescription,
        blogIdeas: seoData.blogIdeas,
        actionChecklist: seoData.actionChecklist
      }
    })

    res.json(profile)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r
