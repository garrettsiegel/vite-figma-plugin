import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyDist } from '../../scripts/verify-dist.mjs'

const fixtureRoots: string[] = []

const validManifest = {
  name: 'Verifier fixture',
  id: '123456789',
  api: '1.0.0',
  main: 'dist/code.js',
  ui: 'dist/index.html',
  documentAccess: 'dynamic-page',
  editorType: ['figma'],
  networkAccess: { allowedDomains: ['none'] },
}

const validHtml = `<!doctype html>
<html>
  <head><style>body { color: CanvasText; }</style></head>
  <body><main>Fixture</main><script type="module">console.log('inline')</script></body>
</html>`

const validProductionCode = '"use strict";(()=>{console.log("production")})();'
const validWatchCode = `(function () {
  console.log('watch')
})();
//# sourceMappingURL=data:application/json;base64,e30=`

type FixtureOverrides = {
  code?: string
  html?: string
  manifest?: Record<string, unknown>
  extraFiles?: Record<string, string>
}

const createFixture = async ({
  code = validProductionCode,
  html = validHtml,
  manifest = validManifest,
  extraFiles = {},
}: FixtureOverrides = {}) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'figma-plugin-verifier-'))
  const distDir = join(rootDir, 'dist')
  fixtureRoots.push(rootDir)

  await mkdir(distDir)
  await Promise.all([
    writeFile(join(rootDir, 'manifest.json'), JSON.stringify(manifest)),
    writeFile(join(distDir, 'code.js'), code),
    writeFile(join(distDir, 'index.html'), html),
    ...Object.entries(extraFiles).map(([path, contents]) =>
      writeFile(join(distDir, path), contents),
    ),
  ])

  return rootDir
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { recursive: true })),
  )
})

describe('verifyDist', () => {
  it.each([
    ['production', validProductionCode],
    ['watch', validWatchCode],
  ])('accepts a valid %s sandbox bundle', async (_name, code) => {
    const rootDir = await createFixture({ code })

    await expect(verifyDist({ rootDir })).resolves.toEqual({
      files: ['code.js', 'index.html'],
    })
  })

  it('ignores tag-like strings inside inline JavaScript', async () => {
    const html = validHtml.replace(
      "console.log('inline')",
      `const examples = '<script src="./not-a-tag.js"><link rel="stylesheet" href="./not-a-tag.css">'`,
    )
    const rootDir = await createFixture({ html })

    await expect(verifyDist({ rootDir })).resolves.toBeDefined()
  })

  it('rejects extra output files', async () => {
    const rootDir = await createFixture({
      extraFiles: { 'asset.js': 'unused' },
    })

    await expect(verifyDist({ rootDir })).rejects.toThrow(
      /Expected only code\.js and index\.html/,
    )
  })

  it.each([
    [
      'an ES module',
      'export const value = 1',
      /not valid classic-script JavaScript/,
    ],
    ['a runtime require', 'require("dependency")', /runtime require reference/],
    ['a dynamic import', 'import("dependency")', /runtime import\(\)/],
    [
      'a template-expression require',
      '`${require("dependency")}`',
      /runtime require reference/,
    ],
    [
      'a template-expression import',
      '`${import("dependency")}`',
      /runtime import\(\)/,
    ],
  ])('rejects %s sandbox bundle', async (_name, code, message) => {
    const rootDir = await createFixture({ code })

    await expect(verifyDist({ rootDir })).rejects.toThrow(message)
  })

  it('rejects esbuild dynamic-require helpers after minification', async () => {
    const buildResult = await build({
      bundle: true,
      format: 'iife',
      minify: true,
      platform: 'browser',
      stdin: {
        contents: 'const target = globalThis.name; require(target)',
        sourcefile: 'dynamic-require.js',
      },
      target: 'es2020',
      write: false,
    })
    const code = buildResult.outputFiles[0].text
    const rootDir = await createFixture({ code })

    await expect(verifyDist({ rootDir })).rejects.toThrow(
      /runtime require reference/,
    )
  })

  it.each([
    [
      'an invalid executable script',
      '<script type="module">const = ;</script>',
      /Inline UI script is not valid module JavaScript/,
    ],
    [
      'a static module import',
      '<script type="module">import value from "dependency"</script>',
      /Found a static import/,
    ],
    [
      'a dynamic module import',
      '<script type="module">import("https://example.com/app.js")</script>',
      /runtime import\(\)/,
    ],
    [
      'an export-all module load',
      '<script type="module">export * from "https://example.com/app.js"</script>',
      /module re-export/,
    ],
    [
      'a named re-export module load',
      '<script type="module">export { value } from "https://example.com/app.js"</script>',
      /module re-export/,
    ],
  ])('rejects %s in inline UI JavaScript', async (_name, script, message) => {
    const html = validHtml.replace(
      '<script type="module">console.log(\'inline\')</script>',
      script,
    )
    const rootDir = await createFixture({ html })

    await expect(verifyDist({ rootDir })).rejects.toThrow(message)
  })

  it('does not count non-executable script data as UI JavaScript', async () => {
    const html = validHtml.replace(
      '<script type="module">console.log(\'inline\')</script>',
      '<script type="application/json">{"fixture":true}</script>',
    )
    const rootDir = await createFixture({ html })

    await expect(verifyDist({ rootDir })).rejects.toThrow(
      /Executable UI JavaScript was not inlined/,
    )
  })

  it('does not count non-CSS style data as inline UI CSS', async () => {
    const html = validHtml.replace(
      '<style>body { color: CanvasText; }</style>',
      '<style type="text/less">body { color: red; }</style>',
    )
    const rootDir = await createFixture({ html })

    await expect(verifyDist({ rootDir })).rejects.toThrow(
      /UI CSS was not inlined/,
    )
  })

  it.each([
    [
      'an external script',
      '<script src="https://example.com/app.js"></script>',
      /Found external script/,
    ],
    [
      'an external stylesheet',
      '<link rel="stylesheet" href="https://example.com/app.css">',
      /Found external stylesheet or icon/,
    ],
    [
      'a local image',
      '<img src="./asset.png" alt="">',
      /Found non-embedded resource reference/,
    ],
    [
      'a local module preload',
      '<link rel="modulepreload" href="./asset.js">',
      /Found non-embedded resource reference/,
    ],
    [
      'a local CSS resource',
      '<style>.image { background: url("./asset.png") }</style>',
      /Found non-embedded resource reference/,
    ],
    [
      'an external image',
      '<img src="https://example.com/asset.png" alt="">',
      /Found non-embedded resource reference/,
    ],
    [
      'a static blob URL',
      '<img src="blob:https://example.com/dead-id" alt="">',
      /Found non-embedded resource reference/,
    ],
    [
      'an external CSS resource',
      '<style>.image { background: url("https://example.com/asset.png") }</style>',
      /Found non-embedded resource reference/,
    ],
    [
      'a CSS import',
      '<style>@import "https://example.com/theme.css";</style>',
      /Found non-embedded resource reference/,
    ],
    [
      'an escaped CSS resource',
      String.raw`<style>.image { background: u\72l(https://example.com/asset.png) }</style>`,
      /Found non-embedded resource reference/,
    ],
    [
      'an SVG image',
      '<svg><image href="https://example.com/asset.png"></image></svg>',
      /Found non-embedded resource reference/,
    ],
    [
      'an SVG use reference',
      '<svg><use href="https://example.com/icons.svg#shape"></use></svg>',
      /Found non-embedded resource reference/,
    ],
    [
      'a second namespaced SVG resource',
      '<svg><image href="data:image/png;base64,AA==" xlink:href="https://example.com/asset.png"></image></svg>',
      /Found non-embedded resource reference/,
    ],
    [
      'an SVG filter image',
      '<svg><filter><feImage href="https://example.com/asset.png"></feImage></filter></svg>',
      /Found non-embedded resource reference/,
    ],
    [
      'an SVG gradient reference',
      '<svg><linearGradient href="https://example.com/gradients.svg#brand"></linearGradient></svg>',
      /Found non-embedded resource reference/,
    ],
    [
      'an SVG text path',
      '<svg><text><textPath href="https://example.com/paths.svg#line">Text</textPath></text></svg>',
      /Found non-embedded resource reference/,
    ],
    [
      'an SVG presentation resource',
      '<svg><rect fill="url(https://example.com/gradients.svg#brand)"></rect></svg>',
      /Found non-embedded resource reference/,
    ],
    [
      'a preload image source set',
      '<link rel="preload" as="image" href="data:image/png;base64,AA==" imagesrcset="https://example.com/asset.png 1x">',
      /Found non-embedded resource reference/,
    ],
    [
      'an iframe srcdoc resource',
      '<iframe srcdoc="&lt;img src=&quot;https://example.com/asset.png&quot; alt=&quot;&quot;&gt;"></iframe>',
      /Found non-embedded resource reference/,
    ],
    [
      'an iframe data document',
      '<iframe src="data:text/html,%3Cimg%20src%3Dhttps%3A%2F%2Fexample.com%2Fasset.png%3E"></iframe>',
      /Found non-embedded resource reference/,
    ],
    [
      'an object data document',
      '<object data="data:text/html,%3Cp%3EEmbedded%3C%2Fp%3E"></object>',
      /Found non-embedded resource reference/,
    ],
    [
      'a meta refresh',
      '<meta http-equiv="refresh" content="0; url=https://example.com">',
      /Found non-embedded resource reference/,
    ],
    [
      'a legacy body background',
      '<body background="https://example.com/asset.png"></body>',
      /Found non-embedded resource reference/,
    ],
  ])('rejects %s in the UI bundle', async (_name, markup, message) => {
    const html = validHtml.replace(
      '<main>Fixture</main>',
      `<main>Fixture</main>${markup}`,
    )
    const rootDir = await createFixture({ html })

    await expect(verifyDist({ rootDir })).rejects.toThrow(message)
  })

  it.each([
    ['name', { name: '' }, /manifest\.name must be a non-empty string/],
    ['ID', { id: 'change-me' }, /manifest\.id must be a numeric string/],
    ['API', { api: '2.0.0' }, /manifest\.api must be 1\.0\.0/],
    ['main path', { main: 'code.js' }, /manifest\.main must be dist\/code\.js/],
    ['UI path', { ui: 'index.html' }, /manifest\.ui must be dist\/index\.html/],
    [
      'document access',
      { documentAccess: 'current-page' },
      /manifest\.documentAccess must be dynamic-page/,
    ],
    [
      'editor type',
      { editorType: ['unsupported'] },
      /Unsupported manifest editorType/,
    ],
    [
      'editor combination',
      { editorType: ['figjam', 'dev'] },
      /cannot combine figjam and dev/,
    ],
    [
      'capability',
      { capabilities: ['unsupported'] },
      /Unsupported manifest\.capabilities value/,
    ],
    [
      'permission',
      { permissions: ['unsupported'] },
      /Unsupported manifest\.permissions value/,
    ],
    [
      'proposed API flag',
      { enableProposedApi: 'false' },
      /manifest\.enableProposedApi must be a boolean/,
    ],
  ])('rejects an invalid manifest %s', async (_name, override, message) => {
    const rootDir = await createFixture({
      manifest: { ...validManifest, ...override },
    })

    await expect(verifyDist({ rootDir })).rejects.toThrow(message)
  })

  it.each([
    {
      allowedDomains: ['https://api.example.com'],
      devAllowedDomains: ['http://localhost:3000'],
    },
    {
      allowedDomains: ['*'],
      reasoning: 'This fixture intentionally tests wildcard access.',
    },
    {
      allowedDomains: ['http://localhost:3000'],
      reasoning: 'This fixture intentionally tests a development domain.',
    },
  ])(
    'accepts a supported custom network configuration',
    async (networkAccess) => {
      const rootDir = await createFixture({
        manifest: { ...validManifest, networkAccess },
      })

      await expect(verifyDist({ rootDir })).resolves.toBeDefined()
    },
  )

  it.each([
    [
      'an empty production list',
      { allowedDomains: [] },
      /allowedDomains must contain at least one domain/,
    ],
    [
      'a non-string production entry',
      { allowedDomains: [42] },
      /allowedDomains entries must be non-empty strings/,
    ],
    [
      '"none" combined with a domain',
      { allowedDomains: ['none', 'https://api.example.com'] },
      /"none" must be the sole/,
    ],
    [
      'a wildcard without reasoning',
      { allowedDomains: ['*'] },
      /reasoning is required/,
    ],
    [
      'a production development domain without reasoning',
      { allowedDomains: ['http://localhost:3000'] },
      /reasoning is required/,
    ],
    [
      'a non-array development list',
      {
        allowedDomains: ['https://api.example.com'],
        devAllowedDomains: 'http://localhost:3000',
      },
      /devAllowedDomains must be an array/,
    ],
    [
      'an empty development entry',
      {
        allowedDomains: ['https://api.example.com'],
        devAllowedDomains: [''],
      },
      /devAllowedDomains entries must be non-empty strings/,
    ],
  ])(
    'rejects network access with %s',
    async (_name, networkAccess, message) => {
      const rootDir = await createFixture({
        manifest: { ...validManifest, networkAccess },
      })

      await expect(verifyDist({ rootDir })).rejects.toThrow(message)
    },
  )
})
