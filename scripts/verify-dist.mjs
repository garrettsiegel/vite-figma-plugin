import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse as parseJavaScript } from 'acorn'
import {
  transform as transformCss,
  transformStyleAttribute,
} from 'lightningcss'
import { parse } from 'parse5'

const EXPECTED_DIST_FILES = ['code.js', 'index.html']
const SUPPORTED_EDITOR_TYPES = new Set([
  'figma',
  'figjam',
  'dev',
  'slides',
  'buzz',
])
const SUPPORTED_CAPABILITIES = new Set([
  'textreview',
  'codegen',
  'inspect',
  'vscode',
])
const SUPPORTED_PERMISSIONS = new Set([
  'currentuser',
  'activeusers',
  'fileusers',
  'payments',
  'teamlibrary',
])
const EXECUTABLE_SCRIPT_TYPES = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
])
const SVG_RESOURCE_STYLE_ATTRIBUTES = new Set([
  'clip-path',
  'color-profile',
  'cursor',
  'fill',
  'filter',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
])

const attrValue = (node, name) =>
  node.attrs?.find((attribute) => attribute.name === name)?.value

const walk = (node, visit) => {
  visit(node)

  for (const child of node.childNodes ?? []) {
    walk(child, visit)
  }
}

const textContent = (node) => {
  if (node.nodeName === '#text') {
    return node.value ?? ''
  }

  return (node.childNodes ?? []).map(textContent).join('')
}

const scriptType = (node) =>
  (attrValue(node, 'type') ?? '').trim().toLowerCase().split(';', 1)[0]

const isExecutableScript = (node) => {
  const type = scriptType(node)
  return !type || type === 'module' || EXECUTABLE_SCRIPT_TYPES.has(type)
}

const isCssStyle = (node) => {
  const type = (attrValue(node, 'type') ?? '')
    .trim()
    .toLowerCase()
    .split(';', 1)[0]
  return !type || type === 'text/css'
}

const isEmbeddedReference = (value) => {
  const reference = value.trim()

  if (!reference || reference.startsWith('#')) {
    return true
  }

  return /^data:/i.test(reference)
}

const isDevelopmentDomain = (domain) =>
  /^(?:https?:\/\/)?(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(
    domain,
  )

const assertStringArray = (value, name, { nonEmpty = false } = {}) => {
  assert(Array.isArray(value), `${name} must be an array`)
  assert(
    !nonEmpty || value.length > 0,
    `${name} must contain at least one domain`,
  )

  for (const entry of value) {
    assert(
      typeof entry === 'string' && entry.trim().length > 0,
      `${name} entries must be non-empty strings`,
    )
  }
}

const localResourceReferences = (node) => {
  const attributeNamesByElement = {
    audio: ['src'],
    base: ['href'],
    body: ['background'],
    embed: ['src'],
    html: ['manifest'],
    iframe: ['src'],
    img: ['src', 'srcset'],
    input: ['src'],
    link: ['href', 'imagesrcset'],
    object: ['data'],
    script: ['href'],
    source: ['src', 'srcset'],
    table: ['background'],
    td: ['background'],
    th: ['background'],
    track: ['src'],
    video: ['poster', 'src'],
  }
  const attributeNames = new Set(attributeNamesByElement[node.tagName] ?? [])

  if (node.namespaceURI === 'http://www.w3.org/2000/svg') {
    attributeNames.add('href')
  }

  const attributeReferences = [...attributeNames].flatMap((name) => {
    const values = (node.attrs ?? [])
      .filter((attribute) => attribute.name === name)
      .map((attribute) => attribute.value)

    return values.flatMap((value) => {
      const isNestedDocument =
        value.trim().length > 0 &&
        ((node.tagName === 'iframe' && name === 'src') ||
          (node.tagName === 'object' && name === 'data') ||
          (node.tagName === 'embed' && name === 'src'))
      const candidates = name.endsWith('srcset')
        ? value.split(',').map((part) => part.trim().split(/\s+/)[0])
        : [value]
      return candidates
        .filter(
          (reference) => isNestedDocument || !isEmbeddedReference(reference),
        )
        .map((reference) => `${node.tagName}[${name}="${reference}"]`)
    })
  })

  if (node.namespaceURI !== 'http://www.w3.org/2000/svg') {
    return attributeReferences
  }

  const styleReferences = (node.attrs ?? [])
    .filter((attribute) => SVG_RESOURCE_STYLE_ATTRIBUTES.has(attribute.name))
    .flatMap((attribute) =>
      collectCssDependencies(
        `${attribute.name}:${attribute.value}`,
        `${node.tagName}[${attribute.name}]`,
        { styleAttribute: true },
      ),
    )

  return [...attributeReferences, ...styleReferences]
}

const walkJavaScript = (syntaxTree, visit) => {
  const nodes = [syntaxTree]

  while (nodes.length > 0) {
    const node = nodes.pop()

    if (!node || typeof node !== 'object') {
      continue
    }

    visit(node)

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        nodes.push(...value)
      } else if (value && typeof value === 'object') {
        nodes.push(value)
      }
    }
  }
}

const assertNoRuntimeModuleLoading = (syntaxTree, source) => {
  walkJavaScript(syntaxTree, (node) => {
    assert.notEqual(
      node.type,
      'ImportDeclaration',
      `Found a static import in ${source}`,
    )
    assert.notEqual(
      node.type,
      'ImportExpression',
      `Found a runtime import() call in ${source}`,
    )
    assert(
      !(
        (node.type === 'ExportAllDeclaration' ||
          node.type === 'ExportNamedDeclaration') &&
        node.source
      ),
      `Found a module re-export in ${source}`,
    )

    assert(
      !(node.type === 'Identifier' && node.name === 'require'),
      `Found a runtime require reference in ${source}`,
    )

    if (node.type === 'MemberExpression') {
      const accessesRequire =
        (node.computed && node.property?.value === 'require') ||
        (!node.computed && node.property?.name === 'require')

      assert(!accessesRequire, `Found a runtime require reference in ${source}`)
    }
  })
}

const parseInlineJavaScript = (code, node) => {
  const sourceType = scriptType(node) === 'module' ? 'module' : 'script'
  let syntaxTree

  try {
    syntaxTree = parseJavaScript(code, {
      ecmaVersion: 'latest',
      sourceType,
    })
  } catch (error) {
    assert.fail(
      `Inline UI script is not valid ${sourceType} JavaScript: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  assertNoRuntimeModuleLoading(syntaxTree, 'the inline UI script')
}

const collectCssDependencies = (
  css,
  source,
  { styleAttribute = false } = {},
) => {
  let result

  try {
    const options = {
      analyzeDependencies: true,
      code: Buffer.from(css),
      filename: source,
    }
    result = styleAttribute
      ? transformStyleAttribute(options)
      : transformCss(options)
  } catch (error) {
    assert.fail(
      `${source} is not valid CSS: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return (result.dependencies ?? [])
    .filter(
      (dependency) =>
        dependency.type === 'import' || !isEmbeddedReference(dependency.url),
    )
    .map((dependency) => `${source}: ${dependency.type}("${dependency.url}")`)
}

const verifyManifest = async (rootDir) => {
  const manifestPath = resolve(rootDir, 'manifest.json')
  let manifest

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    assert.fail(
      `Could not read a valid root manifest.json: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  assert(
    typeof manifest === 'object' &&
      manifest !== null &&
      !Array.isArray(manifest),
    'manifest.json must contain a JSON object',
  )
  assert(
    typeof manifest.name === 'string' && manifest.name.trim().length > 0,
    'manifest.name must be a non-empty string',
  )
  assert(
    typeof manifest.id === 'string' && /^\d+$/.test(manifest.id),
    'manifest.id must be a numeric string assigned by Figma',
  )
  assert.equal(manifest.api, '1.0.0', 'manifest.api must be 1.0.0')
  assert.equal(
    manifest.main,
    'dist/code.js',
    'manifest.main must be dist/code.js',
  )
  assert.equal(
    manifest.ui,
    'dist/index.html',
    'manifest.ui must be dist/index.html',
  )
  assert.equal(
    manifest.documentAccess,
    'dynamic-page',
    'manifest.documentAccess must be dynamic-page',
  )
  assert(
    Array.isArray(manifest.editorType) && manifest.editorType.length > 0,
    'manifest.editorType must be a non-empty array',
  )
  assert.equal(
    new Set(manifest.editorType).size,
    manifest.editorType.length,
    'manifest.editorType must not contain duplicates',
  )

  for (const editorType of manifest.editorType) {
    assert(
      SUPPORTED_EDITOR_TYPES.has(editorType),
      `Unsupported manifest editorType: ${String(editorType)}`,
    )
  }
  assert(
    !(
      manifest.editorType.includes('figjam') &&
      manifest.editorType.includes('dev')
    ),
    'manifest.editorType cannot combine figjam and dev',
  )

  const validateKnownValues = (value, name, supported) => {
    if (value === undefined) {
      return
    }

    assertStringArray(value, name)
    assert.equal(
      new Set(value).size,
      value.length,
      `${name} must not contain duplicates`,
    )
    for (const entry of value) {
      assert(supported.has(entry), `Unsupported ${name} value: ${entry}`)
    }
  }

  validateKnownValues(
    manifest.capabilities,
    'manifest.capabilities',
    SUPPORTED_CAPABILITIES,
  )
  validateKnownValues(
    manifest.permissions,
    'manifest.permissions',
    SUPPORTED_PERMISSIONS,
  )

  for (const flag of ['enableProposedApi', 'enablePrivatePluginApi']) {
    assert(
      manifest[flag] === undefined || typeof manifest[flag] === 'boolean',
      `manifest.${flag} must be a boolean when provided`,
    )
  }

  assert(
    typeof manifest.networkAccess === 'object' &&
      manifest.networkAccess !== null &&
      !Array.isArray(manifest.networkAccess),
    'manifest.networkAccess must be an object',
  )
  const { allowedDomains, devAllowedDomains, reasoning } =
    manifest.networkAccess
  assertStringArray(allowedDomains, 'manifest.networkAccess.allowedDomains', {
    nonEmpty: true,
  })

  if (allowedDomains.includes('none')) {
    assert.deepEqual(
      allowedDomains,
      ['none'],
      '"none" must be the sole manifest.networkAccess.allowedDomains value',
    )
  }

  if (
    allowedDomains.some(
      (domain) => domain === '*' || isDevelopmentDomain(domain),
    )
  ) {
    assert(
      typeof reasoning === 'string' && reasoning.trim().length > 0,
      'manifest.networkAccess.reasoning is required for wildcard or development domains in allowedDomains',
    )
  }

  if (devAllowedDomains !== undefined) {
    assertStringArray(
      devAllowedDomains,
      'manifest.networkAccess.devAllowedDomains',
    )
  }

  for (const outputPath of [manifest.main, manifest.ui]) {
    const output = await stat(resolve(rootDir, outputPath)).catch(
      () => undefined,
    )
    assert(
      output?.isFile(),
      `Manifest output does not exist as a file: ${outputPath}`,
    )
  }
}

const verifyHtml = (html) => {
  const document = parse(html)
  const rootExecutableScripts = []
  const rootInlineStyles = []
  const externalScripts = []
  const externalStylesOrIcons = []
  const localReferences = []

  const inspectDocument = (currentDocument, depth) => {
    walk(currentDocument, (node) => {
      if (!node.tagName) {
        return
      }

      localReferences.push(...localResourceReferences(node))

      if (node.tagName === 'script') {
        const src = attrValue(node, 'src')
        const code = textContent(node).trim()

        if (src !== undefined) {
          externalScripts.push(src || '<empty>')
        } else if (code && isExecutableScript(node)) {
          parseInlineJavaScript(code, node)
          if (depth === 0) {
            rootExecutableScripts.push(node)
          }
        }
      }

      if (
        node.tagName === 'style' &&
        textContent(node).trim() &&
        isCssStyle(node)
      ) {
        if (depth === 0) {
          rootInlineStyles.push(node)
        }
        localReferences.push(
          ...collectCssDependencies(textContent(node), 'style'),
        )
      }

      const inlineStyle = attrValue(node, 'style')
      if (inlineStyle?.trim()) {
        localReferences.push(
          ...collectCssDependencies(inlineStyle, `${node.tagName}[style]`, {
            styleAttribute: true,
          }),
        )
      }

      if (node.tagName === 'link') {
        const relations = (attrValue(node, 'rel') ?? '')
          .toLowerCase()
          .split(/\s+/)

        if (
          relations.some(
            (relation) => relation === 'stylesheet' || relation === 'icon',
          )
        ) {
          externalStylesOrIcons.push(attrValue(node, 'href') ?? '<empty>')
        }
      }

      if (
        node.tagName === 'meta' &&
        (attrValue(node, 'http-equiv') ?? '').trim().toLowerCase() === 'refresh'
      ) {
        localReferences.push('meta[http-equiv="refresh"]')
      }

      if (node.tagName === 'iframe') {
        const srcdoc = attrValue(node, 'srcdoc')
        if (srcdoc !== undefined) {
          inspectDocument(parse(srcdoc), depth + 1)
        }
      }
    })
  }

  inspectDocument(document, 0)

  assert(rootInlineStyles.length > 0, 'UI CSS was not inlined into index.html')
  assert(
    rootExecutableScripts.length > 0,
    'Executable UI JavaScript was not inlined into index.html',
  )
  assert.deepEqual(
    externalScripts,
    [],
    `Found external script: ${externalScripts.join(', ')}`,
  )
  assert.deepEqual(
    externalStylesOrIcons,
    [],
    `Found external stylesheet or icon: ${externalStylesOrIcons.join(', ')}`,
  )
  assert.deepEqual(
    localReferences,
    [],
    `Found non-embedded resource reference: ${localReferences.join(', ')}`,
  )
}

const verifySandboxCode = (code) => {
  let syntaxTree

  try {
    syntaxTree = parseJavaScript(code, {
      ecmaVersion: 'latest',
      sourceType: 'script',
    })
  } catch (error) {
    assert.fail(
      `Sandbox bundle is not valid classic-script JavaScript: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  assertNoRuntimeModuleLoading(syntaxTree, 'the sandbox bundle')
}

export const verifyDist = async ({ rootDir = process.cwd() } = {}) => {
  const absoluteRoot = resolve(rootDir)
  const distDir = resolve(absoluteRoot, 'dist')
  const entries = await readdir(distDir, { withFileTypes: true })
  const actualFiles = entries.map((entry) => entry.name).sort()

  assert.deepEqual(
    actualFiles,
    EXPECTED_DIST_FILES,
    `Expected only ${EXPECTED_DIST_FILES.join(' and ')} in dist; found ${actualFiles.join(', ')}`,
  )
  assert(
    entries.every((entry) => entry.isFile()),
    'dist/code.js and dist/index.html must both be files',
  )

  const [code, html] = await Promise.all([
    readFile(resolve(distDir, 'code.js'), 'utf8'),
    readFile(resolve(distDir, 'index.html'), 'utf8'),
  ])

  verifySandboxCode(code)
  verifyHtml(html)
  await verifyManifest(absoluteRoot)

  return { files: EXPECTED_DIST_FILES }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined

if (invokedPath === import.meta.url) {
  await verifyDist()
  console.log('Verified manifest.json, dist/code.js, and dist/index.html')
}
