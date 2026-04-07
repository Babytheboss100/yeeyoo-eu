import { Router } from 'express'
import Stripe from 'stripe'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const r = Router()

// ─── Plan definitions ────────────────────────────────────────────────────────
export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratis',
    price: 0,
    postsPerMonth: 999,
    projects: 1,
    aiModels: ['claude', 'gpt4o', 'gemini', 'grok', 'deepseek'],
    platforms: 4
  },
  starter: {
    id: 'starter',
    name: 'Grunnleggende',
    price: 29,
    priceId: process.env.STRIPE_PRICE_STARTER,
    postsPerMonth: 50,
    projects: 2,
    aiModels: ['claude', 'gpt4o'],
    platforms: 4
  },
  vekst: {
    id: 'vekst',
    name: 'Vekst',
    price: 79,
    priceId: process.env.STRIPE_PRICE_VEKST,
    postsPerMonth: 200,
    projects: 5,
    aiModels: ['claude', 'gpt4o', 'gemini', 'grok', 'deepseek'],
    platforms: 4
  },
  bedrift: {
    id: 'bedrift',
    name: 'Bedrift',
    price: 149,
    priceId: process.env.STRIPE_PRICE_BEDRIFT,
    postsPerMonth: -1, // unlimited
    projects: -1,
    aiModels: ['claude', 'gpt4o', 'gemini', 'grok', 'deepseek'],
    platforms: 4
  }
}

// ─── Helper: get or create subscription ──────────────────────────────────────
export async function getSubscription(userId) {
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  return sub || { plan: 'free', status: 'active' }
}

// ─── GET /payments/plan ──────────────────────────────────────────────────────
r.get('/plan', requireAuth, async (req, res) => {
  try {
    const sub = await getSubscription(req.user.id)
    const plan = PLANS[sub.plan] || PLANS.free
    res.json({ subscription: sub, plan })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /payments/usage ─────────────────────────────────────────────────────
r.get('/usage', requireAuth, async (req, res) => {
  try {
    const sub = await getSubscription(req.user.id)
    const plan = PLANS[sub.plan] || PLANS.free

    // Count posts this month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const used = await prisma.post.count({
      where: {
        userId: req.user.id,
        createdAt: { gte: startOfMonth }
      }
    })

    const limit = plan.postsPerMonth
    const remaining = limit === -1 ? -1 : Math.max(0, limit - used)
    const canGenerate = limit === -1 || used < limit

    res.json({ used, limit, remaining, canGenerate, plan: sub.plan })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /payments/checkout ─────────────────────────────────────────────────
r.post('/checkout', requireAuth, async (req, res) => {
  const { planId } = req.body
  const plan = PLANS[planId]
  if (!plan || !plan.priceId) {
    return res.status(400).json({
      error: `Plan "${planId}" mangler pris-ID. Sett STRIPE_PRICE_${planId.toUpperCase()} i env vars.`,
      configured: Object.entries(PLANS).map(([k,v]) => ({ plan: k, hasPrice: Boolean(v.priceId) }))
    })
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })

    // Get or create Stripe customer
    let customerId
    const sub = await getSubscription(req.user.id)
    if (sub.stripeCustomerId) {
      customerId = sub.stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: req.user.id }
      })
      customerId = customer.id
      await prisma.subscription.upsert({
        where: { userId: req.user.id },
        update: { stripeCustomerId: customerId },
        create: { userId: req.user.id, stripeCustomerId: customerId, plan: 'free', status: 'active' }
      })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/app?upgrade=success`,
      cancel_url: `${process.env.FRONTEND_URL}/app?upgrade=cancelled`,
      metadata: { userId: req.user.id, planId }
    })

    res.json({ url: session.url })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /payments/portal ───────────────────────────────────────────────────
r.post('/portal', requireAuth, async (req, res) => {
  try {
    const sub = await getSubscription(req.user.id)
    if (!sub.stripeCustomerId) return res.status(400).json({ error: 'Ingen aktiv plan' })

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/app?tab=settings`
    })
    res.json({ url: session.url })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /payments/webhook ──────────────────────────────────────────────────
r.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    return res.status(400).json({ error: `Webhook feil: ${e.message}` })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        const { userId, planId } = session.metadata
        await prisma.subscription.upsert({
          where: { userId },
          update: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan: planId,
            status: 'active'
          },
          create: {
            userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan: planId,
            status: 'active'
          }
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const sub = await stripe.subscriptions.retrieve(invoice.subscription)
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription },
          data: {
            status: 'active',
            currentPeriodEnd: new Date(sub.current_period_end * 1000)
          }
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const planId = Object.keys(PLANS).find(k =>
          PLANS[k].priceId === sub.items.data[0]?.price.id
        ) || 'free'
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            plan: planId,
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000)
          }
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: 'free', status: 'cancelled' }
        })
        break
      }
    }
    res.json({ received: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default r
