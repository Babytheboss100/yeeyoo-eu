# Yeeyoo EU

AI-drevet innholdsgenerator for bedrifter. Lim inn nettadressen din og få ferdige innlegg for LinkedIn, Instagram, Facebook og TikTok.

## Arkitektur

- **Backend**: Node.js / Express / Prisma / PostgreSQL
- **Frontend**: Single-page HTML (static)
- **AI**: Google Gemini Flash via API
- **Scraping**: Jina Reader (`r.jina.ai`)

## Kom i gang

### Backend

```bash
cd backend
cp .env.example .env    # Fyll inn verdier
npm install
npx prisma migrate dev  # Opprett database
npm run dev
```

### Frontend

Åpne `frontend/index.html` i nettleseren, eller serve med en statisk server.
Oppdater `API_BASE` i `index.html` til å peke på din backend-URL.

## Deploy (Render)

1. Push til GitHub
2. Koble repo i Render Dashboard
3. Render leser `render.yaml` automatisk
4. Sett `GEMINI_API_KEY` i Render environment

## API-endepunkter

| Metode | Endepunkt | Beskrivelse |
|--------|-----------|-------------|
| POST | `/api/scrape` | Scrape nettside og trekk ut bedriftsinfo |
| POST | `/api/analyse` | Analyser bedrift og lag innholdsstrategi |
| POST | `/api/generate` | Generer innlegg for sosiale medier |
| GET | `/api/posts` | Hent alle genererte innlegg |
| PATCH | `/api/posts/:id/approve` | Godkjenn innlegg |
| PATCH | `/api/posts/:id/reject` | Avvis innlegg |
