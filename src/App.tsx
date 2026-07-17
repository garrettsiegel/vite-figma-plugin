import Count from './components/Count'

function App() {
  return (
    <main className="min-h-screen bg-[var(--plugin-bg)] p-4 text-[var(--plugin-text)]">
      <div className="mx-auto flex max-w-sm flex-col gap-3">
        <header className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--plugin-text-secondary)] uppercase">
            Figma plugin starter
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            Rectangle creator
          </h1>
          <p className="text-sm leading-5 text-[var(--plugin-text-secondary)]">
            Create a centered grid through the typed UI-to-sandbox bridge.
          </p>
        </header>

        <Count />

        <aside className="rounded-lg border border-[var(--plugin-border)] bg-[var(--plugin-bg-secondary)] p-2.5 text-xs leading-4 text-[var(--plugin-text-secondary)]">
          UI and sandbox messages are runtime-validated in{' '}
          <code className="font-mono text-[var(--plugin-text)]">shared/</code>.
        </aside>
      </div>
    </main>
  )
}

export default App
