# README Bilingual Design

**Date:** 2026-03-28

## Goal

在保留中文主文档定位的前提下，为仓库补充完整英文 README，提升项目对国际读者、招聘场景和公开展示场景的可读性。

## Decision

采用双文件方案：

- `README.md` 作为中文主文档
- `README.en.md` 作为完整英文镜像版

## Why This Approach

- GitHub 首页继续默认展示中文内容，适合当前项目语境
- 英文读者有清晰入口，不需要在单文件中来回跳转
- 相比“一个文件中英混排”，阅读负担更低
- 相比“英文精简版”，信息更完整，展示更专业

## Information Architecture

两份 README 保持同一章节顺序：

1. Hero
2. 项目简介 / Overview
3. 核心亮点 / Highlights
4. 功能全景 / Features
5. 技术栈 / Tech Stack
6. 项目结构 / Project Structure
7. 快速开始 / Quick Start
8. 环境变量 / Environment Variables
9. 常用命令 / Common Commands
10. 数据模型概览 / Data Model Overview
11. 测试与质量保障 / Testing
12. 部署说明 / Deployment
13. 补充文档 / Additional Docs
14. 适用场景 / Use Cases

## Language Switch Design

- 在 `README.md` 顶部添加 `简体中文 | English`
- 在 `README.en.md` 顶部添加 `简体中文 | English`
- 两份文档互相链接，形成稳定切换入口

## Translation Rules

- 英文版保持结构一致，但使用自然的开源项目表达
- 专有名词保持原样，如 `Next.js 16`、`Prisma 7`、`GitHub Actions`
- 路径、命令、环境变量名不翻译
- 中文版继续作为主叙事版本，不为了“完全逐字对齐”牺牲英文可读性
