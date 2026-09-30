# Linux x64 Desktop Build Target — Design

Date: 2026-10-01
Status: Approved design, pending implementation plan
Scope: `apps/desktop` packaging pipeline

## Goal

Let a developer build a runnable Linux x64 AppImage of the DeepSeek Harness desktop app, either on a Linux machine or cross-compiled from macOS. This is a local build capability, not an official release channel: no auto-update, no signing, no CI packaging.

## Non-Goals

- AppImage auto-update feeds, COS upload, release channels
- Linux CI packaging or smoke tests
- Code signing or notarization for Linux
- arm64, deb, or rpm targets
- Any change to mac/win packaging behavior

## Approach (chosen: extend the existing target pipeline)

Linux becomes a third first-class entry in the existing packaging pipeline. No parallel pipeline. The compiler's closed unions surface every branch that needs a Linux case.

### 1. Target definition and platform plumbing

- `apps/desktop/scripts/desktop-build-paths.mjs`: add `linux-x64` to the supported target set; `desktopTargetPlatform()` returns `{ platform: 'linux', arch: 'x64' }`.
- `apps/desktop/scripts/package-target.ts`: add a `linux-x64` entry to `TARGETS` (`platform: 'linux'`, `builderPlatform: '--linux'`, `builderArch: '--x64'`); widen `DesktopPackageTarget['platform']` to `'darwin' | 'win32' | 'linux'`. No host gate: cross-building AppImage from macOS is allowed (electron-builder supports it), and building on Linux is auto-detected via `resolveDesktopBuildTarget()`.
- `apps/desktop/scripts/prepare-runtime.ts`: replace the hardcoded `darwin`/`win32` mapping with `desktopTargetPlatform()`; the Electron executable path gains a Linux branch (`electron` at the distribution root, instead of `Electron.app/Contents/MacOS/Electron`); the macOS-only PlistBuddy minimum-version step stays darwin-only.
- `apps/desktop/scripts/prepare-dsh.ts`: the `NODE` path resolves from the target platform (not `process.platform`) so cross-builds pick the right path; Linux uses the root `electron` binary.
- `apps/desktop/scripts/node-bin/node`: no change — it is already a POSIX shell launcher.
- `apps/desktop/package.json`: add `package:linux:x64` and `package:linux:x64:dir` scripts.

### 2. electron-builder configuration and packaging flow

The existing `linux` section in `apps/desktop/scripts/electron-builder-config.mjs` gains:

```js
linux: {
  category: 'Development',
  target: ['AppImage'],
  icon: fileURLToPath(new URL('../resources/icon-macos.png', import.meta.url)),
  executableName: 'deepseek-harness',
}
```

- The icon reuses the existing 512px PNG, mirroring how the Windows section reuses shared resources.
- `executableName` is explicit because Linux binary names must not contain spaces.
- No publish config: local builds already run with `publish: null`.
- No signing hooks: existing `afterSign` / `artifactBuildCompleted` hooks return early per platform.

Build commands (identical on both build hosts):

```sh
pnpm --filter @deepseek-ai/dsh-desktop run build
pnpm run prepare:runtime   # downloads the linux-x64 Electron distribution when targeted
pnpm run prepare:dsh
pnpm run package:linux:x64:dir   # unpacked directory, fastest validation
pnpm run package:linux:x64       # AppImage
```

Cross-builds set `DSH_DESKTOP_TARGET_PLATFORM=linux DSH_DESKTOP_TARGET_ARCH=x64`; Linux-host builds auto-detect.

The existing `afterPack` hook's `verifyDesktopRuntime` call is already platform-parameterized and validates the `versions.json` descriptor; the prepare-runtime change guarantees it records `linux`.

### 3. Error handling, documentation, verification

- Unsupported target names keep throwing (existing `isTargetName` behavior); no silent fallback.
- A missing or corrupt Linux Electron distribution fails at the `electron -p process.versions.node` probe with the underlying error; no extra defensive checks (typed/derived boundaries stay trust-based).
- AppImage tooling (`mksquashfs`) ships with electron-builder; no extra host system dependencies on macOS.
- Docs: `apps/desktop/README.md` updates its target statement — linux-x64 is a local build target, not an official release channel and has no auto-update. An upgrade-guide entry under `docs/upgrade-guide/` records the two new package scripts and the unsigned local AppImage artifact. Bilingual docs follow `docs/AGENTS.md`.
- Verification checklist:
  - `pnpm run typecheck` (closed unions expose missed branches)
  - desktop package unit tests still pass
  - cross-build `package:linux:x64:dir` on macOS; runtime tree descriptor reads `platform: "linux"`
  - on a Linux machine with `libfuse2`: launch the AppImage, open a workspace, run a session, use the terminal tool
  - known behavioral differences are pre-existing implemented Linux branches (DOM shortcut dispatch, browse-mode directory picker without zenity/kdialog), not new code

## Open Items for the Implementation Plan

- Confirm whether the `packedLandlock` payload has a Linux binary variant; if not, this is the only work item beyond branch extension and gets its own plan step.

## Rejected Alternatives

- **Standalone Linux packaging script**: duplicates pipeline logic, diverges from repo symmetry conventions, long-term maintenance debt.
- **Full release target** (CI, auto-update, upload): exceeds the stated goal.
