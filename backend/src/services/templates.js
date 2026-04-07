// ─── Industry Templates for Yeeyoo ──────────────────────────────────────────
// Pre-built project configurations per industry

export const INDUSTRY_TEMPLATES = [
  {
    id: 'fintech',
    name: 'Fintech / Finanstjenester',
    emoji: 'money',
    color: '#2d5be3',
    tone: 'Profesjonell, trygg og transparent. Bygg tillit med tall og fakta.',
    audience: 'Privatinvestorer, grundere, finansinteresserte 25-55 ar',
    keywords: 'investering, avkastning, crowdfunding, fintech, lan, rente, portefolje',
    about: 'Vi tilbyr finanstjenester og investeringsplattform for privatpersoner.',
    prompts: [
      { label: 'Markedsoppdatering', prompt: 'Skriv et markedsoppdatering-innlegg med nokkeltall og trender. Vis ekspertise.' },
      { label: 'Investortips', prompt: 'Del et praktisk investeringstips. Enkel forklaring, konkret eksempel.' },
      { label: 'Milepael', prompt: 'Vi har passert en viktig milepael. Del nyheten med begeistring og takk investorene.' },
    ]
  },
  {
    id: 'ecommerce',
    name: 'E-handel / Nettbutikk',
    emoji: 'cart',
    color: '#f59e0b',
    tone: 'Engasjerende, visuell og salgsorientert. Skap FOMO og urgency.',
    audience: 'Online shoppere 20-45 ar, trendsettere, prisbevisste forbrukere',
    keywords: 'netthandel, tilbud, kampanje, gratis frakt, bestselger, nyheter',
    about: 'Vi selger produkter online og onsker a drive trafikk til nettbutikken.',
    prompts: [
      { label: 'Produktlansering', prompt: 'Lanser et nytt produkt med begeistring. Vis fordeler og skap urgency.' },
      { label: 'Flash Sale', prompt: 'Annonser et tidsbegrenset tilbud. Skap FOMO med countdown og rabatt.' },
      { label: 'Kundehistorie', prompt: 'Del en ekte kundehistorie/anmeldelse. Bygg sosial bevis.' },
    ]
  },
  {
    id: 'restaurant',
    name: 'Restaurant / Mat & Drikke',
    emoji: 'food',
    color: '#ef4444',
    tone: 'Varm, innbydende og sanselig. Beskriv smaker, dufter og opplevelser.',
    audience: 'Matentusiaster, lokale innbyggere, familier, par 25-55 ar',
    keywords: 'restaurant, meny, lokal mat, sesong, vin, opplevelse, reservasjon',
    about: 'Vi driver restaurant og onsker a tiltrekke gjester og bygge merkevare.',
    prompts: [
      { label: 'Ukens meny', prompt: 'Presenter ukens spesialrett. Beskriv ingredienser og smaker levende.' },
      { label: 'Bak kulissene', prompt: 'Vis et glimt bak kulissene — kokken, ravarene, forberedelsene.' },
      { label: 'Event/kveld', prompt: 'Annonser et kommende arrangement — vinkveld, live musikk, tema-aften.' },
    ]
  },
  {
    id: 'realestate',
    name: 'Eiendom / Bolig',
    emoji: 'house',
    color: '#16a34a',
    tone: 'Profesjonell, aspirasjonell og lokal. Vis drommeboligen.',
    audience: 'Boligkjopere, investorer, utleiere, forstegangskjopere 28-55 ar',
    keywords: 'eiendom, bolig, leilighet, salg, utleie, investering, visning',
    about: 'Vi formidler eiendom og hjelper kunder med kjop, salg og utleie.',
    prompts: [
      { label: 'Ny bolig', prompt: 'Presenter en ny bolig til salgs. Fremhev unike egenskaper og beliggenhet.' },
      { label: 'Markedstips', prompt: 'Del et tips om boligmarkedet. Vis ekspertise og gi verdifull innsikt.' },
      { label: 'Solgt!', prompt: 'Del at en bolig er solgt. Gratulerer kjoper og selger. Bygg momentum.' },
    ]
  },
  {
    id: 'health',
    name: 'Helse / Trening',
    emoji: 'health',
    color: '#06b6d4',
    tone: 'Motiverende, faglig og empatisk. Inspirer til endring.',
    audience: 'Helsebevisste, treningsentusiaster, pasienter 20-60 ar',
    keywords: 'helse, trening, kosthold, velvaere, motivasjon, resultater, livsstil',
    about: 'Vi tilbyr helsetjenester, trening eller velvaere-produkter.',
    prompts: [
      { label: 'Treningstips', prompt: 'Del et konkret treningstips med ovelse og forklaring. Motiver.' },
      { label: 'Suksesshistorie', prompt: 'Del en kundes transformasjonshistorie. Vis resultater og inspirer.' },
      { label: 'Myte vs fakta', prompt: 'Avliv en vanlig helsemyte med fakta. Posisjoner som ekspert.' },
    ]
  },
  {
    id: 'tech',
    name: 'Tech / SaaS',
    emoji: 'computer',
    color: '#7c3aed',
    tone: 'Innovativ, klar og losningsorientert. Vis teknisk kompetanse uten jargong.',
    audience: 'Utviklere, produktledere, grundere, tech-enthusiaster 22-45 ar',
    keywords: 'SaaS, startup, AI, automatisering, produktivitet, API, integrasjon',
    about: 'Vi bygger teknologi/software som loser et spesifikt problem.',
    prompts: [
      { label: 'Feature launch', prompt: 'Annonser en ny feature. Vis problemet den loser og hvordan den fungerer.' },
      { label: 'Behind the code', prompt: 'Del en teknisk innsikt eller arkitekturbeslutning. Vis teamets kompetanse.' },
      { label: 'Brukercase', prompt: 'Vis hvordan en kunde bruker produktet og hvilke resultater de oppnar.' },
    ]
  }
]
