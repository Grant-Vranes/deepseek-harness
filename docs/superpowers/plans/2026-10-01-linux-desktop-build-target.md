# Linux x64 Desktop Build Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `linux-x64` release target to the Desktop packaging pipeline so a developer can build a runnable AppImage locally on Linux or cross-compiled from macOS.

**Architecture:** Linux becomes a third entry in the existing target table (`desktop-build-paths.mjs` → `package-target.ts`), flowing through the unchanged prepare → package → verify pipeline. Every platform branch the pipeline already has gains a Linux case; the compiler's closed unions expose any missed one. Cross-builds pass the target platform through `DSH_DESKTOP_TARGET_PLATFORM` (existing mechanism) and pin pnpm's `supportedArchitectures` so the runtime tree gets Linux binaries.

**Tech Stack:** TypeScript (strict, ESM), electron-builder (AppImage), pnpm workspaces, vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-linux-desktop-build-target-design.md`

## Global Constraints

- No mac/win behavior change: every existing test must keep passing.
- Linux is a local build target only: no auto-update feed content, no signing, no CI, no arm64/deb/rpm.
- Misconfiguration fails loud (no silent fallbacks); no new `as unknown` casts; JSDoc on changed exported functions with `@param`/`@returns`.
- ESM everywhere; imports of sibling TS scripts use extensioned specifiers as the file already does.
- Docs: one physical line per paragraph; bilingual README pairs update together.
- Test runner is vitest: `pnpm run test --filter @deepseek-ai/dsh-desktop` or targeted `pnpm vitest run apps/desktop/tests/<file>` from repo root (vitest workspace picks it up).

---

### Task 1: Add `linux-x64` to the supported build targets

**Files:**
- Modify: `apps/desktop/scripts/desktop-build-paths.mjs`
- Test: `apps/desktop/tests/desktop-build-paths.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `resolveDesktopBuildTarget()` and `desktopTargetPlatform()` accept `'linux-x64'`; `desktopTargetPlatform('linux-x64')` returns `{ platform: 'linux', arch: 'x64' }`. Later tasks depend on exactly this shape.

- [ ] **Step 1: Write the failing tests**

Open `apps/desktop/tests/desktop-build-paths.spec.ts`, find the existing describe blocks for `resolveDesktopBuildTarget` and `desktopTargetPlatform`, and add beside the analogous mac/win cases:

```ts
it('resolves an explicit linux-x64 override', () => {
  expect(resolveDesktopBuildTarget({
    DSH_DESKTOP_TARGET_PLATFORM: 'linux',
    DSH_DESKTOP_TARGET_ARCH: 'x64',
  })).toBe('linux-x64')
})

it('resolves linux-x64 from a linux x64 host', () => {
  expect(resolveDesktopBuildTarget({}, 'linux', 'x64')).toBe('linux-x64')
})

it('maps linux-x64 to the linux payload platform', () => {
  expect(desktopTargetPlatform('linux-x64')).toEqual({ platform: 'linux', arch: 'x64' })
})
```

Match the import style and describe-block placement the file already uses; do not restructure existing cases.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run apps/desktop/tests/desktop-build-paths.spec.ts` (from repo root)
Expected: FAIL — the linux cases reject with `desktop build paths: unsupported target linux-x64`.

- [ ] **Step 3: Implement**

In `apps/desktop/scripts/desktop-build-paths.mjs` make these exact changes:

1. The supported-target set:

```js
const SUPPORTED_TARGETS = new Set(['mac-arm64', 'mac-x64', 'win-x64', 'linux-x64'])
```

2. Every `@returns`/`@param` JSDoc that names the union `'mac-arm64' | 'mac-x64' | 'win-x64'` becomes `'mac-arm64' | 'mac-x64' | 'win-x64' | 'linux-x64'` (four sites: `resolveDesktopBuildTarget`, `desktopTargetBuildPaths`, `desktopTargetPlatform`, and the casts inside `resolveDesktopBuildTarget`).

3. `desktopTargetPlatform` becomes:

```js
export function desktopTargetPlatform(target) {
  assertSupportedTarget(target)
  return {
    platform: /** @type {'darwin' | 'win32' | 'linux'} */ (target === 'win-x64' ? 'win32' : target === 'linux-x64' ? 'linux' : 'darwin'),
    arch: /** @type {'arm64' | 'x64'} */ (target === 'mac-arm64' ? 'arm64' : 'x64'),
  }
}
```

and its `@returns` JSDoc becomes `@returns {{ platform: 'darwin' | 'win32' | 'linux', arch: 'arm64' | 'x64' }} Platform and architecture of the prepared payload.`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run apps/desktop/tests/desktop-build-paths.spec.ts`
Expected: PASS, including all pre-existing cases.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/scripts/desktop-build-paths.mjs apps/desktop/tests/desktop-build-paths.spec.ts
git commit -m "feat(desktop): support linux-x64 as a build target in build paths"
```

---

### Task 2: Accept `linux-x64` in auto-update target resolution and record filename

**Files:**
- Modify: `apps/desktop/scripts/desktop-auto-update-environment.mjs`
- Test: `apps/desktop/tests/desktop-auto-update-environment.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `resolveDesktopAutoUpdateTarget('linux', 'x64')` returns `'linux-x64'` and `desktopBuildRecordFilename('linux-x64')` works, so `writeReleaseRecord` in Task 4 can resolve the update config for Linux without throwing.

- [ ] **Step 1: Write the failing test**

In `apps/desktop/tests/desktop-auto-update-environment.spec.ts`, beside the existing `resolveDesktopAutoUpdateTarget` cases:

```ts
it('resolves the linux-x64 update target directory', () => {
  expect(resolveDesktopAutoUpdateTarget('linux', 'x64')).toBe('linux-x64')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/desktop/tests/desktop-auto-update-environment.spec.ts`
Expected: FAIL — `desktop auto-update: unsupported target linux-x64`.

- [ ] **Step 3: Implement**

In `apps/desktop/scripts/desktop-auto-update-environment.mjs`:

1. `const UPDATE_TARGETS = new Set(['mac-arm64', 'mac-x64', 'win-x64', 'linux-x64'])`
2. Widen the `@returns` JSDoc unions from `'mac-arm64' | 'mac-x64' | 'win-x64'` to include `'linux-x64'` (two sites: `resolveDesktopAutoUpdateTarget` and `desktopBuildRecordFilename`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/desktop/tests/desktop-auto-update-environment.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/scripts/desktop-auto-update-environment.mjs apps/desktop/tests/desktop-auto-update-environment.spec.ts
git commit -m "feat(desktop): accept linux-x64 in auto-update target resolution"
```

---

### Task 3: Widen the toolchain preflight and package environment for Linux

**Files:**
- Modify: `apps/desktop/scripts/desktop-toolchain-preflight.ts`
- Modify: `apps/desktop/scripts/desktop-package-environment.mjs`
- Create: `apps/desktop/.env.linux.example`
- Test: `apps/desktop/tests/desktop-package-environment.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `requireDesktopToolchain(platform)` accepts `'linux'` (probe set: `tar` only, as for darwin); `loadDesktopPackageEnvironment('linux')` reads `apps/desktop/.env.linux`. Task 4 calls both with `target.platform === 'linux'`.

- [ ] **Step 1: Write the failing test**

In `apps/desktop/tests/desktop-package-environment.spec.ts`, beside the existing `loadDesktopPackageEnvironment` cases (copy the mac fixture setup it uses — an `appRoot` fixture directory containing a `.env.linux` file):

```ts
it('loads linux settings from .env.linux', () => {
  const appRoot = makeEnvFixture({ '.env.linux': '' })
  const environment = loadDesktopPackageEnvironment('linux', {}, appRoot)
  expect(environment.DSH_DESKTOP_AUTO_UPDATE_ENV).toBeUndefined()
})
```

Adapt `makeEnvFixture` to the helper names the file already defines; if it writes `.env.macos`, write `.env.linux` with the same helper.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/desktop/tests/desktop-package-environment.spec.ts`
Expected: FAIL — the function still reads `.env.macos` for any non-win32 platform.

- [ ] **Step 3: Implement**

1. `apps/desktop/scripts/desktop-toolchain-preflight.ts`: change both occurrences of the parameter type `platform: 'darwin' | 'win32'` (in `probeDesktopToolchain` and `requireDesktopToolchain`) to `platform: 'darwin' | 'win32' | 'linux'`. No probe logic change: the `tar` probe already runs for every platform and the win32-only probes stay win32-gated. Update the `@param` JSDoc of `requireDesktopToolchain` to name all three platforms.

2. `apps/desktop/scripts/desktop-package-environment.mjs`: change the dotenv selection:

```js
const path = join(appRoot, platform === 'win32' ? '.env.windows' : platform === 'linux' ? '.env.linux' : '.env.macos')
```

and the platform-setting filter below it stays keyed on `platform === 'win32'` versus everything else, exactly as now — Linux accepts the shared setting names only, which is the current non-win32 behavior.

3. Create `apps/desktop/.env.linux.example`:

```bash
# Linux local builds need no signing, notarization, or update settings.
# Copy this file to .env.linux only if you want to override shared release settings.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/desktop/tests/desktop-package-environment.spec.ts`
Expected: PASS, including pre-existing mac/win cases.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/scripts/desktop-toolchain-preflight.ts apps/desktop/scripts/desktop-package-environment.mjs apps/desktop/.env.linux.example apps/desktop/tests/desktop-package-environment.spec.ts
git commit -m "feat(desktop): load linux package environment and widen toolchain preflight"
```

---

### Task 4: Register the `linux-x64` packaging target

**Files:**
- Modify: `apps/desktop/scripts/package-target.ts`
- Test: `apps/desktop/tests/` — add cases to the existing spec that covers `parseDesktopPackageInvocation` / `resolveDesktopPackageTarget` (locate it with `grep -l "parseDesktopPackageInvocation" apps/desktop/tests/*.ts`)

**Interfaces:**
- Consumes: `desktopTargetPlatform` (Task 1), `loadDesktopPackageEnvironment('linux')` (Task 3).
- Produces: `resolveDesktopPackageTarget('linux-x64')` returns `{ name: 'linux-x64', platform: 'linux', arch: 'x64', builderPlatform: '--linux', builderArch: '--x64' }`; `desktopElectronBuilderArguments` emits `--linux ... --x64`. Task 6's smoke changes call `resolveDesktopPackageTarget(target)` with the widened union.

- [ ] **Step 1: Write the failing tests**

In the spec covering target parsing/resolution, beside the mac/win cases:

```ts
it('resolves the linux-x64 target selectors', () => {
  expect(resolveDesktopPackageTarget('linux-x64')).toEqual({
    name: 'linux-x64', platform: 'linux', arch: 'x64', builderPlatform: '--linux', builderArch: '--x64',
  })
})

it('builds electron-builder arguments for linux-x64', () => {
  const target = resolveDesktopPackageTarget('linux-x64')
  const args = desktopElectronBuilderArguments(target, false)
  expect(args).toContain('--linux')
  expect(args).toContain('--x64')
})

it('defaults to linux-x64 on a linux x64 host', () => {
  expect(parseDesktopPackageInvocation([], 'linux', 'x64').target.name).toBe('linux-x64')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run apps/desktop/tests/<the-spec-file>.ts`
Expected: FAIL — `desktop package: unsupported ... linux-x64` from the target table.

- [ ] **Step 3: Implement**

In `apps/desktop/scripts/package-target.ts`:

1. Types and table:

```ts
export type DesktopPackageTargetName = 'mac-arm64' | 'mac-x64' | 'win-x64' | 'linux-x64'

export interface DesktopPackageTarget {
  readonly name: DesktopPackageTargetName
  readonly platform: 'darwin' | 'win32' | 'linux'
  readonly arch: 'arm64' | 'x64'
  readonly builderPlatform: '--mac' | '--win' | '--linux'
  readonly builderArch: '--arm64' | '--x64'
}
```

2. Add to `TARGETS`:

```ts
  'linux-x64': {
    name: 'linux-x64',
    platform: 'linux',
    arch: 'x64',
    builderPlatform: '--linux',
    builderArch: '--x64',
  },
```

3. In `main()`, make the packaging-step label honest. Change the `else` branch of:

```ts
  if (target.platform === 'darwin') {
    ...
  } else {
    await packagingStep(run.directory, 'windows-package', () => packageTarget(invocation, environment, run), secrets)
  }
```

to:

```ts
  } else {
    const step = target.platform === 'win32' ? 'windows-package' : 'linux-package'
    await packagingStep(run.directory, step, () => packageTarget(invocation, environment, run), secrets)
  }
```

(Read the exact current block first; keep everything else identical.)

4. `desktopElectronBuilderArguments` needs no change: it already interpolates `target.builderPlatform`/`target.builderArch`, and its only platform check is `target.platform === 'darwin'` for notarize flags, which Linux correctly skips.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run apps/desktop/tests/<the-spec-file>.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm run typecheck`
Expected: exit 0. If another consumer of `DesktopPackageTarget['platform']` narrows on `'darwin' | 'win32'` and errors, extend its union the same way — the error list is authoritative for finding missed branches. (Known candidate: `desktop-upload-plan.ts` / `desktop-upload-run.ts` reference target names; widen their unions only if the compiler demands it, keeping behavior unchanged for mac/win.)

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/scripts/package-target.ts apps/desktop/tests/<the-spec-file>.ts
git commit -m "feat(desktop): register linux-x64 packaging target"
```

---

### Task 5: Prepare the runtime tree for Linux

**Files:**
- Modify: `apps/desktop/scripts/prepare-runtime.ts`
- Modify: `apps/desktop/scripts/prepare-dsh.ts`

**Interfaces:**
- Consumes: `desktopTargetPlatform()` from Task 1.
- Produces: a runtime tree whose `versions.json` descriptor records `platform: 'linux'` for the linux-x64 target, and a `prepare-dsh` that resolves paths from the target platform. Task 6 verifies against this descriptor.

- [ ] **Step 1: Update `prepare-runtime.ts`**

Current code (in `main()`):

```ts
  const target = resolveDesktopBuildTarget()
  const platform = target.startsWith('mac-') ? 'darwin' : 'win32'
  const arch = target.endsWith('arm64') ? 'arm64' : 'x64'
```

and later:

```ts
  const executable = join(BUILD_PATHS.electron, platform === 'win32' ? 'electron.exe' : 'Electron.app/Contents/MacOS/Electron')
```

Change to resolve both from the target helper:

```ts
  const target = resolveDesktopBuildTarget()
  const { platform, arch } = desktopTargetPlatform(target)
```

(add `desktopTargetPlatform` to the existing `./desktop-build-paths.mjs` import) and:

```ts
  const executable = join(BUILD_PATHS.electron, platform === 'win32' ? 'electron.exe'
    : platform === 'linux' ? 'electron' : 'Electron.app/Contents/MacOS/Electron')
```

Everything else stays: `downloadArtifact({ version, platform, arch, ... })` already forwards the platform to `@electron/get`, the macOS-only `PlistBuddy` minimum-version step stays guarded by `platform === 'darwin'`, and `node-bin/node` (POSIX shell) copies unchanged.

- [ ] **Step 2: Update `prepare-dsh.ts`**

Two changes in `prepare-dsh.ts`:

1. The Electron-as-Node path currently derives from `process.platform`:

```ts
const NODE = join(BUILD_PATHS.electron, process.platform === 'win32' ? 'electron.exe' : 'Electron.app/Contents/MacOS/Electron')
```

Change to derive from the selected build target (cross-build correctness):

```ts
const NODE = join(BUILD_PATHS.electron, (() => {
  const { platform } = desktopTargetPlatform(resolveDesktopBuildTarget())
  return platform === 'win32' ? 'electron.exe' : platform === 'linux' ? 'electron' : 'Electron.app/Contents/MacOS/Electron'
})())
```

2. The payload descriptor currently records the host platform:

```ts
    const targetName = resolveDesktopBuildTarget()
    const target = { platform: process.platform, arch: desktopTargetPlatform(targetName).arch }
```

Change to:

```ts
    const targetName = resolveDesktopBuildTarget()
    const target = desktopTargetPlatform(targetName)
```

3. In the same file, `pnpm install` must fetch Linux binaries when cross-building. Find the `runtime:install` step and thread the architecture selection:

```ts
    await packagingStep(process.env.DSH_DESKTOP_PACKAGING_RUN_DIR, 'runtime:install', () => runPnpm([
      'install', '--prod', '--frozen-lockfile', '--trust-lockfile',
      ...targetPlatformArguments(target),
    ]))
```

with a new local helper defined above `main()` in the same file:

```ts
/** Pin pnpm's optional-dependency selection to the target platform when it differs from the build host. */
function targetPlatformArguments(target: { platform: NodeJS.Platform; arch: string }): string[] {
  if (target.platform === process.platform && target.arch === process.arch) return []
  return [
    `--config.supportedArchitectures.os=${target.platform === 'darwin' ? 'darwin' : target.platform}`,
    `--config.supportedArchitectures.cpu=${target.arch}`,
    '--config.supportedArchitectures.libc=glibc',
  ]
}
```

4. Guard the runtime smoke, which executes the target Electron binary and cannot run cross-host. Change:

```ts
      await packagingStep(process.env.DSH_DESKTOP_PACKAGING_RUN_DIR, 'runtime:smoke', () => smokePreparedRuntime(DSH_OUTPUT_ROOT, NODE, RUNTIME_ROOT, descriptor))
```

to:

```ts
      if (descriptor.platform !== process.platform) {
        await packagingStep(process.env.DSH_DESKTOP_PACKAGING_RUN_DIR, 'runtime:smoke-skipped',
          () => console.log(`desktop runtime: smoke skipped for cross-target ${descriptor.platform}`))
      } else {
        await packagingStep(process.env.DSH_DESKTOP_PACKAGING_RUN_DIR, 'runtime:smoke', () => smokePreparedRuntime(DSH_OUTPUT_ROOT, NODE, RUNTIME_ROOT, descriptor))
      }
```

(`smokePrimaryRuntime` needs no guard: it already returns early when the manifest platform differs from the host.)

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/scripts/prepare-runtime.ts apps/desktop/scripts/prepare-dsh.ts
git commit -m "feat(desktop): prepare the runtime tree for linux-x64 targets"
```

---

### Task 6: Smoke and verify Linux packaged artifacts

**Files:**
- Modify: `apps/desktop/scripts/smoke-packaged-runtime.ts`
- Modify: `apps/desktop/src/runtime-tree.ts` — only if the compiler demands it; `verifyDesktopRuntime` is already platform-parameterized, so no change is expected

**Interfaces:**
- Consumes: `resolveDesktopPackageTarget` (Task 4), the descriptor written by Task 5.
- Produces: a smoke entry that validates `linux-unpacked` artifacts on a Linux host and verifies-only when cross-building.

- [ ] **Step 1: Implement the Linux branch and cross-host guard**

In `apps/desktop/scripts/smoke-packaged-runtime.ts`, the application path/`resources`/`executable` selection currently covers windows and mac. Replace:

```ts
const windows = target === 'win-x64'
if (values.unsigned && !windows) throw new Error('desktop smoke: unsigned artifacts require Windows')
const artifacts = values.unsigned ? paths.unsignedArtifacts : paths.artifacts
const application = windows ? join(artifacts, 'win-unpacked')
  : join(artifacts, target === 'mac-arm64' ? 'mac-arm64' : 'mac', 'DeepSeek Harness.app', 'Contents')
const resources = join(application, windows ? 'resources' : 'Resources')
const executable = windows ? join(application, 'DeepSeek Harness.exe') : join(application, 'MacOS', 'DeepSeek Harness')
```

with:

```ts
const { platform } = resolveDesktopPackageTarget(target)
const windows = platform === 'win32'
if (values.unsigned && !windows) throw new Error('desktop smoke: unsigned artifacts require Windows')
const artifacts = values.unsigned ? paths.unsignedArtifacts : paths.artifacts
const application = platform === 'linux' ? join(artifacts, 'linux-unpacked')
  : windows ? join(artifacts, 'win-unpacked')
  : join(artifacts, target === 'mac-arm64' ? 'mac-arm64' : 'mac', 'DeepSeek Harness.app', 'Contents')
const resources = join(application, platform === 'darwin' ? 'Resources' : 'resources')
const executable = windows ? join(application, 'DeepSeek Harness.exe')
  : platform === 'linux' ? join(application, 'deepseek-harness')
  : join(application, 'MacOS', 'DeepSeek Harness')
```

and guard the final smoke line:

```ts
if (platform !== process.platform) {
  console.log(`desktop smoke: cross-target ${platform} verified without execution`)
} else {
  await smokePreparedRuntime(join(resources, 'app.asar', 'dsh'), executable, join(resources, 'runtime'), descriptor)
}
```

(`deepseek-harness` must match the `executableName` set in Task 7.)

- [ ] **Step 2: Typecheck and run desktop unit tests**

Run: `pnpm run typecheck && pnpm run test --filter @deepseek-ai/dsh-desktop`
Expected: typecheck exit 0; desktop tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/scripts/smoke-packaged-runtime.ts
git commit -m "feat(desktop): smoke linux-unpacked artifacts and skip execution cross-host"
```

---

### Task 7: Complete the electron-builder Linux configuration

**Files:**
- Modify: `apps/desktop/scripts/electron-builder-config.mjs`
- Modify: `apps/desktop/electron-builder.config.mjs` — no change expected; it re-exports the factory. Verify only.

**Interfaces:**
- Consumes: nothing new.
- Produces: an AppImage with binary name `deepseek-harness` (consumed by Task 6's smoke path) and the shared icon.

- [ ] **Step 1: Implement**

In `apps/desktop/scripts/electron-builder-config.mjs`, replace the existing linux section:

```js
    linux: {
      category: 'Development',
      target: ['AppImage'],
    },
```

with:

```js
    linux: {
      category: 'Development',
      target: ['AppImage'],
      icon: fileURLToPath(new URL('../resources/icon-macos.png', import.meta.url)),
      executableName: 'deepseek-harness',
    },
```

Confirm `resources/icon-macos.png` is at least 512×512 (AppImage requirement) with `file apps/desktop/resources/icon-macos.png`; if it is smaller, use the largest existing PNG under `resources/` instead and note the choice in the commit message.

- [ ] **Step 2: Verify the config still loads**

Run: `node -e "import('./apps/desktop/electron-builder.config.mjs').then(m => console.log(typeof m.default.linux))"`
Expected: prints `object`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/scripts/electron-builder-config.mjs
git commit -m "feat(desktop): complete electron-builder linux AppImage configuration"
```

---

### Task 8: Add the package scripts and update docs

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/README.md` and `apps/desktop/README.zh.md`
- Create: `docs/upgrade-guide/v<current>/linux-desktop-build-target/guide.md` (check `ls docs/upgrade-guide/` for the active version directory; if none exists yet, create `docs/upgrade-guide/v0.2.0/linux-desktop-build-target/guide.md` and follow the structure of an existing guide)

**Interfaces:**
- Consumes: `package-target.ts` positional target `linux-x64` (Task 4).
- Produces: user-facing commands `pnpm run package:linux:x64[:dir]`.

- [ ] **Step 1: Add scripts**

In `apps/desktop/package.json`, after `"package:win:x64:dir"`:

```json
    "package:linux:x64": "tsx scripts/package-target.ts linux-x64",
    "package:linux:x64:dir": "tsx scripts/package-target.ts linux-x64 --dir",
```

- [ ] **Step 2: Update the README target statement**

In `apps/desktop/README.md` line ~232, the sentence currently reads:

> The Windows x64 command requires Windows x64. Linux is not a supported Desktop release target.

Replace with:

> The Windows x64 command requires Windows x64. The Linux x64 command builds an unsigned local AppImage on a Linux x64 host or cross-compiled from macOS; Linux has no update feed and is not an official release target.

Mirror the change in `apps/desktop/README.zh.md` at the corresponding paragraph (same position in the bilingual pair), then run `pnpm run doc-sync` to catch alignment gates.

- [ ] **Step 3: Write the upgrade guide**

Create the guide directory and file; content pattern (match headings of an existing guide exactly):

```markdown
# Linux desktop build target

## What changed

`@deepseek-ai/dsh-desktop` accepts `linux-x64` as a packaging target. Two scripts were added: `package:linux:x64` builds an AppImage and `package:linux:x64:dir` stops at the unpacked application directory.

## What you need to do

Nothing, unless you build Desktop for Linux. The artifact is unsigned, has no update feed, and requires `libfuse2` on the running host. macOS or Windows packaging is unchanged.
```

- [ ] **Step 4: Documentation gates**

Run: `pnpm run doc-sync`
Expected: exit 0. Fix any bilingual or budget findings it reports before committing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/README.md apps/desktop/README.zh.md docs/upgrade-guide/
git commit -m "feat(desktop): add linux package scripts and document the local target"
```

---

### Task 9: End-to-end verification of the pipeline

**Files:** none created; this task is verification only.

**Interfaces:**
- Consumes: every earlier task.
- Produces: evidence that the mac path is unbroken and the linux path prepares, packages, and verifies.

- [ ] **Step 1: Full desktop unit suite**

Run: `pnpm run test --filter @deepseek-ai/dsh-desktop`
Expected: all pass, including pre-existing mac/win cases.

- [ ] **Step 2: Repo typecheck**

Run: `pnpm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Cross-build the unpacked Linux application from macOS**

```bash
DSH_DESKTOP_TARGET_PLATFORM=linux DSH_DESKTOP_TARGET_ARCH=x64 \
  pnpm --filter @deepseek-ai/dsh-desktop run package:linux:x64:dir
```

Expected: completes without error; `apps/desktop/.desktop-build/targets/linux-x64/artifacts/linux-unpacked/` exists with an executable named `deepseek-harness`; the runtime descriptor at `.desktop-build/targets/linux-x64/dsh` (read `versions.json`/descriptor file beside it) records `platform: "linux"`. The smoke lines print `cross-target` skip messages rather than executing the Linux binary.

If `pnpm install` inside `prepare:dsh` fails resolving Linux optional dependencies, check that the `--config.supportedArchitectures.*` arguments from Task 5 are present in the failing command line before investigating anything else.

Landlock/flock native support is confirmed available for the target: `native/system/packages/linux-x64/prebuilds.json` ships prebuilt `landlock-run` and `flock` (glibc and musl) binaries, and the packed landlock entry (`prepare-package-set` → `native/system/packages/entry`) distributes prebuilds rather than compiling on the build host, so cross-building needs no Linux toolchain.

- [ ] **Step 4: Confirm the mac path still prepares**

Run: `pnpm --filter @deepseek-ai/dsh-desktop run prepare:runtime` (no target env vars)
Expected: completes; the mac-x64 runtime tree builds as before. (Full mac packaging requires signing settings; preparation alone proves the shared pipeline is unbroken.)

- [ ] **Step 5: Hand off the AppImage**

Build the AppImage (`pnpm run package:linux:x64` with the same env vars) and hand the artifact to the user with the verification checklist from the spec: install `libfuse2`, launch, open a workspace, run a session, use the terminal tool. Known pre-existing Linux behaviors (DOM shortcut dispatch, browse-mode directory picker without zenity/kdialog) are expected, not bugs.

- [ ] **Step 6: Final commit of any fixups**

```bash
git status --short
# fix any residue found in steps 1-4, then:
git add -A && git commit -m "fix(desktop): linux build target verification fixups"
```
