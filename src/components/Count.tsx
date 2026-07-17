import {
  DEFAULT_SHAPE_COUNT,
  MAX_SHAPE_COUNT,
  MIN_SHAPE_COUNT,
  isPluginMessage,
  normalizeShapeCountInput,
  type UIMessage,
} from '@shared/messages'
import { useEffect, useState, type FormEvent } from 'react'

type Status = {
  message: string
  tone: 'default' | 'error'
}

function postPluginMessage(pluginMessage: UIMessage) {
  parent.postMessage({ pluginMessage }, '*')
}

export default function Count() {
  const [count, setCount] = useState(String(DEFAULT_SHAPE_COUNT))
  const [status, setStatus] = useState<Status>({
    message: 'Ready to create shapes.',
    tone: 'default',
  })

  useEffect(() => {
    function handlePluginMessage(event: MessageEvent) {
      const message: unknown = event.data?.pluginMessage

      if (isPluginMessage(message)) {
        if (message.type === 'shapes-created') {
          setStatus({
            message: `Created ${message.count} ${message.count === 1 ? 'shape' : 'shapes'}.`,
            tone: 'default',
          })
          return
        }

        setStatus({
          message: 'Could not create shapes. Please try again.',
          tone: 'error',
        })
      }
    }

    window.addEventListener('message', handlePluginMessage)
    return () => window.removeEventListener('message', handlePluginMessage)
  }, [])

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextCount = normalizeShapeCountInput(count)
    setCount(String(nextCount))
    setStatus({
      message: `Creating ${nextCount} ${nextCount === 1 ? 'shape' : 'shapes'}…`,
      tone: 'default',
    })
    postPluginMessage({ type: 'create-shapes', count: nextCount })
  }

  function handleCancel() {
    postPluginMessage({ type: 'cancel' })
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-[var(--plugin-border)] bg-[var(--plugin-bg-secondary)] p-3 shadow-sm"
      noValidate
      onSubmit={handleCreate}
    >
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="count">
          Number of rectangles
        </label>
        <input
          aria-describedby="count-help"
          className="w-full rounded-md border border-[var(--plugin-border-strong)] bg-[var(--plugin-bg)] px-3 py-2 text-sm text-[var(--plugin-text)] outline-none transition focus:border-[var(--plugin-focus)] focus:ring-2 focus:ring-[var(--plugin-focus-muted)]"
          id="count"
          inputMode="numeric"
          max={MAX_SHAPE_COUNT}
          min={MIN_SHAPE_COUNT}
          onChange={(event) => setCount(event.target.value)}
          step="1"
          type="number"
          value={count}
        />
        <p
          className="text-xs text-[var(--plugin-text-secondary)]"
          id="count-help"
        >
          Choose {MIN_SHAPE_COUNT}–{MAX_SHAPE_COUNT}; other values are clamped.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="rounded-md bg-[var(--plugin-brand)] px-4 py-2 text-sm font-semibold text-[var(--plugin-text-onbrand)] transition hover:bg-[var(--plugin-brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--plugin-focus)]"
          id="create"
          type="submit"
        >
          Create
        </button>
        <button
          className="rounded-md border border-[var(--plugin-border-strong)] bg-[var(--plugin-bg)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--plugin-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--plugin-focus)]"
          id="cancel"
          onClick={handleCancel}
          type="button"
        >
          Cancel
        </button>
      </div>

      <p
        aria-live="polite"
        className={`min-h-5 text-xs font-medium ${
          status.tone === 'error'
            ? 'text-[var(--plugin-error)]'
            : 'text-[var(--plugin-text-secondary)]'
        }`}
        role="status"
      >
        {status.message}
      </p>
    </form>
  )
}
