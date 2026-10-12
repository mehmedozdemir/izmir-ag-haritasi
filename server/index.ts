import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { logger } from 'hono/logger'
import { getEshotFare } from './eshot.ts'
import { FareError, getFare } from './fare.ts'

const isProd = process.env.NODE_ENV === 'production'
// Geliştirmede PORT, Vite ile çakışabildiği için yalnızca üretimde dikkate alınır.
const PORT = Number(process.env.API_PORT ?? (isProd ? process.env.PORT : undefined) ?? 8787)

const todayInIstanbul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

const app = new Hono()
// Sağlık kontrolü (Docker healthcheck) logları doldurmasın diye logger'dan önce tanımlı.
app.get('/api/health', (c) => c.json({ ok: true }))

app.use('/api/*', logger())

app.get('/api/fare', async (c) => {
  const from = Number(c.req.query('from'))
  const to = Number(c.req.query('to'))
  const date = c.req.query('date') ?? todayInIstanbul()
  try {
    return c.json(await getFare(from, to, date))
  } catch (err) {
    if (err instanceof FareError) return c.json({ error: err.message }, err.status)
    throw err
  }
})

// ESHOT "Gittiğin Kadar Öde" hatları: dir 1 = gidiş, 2 = dönüş; htt=1 Halk Taşıt saati.
app.get('/api/fare/eshot', async (c) => {
  const q = (k: string) => Number(c.req.query(k))
  try {
    return c.json(await getEshotFare(q('line'), q('dir'), q('from'), q('to'), c.req.query('htt') === '1'))
  } catch (err) {
    if (err instanceof FareError) return c.json({ error: err.message }, err.status)
    throw err
  }
})

// Üretimde derlenmiş frontend'i de bu sunucu servis eder (tek dağıtım birimi).
if (isProd) {
  app.use('/*', compress())
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API http://localhost:${info.port} (${isProd ? 'production' : 'development'})`)
})
