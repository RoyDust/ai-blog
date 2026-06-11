# Display 标题字体

本分支原计划使用 Noto Serif SC 700/900 源字体，通过 `cn-font-split` 生成 `unicode-range` 分片到 `public/font/noto-serif-sc/`。

## 本次实施结果

当前环境网络受限：

- `npx cn-font-split --version` 访问 `https://registry.npmjs.org/cn-font-split` 被系统拒绝。
- `Invoke-WebRequest` 下载 google/fonts 官方源字体被系统拒绝。

因此本次按计划风险表退回 `next/font/google` 的 `Noto_Serif_SC`，只加载 700/900 两个字重，并通过 `--font-noto-serif-sc-display` 接入公共阅读端 display 标题。

## 可再生成命令

有网络权限后，可从 notofonts 官方 GitHub release 或 google/fonts 仓库获取 Noto Serif SC 700/900 源字体，再执行：

```bash
npx cn-font-split -i NotoSerifSC-Bold.otf -o public/font/noto-serif-sc/700
npx cn-font-split -i NotoSerifSC-Black.otf -o public/font/noto-serif-sc/900
```

随后把两份 `result.css` 合并为 `src/styles/font-serif-display.css`：

- `font-family` 统一为 `"Noto Serif SC Display"`。
- 每条 `@font-face` 保留 `font-display: swap`。
- 字体 URL 改为 `/font/noto-serif-sc/...` 绝对路径。
