# IMT PoC — 前端界面设计规范 (Design Specification)

> **版本**: v1.0 | **日期**: 2026-07-23  
> **标准**: 商业银行级 UI/UX 设计规范  
> **关联**: [UserRequirement.md](./UserRequirement.md) | [UI.md](./UI.md)

---

## 目录

1. [设计原则](#一设计原则)
2. [Design Token 体系](#二design-token-体系)
3. [全局布局框架](#三全局布局框架)
4. [P1 — Dashboard 事件看板](#四p1--dashboard-事件看板)
5. [P2 — Incident 作战室](#五p2--incident-作战室)
6. [P3 — Chat 智能交互面板](#六p3--chat-智能交互面板)
7. [P4 — Task 任务工作台](#七p4--task-任务工作台)
8. [P5 — Report 报告中心](#八p5--report-报告中心)
9. [P6 — 检索验证工具](#九p6--检索验证工具)
10. [P7 — 生命周期回放](#十p7--生命周期回放)
11. [通用组件详规](#十一通用组件详规)
12. [状态与反馈系统](#十二状态与反馈系统)
13. [可访问性规范 (WCAG 2.1 AA)](#十三可访问性规范-wcag-21-aa)
14. [页面流转与导航](#十四页面流转与导航)
15. [附录：设计检查清单](#十五附录设计检查清单)

---

## 一、设计原则

### 1.1 核心设计理念

| 原则 | 说明 | 实施方式 |
|------|------|---------|
| **清晰优先** | 信息架构扁平，关键数据一眼可见 | 三级信息层级：摘要 → 详情 → 操作 |
| **操作可逆** | 所有关键操作均支持撤销/回滚 | Contextual Undo + 确认弹窗 |
| **渐进披露** | 复杂信息按需展开，避免认知过载 | 折叠面板 + 悬浮 Tooltip |
| **状态可视** | 系统状态全局一致、实时更新 | 颜色编码 + 图标 + 进度指示器 |
| **安全合规** | 敏感操作需二次确认，操作日志可审计 | 确认弹窗 + Audit Trail |

### 1.2 商业银行设计约束

| 约束项 | 要求 |
|--------|------|
| **色彩对比度** | 文字与背景对比度 ≥ 4.5:1 (WCAG AA) |
| **字体最小** | 正文 ≥ 12px，标注 ≥ 10px (合规要求) |
| **操作确认** | 定级变更、Report 发布、复盘发布需二次确认 |
| **审计痕迹** | 所有 Create/Update/Delete 操作记录操作人+时间戳 |
| **数据脱敏** | PII 字段在列表中默认脱敏展示 (如 `***@***.com`) |
| **超时锁定** | 会话空闲 30min 自动锁定，需重新认证 |
| **打印友好** | Report 和复盘页面支持打印样式 (隐藏导航) |

---

## 二、Design Token 体系

### 2.1 品牌色彩

```css
/* 主色调 — 银行蓝 */
--color-primary-50:  #EFF2FF;
--color-primary-100: #DEE4FE;
--color-primary-200: #BCC8FC;
--color-primary-300: #8FA0F9;
--color-primary-400: #6B7DF5;
--color-primary-500: #4F5FEF;  /* 主色 */
--color-primary-600: #3D46D9;
--color-primary-700: #3135B5;
--color-primary-800: #282C8F;
--color-primary-900: #1E2163;

/* 中性色 */
--color-gray-50:  #F8F9FC;
--color-gray-100: #F0F2F5;
--color-gray-200: #E2E6EC;
--color-gray-300: #C9CED6;
--color-gray-400: #A3AAB5;
--color-gray-500: #7B8290;
--color-gray-600: #5A606B;
--color-gray-700: #3C414A;
--color-gray-800: #242830;
--color-gray-900: #14161A;

/* 语义色 */
--color-success-50:  #ECFDF5;
--color-success-500: #10A861;  /* 成功 / Resolved */
--color-warning-50:  #FFFBEB;
--color-warning-500: #F59E0B;  /* 警告 / Investigating */
--color-danger-50:   #FEF2F2;
--color-danger-500:  #E53E3E;  /* 危险 / P0 / Open */
--color-info-50:     #EFF6FF;
--color-info-500:    #3B82F6;  /* 信息 / Mitigated */
```

### 2.2 功能色映射

| 业务状态 | 文字色 | 背景色 | 边框色 | 图标 |
|---------|--------|--------|--------|------|
| Open | `danger-500` | `danger-50` | `danger-200` | `AlertCircle` |
| Investigating | `warning-500` | `warning-50` | `warning-200` | `Clock` |
| Mitigated | `info-500` | `info-50` | `info-200` | `Shield` |
| Resolved | `success-500` | `success-50` | `success-200` | `CheckCircle` |
| P0 | `danger-500` | `danger-50` | `danger-200` | — |
| P1 | `#EA580C` | `#FFF7ED` | `#FED7AA` | — |
| P2 | `warning-500` | `warning-50` | `warning-200` | — |
| P3 | `gray-400` | `gray-100` | `gray-200` | — |

### 2.3 排版体系

| Token | Font Size | Line Height | Font Weight | Usage |
|-------|-----------|-------------|-------------|-------|
| `text-display` | 28px | 36px | 700 | 仪表盘核心数字 |
| `text-h1` | 24px | 32px | 700 | 页面标题 |
| `text-h2` | 18px | 26px | 600 | 区块标题 |
| `text-h3` | 14px | 20px | 600 | 子区块标题 |
| `text-body` | 13px | 20px | 400 | 正文 |
| `text-body-sm` | 12px | 18px | 400 | 辅助正文 |
| `text-caption` | 11px | 16px | 400 | 表格/列表内容 |
| `text-label` | 10px | 14px | 500 | 标签/标注 |
| `text-micro` | 9px | 12px | 400 | 时间戳/来源 |

**字体栈**：`"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`  
**等宽字体**：`"JetBrains Mono", "SF Mono", "Cascadia Code", monospace`

### 2.4 间距与栅格

| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0 | — |
| `space-1` | 4px | 元素内间距 (icon-label) |
| `space-2` | 8px | 内联元素间距 |
| `space-3` | 12px | 组件内间距 |
| `space-4` | 16px | 卡片 padding |
| `space-5` | 20px | 卡片间间距 |
| `space-6` | 24px | 区块间距 |
| `space-8` | 32px | 页面 section 间距 |
| `space-10` | 40px | 页面间大间距 |

**栅格系统**：12 列栅格，列间距 16px，最大内容宽度 1280px。

### 2.5 圆角与阴影

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | 标签、徽章、小按钮 |
| `radius-md` | 8px | 输入框、下拉菜单 |
| `radius-lg` | 12px | 卡片、面板 |
| `radius-xl` | 16px | 模态框、大面板 |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | 卡片默认 |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | 卡片悬停、下拉菜单 |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | 模态框、抽屉 |

### 2.6 过渡与动画

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `transition-fast` | 150ms | `ease-out` | Hover 状态、按钮 |
| `transition-normal` | 250ms | `ease-in-out` | 面板展开/折叠 |
| `transition-slow` | 400ms | `ease-in-out` | 模态框/抽屉进出 |
| `duration-skeleton` | 1.5s | `ease-in-out` (infinite) | Loading skeleton |

---

## 三、全局布局框架

### 3.1 Shell 结构

```
┌──────────────────────────────────────────────────────────────────┐
│  Header (h=56px)                                  [User] [⚙]    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 🏦 IMT · Incident Management Platform            v1.0.0    │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────┬───────────────────────────────────────────────────────┤
│ Sidebar  │  Breadcrumb > Page Title                              │
│ w=220px  │  ─────────────────────────────────────────────────    │
│          │                                                       │
│  ◫ Board │  [Main Content Area]                                  │
│  ◎ Search│                                                       │
│  ◷ Life..│                                                       │
│  ▤ Report│                                                       │
│  ☰ Tasks │                                                       │
│          │                                                       │
│  ─────── │                                                       │
│  💬 Chat │                                                       │
│          │                                                       │
│  Collapse▶                                                       │
└──────────┴───────────────────────────────────────────────────────┘
```

### 3.2 Header 规格

| 属性 | 值 |
|------|-----|
| 高度 | 56px |
| 背景 | `#FFFFFF` |
| 底部边框 | `1px solid var(--color-gray-200)` |
| 左侧 | Logo (24×24) + 平台名称 |
| 右侧 | 用户头像 + 下拉菜单 (Profile/Logout) |

### 3.3 Sidebar 规格

| 属性 | 值 |
|------|-----|
| 宽度 | 220px (展开) / 56px (折叠) |
| 背景 | `var(--color-gray-50)` |
| 右边框 | `1px solid var(--color-gray-200)` |
| 导航项高度 | 40px |
| 导航项间距 | 2px |
| 活跃态 | `bg-primary-50` + `text-primary-600` + 左侧 `3px solid primary-500` |
| 折叠态 | 仅显示图标，hover 展开 Tooltip |
| 底部 | Chat 按钮 (独立分区，分隔线以上) |

### 3.4 响应式断点

| 断点 | Min Width | Layout |
|------|-----------|--------|
| `sm` | 640px | 单列，Sidebar 隐藏 |
| `md` | 768px | 双列，Sidebar 折叠 (56px) |
| `lg` | 1024px | Sidebar 展开 (220px) |
| `xl` | 1280px | Sidebar 展开 + 内容最大宽度 1280px |

### 3.5 面包屑导航

```
Dashboard > Incident IN9451263 > Timeline
```

每个层级可点击跳转，当前页灰色不可点击。

---

## 四、P1 — Dashboard 事件看板

**路由**: `/`  
**核心组件**: KanbanBoard, IncidentCard, FilterBar, NewIncidentModal  
**数据源**: `GET /api/tickets?severity=&category=&limit=50`

### 4.1 整体布局

```
┌─ Dashboard ──────────────────────────────────────────────────────┐
│                                                                  │
│  Incident Board         49 incidents       [Filters]   [+ New]   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Severity: [All ▾] [P0] [P1] [P2] [P3]                     │ │
│  │ Category: [All ▾] [Database] [App] [Network] [Infra] [Sec] │ │
│  │ Service:  [All ▾]                                          │ │
│  │                        [Clear Filters]           49 results │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┬──────────────┬──────────────┬──────────────────┐  │
│  │ ● OPEN   │ ◐ INVESTIG.  │ ◑ MITIGATED  │ ● RESOLVED       │  │
│  │   2      │     4        │     1        │      42          │  │
│  ├──────────┼──────────────┼──────────────┼──────────────────┤  │
│  │          │              │              │                  │  │
│  │ [card]   │ [card]       │ [card]       │ [card]           │  │
│  │ [card]   │ [card]       │              │ [card]           │  │
│  │          │ [card]       │              │ ...              │  │
│  └──────────┴──────────────┴──────────────┴──────────────────┘  │
│                                                                  │
│  Last updated: 2026-07-23 14:32 UTC     Auto-refresh: 30s [⚡]   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Kanban 列头规格

```
┌─ ● OPEN  2 ──────────────────────────────────────────────────────┐
│  width: 25% of viewport minus gaps                               │
│  background: var(--color-gray-50)                                │
│  border-top: 3px solid var(--color-danger-500)                   │
│  header: 48px height, flex row                                    │
│    icon (18px) + label (text-label, uppercase) + count badge      │
│  header sticky: top (scrolls with column content)                 │
└──────────────────────────────────────────────────────────────────┘
```

**列头颜色映射**：

| 列 | 顶部分隔条 | 标题色 | 计数 Badge 色 |
|----|-----------|--------|-------------|
| Open | `danger-500` (3px) | `danger-500` | `danger-50 bg, danger-500 text` |
| Investigating | `warning-500` (3px) | `warning-500` | `warning-50 bg, warning-500 text` |
| Mitigated | `info-500` (3px) | `info-500` | `info-50 bg, info-500 text` |
| Resolved | `success-500` (3px) | `success-500` | `success-50 bg, success-500 text` |

### 4.3 Incident Card 详规

```
┌─────────────────────────────────────┐
│  INC-2025-0001             [P1]    │ ← 12px padding, 12px border-radius
│                                     │
│  Payment service P99 latency spike  │ ← text-body-sm, 2-line clamp
│  after MySQL migration to 8.0       │
│                                     │
│  database · payment-service · v3    │ ← text-micro, gray-400
│  timeout          ⏱ 2h 15m         │
│                                     │
│  ─────────────────────────────────  │ ← subtle divider (gray-100)
│  🤖 xMatter · XM-2025-0892         │ ← source badge (if applicable)
└─────────────────────────────────────┘

默认状态:
  bg: white, border: 1px gray-200, shadow: shadow-sm

悬浮状态 (hover):
  border: gray-300, shadow: shadow-md, transform: translateY(-2px)
  transition: 150ms ease-out

拖拽状态 (drag):
  border: primary-400, shadow: shadow-lg, opacity: 0.8

点击:
  navigate to /incident/INC-2025-0001
```

**卡片信息层级**：

| 层级 | 位置 | 内容 | 字号 |
|------|------|------|------|
| L1 | 顶部左侧 | Incident No (monospace) | `text-caption` |
| L1 | 顶部右侧 | Severity Badge | `text-micro` |
| L2 | 中部 | Title (2行截断) | `text-body-sm` |
| L3 | 底部左 | Category · Service · Version | `text-micro` |
| L3 | 底部右 | Error Type · Duration | `text-micro` |
| L4 | 底部分隔线下 | Source Badge (xMatter/Manual) | `text-micro` |

### 4.4 Filter Bar 规格

```
┌─ Filters ─────────────────────────────────────────────────────┐
│                                                               │
│  Severity: [All ▾]  [P0] [P1] [P2] [P3]                     │
│  Category: [All ▾]  [DB] [App] [Net] [Infra] [Sec]          │
│  Service:  [________________________________________ ▾]       │
│                                                               │
│  Active filters: P0 × Database        [Clear All Filters]     │
│                                                               │
│  12 results shown · Last updated 14:32 UTC                    │
└───────────────────────────────────────────────────────────────┘
```

**交互规则**：
- Severity/Category 使用 Pill 按钮（选中态：primary-50 bg + primary-600 text）
- Service 使用带搜索的 Select 下拉
- 激活筛选时显示 "Active filters" 行 + "Clear All" 链接
- 筛选变更后 150ms debounce 发送请求
- 结果数实时更新

### 4.5 New Incident Modal

```
┌─ Create New Incident ─────────────────────────────[✕]──────────┐
│                                                                 │
│  Title *                                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Payment service P99 latency spike after MySQL migration    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (0/200)                                  ← character counter   │
│                                                                 │
│  Description *                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ After migrating order-service DB from MySQL 5.7 to 8.0,   │ │
│  │ P99 latency spiked from 120ms to 2.8s. Slow query log     │ │
│  │ shows 200+ SELECT queries scanning 6M rows per request.    │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (245/2000)                                                     │
│                                                                 │
│  Severity *          Service Name *                             │
│  ┌──────────────┐   ┌──────────────────────────────────────┐   │
│  │ P1 — High  ▾ │   │ payment-service                      │   │
│  └──────────────┘   └──────────────────────────────────────┘   │
│                                                                 │
│  Category             Error Type                                │
│  ┌──────────────┐   ┌──────────────────────────────────────┐   │
│  │ database   ▾ │   │ timeout                             ▾│   │
│  └──────────────┘   └──────────────────────────────────────┘   │
│                                                                 │
│  Source                                                         │
│  ● Manual Entry    ○ xMatter Alert                             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  On create: auto-embed → retrieve similar incidents             │
│                                                                 │
│                        [Cancel]    [Create Incident]            │
└─────────────────────────────────────────────────────────────────┘
```

**表单验证规则**：

| 字段 | 规则 |
|------|------|
| Title | 必填, 1-200 字符 |
| Description | 必填, 10-2000 字符 |
| Severity | 必选 (默认 P1) |
| Service Name | 必填, 从已有服务列表中选择或输入新服务名 |
| Category | 可选, 未选时由 AI 推断 |
| Error Type | 可选 |

---

## 五、P2 — Incident 作战室

**路由**: `/incident/[id]`  
**核心组件**: IncidentHeader, VerticalTimeline, EventCard, DescriptionSection, RootCauseSection, ResolutionSection

### 5.1 页面布局

```
┌─ Incident: INC-2025-0001 ──────────────────────────────────────┐
│                                                                 │
│  ← Back to Board                                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ INC-2025-0001    [investigating]    v4                      ││
│  │ Payment service failing under load                          ││
│  │                                                            ││
│  │ Severity: P0 · Service: payment-service · Cat: application  ││
│  │ Created: 2026-07-22 14:30 UTC · Updated: 14:45 UTC          ││
│  │ Source: Manual Entry                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ Event Statistics ─────────────────────────────────────────┐ │
│  │  Events: 7    Created: 1    Reports: 4    Tasks: 2         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Timeline ─────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  ● 14:30  CREATED   Ticket Created                        │ │
│  │  │           Severity: P0 | payment-service                │ │
│  │  │                                                        │ │
│  │  📄 14:32  REPORT    Report Demo v2                        │ │
│  │  │           [STATUS] INVESTIGATING · [REFERENCE] ×2       │ │
│  │  │                                                        │ │
│  │  📋 14:32  TASKS     7 Tasks Generated                     │ │
│  │  │                                                        │ │
│  │  📄 14:35  REPORT    Report Demo v3                        │ │
│  │  │           [STATUS] INV · [ROOT CAUSE] · [REF] ×2       │ │
│  │  │                                                        │ │
│  │  📋 14:35  TASKS     8 Tasks Generated                     │ │
│  │  │                                                        │ │
│  │  📄 14:38  REPORT    Report Demo v4                        │ │
│  │  │           [STATUS] RESOLVED · [RC] · [ACTION] · [REF]  │ │
│  │  │                                                        │ │
│  │  ▼ (chronological, oldest at top)                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Full Details ─────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Description                                               │ │
│  │  Payment service returning HTTP 504 Gateway Timeout on     │ │
│  │  /charge endpoint. P99 latency spiked from 200ms to 30s... │ │
│  │                                                            │ │
│  │  ─────────────────────────────────────────────────────────  │ │
│  │                                                            │ │
│  │  Root Cause                                   [Confirmed]  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 🔴 New deployment added fraud-check HTTP call inside │  │ │
│  │  │ /charge handler, increasing critical path from 2 to │  │ │
│  │  │ 4 sequential calls. Each call holds a DB connection │  │ │
│  │  │ for its duration. Connection hold time doubled to   │  │ │
│  │  │ ~4s, exhausting the 50-connection pool.            │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  ─────────────────────────────────────────────────────────  │ │
│  │                                                            │ │
│  │  Resolution                                  [Implemented]  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 🟢 1. Rolled back the deployment to remove fraud-   │  │ │
│  │  │ check from critical path. 2. Connection pool        │  │ │
│  │  │ recovered within 30s. 3. Moved fraud-check to async │  │ │
│  │  │ post-processing. 4. Increased pool size to 150.     │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Timeline 组件规格

**连接线**：
- 宽度: 2px
- 颜色: `gray-200`
- 从第一个节点延伸至最后一个节点
- 节点之间的线段: 40px 最小间距

**事件节点**：
| 组件 | 规格 |
|------|------|
| 外圆 | 24px 直径, 白色背景, 3px 边框 |
| 内图标 | 12px, 对应类型颜色 |
| 间距 | 节点间 ≥ 48px |
| 展开动画 | max-height transition 300ms ease-in-out |

**事件类型配色**：
| 类型 | 圆点色 | 边框色 | 展开背景 | 图标 |
|------|--------|--------|---------|------|
| created | `success-500` | `success-200` | `success-50` | ● |
| report | `primary-500` | `primary-200` | `primary-50` | 📄 |
| tasks | `warning-500` | `warning-200` | `warning-50` | 📋 |

### 5.3 Root Cause / Resolution 区块

```
Root Cause 区块:
  background: danger-50 (浅红)
  border: 1px solid danger-200
  border-left: 4px solid danger-500 (强调)
  padding: 16px
  label: "Root Cause" (text-label, danger-500, uppercase)
  status badge: [Confirmed] / [Unconfirmed]

Resolution 区块:
  background: success-50 (浅绿)
  border: 1px solid success-200
  border-left: 4px solid success-500 (强调)
  padding: 16px
  label: "Resolution" (text-label, success-500, uppercase)
  status badge: [Implemented] / [Pending]
```

---

## 六、P3 — Chat 智能交互面板

**触发方式**: Sidebar Chat 按钮 / `Ctrl+K` / 详情页 Inline Chat  
**核心组件**: ChatDrawer, ChatMessage, QuickCommandBar, FileDropZone

### 6.1 ChatDrawer 规格

```
┌──────────────────────────────────────┬───────────────────────────┐
│  Main Content (dimmed overlay)       │ Chat · INC-2025-0001 [✕] │
│  opacity: 0.4, pointer-events: none  │ ──────────────────────── │
│                                      │                           │
│                                      │ System 14:30              │
│                                      │ Incident created.         │
│                                      │ Top match: INC-2024-0002  │
│                                      │ (pool exhaustion, 18.5)   │
│                                      │                           │
│                                      │ You 14:32                  │
│                                      │ /status investigating      │
│                                      │                           │
│                                      │ System 14:32              │
│                                      │ ✓ Status updated.         │
│                                      │ v1→v2. Score 5.6→9.4     │
│                                      │                           │
│                                      │ [Quick Commands]          │
│                                      │ /status /rc /res /report  │
│                                      │ /recommend /timeline      │
│                                      │                           │
│                                      │ ┌───────────────────────┐ │
│                                      │ │ 📎 Drop files or      │ │
│                                      │ │ type a command...     │ │
│                                      │ └───────────────────────┘ │
│                                      │ [Send]                    │
└──────────────────────────────────────┴───────────────────────────┘
```

**抽屉规格**：
| 属性 | 值 |
|------|-----|
| 宽度 | 420px |
| 背景 | `white` |
| 动画 | slide-in-right, 300ms ease-out |
| 遮罩 | `rgba(0,0,0,0.2)`, 点击关闭 |
| Header | 56px, border-bottom, incident_no + close button |
| Footer | 固定底部, Quick Commands + Input Area |

### 6.2 消息气泡规格

```
系统消息 (左对齐):
┌──────────────────────────────────────┐
│ 🤖 System · 14:30                   │ ← 8px padding, max-width 85%
│                                      │
│ Incident created. Top match:         │
│ INC-2024-0002 (pool exhaust, 18.5)   │
│                                      │
│ bg: gray-50, border: gray-200        │
│ border-radius: 12px (右下直角)       │
└──────────────────────────────────────┘

用户消息 (右对齐):
                    ┌─────────────────┐
                    │ /status         │
                    │ investigating   │
                    │                 │
                    │ bg: primary-500  │
                    │ text: white      │
                    │ radius: 12px     │
                    │ (左下直角)      │
                    └─────────────────┘

文件上传 (左对齐):
┌──────────────────────────────────────┐
│ 📎 incident-log.docx (2.3KB)        │
│ bg: white, border: gray-200          │
│ border: 1px dashed gray-300         │
└──────────────────────────────────────┘

系统确认 (左对齐):
┌──────────────────────────────────────┐
│ ✓ Status updated. v1→v2.            │
│ Score: 5.6 → 9.4 (+69%)             │
│                                      │
│ bg: success-50, border: success-200  │
│ border-left: 3px solid success-500   │
└──────────────────────────────────────┘
```

### 6.3 Quick Commands 规格

```
[/status] [/rc] [/res] [/recommend] [/report] [/timeline]
```

- 水平排列, 2行, 每行3个
- 样式: `bg-gray-50, border-gray-200, text-caption`
- hover: `bg-primary-50, border-primary-200`
- 点击: 自动填入输入框 + 光标定位到参数位置

### 6.4 文件上传区域

```
┌──────────────────────────────────────────┐
│                                          │
│         📎 Drop files here               │
│     or click to browse                   │
│                                          │
│   Supports: .docx .pptx .txt .log       │
│   Max size: 10MB                         │
│                                          │
└──────────────────────────────────────────┘
```

- 虚线边框 `2px dashed gray-300`
- 拖拽时: 边框变 `primary-400` + 背景 `primary-50`
- 上传中: 进度条 (primary-500, 2px height)
- 上传完成: ✓ 图标 + 文件名 + 大小

---

## 七、P4 — Task 任务工作台

### 7.1 Incident 选择表

与 Dashboard 看板共用同一 `IncidentTable` 组件, 差异在于:
- 表格布局 (非 Kanban)
- 带 checkbox 列
- 点击行选中 + 加载该 Incident 的 Tasks

### 7.2 任务卡片详细状态

#### Pending 状态

```
┌──────────────────────────────────────────────────────┐
│ ☐  ○  T01  Check connection pool metrics             │
│         src: best-practice/timeout                   │
│                                                      │
│         [✎ Edit]  [👤 Assign]  [Accept]  [Reject]   │
└──────────────────────────────────────────────────────┘
```

#### In Progress 状态

```
┌──────────────────────────────────────────────────────┐
│ ☐  ◐  T03  Verify recent deployment diff              │
│         src: best-practice/timeout                   │
│         assigned: david.lin                           │
│                                                      │
│  ┌─ Progress Note ───────────────────────────────┐   │
│  │ Analyzing git diff between v2.4.0 and v2.4.1  │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  [✎ Edit]  [👤 Assign]  [Complete]  [Reject]        │
└──────────────────────────────────────────────────────┘
```

**设计细节**：
- In Progress 卡片左侧 `3px solid warning-500` 强调条
- Progress Note 区域: `bg-warning-50` + `border-warning-200`
- 最小高度: 48px (可手动拖拽调整)

#### Completed 状态

```
┌──────────────────────────────────────────────────────┐
│ ☐  ●  T01  Check connection pool metrics             │
│         src: best-practice/timeout                   │
│         completed by: david.lin · 14:35 UTC          │
│                                                      │
│  ┌─ Result ─────────────────────────────────────┐   │
│  │ ✓ Confirmed: HikariCP active=50/50,          │   │
│  │ pending=340. Pool exhausted at 12 req/s.     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [✎ Edit]                                          │
└──────────────────────────────────────────────────────┘
```

**设计细节**：
- Completed 卡片左侧 `3px solid success-500` 强调条
- 整体背景 `success-50/30` (30% opacity)
- Result 区域: `bg-success-50` + `border-success-200`

#### Rejected 状态

```
┌──────────────────────────────────────────────────────┐
│ ☐  ✕  T04  Assess blast radius                      │
│         src: sre-playbook/general                    │
│         rejected by: david.lin · 14:40 UTC           │
│                                                      │
│  ┌─ Reason ─────────────────────────────────────┐   │
│  │ Impact limited to payment-service only.       │   │
│  │ No cascading effect on other services.       │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [✎ Edit]  (text-strikethrough, opacity: 0.7)      │
└──────────────────────────────────────────────────────┘
```

**设计细节**：
- 整体 `opacity: 0.7`
- 标题 `text-decoration: line-through`
- Reason 区域: `bg-danger-50` + `border-danger-200`

### 7.3 Progress Bar 规格

```
┌─ Progress ─────────────────────────────────────────────┐
│                                                        │
│  INC-2025-0001 · Task Progress                          │
│                                                        │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  4/8 completed (50%)             │
│                                                        │
│  ○ pending (2)  ◐ in_progress (1)  ● done (4)  ✕ rej (1) │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- 进度条高度: 8px
- 已完成段: `success-500`
- 未完成段: `gray-100`
- 圆角: `radius-full`
- 过渡动画: `width` 500ms ease-out

### 7.4 Revision History 面板

```
┌─ Revision History ────────────────────────────────────────┐
│                                                          │
│  14:35  accepted    david.lin  T01: Check connection pool  │
│  14:38  completed   david.lin  T01: Confirmed active=50   │
│  14:40  rejected    david.lin  T04: Not applicable        │
│  14:42  modified    jane.doe   T03: Description updated    │
│  14:45  assigned    david.lin  T02: → jane.doe            │
│                                                          │
│  Showing 5 most recent entries                           │
│  [Load More]                                              │
└──────────────────────────────────────────────────────────┘
```

**表格规格**：
| 列 | 宽度 | 对齐 |
|----|------|------|
| Time | 60px | Left, monospace, `text-micro` |
| Action | 80px | Left, `text-caption`, bold, colored |
| By | 100px | Left, `text-caption` |
| Detail | Flex | Left, `text-caption`, truncate |

**Action 颜色**：
- `accepted`: `primary-500`
- `completed`: `success-500`
- `rejected`: `danger-500`
- `modified`: `gray-600`
- `assigned`: `info-500`

---

## 八、P5 — Report 报告中心

### 8.1 Report 模板布局

```
┌─ RE PORT: INC-2025-0001 ─────────────────────────────────────┐
│                                                               │
│  Version: v4  ·  Generated: 2026-07-22 14:38 UTC  ·  DRAFT   │
│                                                               │
│  ┌─ 1. Executive Summary ─────────────────────────────────┐  │
│  │ Payment service returning HTTP 504 Gateway Timeout on   │  │
│  │ /charge endpoint. P99 latency spiked from 200ms to 30s. │  │
│  │ 60% of transactions failing. Root cause identified as   │  │
│  │ N+1 connection pattern from fraud-check integration.    │  │
│  │                                                        │  │
│  │ Closest historical match: INC-2024-0002                 │  │
│  │ (PostgreSQL pool exhaustion, similarity score: 28.3)    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ 2. Current Status ────────────────────────────────────┐  │
│  │ Status: RESOLVED   Severity: P0   Error: timeout        │  │
│  │ Service: payment-service   Category: application        │  │
│  │ Version: v4  ·  Updated: 2026-07-22 14:45 UTC           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ 3. Impact Assessment ─────────────────────────────────┐  │
│  │ P0 — CRITICAL: Customer-facing payment gateway outage   │  │
│  │ 60% of /charge requests failing. Estimated revenue      │  │
│  │ impact: ~$12,000/hour (based on avg transaction volume) │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ 4. Investigation Progress ────────────────────────────┐  │
│  │ Root cause identified: N+1 connection pattern caused by │  │
│  │ fraud-check integration in critical path.               │  │
│  │ Resolution applied: Rollback + async refactor.          │  │
│  │ Connection pool recovered within 30s of rollback.       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ 5. Key Highlights ────────────────────────────────────┐  │
│  │                                                        │  │
│  │  ┌────────┐                                            │  │
│  │  │ STATUS │  RESOLVED — severity P0                    │  │
│  │  └────────┘                                            │  │
│  │  ┌───────────┐                                         │  │
│  │  │ ROOT CAUSE│  N+1 connection pattern from fraud-     │  │
│  │  └───────────┘  check integration in /charge handler    │  │
│  │  ┌────────┐                                            │  │
│  │  │ ACTION │  Rolled back deployment, moved fraud-check │  │
│  │  └────────┘  to async post-processing                   │  │
│  │  ┌───────────┐                                         │  │
│  │  │ REFERENCE │  INC-2024-0002 — PostgreSQL pool exhaust │  │
│  │  └───────────┘               (similarity: 28.3)         │  │
│  │  ┌───────────┐                                         │  │
│  │  │ REFERENCE │  INC-2024-0001 — MySQL CPU spike        │  │
│  │  └───────────┘               (similarity: 22.1)         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ 6. Recommended Next Steps ────────────────────────────┐  │
│  │ 1. Monitor HikariCP metrics for 30min post-deployment   │  │
│  │ 2. Schedule post-mortem review within 24h               │  │
│  │ 3. Update runbook: add connection pool monitoring alert │  │
│  │ 4. Review fraud-check circuit breaker implementation    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ─────────────────────────────────────────────────────────    │
│  Generated: 2026-07-22 14:38 UTC · Status: DRAFT              │
└───────────────────────────────────────────────────────────────┘
```

### 8.2 Highlights 标签规格

| Tag | 背景色 | 文字色 | 边框色 | 左强调条 |
|-----|--------|--------|--------|---------|
| STATUS | `info-50` | `info-600` | `info-200` | `info-500` (3px) |
| ROOT CAUSE | `danger-50` | `danger-600` | `danger-200` | `danger-500` (3px) |
| ACTION | `success-50` | `success-600` | `success-200` | `success-500` (3px) |
| REFERENCE | `warning-50` | `warning-600` | `warning-200` | `warning-500` (3px) |
| NEXT | `gray-100` | `gray-600` | `gray-200` | `gray-500` (3px) |

**Tag Badge 组件**：
- `display: inline-flex`
- `padding: 2px 8px`
- `border-radius: radius-sm (6px)`
- `font-size: text-micro`
- `font-weight: 600`
- `text-transform: uppercase`
- `letter-spacing: 0.5px`

### 8.3 Compare Mode 设计

```
┌── v3 (Previous) ───────────────┬── v4 (Current) ──────────────┐
│                                 │                               │
│  • [STATUS] INVESTIGATING       │  • [STATUS] RESOLVED          │
│  • [ROOT CAUSE] N+1 pattern...  │  • [ROOT CAUSE] N+1 pattern..│
│  • [REFERENCE] INC-2024-0014    │  + [ACTION] Rolled back...   │
│  ✕ old highlight (removed)     │  + [REFERENCE] INC-2024-0002 │
│                                 │                               │
│  3 highlights                   │  4 highlights (1 added)       │
│  1 removed                      │                               │
└─────────────────────────────────┴───────────────────────────────┘
```

**Diff 视觉规则**：
- Removed item: `bg-danger-50`, `border-danger-200`, `text-danger-600`, `line-through`
- Added item: `bg-success-50`, `border-success-200`, `text-success-600`, `font-bold`
- Unchanged item: `bg-gray-50`, `border-gray-100`, `text-gray-500`

---

## 九、P6 — 检索验证工具

*(参考 UI.md §8, 此处补充设计细节)*

### 9.1 检索结果卡片

```
┌─ Result #1 ─────────────────────────────────────────────────┐
│                                                              │
│  INC-2024-0002                          Relevance: ████████░ │
│  PostgreSQL connection pool exhausted          Score: 28.3   │
│                                                              │
│  Root Cause: New deployment introduced N+1 queries in        │
│  product-listing endpoint. Each page view spawned 200+       │
│  individual queries instead of 1 JOIN.                      │
│                                                              │
│  Resolution: 1. Rolled back deployment. 2. Rewrote query    │
│  with JOIN. 3. Added pgbouncer.                             │
│                                                              │
│  Similarity Reason: Root cause highly aligned                │
│                                                              │
│  [View Full Incident →]                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 十、P7 — 生命周期回放

*(参考 UI.md §9, 此处补充分数趋势图设计细节)*

### 10.1 分数趋势图规格

```
Score Trend
  │
20 ┤                                             ● 18.3
   │
15 ┤                          ● 17.3
   │                          │
10 ┤            ● 9.4         │
   │            │             │
 5 ┤  ● 5.6     │             │
   │  │         │             │
 0 ┼──┴─────────┴─────────────┴────────────────────────
      T+0       T+10         T+45          T+90
      open      investigating investigating   resolved
```

**图表规格**：
- 高度: 120px
- 折线: `primary-500`, 2px solid
- 数据点: 8px 直径, `primary-500` fill, white border 2px
- 填充: `primary-500` → transparent 渐变 (opacity 0.1 → 0)
- X轴: 时间标签 (`text-micro`, `gray-400`)
- Y轴: 0-25 范围, 不显示轴线
- Tooltip: hover 时显示精确分数 + Stage 信息

---

## 十一、通用组件详规

### 11.1 Button 按钮体系

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | `primary-500` | white | — | `primary-600` |
| Secondary | white | `gray-700` | `gray-200` | `gray-50` bg |
| Danger | `danger-500` | white | — | `danger-600` |
| Success | `success-500` | white | — | `success-600` |
| Ghost | transparent | `gray-500` | — | `gray-50` bg |
| Link | transparent | `primary-500` | — | underline |

**尺寸**：
| Size | Height | Padding X | Font | Radius |
|------|--------|-----------|------|--------|
| xs | 28px | 8px | `text-micro` | `radius-sm` |
| sm | 32px | 12px | `text-caption` | `radius-sm` |
| md | 36px | 16px | `text-caption` | `radius-md` |
| lg | 44px | 20px | `text-body-sm` | `radius-md` |

**状态**：
- Default, Hover, Active, Focus (ring-2 primary-200), Disabled (opacity 0.4), Loading (spinner + disabled)

### 11.2 Input 输入框

```
┌─ Label (text-label, gray-600) ──────────────────────────────┐
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🔍  Search incidents...                          [✕]    ││
│  └──────────────────────────────────────────────────────────┘│
│  Helper text (text-micro, gray-400)                          │
│  Error message (text-micro, danger-500)                      │
└──────────────────────────────────────────────────────────────┘
```

**规格**：
- 高度: 36px (md)
- 边框: `1px solid gray-200`
- 圆角: `radius-md`
- Padding: 8px 12px
- Focus: `border-primary-400`, `ring-2 ring-primary-100`
- Error: `border-danger-400`, `ring-2 ring-danger-100`
- Disabled: `bg-gray-50`, `text-gray-400`

### 11.3 Select 下拉

```
┌──────────────────────┐
│ Severity: P1 — High ▾│
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│ P0 — Critical        │
│ P1 — High         ◀  │ ← selected
│ P2 — Medium          │
│ P3 — Low             │
└──────────────────────┘
```

### 11.4 Modal 模态框

**规格**：
- 最大宽度: 480px (sm), 640px (md), 800px (lg)
- 背景: white
- 圆角: `radius-xl`
- 阴影: `shadow-lg`
- Header: 56px, border-bottom, Title + Close button
- Body: padding 24px
- Footer: padding 16px, border-top, 按钮右对齐
- 遮罩: `rgba(0,0,0,0.4)`, 点击关闭
- 动画: fade-in 200ms + scale(0.95→1)
- Focus trap: Tab 在 Modal 内循环

### 11.5 Toast 通知

```
┌──────────────────────────────────────────┐
│ ✓  Incident INC-2025-0001 created        │
│   3 similar incidents found.     [View]   │
└──────────────────────────────────────────┘
```

| Type | 图标 | 背景 | 边框 | 持续时间 |
|------|------|------|------|---------|
| Success | ✓ | `success-50` | `success-200` | 5s |
| Error | ✕ | `danger-50` | `danger-200` | 10s (需手动关闭) |
| Warning | ⚠ | `warning-50` | `warning-200` | 8s |
| Info | ℹ | `info-50` | `info-200` | 5s |

**位置**: 右上角, `top: 16px, right: 16px`, 堆叠间距 8px

### 11.6 Skeleton Loading

```
┌──────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░  (title)       │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░      (subtitle)    │
│                                      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (body)  │
└──────────────────────────────────────┘
```

- 颜色: `gray-100` → `gray-200` (shimmer animation)
- 圆角: `radius-sm`
- 动画: `shimmer` 1.5s infinite

---

## 十二、状态与反馈系统

### 12.1 页面级状态

| 状态 | 视觉 | 时机 |
|------|------|------|
| **Loading** | Skeleton / Spinner | 首次加载 / 数据请求中 |
| **Empty** | 插图 + 提示文字 + CTA | 无数据 |
| **Error** | 错误卡片 + 重试按钮 | 请求失败 |
| **Success** | Toast 通知 | 操作成功 |
| **Partial** | 部分内容 + 降级提示 | 部分数据加载失败 |

### 12.2 操作确认弹窗

危险操作 (Delete, Reject, Publish) 必须二次确认：

```
┌─ Confirm Action ──────────────────────────────────┐
│                                                   │
│  ⚠  Are you sure you want to publish this report? │
│                                                   │
│  This action will make the report visible to all   │
│  stakeholders and cannot be easily undone.        │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ Reason for publication (optional):            │ │
│  │ Confirmed RC with DB team. Escalating to VP. │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│              [Cancel]    [Publish Report]          │
└───────────────────────────────────────────────────┘
```

---

## 十三、可访问性规范 (WCAG 2.1 AA)

### 13.1 色彩对比度

| 元素 | 要求 | 验证方法 |
|------|------|---------|
| 正文 vs 背景 | ≥ 4.5:1 | `gray-700 (#3C414A)` on `white (#FFF)` = 8.6:1 ✅ |
| 大文字 (≥18px bold) vs 背景 | ≥ 3:1 | — |
| 链接 vs 正文 | ≥ 3:1 + 下划线区分 | `primary-500` vs `gray-700` = 4.1:1 ✅ |
| Focus 指示器 | ≥ 3:1 vs 相邻色 | `primary-400` ring on white ✅ |

### 13.2 键盘导航

| 操作 | 快捷键 |
|------|--------|
| Tab | 下一个可聚焦元素 |
| Shift+Tab | 上一个可聚焦元素 |
| Enter/Space | 激活当前元素 |
| Escape | 关闭 Modal/Drawer/Dropdown |
| Arrow Keys | 在列表/菜单中导航 |
| Ctrl+K | 打开 Chat (全局) |

### 13.3 屏幕阅读器

- 所有图标必须有 `aria-label`
- 动态内容更新使用 `aria-live="polite"`
- Modal 打开时 focus trap + `aria-modal="true"`
- 表单错误使用 `aria-describedby` 关联错误消息
- 数据表格使用 `<thead>`, `<tbody>`, `scope="col"` 语义化标签

### 13.4 字体缩放

- 支持浏览器 200% 缩放不失布局
- 使用 `rem` 单位 (root: 16px)
- 最小触摸目标: 44×44px (移动端)

---

## 十四、页面流转与导航

### 14.1 用户旅程图

```
[Dashboard] ──click card──→ [Incident Detail]
     │                            │
     │                            ├─ timeline nodes (expand/collapse)
     │                            ├─ Chat (inline / Ctrl+K)
     │                            └─ ← Back to Board
     │
     ├─ sidebar ──→ [Retrieve] ──run──→ results ──click──→ [Incident Detail]
     │
     ├─ sidebar ──→ [Lifecycle] ──run──→ timeline
     │
     ├─ sidebar ──→ [Reports] ──select──→ [Generate] [Compare] [Revise] [Publish]
     │
     ├─ sidebar ──→ [Tasks] ──select──→ Accept/Reject/Complete/Edit
     │
     └─ sidebar / K ──→ [Chat Drawer] ──/status /rc /res /recommend /report
```

### 14.2 路由表

| 路由 | 页面 | 权限 |
|------|------|------|
| `/` | Dashboard | IM, SRE |
| `/incident/[id]` | Incident 详情 | IM, SRE |
| `/retrieve` | E2E 检索 | IM, SRE |
| `/lifecycle` | 生命周期演示 | IM, SRE |
| `/reports` | 报告管理 | IM (发布), SRE (查看) |
| `/tasks` | 任务工作台 | IM, SRE |
| `/chat` | Chat 页面 | IM, SRE |

---

## 十五、附录：设计检查清单

### 实现前检查

- [ ] Design Token 已定义为 CSS 变量
- [ ] 色彩对比度 ≥ 4.5:1 (全部组合验证)
- [ ] 字体栈已确认 (Inter + system fallback)
- [ ] 响应式断点已定义 (sm/md/lg/xl)
- [ ] 所有交互状态已设计 (default/hover/active/focus/disabled/loading)
- [ ] Focus 指示器全局可见
- [ ] 键盘导航路径完整

### 页面级检查

- [ ] Dashboard: Kanban 列可独立滚动
- [ ] Dashboard: 卡片拖拽排序 (optional)
- [ ] Incident: 时间线展开/折叠动画流畅
- [ ] Incident: RC/Resolution 区块独立
- [ ] Chat: 消息自动滚动到底部
- [ ] Chat: 文件拖拽区域视觉反馈
- [ ] Tasks: 进度条过渡动画
- [ ] Tasks: 修订历史分页加载
- [ ] Reports: Compare diff 清晰可辨
- [ ] Reports: Print 样式隐藏导航

### 银行合规检查

- [ ] 无倒计时/高压视觉元素
- [ ] 数据脱敏规则已应用
- [ ] 操作确认弹窗已实现
- [ ] 审计日志字段完整 (who, when, what, old_value, new_value)
- [ ] 会话超时锁定机制
- [ ] 错误消息不含敏感信息 (stack traces, internal paths)

---

> **文档状态**: ✅ 已完成  
> **下次审查**: Sprint Review 前
