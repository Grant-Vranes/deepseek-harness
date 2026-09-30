---
kind: upgrade-guide
description: "Desktop 打包新增 linux-x64 目标，构建未签名且没有更新源的本地 AppImage。"
---

# Linux 桌面打包目标

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-desktop` 现在接受 `linux-x64` 作为打包目标。新增两个脚本：`package:linux:x64` 构建 AppImage，`package:linux:x64:dir` 停在未打包的应用目录。

macOS 和 Windows 打包保持不变。不构建 Linux Desktop 的读者不受任何影响。

## 迁移

1. 除非你在 Linux 上构建 Desktop，否则无需操作。如需产出工件，在 `apps/desktop` 运行 `pnpm run package:linux:x64`（或 `package:linux:x64:dir` 只生成未打包目录）。AppImage 未签名、没有更新源，且要求运行主机安装 `libfuse2`。
2. 确认：命令在 `apps/desktop/.desktop-build/targets/linux-x64/` 下产出 AppImage。
