// dmosh heavy-mode reference server. Implements the contract that
// src/mosh/serverBackend.ts expects:
//   POST /jobs            multipart {effect,intensity,seed,keepAudio,range,clip,clip2?} -> {id}
//   GET  /jobs/:id        -> {status,progress,phase,error?}
//   GET  /jobs/:id/result -> mp4 bytes
//
// Run: cd server && npm install && npm start   (needs ffmpeg on PATH;
// motionTransfer additionally needs ffgac/ffedit from ffglitch.org).
import express from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { rm, stat } from 'node:fs/promises'
import { processJob } from './mosh.mjs'

const PORT = process.env.PORT || 8787
const TOKEN = process.env.MOSH_TOKEN || ''
const ORIGIN = process.env.CORS_ORIGIN || '*'

const upload = multer({ dest: '/tmp/dmosh-uploads', limits: { fileSize: 512 * 1024 * 1024 } })
const app = express()

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', ORIGIN)
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  if (TOKEN && req.get('Authorization') !== `Bearer ${TOKEN}`) return res.sendStatus(401)
  next()
})

/** id -> { status, progress, phase, error?, resultPath?, files[] } */
const jobs = new Map()

app.post('/jobs', upload.fields([{ name: 'clip', maxCount: 1 }, { name: 'clip2', maxCount: 1 }]), (req, res) => {
  const clip = req.files?.clip?.[0]
  if (!clip) return res.status(400).json({ error: 'missing clip' })
  const clip2 = req.files?.clip2?.[0]

  const options = {
    effect: req.body.effect,
    intensity: req.body.intensity != null ? Number(req.body.intensity) : undefined,
    seed: req.body.seed != null ? Number(req.body.seed) : undefined,
    maxDimension: req.body.maxDimension != null ? Number(req.body.maxDimension) : undefined,
    keepAudio: req.body.keepAudio === 'true',
    range: req.body.range ? JSON.parse(req.body.range) : undefined,
  }

  const id = randomUUID()
  const uploads = [clip.path, clip2?.path].filter(Boolean)
  const job = { status: 'queued', progress: 0, phase: 'Queued', files: uploads }
  jobs.set(id, job)
  res.json({ id })

  ;(async () => {
    job.status = 'processing'
    try {
      const result = await processJob(
        { clip: clip.path, clip2: clip2?.path },
        options,
        (progress, phase) => Object.assign(job, { progress, phase }),
      )
      Object.assign(job, { status: 'done', progress: 1, phase: 'Done', resultPath: result })
    } catch (e) {
      Object.assign(job, { status: 'error', error: String(e.message || e) })
    } finally {
      await Promise.all(uploads.map((f) => rm(f, { force: true }).catch(() => {})))
    }
  })()
})

app.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) return res.sendStatus(404)
  const { status, progress, phase, error } = job
  res.json({ status, progress, phase, error })
})

app.get('/jobs/:id/result', async (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job || job.status !== 'done' || !job.resultPath) return res.sendStatus(404)
  try {
    await stat(job.resultPath)
  } catch {
    return res.sendStatus(410)
  }
  res.type('video/mp4')
  createReadStream(job.resultPath).pipe(res)
})

app.listen(PORT, () => console.log(`dmosh server on :${PORT}`))
