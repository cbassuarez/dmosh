import { ArrowRight, Sparkles, Wand2, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const featureCards = [
  {
    title: 'Codec-aware timeline',
    subtitle: 'Frame-accurate layering with intra-frame finesse',
    icon: <Workflow className="h-5 w-5 text-accent" />,
  },
  {
    title: 'Spatial masks',
    subtitle: 'Carve regions that breathe with the frame energy',
    icon: <Sparkles className="h-5 w-5 text-accent" />,
  },
  {
    title: 'Motion-vector transforms',
    subtitle: 'Bend vectors into ribbons, smear, drag, and echo',
    icon: <Wand2 className="h-5 w-5 text-accent" />,
  },
  {
    title: 'Automation curves',
    subtitle: 'Dial chaos in precise, performable envelopes',
    icon: <ArrowRight className="h-5 w-5 text-accent" />,
  },
]

const LandingPage = () => {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-20 text-slate-100">
      <section className="flex flex-col gap-8 py-16 sm:py-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Datamoshing suite</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Precision-grade web datamosher</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            A cinematic, codec-native environment for bending motion vectors, weaving masks, and automating glitch
            choreography in the browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/app"
              className="group inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-black shadow-panel transition-transform duration-200 hover:scale-[1.02]"
            >
              Open Editor
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 rounded-md border border-surface-300 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:border-accent hover:text-white"
            >
              View Docs
            </Link>
          </div>
        </motion.div>
        <motion.div
          className="grid gap-4 rounded-xl border border-surface-300/60 bg-surface-200/80 p-6 shadow-panel sm:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {featureCards.map((card) => (
            <div
              key={card.title}
              className="group relative overflow-hidden rounded-lg border border-surface-300/40 bg-surface-300/60 p-4 transition duration-200 hover:border-accent/60"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-surface-200 opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex items-start gap-3">
                <div className="rounded-md border border-surface-300/60 bg-surface-400/60 p-2 shadow-inner">{card.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-white">{card.title}</p>
                  <p className="text-xs text-slate-400">{card.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="grid gap-6 border-t border-surface-300/60 py-12 sm:grid-cols-3">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Step {step}</p>
            <p className="text-lg font-semibold text-white">
              {step === 1 && 'Import your sources with codec awareness.'}
              {step === 2 && 'Configure masks, operations, and automation cues.'}
              {step === 3 && 'Render or handoff to CLI/ffmpeg with deterministic intent.'}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 py-10 sm:grid-cols-3">
        {[1, 2, 3].map((frame) => (
          <div
            key={frame}
            className="relative aspect-video overflow-hidden rounded-xl border border-surface-300/60 bg-gradient-to-br from-surface-200 via-surface-300 to-surface-400"
          >
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              Future screenshot {frame}
            </div>
          </div>
        ))}
      </section>

      <footer className="mt-6 flex flex-wrap gap-4 border-t border-surface-300/60 py-8 text-sm text-slate-400">
        {['/about', '/docs', '/cli', '/examples', '/changelog'].map((href) => (
          <Link key={href} to={href} className="hover:text-white">
            {href.replace('/', '')}
          </Link>
        ))}
      </footer>
    </div>
  )
}

export default LandingPage
