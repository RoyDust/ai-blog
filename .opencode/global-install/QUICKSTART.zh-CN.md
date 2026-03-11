# OpenCode 快速开始

把这份文档当作你日常个人开发的快速入口。

## 已安装的 Skills

- `personal-using-superpowers`
- `personal-brainstorming`
- `personal-writing-plans`
- `personal-test-driven-development`
- `personal-systematic-debugging`
- `personal-verification-before-completion`

## 默认套路

1. 先加载 `personal-using-superpowers`
2. 判断当前任务属于哪种工作流
3. 最后一定用 `personal-verification-before-completion` 收尾

## 固定流程

### 新功能

`personal-using-superpowers` -> `personal-brainstorming` -> `personal-writing-plans` -> `personal-test-driven-development` -> `personal-verification-before-completion`

### 修 Bug

`personal-using-superpowers` -> `personal-systematic-debugging` -> 需要回归保护时再用 `personal-test-driven-development` -> `personal-verification-before-completion`

### 重构

`personal-using-superpowers` -> `personal-brainstorming` -> `personal-writing-plans` -> `personal-test-driven-development` -> `personal-verification-before-completion`

## 每个 Skill 什么时候用

- `personal-using-superpowers`：每个任务的第一步
- `personal-brainstorming`：改功能、改交互、改架构之前
- `personal-writing-plans`：任务比一次小改更复杂时
- `personal-test-driven-development`：逻辑复杂、改动有风险、需要防回归时
- `personal-systematic-debugging`：出问题了，但根因还不清楚时
- `personal-verification-before-completion`：准备说“做完了”之前

## 常用 Prompt 模板

### 开始任意任务

```text
加载 personal-using-superpowers，并告诉我这个任务应该走哪条工作流：<任务>
```

### 开始做功能

```text
加载 personal-brainstorming，帮我梳理这个功能的范围、取舍和推荐方案：<功能>
```

### 把设计拆成步骤

```text
加载 personal-writing-plans，把这个已经确认的方案拆成小的实现步骤：<已确认方案>
```

### 排查问题

```text
加载 personal-systematic-debugging，帮我复现、缩小范围并验证这个问题：<bug>
```

### 完成前验证

```text
加载 personal-verification-before-completion，告诉我这个改动在结束前应该跑哪些检查：<改动>
```

## 最短安全口诀

如果你只记住一条，就记这句：

先 `personal-using-superpowers`，最后 `personal-verification-before-completion`。
