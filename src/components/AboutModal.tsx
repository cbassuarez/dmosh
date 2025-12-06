import React from 'react'
import { useNavigate } from 'react-router-dom'

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

const AboutModal: React.FC<AboutModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate()

  if (!open) return null

  const handleLicensesClick = () => {
    onClose()
    navigate('/licenses')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-2xl border border-surface-300/70 bg-surface-100/90 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-50">About dmosh</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 transition hover:text-slate-200 hover:underline"
          >
            Close
          </button>
        </div>
        <div className="space-y-3 text-sm text-slate-400">
          <p>
            dmosh is a browser-based datamoshing tool for experimenting with temporal artifacts, keyframes, and motion
            vectors in video.
          </p>
          <p>
            dmosh uses libraries from the{' '}
            <a
              href="https://ffmpeg.org"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-600/70 hover:decoration-slate-300"
            >
              FFmpeg
            </a>{' '}
            project under the LGPLv2.1.
          </p>
          <p className="text-xs text-slate-500">FFmpeg is a trademark of Fabrice Bellard.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleLicensesClick}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition hover:opacity-90"
          >
            View open-source licenses
          </button>
        </div>
      </div>
    </div>
  )
}

export default AboutModal
