// The SAQ-A boundary, enforced.
//
// billing.hanzo.ai stays out of PCI SAQ-D scope by never letting a raw PAN reach
// first-party JavaScript: Square Web Payments hosted fields hold the card in
// Square's iframe and hand back a single-use nonce. That is a property of the
// SHIPPED BUNDLE, not of anyone's intent, so it is checked against the bundle.
//
// It regressed once exactly the way it would regress again: nobody wrote a raw
// card form here. `lib/components/billing-shell.tsx` imported billing components
// from the published `@hanzo/ui/billing` barrel, and that barrel is a single
// pre-bundled module carrying a `fetch('.../billing/card/tokenize')` form. One
// named import dragged the whole thing in, so a PAN input shipped next to the
// hosted fields with nothing in this repo's source to grep for. Hence two scans:
// source catches what we write, bundle catches what we import.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Each pattern is a way cardholder data reaches our origin. The label is what a
// failure should make someone go read.
const FORBIDDEN = [
  [/card\/tokenize/, 'a server-side raw-PAN tokenize call (the endpoint is deleted; hosted fields return a nonce)'],
  [/expiry_month|expiry_year/, 'raw expiry fields in a request body (Square holds these)'],
  [/autoComplete=["']cc-(number|csc)["']|autocomplete:"cc-(number|csc)"/, 'a first-party card-number or CVC input'],
  // Import, not prose: this is a module specifier, so only a real edge into the
  // barrel counts. A comment explaining why we avoid it is not a finding.
  [/(from|import|require\()\s*["']@hanzo\/ui\/billing["']/, "an import of the published @hanzo/ui/billing barrel, which bundles a raw-PAN form — use the local `lib/billing` barrel"],
  [/\/api\/v1/, 'the banned /api/ prefix — this codebase serves /v1/ only'],
]

function* files(dir, exts) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path, exts)
    else if (exts.some(e => name.endsWith(e))) yield path
  }
}

function scan(roots, exts, what) {
  const hits = []
  let scanned = 0
  for (const root of roots) {
    let entries
    try { entries = [...files(root, exts)] } catch { continue }
    for (const path of entries) {
      scanned++
      // This file names the patterns it forbids; matching itself is not a finding.
      if (path.endsWith('pci-scope.mjs')) continue
      const text = readFileSync(path, 'utf8')
      for (const [re, why] of FORBIDDEN) if (re.test(text)) hits.push(`  ${path}\n    → ${why}`)
    }
  }
  return { hits, scanned, what }
}

const runs = [
  scan(['lib', 'app'], ['.ts', '.tsx'], 'source files'),
  scan(['.next'], ['.js'], 'built bundle chunks'),
]

let failed = false
for (const { hits, scanned, what } of runs) {
  // A scan that examined nothing proves nothing. The bundle scan finds no chunks
  // before `pnpm build`, and that must not read as a pass.
  if (scanned === 0) {
    console.error(`pci-scope: examined 0 ${what} — this check proved nothing. Run \`pnpm build\` first.`)
    failed = true
    continue
  }
  if (hits.length) {
    console.error(`pci-scope: cardholder data can reach first-party JS (${scanned} ${what} scanned):\n${hits.join('\n')}`)
    failed = true
    continue
  }
  console.log(`pci-scope: ${scanned} ${what} clean`)
}

if (failed) {
  console.error('\nSquare hosted fields (lib/square.ts + lib/billing/square-card-form.tsx) are the ONE card entry path.')
  process.exit(1)
}
console.log('pci-scope: Square hosted fields are the only card entry path — SAQ-A boundary intact')
