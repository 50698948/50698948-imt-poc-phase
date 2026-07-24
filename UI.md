# IMT PoC — 系统原型界面规格 (UI Specification)

> **版本**: v1.0 | **日期**: 2026-07-23  
> **关联文档**: [UserRequirement.md](./UserRequirement.md) | [revised.md](./revised.md)

---

## 目录

1. [全局设计规范](#一全局设计规范)
2. [导航与布局](#二导航与布局)
3. [P1 — Dashboard 仪表盘看板](#三p1--dashboard-仪表盘看板)
4. [P2 — Incident 详情与事件时间线](#四p2--incident-详情与事件时间线)
5. [P3 — Chat 对话面板](#五p3--chat-对话面板)
6. [P4 — Task Board 任务看板](#六p4--task-board-任务看板)
7. [P5 — Reports 报告管理](#七p5--reports-报告管理)
8. [P6 — E2E Retrieval 检索验证](#八p6--e2e-retrieval-检索验证)
9. [P7 — Lifecycle 生命周期演示](#九p7--lifecycle-生命周期演示)
10. [交互组件库](#十交互组件库)
11. [页面间导航关系](#十一页面间导航关系)

---

## 一、全局设计规范

### 1.1 色彩系统

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-page` | `#F5F6F8` | 页面底色 |
| `--bg-card` | `#FFFFFF` | 卡片/面板背景 |
| `--bg-sidebar` | `#FFFFFF` | 侧边栏背景 |
| `--text-primary` | `#1A1A2E` | 主要文字 |
| `--text-secondary` | `#6B7280` | 次要文字 |
| `--text-muted` | `#9CA3AF` | 禁用/占位文字 |
| `--brand` | `#5E6AD2` | 主色调 (按钮/链接) |
| `--brand-hover` | `#4F5BC0` | 主色调悬停 |
| `--success` | `#0EA366` | Resolved / 已完成 |
| `--warning` | `#F59E0B` | Investigating / 进行中 |
| `--danger` | `#E5484D` | Open / P0 / 严重 |
| `--border` | `#E5E7EB` | 边框 |
| `--border-hover` | `#D1D5DB` | 悬停边框 |

### 1.2 状态颜色映射

| 状态 | 文字色 | 背景色 | 边框色 | 图标 |
|------|--------|--------|--------|------|
| Open | `text-red-600` | `bg-red-50` | `border-red-200` | ○ |
| Investigating | `text-amber-600` | `bg-amber-50` | `border-amber-200` | ◐ |
| Mitigated | `text-blue-600` | `bg-blue-50` | `border-blue-200` | ◑ |
| Resolved | `text-emerald-600` | `bg-emerald-50` | `border-emerald-200` | ● |

### 1.3 严重级别颜色

| 级别 | 颜色 |
|------|------|
| P0 | 红色 `#E5484D` |
| P1 | 橙色 `#F59E0B` |
| P2 | 黄色 `#EAB308` |
| P3 | 灰色 `#9CA3AF` |

### 1.4 排版规范

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| H1 | 24px | Bold (700) | 页面标题 |
| H2 | 18px | Semibold (600) | 区块标题 |
| H3 | 14px | Semibold (600) | 子区块标题 |
| Body | 12px | Regular (400) | 正文 |
| Caption | 10px | Regular (400) | 辅助信息/标签 |
| Micro | 8px | Regular (400) | 时间戳/来源标注 |

### 1.5 间距规范

| Token | 值 | 用途 |
|-------|-----|------|
| `xs` | 4px | 元素内间距 |
| `sm` | 8px | 相关元素间距 |
| `md` | 12px | 组件内间距 |
| `lg` | 16px | 卡片内边距 |
| `xl` | 24px | 区块间距 |

---

## 二、导航与布局

### 2.1 全局布局 (Shell)

```
┌─────────────────────────────────────────────────────────────────┐
│  ◫ Incident Management PoC                          v1.0       │ ← Header (h=56px)
├──────────┬──────────────────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                                  │
│ (w=192)  │                                                     │
│          │                                                     │
│ Dashboard│                                                     │
│ Retrieve │                                                     │
│ Lifecycle│                                                     │
│ Reports  │                                                     │
│ Tasks    │                                                     │
│          │                                                     │
│          │                                                     │
│          │                                                     │
│ [💬 Chat]│                                                     │
└──────────┴──────────────────────────────────────────────────────┘
```

### 2.2 侧边栏

| 项目 | 说明 |
|------|------|
| 宽度 | 192px (固定) |
| 背景 | `#FFFFFF` |
| 边框 | 右侧 `1px solid #E5E7EB` |
| 导航项 | 图标 + 文字 + 活跃状态 |
| 活跃态 | `bg-indigo-50` + `text-indigo-600` + 左边框 2px indigo |
| 底部按钮 | "Open Chat" → 打开 Chat 抽屉 |

### 2.3 Chat 抽屉

| 属性 | 值 |
|------|-----|
| 触发方式 | 侧边栏按钮 / `Ctrl+K` 快捷键 |
| 宽度 | 420px |
| 位置 | 右侧滑出，覆盖遮罩层 |
| 遮罩 | `bg-black/20` 点击关闭 |
| 动画 | `animate-slide-in` (300ms ease-out) |
| 自动关联 | 若当前页面正在查看某 Incident，自动填入 `incident_no` |

---

## 三、P1 — Dashboard 仪表盘看板

**对应需求**: UC-01, UC-13, UC-14  
**路由**: `/`

### 3.1 页面布局

```
┌─ Dashboard ────────────────────────────────────────────────────┐
│ Incident Board                          [+ New] [⟳ Re-Seed]    │
│ 49 tickets across 4 status columns                             │
│                                                                │
│ Filter: [All Severities ▾] [All Categories ▾]    [Clear ✕]    │
│                                                                 49 shown
├──────────┬──────────────┬──────────────┬──────────────────────┤
│ ○ OPEN   │ ◐ INVESTIG.  │ ◑ MITIGATED  │ ● RESOLVED           │
│    2     │      4       │      1       │      42              │
├──────────┼──────────────┼──────────────┼──────────────────────┤
│ [card]   │ [card]       │ [card]       │ [card]               │
│ [card]   │ [card]       │              │ [card]               │
│          │ [card]       │              │ [card] ...           │
└──────────┴──────────────┴──────────────┴──────────────────────┘
```

### 3.2 Kanban 卡片规格

```
┌────────────────────────────┐
│ INC-2025-0001      [P1]   │ ← Ticket ID + 严重度标签
│                            │
│ Payment service P99        │ ← 标题 (2行截断)
│ latency spike              │
│                            │
│ application · payment-svc  │ ← 类别 · 服务 · error_type · v1
│ · timeout · v1             │
└────────────────────────────┘

状态:
  hover: border → gray-300, 上浮 2px, shadow
  click: 跳转 /incident/INC-2025-0001
```

### 3.3 交互行为

| 触发 | 行为 |
|------|------|
| 点击 `[+ New Incident]` | 弹出创建表单 Modal |
| 点击卡片 | 导航到 Incident 详情页 `/incident/{no}` |
| Severity 筛选 | 只显示所选级别的卡片 |
| Category 筛选 | 只显示所选类别的卡片 |
| 点击 `[Re-Seed]` | 重新灌入 49 条模拟数据 |
| 列头数字 | 实时更新该列的卡片数 |

### 3.4 创建 Incident Modal

```
┌─ New Incident ───────────────────────[✕]─┐
│                                           │
│  Title *                                   │
│  ┌───────────────────────────────────────┐│
│  │                                       ││
│  └───────────────────────────────────────┘│
│                                           │
│  Description *                             │
│  ┌───────────────────────────────────────┐│
│  │                                       ││
│  │                                       ││
│  └───────────────────────────────────────┘│
│                                           │
│  Severity *       Service *                │
│  [P1 ▾]           [____________]           │
│                                           │
│  Category          Error Type             │
│  [application ▾]   [timeout ▾]            │
│                                           │
│  Source                                    │
│  ● Manual Entry   ○ xMatter Alert         │
│                                           │
│          [Cancel]         [Create]        │
└───────────────────────────────────────────┘

Create 后:
  → Modal 关闭
  → 新卡片出现在 OPEN 列顶部
  → 黄色边框闪烁 2s (animate-pulse-border)
  → 自动运行 retrieve → 卡片下方出现 Top-3 预览
```

---

## 四、P2 — Incident 详情与事件时间线

**对应需求**: UC-02, UC-03, UC-06, UC-07  
**路由**: `/incident/[id]`

### 4.1 页面布局

```
┌─ Incident Detail ──────────────────────────────────────────────┐
│ ← Back to Board                                                │
│ INC-2025-0001 [investigating] v4          Created: 2026-07-22 │
│ Payment service failing under load                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Event Timeline                                                │
│                                                                │
│  ●────📄────📋────📄────📋────📄────                           │
│ 14:30 14:32 14:32 14:35 14:35 14:38                           │
│ Create Report Tasks Report Tasks Report                        │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Events: 7  |  Created: 1  |  Reports: 4  |  Tasks: 2         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Description                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Payment service returning HTTP 504 Gateway Timeout ...   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Root Cause (red bg)                                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ New deployment added fraud-check HTTP call ...           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Resolution (green bg)                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Rolled back deployment. Moved fraud-check to async ...   │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 纵向时间线组件

```
  │
  │  (灰色竖线连接所有事件)
  │
14:30 ●━━ CREATED  Ticket Created                    [click to expand]
  │   ┌──────────────────────────────────────────────┐
  │   │ Severity: P0 | Service: payment-service      │
  │   │ Created: 2026-07-22T14:30:00Z                │
  │   └──────────────────────────────────────────────┘
  │
14:32 📄━━ REPORT   Report Demo v2                   [click to expand]
  │   ┌──────────────────────────────────────────────┐
  │   │ [STATUS] INVESTIGATING — P0                  │
  │   │ [REFERENCE] INC-2024-0014 | INC-2024-0001    │
  │   └──────────────────────────────────────────────┘
  │
14:32 📋━━ TASKS    7 Tasks Generated                [click to expand]
  │
14:35 📄━━ REPORT   Report Demo v3
  │
14:38 📄━━ REPORT   Report Demo v4
  │
  ▼ (chronological, oldest first)
```

**事件节点颜色**：
- ● 创建 → 绿色 `bg-emerald-500`
- 📄 报告 → 靛蓝色 `bg-indigo-500`
- 📋 任务 → 琥珀色 `bg-amber-500`

### 4.3 交互行为

| 触发 | 行为 |
|------|------|
| 点击 `← Back to Board` | 返回 Dashboard |
| 点击时间线节点 | 展开/折叠该事件详情卡片 |
| 点击事件卡片内链接 | 导航到相关页面 |
| 页面加载 | 自动请求 `/api/incidents/{no}/timeline` |

---

## 五、P3 — Chat 对话面板

**对应需求**: UC-02 (编排输入), §12.2 阶段②  
**触发方式**: 侧边栏 "Open Chat" 按钮 / `Ctrl+K`

### 5.1 抽屉布局

```
┌──────────────────────────────────────┬───────────────────────────┐
│  Main Content (遮罩)                 │ Chat                      │
│                                      │ ┌───────────────────────┐ │
│                                      │ │ INC-2025-0001   [✕]   │ │
│                                      │ │ payment-service · P0  │ │
│                                      │ ├───────────────────────┤ │
│                                      │ │                       │ │
│                                      │ │ System: Incident      │ │
│                                      │ │ created. Top match:   │ │
│                                      │ │ INC-2024-0002(18.5)   │ │
│                                      │ │                       │ │
│                                      │ │ You: (pasted table)   │ │
│                                      │ │ | Metric | Value |    │ │
│                                      │ │ | P99    | 2.8s  |    │ │
│                                      │ │                       │ │
│                                      │ │ System: ✓ 3 metrics   │ │
│                                      │ │ added. Score 5.6→9.4  │ │
│                                      │ │                       │ │
│                                      │ │ You: /rc fraud-check  │ │
│                                      │ │ N+1 pattern in        │ │
│                                      │ │ /charge handler       │ │
│                                      │ │                       │ │
│                                      │ │ System: ✓ Root cause  │ │
│                                      │ │ saved. Score 9.4→17.3 │ │
│                                      │ ├───────────────────────┤ │
│                                      │ │ [/status inv.]        │ │
│                                      │ │ [/rc ...] [/res ...]  │ │
│                                      │ │ [/recommend] [/report]│ │
│                                      │ │                       │ │
│                                      │ │ ┌───────────────────┐ │ │
│                                      │ │ │ 📎 Drop files...  │ │ │
│                                      │ │ │ or type command   │ │ │
│                                      │ │ └───────────────────┘ │ │
│                                      │ │              [Send ▸] │ │
│                                      │ └───────────────────────┘ │
└──────────────────────────────────────┴───────────────────────────┘
```

### 5.2 消息类型

| 类型 | 样式 | 示例 |
|------|------|------|
| 系统消息 | 左对齐，灰底 `bg-gray-100` | "Incident created. Top match: INC-2024-0002" |
| 用户消息 | 右对齐，靛蓝底 `bg-indigo-500 text-white` | "/status investigating" |
| 文件上传 | 左对齐，含文件图标 + 文件名 | "📎 incident-log.docx (2.3KB)" |
| 系统确认 | 左对齐，绿色左边框 | "✓ 3 metrics added. Score 5.6→9.4" |

### 5.3 快捷命令

| 命令 | 作用 | AI 响应示例 |
|------|------|-----------|
| `/status <new>` | 更新事件状态 | "✓ Status: open → investigating. Version: v1→v2" |
| `/rc <text>` | 添加 Root Cause | "✓ Root cause saved. Score 9.4→17.3" |
| `/res <text>` | 添加 Resolution | "✓ Resolution saved. Report v4 generated." |
| `/recommend` | 查看推荐 Tasks | 返回 8 条 Task 列表 |
| `/report` | 查看最新 Report | 返回 Report highlights |
| `/timeline` | 查看事件时间线 | 返回事件摘要 |

### 5.4 文件上传交互

```
拖拽文件到输入框 / 点击 📎 图标
  → 文件上传进度条 (2s)
  → 后端解析文本
  → AI 响应: "✓ Parsed incident-log.docx (2.3KB). 156 words added."
  → 追加到 Incident.description
  → 触发 re-embed + re-retrieve
  → 显示 Score 变化
```

---

## 六、P4 — Task Board 任务看板

**对应需求**: UC-04, UC-16, §12.2 阶段④  
**路由**: `/tasks`

### 6.1 页面布局

```
┌─ Task Board ────────────────────────────────────────────────────┐
│                                                                 │
│ ┌─ Incident Table ────────────────────────────────────────────┐ │
│ │ Incidents  49 total                    🔍 Filter...         │ │
│ ├────┬──────────┬──────────────────┬────────┬────┬───────────┤ │
│ │ ☑  │ Incident │ Title            │ Status │ Sev│ Service   │ │
│ ├────┼──────────┼──────────────────┼────────┼────┼───────────┤ │
│ │ ☐  │ INC-2024 │ MySQL master...  │ resol. │ P0 │ order-svc │ │
│ │ ☑  │ INC-2025 │ Payment service.◀│ invest.│ P0 │ payment   │ │ ← selected
│ └────┴──────────┴──────────────────┴────────┴────┴───────────┘ │
│  Show all 49 incidents                                          │
│                                                                 │
│ ┌─ INC-2025-0001 — 8 tasks ───────────────────────────────────┐ │
│ │ [Select All] [Assign: ____] [History] | [Accept] [Compl.]   │ │
│ │ ████████░░░░░░  4/8 (50%)                                    │ │
│ │ ○ pending(2) ◐ prog(1) ● done(4) ✕ rej(1)                   │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ ☑ ● T01 Check connection pool metrics    src: best-practice │ │
│ │      assigned: david.lin  ✓ Confirmed active=50/50           │ │
│ │      [✎ Edit] [👤 Assign]                                     │ │
│ │                                                              │ │
│ │ ☐ ○ T02 Review slow query logs           src: best-practice │ │
│ │      [Accept] [Reject]                                       │ │
│ │                                                              │ │
│ │ ☐ ○ T03 Verify deployment diff            src: best-practice │ │
│ │      [✎ Edit] [👤 Assign] [Accept] [Reject]                  │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [+ Add Custom Task]                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Task 卡片状态

```
pending:
  ┌─────────────────────────────────────────┐
  │ ○ T02 Review slow query logs            │
  │     src: best-practice/timeout          │
  │     [Accept] [Reject]                   │
  └─────────────────────────────────────────┘

in_progress:
  ┌─────────────────────────────────────────┐
  │ ◐ T03 Verify deployment diff            │
  │     assigned: david.lin                  │
  │     ┌ Progress Note ────────────────┐   │
  │     │ Analyzing git diff...          │   │
  │     └───────────────────────────────┘   │
  │     [Complete] [Reject]                 │
  └─────────────────────────────────────────┘

completed:
  ┌─────────────────────────────────────────┐
  │ ● T01 Check connection pool metrics     │ ← green bg
  │     assigned: david.lin                  │
  │     ┌ Result ───────────────────────┐   │
  │     │ Confirmed: active=50/50       │   │
  │     └──────────────────────────────┘   │
  └─────────────────────────────────────────┘

rejected:
  ┌─────────────────────────────────────────┐
  │ ✕ T04 Assess blast radius               │ ← red bg, strikethrough
  │     ┌ Reason ───────────────────────┐   │
  │     │ Impact limited to payment-svc │   │
  │     └──────────────────────────────┘   │
  └─────────────────────────────────────────┘
```

### 6.3 Revision History 面板

```
┌─ Revision History ─────────────────────────────────────────────┐
│ 14:35  accepted   david.lin  T01: Check connection pool        │
│ 14:38  completed  david.lin  T01: Confirmed active=50/50       │
│ 14:40  rejected   david.lin  T04: Not applicable               │
│ 14:42  modified   david.lin  T03: Description updated          │
│ 14:45  assigned   david.lin  T02: → jane.doe                   │
└────────────────────────────────────────────────────────────────┘
```

---

## 七、P5 — Reports 报告管理

**对应需求**: §12.2 阶段⑤  
**路由**: `/reports`

### 7.1 页面布局

```
┌─ Reports ──────────────────────────────────────────────────────┐
│                                                                 │
│ ┌─ Incident Table ────────────────────────────────────────────┐ │
│ │ (same table as Task Board)                                   │ │
│ │ ☑ INC-2025-0001 ◀ selected                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ INC-2025-0001 — 3 reports ─────────────────────────────────┐ │
│ │ [v2] [v3] [v4]     [Compare] [Revise] [Generate] [Publish]  │ │
│ │ Generated: 2026-07-22 14:32 · Status: draft                  │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │                                                              │ │
│ │ KEY HIGHLIGHTS                                               │ │
│ │ ┌STATUS┐ INVESTIGATING — P0                                  │ │
│ │ ┌ROOT CAUSE┐ N+1 connection pattern...                       │ │
│ │ ┌ACTION┐ Resolution applied: Rolled back...                  │ │
│ │ ┌REFERENCE┐ INC-2024-0002 — PostgreSQL pool (score=28.3)     │ │
│ │ ┌REFERENCE┐ INC-2024-0001 — MySQL CPU spike (score=22.1)     │ │
│ │                                                              │ │
│ │ FULL REPORT (scrollable)                                     │ │
│ │ ┌──────────────────────────────────────────────────────────┐ │ │
│ │ │ ===================================================     │ │ │
│ │ │ INCIDENT LEADERSHIP REPORT — INC-2025-0001               │ │ │
│ │ │ ===================================================     │ │ │
│ │ │ ## 1. Executive Summary                                  │ │ │
│ │ │ ## 2. Current Status                                     │ │ │
│ │ │ ## 3. Impact Assessment                                  │ │ │
│ │ │ ## 4. Investigation Progress                             │ │ │
│ │ │ ## 5. Key Highlights                                     │ │ │
│ │ │ ## 6. Recommended Next Steps                             │ │ │
│ │ │ ===================================================     │ │ │
│ │ └──────────────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Compare Mode (版本对比)

```
┌── v3 (previous) ──────────┐  ┌── v4 (current) ──────────┐
│                            │  │                            │
│ • [STATUS] INVESTIGATING   │  │ • [STATUS] RESOLVED        │
│ • [ROOT CAUSE] N+1...      │  │ • [ROOT CAUSE] N+1...      │
│ ✕ old reference (deleted) │  │ + [ACTION] new highlight  │
│ ✕ old highlight (removed) │  │ + [REFERENCE] new ref     │
│                            │  │                            │
└────────────────────────────┘  └────────────────────────────┘

Legend:
  ✕ red strikethrough = removed in current version
  + green bold = added in current version
```

### 7.3 Revise Mode (编辑)

```
┌─ Revise Report ───────────────────────────────────────────────┐
│                                                               │
│ Executive Summary                                             │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Payment service returning HTTP 504 errors on /charge      │ │
│ │ endpoint. P99 latency spiked to 30s. Closest match:       │ │
│ │ INC-2024-0002 (score=28.3). Root cause: N+1 connection    │ │
│ │ pattern identified and confirmed.                        │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ Highlights                                                    │
│ 1. [STATUS] RESOLVED — severity P0                      [✕]  │
│ 2. [ROOT CAUSE] N+1 connection pattern...               [✕]  │
│ 3. [ACTION] Rolled back deployment, moved to async      [✕]  │
│ 4. [+ Add Highlight]                                          │
│                                                               │
│ Review Notes (internal)                                       │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Confirmed RC with DB team. Escalating to VP Engineering.  │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ [Save Draft]      [Publish Report]                            │
└───────────────────────────────────────────────────────────────┘
```

---

## 八、P6 — E2E Retrieval 检索验证

**路由**: `/retrieve`

### 8.1 页面布局

```
┌─ E2E Retrieval Pipeline ──────────────────────────────────────┐
│                                                               │
│ ┌─ Input ──────────────────┐ ┌─ Results ────────────────────┐ │
│ │                           │ │                               │ │
│ │ Title                     │ │ Reranked Top-5 (5)            │ │
│ │ [_______________]         │ │ ┌─────────────────────────┐   │ │
│ │                           │ │ │ INC-2024-0002  score=28.3│   │ │
│ │ Description               │ │ │ PostgreSQL pool exhaust. │   │ │
│ │ [_______________]         │ │ │ Root cause highly aligned│   │ │
│ │ [_______________]         │ │ └─────────────────────────┘   │ │
│ │                           │ │ ┌─────────────────────────┐   │ │
│ │ Service    Category       │ │ │ INC-2024-0001  score=22.1│   │ │
│ │ [order-svc] [database ▾]  │ │ │ MySQL master CPU 100%    │   │ │
│ │                           │ │ └─────────────────────────┘   │ │
│ │ Severity   Error Type     │ │ ...                           │ │
│ │ [P1 ▾]     [timeout ▾]    │ │                               │ │
│ │                           │ │ Action Plan                   │ │
│ │ [Run Retrieval]           │ │ ┌─────────────────────────┐   │ │
│ │                           │ │ │ Phase A — Emergency      │   │ │
│ └───────────────────────────┘ │ │ Phase B — Diagnosis      │   │ │
│                               │ │ Phase C — Root Cause Fix │   │ │
│                               │ └─────────────────────────┘   │ │
│                               │                               │ │
│                               │ All RRF Candidates (15)        │ │
│                               │ 1. INC-2024-0002 ...           │ │
│                               │ 2. INC-2024-0001 ...           │ │
│                               └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 九、P7 — Lifecycle 生命周期演示

**路由**: `/lifecycle`

### 9.1 页面布局

```
┌─ Lifecycle ────────────────────────────────────────────────────┐
│ Lifecycle Demo                         [▶ Run Lifecycle Demo]  │
│                                                                 │
│ ┌─ Incident Table (same as Tasks/Reports) ────────────────────┐ │
│ │ ☑ INC-2025-0001 ◀ selected (or click Run Demo to create)   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Score Trend ───────────────────────────────────────────┐    │
│ │  5.6       9.4        17.3       18.3                    │    │
│ │  ██       ████      ████████   █████████                │    │
│ │  open    investing  investing  resolved                  │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ ● T+0  Ticket Created (65 chars, no RC, no Resolution)         │
│ ● T+10 Status → investigating (+271 chars)                     │
│ 📄 T+10 Report v2 generated (draft)                            │
│ 📋 T+10 7 Tasks generated                                      │
│ ● T+45 Root Cause identified (+215 chars)                      │
│ 📄 T+45 Report v3 generated (draft)                            │
│ 📋 T+45 8 Tasks generated                                      │
│ ● T+90 Resolution applied                                      │
│ 📄 T+90 Report v4 generated (draft)                            │
│                                                                 │
│ Description | Root Cause | Resolution (collapsible sections)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十、交互组件库

### 10.1 通用组件

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| `IncidentTable` | 带 checkbox 的 Incident 列表 | Tasks, Reports, Lifecycle |
| `ProgressBar` | 任务完成进度条 | Tasks |
| `StatusBadge` | 状态标签 (Open/Inv/Mit/Res) | 全局 |
| `SeverityBadge` | 严重度标签 (P0-P3) | 全局 |
| `TimelineNode` | 时间线事件节点 | Incident Detail, Lifecycle |
| `ChatDrawer` | Chat 滑出面板 | 全局 |
| `NewIncidentModal` | 创建 Incident 弹窗 | Dashboard |
| `HighlightTag` | Report Highlight 标签 | Reports |
| `RevisionHistory` | 修订历史面板 | Tasks |
| `ComparePanel` | 版本对比面板 | Reports |
| `RevisePanel` | 编辑面板 | Reports |

### 10.2 状态指示器

| 组件 | 状态 | 视觉 |
|------|------|------|
| Loading | 加载中 | Skeleton shimmer 动画 |
| Empty | 无数据 | 居中图标 + 提示文字 + 操作按钮 |
| Error | 加载失败 | 红色边框 + 错误信息 + 重试按钮 |
| Success | 操作成功 | 绿色 Toast (3s 自动消失) |

### 10.3 空状态示例

```
┌────────────────────────────────────┐
│                                    │
│              📭                    │
│    No tasks for INC-2025-0001      │
│                                    │
│    [Generate Tasks]  [+ Add Custom]│
│                                    │
└────────────────────────────────────┘
```

---

## 十一、页面间导航关系

```
Dashboard (/)
  │
  ├── click card ──→ Incident Detail (/incident/[id])
  │                    │
  │                    ├── timeline nodes
  │                    ├── description / RC / resolution
  │                    └── ← Back to Board
  │
  ├── sidebar ──→ Retrieve (/retrieve)
  │                 └── Run → results → click card → Incident Detail
  │
  ├── sidebar ──→ Lifecycle (/lifecycle)
  │                 └── Run Demo → timeline → click node → expand
  │
  ├── sidebar ──→ Reports (/reports)
  │                 └── Select incident → [Generate] [Compare] [Revise] [Publish]
  │
  ├── sidebar ──→ Tasks (/tasks)
  │                 └── Select incident → Accept/Reject/Complete/Edit Tasks
  │
  └── sidebar / Ctrl+K ──→ Chat (drawer)
                             └── /status /rc /res /recommend /report /timeline
```

### 导航规则

| 规则 | 说明 |
|------|------|
| 所有 Incident No 可点击 | 跳转到 `/incident/{no}` 详情页 |
| Chat 自动关联上下文 | 若当前在 Incident 详情页，Chat 自动填入 `incident_no` |
| 表格选中跨页面隔离 | Tasks/Reports/Lifecycle 的 Incident 选择互不影响 |
| 数据修改实时同步 | Incident 更新后，Dashboard 看板、Reports、Tasks 自动显示最新状态 |

---

## 附录 A：响应式断点

| 断点 | 宽度 | 布局调整 |
|------|------|---------|
| Desktop | ≥ 1280px | 侧边栏 + 内容区 + 最大宽度 1024px |
| Tablet | 768-1279px | 侧边栏折叠为图标，内容区全宽 |
| Mobile | < 768px | 侧边栏隐藏 (汉堡菜单)，内容区堆叠 |

## 附录 B：键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 打开/关闭 Chat 抽屉 |
| `Esc` | 关闭 Modal / Chat 抽屉 |
| `Enter` | 在 Chat 输入框中发送消息 |
| `/` | 在 Chat 输入框中触发命令提示 |
