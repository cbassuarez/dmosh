import React from 'react'

export const LicensesPage: React.FC = () => {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 pb-16 pt-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">Open-source &amp; licenses</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          dmosh is built on open-source software. This page outlines the licenses of dmosh itself and key third-party
          components.
        </p>
      </header>

      <section className="space-y-2 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Project license</h2>
        <p className="text-sm text-slate-400">
          dmosh is licensed under the MIT License. You can find the full text in the{' '}
          <code className="rounded bg-surface-300/70 px-1 py-0.5 text-[0.75rem]">LICENSE</code> file in the repository.
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4">
        <h2 className="text-sm font-semibold text-slate-100">FFmpeg</h2>
        <p className="text-sm text-slate-400">
          dmosh uses code of{' '}
          <a
            href="https://ffmpeg.org"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-500 hover:decoration-slate-300"
          >
            FFmpeg
          </a>{' '}
          via the{' '}
          <a
            href="https://www.npmjs.com/package/@ffmpeg/ffmpeg"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-500 hover:decoration-slate-300"
          >
            @ffmpeg/ffmpeg
          </a>{' '}
          WebAssembly build for in-browser media processing.
        </p>
        <p className="text-sm text-slate-400">
          FFmpeg is licensed under the LGPLv2.1 or later (and GPL for certain optional components). dmosh is configured to
          avoid GPL-only or nonfree components so that dmosh itself can remain under the MIT License.
        </p>
        <p className="text-sm text-slate-400">FFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.</p>
        <p className="text-sm text-slate-400">
          For corresponding FFmpeg source code and build information, see the
          <code className="mx-1 rounded bg-surface-300/70 px-1 py-0.5 text-[0.75rem]">third_party/ffmpeg-core/</code>
          directory and the{' '}
          <a
            href="https://github.com/dmosh/dmosh/blob/main/THIRD_PARTY_LICENSES.md"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-500 hover:decoration-slate-300"
          >
            Third-Party Licenses
          </a>{' '}
          document in the repository.
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Other dependencies</h2>
        <p className="text-sm text-slate-400">
          dmosh also uses open-source libraries such as React, React Router, Tailwind CSS, Framer Motion, and Lucide icons.
          Please refer to their respective projects for full license information.
        </p>
      </section>
    </div>
  )
}

export default LicensesPage
