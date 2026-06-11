# Display 标题字体

公共阅读端 display 层级标题使用 Noto Serif SC（700/900），当前方案为 **自托管分片**：

- 依赖 `@fontsource/noto-serif-sc`（Google 官方 unicode-range 分片的 woff2，`font-display: swap`）
- `src/app/layout.tsx` 引入 `@fontsource/noto-serif-sc/700.css` 与 `900.css`
- `src/app/globals.css` 的 `.serif-display-scope` 把 `--font-display` 切到 `"Noto Serif SC"`，并对 h2-h6 / 导航 / 正文 prose / admin 保持普惠体
- 浏览器按 unicode-range 只下载命中分片；字体文件由构建产物自托管，**构建期与运行期都不依赖 Google Fonts 网络**

## 历史方案与取舍

1. 计划主方案 `cn-font-split` 自切分片：实施时沙箱网络受限（npm registry 与字体下载被拒）未走通。
2. 临时方案 `next/font/google` 的 `Noto_Serif_SC`：开发期可用，但生产构建需要在构建期访问 Google Fonts——在本部署网络环境下不可靠（曾导致 `pnpm build` module-not-found 失败），已于审查阶段替换为 fontsource 自托管。

## 升级字重 / 换字体

```bash
pnpm add @fontsource/<font-name>
```

然后同步修改 layout.tsx 的 css 引入与 globals.css 的 `.serif-display-scope` 字体栈。若需进一步控制分片体积，可在有网环境恢复 cn-font-split 流程：

```bash
npx cn-font-split -i NotoSerifSC-Bold.otf -o public/font/noto-serif-sc/700
npx cn-font-split -i NotoSerifSC-Black.otf -o public/font/noto-serif-sc/900
```

并把产物 css 合并为 `src/styles/font-serif-display.css`（family 统一命名、保留 swap、URL 改 `/font/...` 绝对路径）。
