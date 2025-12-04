const AboutPage = () => (
  <div className="mx-auto max-w-4xl px-6 pb-16 text-slate-200">
    <h2 className="text-3xl font-semibold text-white">About / Credits</h2>
    <p className="mt-4 text-lg text-slate-300">
      DMOSH is a focused web-based datamoshing lab—built to feel like a grading suite, tuned for deterministic motion
      play. No gimmicks, just codecs, masks, and time.
    </p>
    <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-300">
      <p>
        We care about creative control: timeline-aware operations, maskable transforms, and automation lanes that feel
        like a DAW. The engine hooks are stubbed today, but the structure is production-grade.
      </p>
      <p>
        Credits: built by people who like bending motion vectors without breaking the craft. IBM Plex faces keep the
        interface technical and honest.
      </p>
      <p className="font-mono text-xs text-slate-400">Source: github.com/dmosh</p>
    </div>
  </div>
)

export default AboutPage
