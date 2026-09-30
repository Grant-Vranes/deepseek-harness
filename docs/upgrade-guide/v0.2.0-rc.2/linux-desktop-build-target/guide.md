---
kind: upgrade-guide
description: "Desktop packaging accepts a new linux-x64 target that builds an unsigned local AppImage with no update feed."
---

# Linux desktop build target

English | [中文](guide.zh.md)

## Change

`@deepseek-ai/dsh-desktop` accepts `linux-x64` as a packaging target. Two scripts were added: `package:linux:x64` builds an AppImage and `package:linux:x64:dir` stops at the unpacked application directory.

macOS and Windows packaging are unchanged. Nothing breaks for readers who do not build Desktop for Linux.

## Migration

1. Nothing, unless you build Desktop for Linux. To produce an artifact, run `pnpm run package:linux:x64` from `apps/desktop` (or `package:linux:x64:dir` for the unpacked directory). The AppImage is unsigned, has no update feed, and requires `libfuse2` on the running host.
2. Confirm: the command emits the AppImage under `apps/desktop/.desktop-build/targets/linux-x64/`.
