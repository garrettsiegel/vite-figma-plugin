import { build } from 'vite'

const watcher = await build({
  build: {
    watch: {
      // Native FSEvents can be dropped in sandboxed/containerized filesystems.
      // Keep polling scoped to watch mode so production builds stay unchanged.
      chokidar: { usePolling: true, interval: 150 },
    },
  },
})

if (Array.isArray(watcher) || typeof watcher.close !== 'function') {
  throw new Error('Expected Vite to start a Rollup watcher')
}

async function shutdown() {
  await watcher.close()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
