# IMT PoC — 优化变更方案 (Revised Plan v2)

> 状态：已确认 | 日期：2026-07-22  
> 范围：完整 PoC Demo，所有变更将在本次迭代中完成

---

## 一、变更总览

| # | 变更项 | 类型 | 优先级 | 涉及文件 |
|---|--------|------|--------|---------|
| 1 | 界面风格全局切换为浅色调 | 视觉 | P0 | globals.css + 7 pages |
| 2 | 创建 Incident：手动录入 + xMatter 自动接入 | 功能 | P0 | page.tsx, api_server.py |
| 3 | Report：Draft → Review → Publish | 流程 | P0 | reports/page.tsx, leader_reports 表 |
| 4 | Tasks：Accept/Reject/Complete + 全面修订 | 流程 | P0 | tasks/page.tsx, recommended_tasks 表 |
| 5 | Chat：多格式输入 + 抽屉式面板 | 功能 | P1 | ChatDrawer.tsx, api_server.py |
| 6 | 时间线：横向分层 + 交互式事件展示 | 视觉 | P1 | TimelineH.tsx, incident/[id]/page.tsx |
| 7 | Demo 演示流程（手动点击操作 6-8 分钟） | 文档 | P1 | guide.md |

---

## 二、详细变更方案

### 2.1 界面风格全局切换为浅色调

**现状**：`bg-gray-950` 暗色主题。

**目标**：专业浅色调企业级 UI，参考 Linear.app 风格。

**色彩系统**：

```css
/* 背景 */
--bg-page:       #F5F6F8;    /* 页面底色 */
--bg-card:       #FFFFFF;    /* 卡片背景 */
--bg-sidebar:    #F0F1F3;    /* 侧边栏 */

/* 文字 */
--text-primary:  #1A1A2E;    /* 主要文字 */
--text-secondary:#6B7280;    /* 次要文字 */
--text-muted:    #9CA3AF;    /* 禁用/占位 */

/* 品牌色 */
--brand:         #5E6AD2;    /* 主色调 (紫蓝) */
--brand-hover:   #4F5BC0;

/* 功能色 */
--success:       #0EA366;    /* 完成/Resolved */
--warning:       #F59E0B;    /* 进行中/Investigating */
--danger:        #E5484D;    /* 严重/P0 */
--info:          #0091FF;    /* 信息/Mitigated */

/* 边框 */
--border:        #E5E7EB;    /* 默认边框 */
--border-hover:  #D1D5DB;    /* 悬停边框 */
```

**卡片规范**：

```css
.card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  transition: box-shadow 0.15s, border-color 0.15s;
}
.card:hover {
  border-color: #D1D5DB;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
```

**Kanban 列头**：

```
┌─ Open ──────┐ ┌─ Investigating ─┐ ┌─ Mitigated ─┐ ┌─ Resolved ────┐
│ ○  2        │ │ ◐  4            │ │ ◑  1        │ │ ●  42         │
│──────────── │ │────────────────│ │─────────────│ │───────────────│
│ [card]      │ │ [card]         │ │ [card]      │ │ [card]        │
└─────────────┘ └────────────────┘ └─────────────┘ └───────────────┘
```

---

### 2.2 创建 Incident：手动录入 + 自动接入

#### 入口 A：手动创建

**触发**：Dashboard 页面顶部 `[+ New Incident]` 按钮。

**交互流程**：

```
点击 [+ New Incident]
  → 弹窗表单（Modal, 480px 宽）
  → 填写字段
  → 提交 → API 调用 → 自动 embed + retrieve
  → 弹窗关闭 → 新卡片出现在 OPEN 列顶部
  → 卡片带 2 秒高亮动画（黄色边框 pulse）
```

**表单设计**：

```
┌─ New Incident ──────────────────────────[✕]─┐
│                                              │
│  Title *                                     │
│  ┌──────────────────────────────────────────┐│
│  │ Payment service P99 latency > 2s         ││
│  └──────────────────────────────────────────┘│
│                                              │
│  Description *                               │
│  ┌──────────────────────────────────────────┐│
│  │ Alert triggered on payment-03 node.      ││
│  │ P99 latency jumped from 200ms to 2.8s.   ││
│  │ 60% of /charge requests failing.         ││
│  └──────────────────────────────────────────┘│
│                                              │
│  Severity *     Service *                    │
│  ┌──────────┐  ┌──────────────────────────┐ │
│  │ P1  ▾   │  │ payment-service           │ │
│  └──────────┘  └──────────────────────────┘ │
│                                              │
│  Category       Error Type                   │
│  ┌──────────┐  ┌──────────────────────────┐ │
│  │ database▾│  │ timeout             ▾    │ │
│  └──────────┘  └──────────────────────────┘ │
│                                              │
│  Source                                       │
│  ● Manual Entry    ○ xMatter Alert           │
│                                              │
│         [Cancel]           [Create]          │
└──────────────────────────────────────────────┘
```

**选择 "xMatter Alert" 时** → 额外展示 xMatter payload 粘贴区

#### 入口 B：xMatter 自动接入

**接收方式**：

```
POST /api/alerts/xmatter

Request Body (xMatter format):
{
  "alertId": "XM-2025-0892",
  "title": "Payment Service P99 Latency > 2s",
  "description": "Alert triggered on host payment-03 at 14:32 UTC. P99 latency 2.8s (threshold 500ms).",
  "severity": "critical",           // maps to P0
  "affectedService": "payment-service",
  "tags": ["latency", "timeout"],
  "rawPayload": { ... }
}

Server-side processing:
  1. Map xMatter severity → P0/P1/P2/P3
  2. Extract error_type from tags or description keywords
  3. Infer category from affectedService prefix
  4. Create incident_tickets record
  5. Generate embedding_description
  6. Auto-run retrieve() → get top-5 similar
  7. Return: { incident_no, top5_similar, summary }

Response:
{
  "incident_no": "INC-2025-0007",
  "source": "xmatter",
  "alert_id": "XM-2025-0892",
  "top5_similar": [
    {"incident_no": "INC-2024-0002", "title": "...", "score": 18.5},
    ...
  ],
  "summary": "Found 3 similar timeout cases in payment-service"
}
```

**Dashboard 来源标签**：

```
┌──────────────────────────────────┐
│ INC-2025-0007           [P1]    │
│ Payment Service P99 > 2s        │
│ payment-service · db · v1       │
│ 🤖 xMatter · XM-2025-0892      │  ← 来源行
└──────────────────────────────────┘
```

---

### 2.3 Report：Draft → Review → Publish 完整流程

#### 设计原则

1. Report 按固定 6-section 模板生成
2. 生成后状态为 **Draft**，对干系人不可见
3. 工程师审阅、编辑后 **Publish**，干系人可见
4. 每次 Publish 对应一个版本快照（存入 `leader_reports`）
5. 编辑历史可追溯

#### 模板结构（不可变）

```
=======================================================================
                 INCIDENT LEADERSHIP REPORT
=======================================================================
Incident  : {incident_no}
Title     : {title}
Service   : {service_name}
Category  : {category}
Severity  : {severity}      Status: {status}
Updated   : {updated_at}    Report v{version}
=======================================================================

## 1. Executive Summary
(可编辑)
{summary_text}

## 2. Current Status
(自动填充，不可编辑)
Status: {status} | Severity: {severity}
Error Type: {error_type} | Affected Service: {service_name}

## 3. Impact Assessment
(自动填充，不可编辑)
{severity_description}

## 4. Investigation Progress
(自动填充，不可编辑)
{root_cause / resolution / progress}

## 5. Key Highlights (3-5 items)
(每项可增删改)
1. [STATUS] {current_status}
2. [ROOT CAUSE] {root_cause_summary}
3. [ACTION] {resolution_summary}
4. [REFERENCE] {similar_ticket_1}
5. [NEXT] {next_action}

## 6. Recommended Next Steps
(可编辑)
{next_steps_text}

=======================================================================
Generated: {timestamp}    Status: {draft/published}
=======================================================================
```

#### Draft → Review → Publish 流程

```
┌──────────────────────────────────────────────────────────────────┐
│ ① AUTOMATIC DRAFT                                                │
│    update_ticket_status() triggers                               │
│    → generate_leader_report() → status=draft                     │
│    → INSERT INTO leader_reports (status='draft')                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ ② REVIEW                                                         │
│    Engineer opens /reports page, sees [DRAFT] badge               │
│    Actions:                                                       │
│      ✓ Review highlights — add/edit/delete individual items       │
│      ✓ Edit Executive Summary (inline textarea)                   │
│      ✓ Edit Next Steps (inline textarea)                          │
│      ✓ Add Review Notes (engineer comments, not in final report)  │
│      ✓ Save Draft (stays draft, can return later)                 │
│      ✓ Publish (status → published)                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ ③ PUBLISHED                                                      │
│    Status: published → stakeholder-visible                        │
│    Published reports appear in report history                     │
│    New draft can be generated on next update                      │
│    (previous published version preserved as immutable snapshot)  │
└──────────────────────────────────────────────────────────────────┘
```

#### 数据库 Schema 变更

```sql
-- 新增字段到 leader_reports
ALTER TABLE leader_reports ADD COLUMN report_status VARCHAR(16) DEFAULT 'draft';
-- report_status: 'draft', 'published', 'archived'

ALTER TABLE leader_reports ADD COLUMN reviewed_by VARCHAR(64);
ALTER TABLE leader_reports ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE leader_reports ADD COLUMN review_notes TEXT;
ALTER TABLE leader_reports ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE leader_reports ADD COLUMN published_by VARCHAR(64);

-- highlights 改为可单独修订（存在 JSON 中，已有 TEXT[] 列支持）
-- 新增 revised_highlights 标记哪些被人工修改过
ALTER TABLE leader_reports ADD COLUMN revised_fields TEXT[] DEFAULT '{}';
```

#### 界面设计

```
┌─ Report: INC-2025-0001 ────────────────────[v3] [DRAFT]──┐
│                                                           │
│  Template Sections                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 1. Executive Summary              [Edit ✎]          │  │
│  │ ┌─────────────────────────────────────────────────┐ │  │
│  │ │ Payment service returning HTTP 504 errors on    │ │  │
│  │ │ /charge endpoint. P99 latency spiked to 30s.    │ │  │
│  │ │ Closest match: INC-2024-0002 (score=22)         │ │  │
│  │ └─────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 5. Key Highlights (3-5)          [+ Add]            │  │
│  │ ┌───────────────────────────────────────────────┐   │  │
│  │ │ 1. [STATUS] INVESTIGATING — severity P0  [✕] │   │  │
│  │ │ 2. [ROOT CAUSE] N+1 connection pattern.. [✕] │   │  │
│  │ │ 3. [REFERENCE] INC-2024-0002            [✕] │   │  │
│  │ │ 4. [NEXT] Continue investigation        [✕] │   │  │
│  │ └───────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Review Notes (internal, not in final report)        │  │
│  │ ┌─────────────────────────────────────────────────┐ │  │
│  │ │ Confirmed RC with DB team. Escalating to VP Eng. │ │  │
│  │ └─────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  [Save Draft]    [Publish Report]    [Discard]            │
└───────────────────────────────────────────────────────────┘
```

**交互规则**：
- Draft 报告：按钮组显示 `[Save Draft] [Publish Report] [Discard]`
- Published 报告：按钮组显示 `[Download] [Share Link] [Archive]`
- 再次更新 ticket 后：旧的 published 报告保持不变，新报告以 draft 状态生成
- Report History 视图：左侧列表标注 draft/published 状态图标


### 2.4 Tasks：Accept/Reject/Complete + 人工修订

#### 设计原则

1. Tasks 自动生成时全部 `pending`
2. 工程师可对每条 task 进行以下操作：
   - **Accept** → status = `in_progress`，可添加备注、指派负责人
   - **Complete** → status = `completed`，必须添加 evidence/result
   - **Reject** → status = `rejected`，必须添加拒绝原因
3. 工程师可以**修订 task 的标题和内容**（`description` 字段可编辑）
4. 工程师可以**新增自定义 task**（`source = manual`）
5. 整体进度以 Progress Bar 可视化

#### 状态机

```
                    ┌──────────────┐
                    │   pending    │
                    └──┬───┬───┬──┘
            Accept     │   │   │   Reject
              ↓        │   │   │      ↓
        ┌──────────┐   │   │   │  ┌──────────┐
        │in_progress│   │   │   │  │ rejected │
        └─────┬─────┘   │   │   │  └──────────┘
              │          │   │   │
           Complete  Reject │   │
              ↓        ↓    │   │
        ┌──────────┐ ┌──────┴───┴──────────┐
        │ completed│ │     rejected         │
        └──────────┘ └─────────────────────┘

        所有状态都可以回到 pending（取消之前的操作）
```

#### 修订能力

| 字段 | pending | in_progress | completed | rejected |
|------|---------|-------------|-----------|----------|
| `description` (标题/内容) | ✎ 可编辑 | ✎ 可编辑 | ✎ 可编辑 | ✎ 可编辑 |
| `status` | → Accept / Reject | → Complete / Reject | — | — |
| `revision_note` | 不可见 | 添加证据/进展 | 强制填结果 | 强制填原因 |
| `revised_by` | — | 自动记录 | 自动记录 | 自动记录 |
| `source` | 只读 | 只读 | 只读 | 只读 |

#### 新增自定义 Task

```
点击 [+ Add Task]
  → 内联表单出现在任务列表底部
  → 输入 description
  → source 自动设为 "manual"
  → 点击 Save → task_order 自动分配（当前最大 +1）
  → 新 task 出现在列表中（pending 状态）
```

#### 界面设计

```
┌─ Task Board: INC-2025-0001 ─────────────────────────────────┐
│ Progress  ████████░░░░░░░░  4/8 completed  (50%)            │
│ Filter: [All] [Pending: 2] [In Progress: 1] [Completed: 4]  │
│         [Rejected: 1]                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ● T01  Check connection pool metrics                        │
│   source: best-practice/timeout                             │
│   ┌─ Result ────────────────────────────────────────────┐   │
│   │ Confirmed: HikariCP active=50/50, pending=340       │   │
│   │ Pool exhausted at 12 req/s.                         │   │
│   └──────────────────────────────────────────────────────┘   │
│   completed by david.lin · 14:32 UTC                        │
│                                                             │
│ ○ T02  Review slow query / request logs            [✎ Edit] │
│   source: best-practice/timeout                             │
│   status: pending                                           │
│   [Accept]  [Reject]                                        │
│                                                             │
│ ◐ T03  Verify recent deployment diff                        │
│   source: best-practice/timeout                             │
│   assigned: david.lin                                       │
│   ┌─ Progress Note ─────────────────────────────────────┐   │
│   │ Analyzing git diff between v2.4.0 and v2.4.1...     │   │
│   └──────────────────────────────────────────────────────┘   │
│   [Mark Complete]  [Reject]                                 │
│                                                             │
│ ✕ T04  Assess blast radius                                  │
│   source: sre-playbook/general                              │
│   ┌─ Rejection Reason ──────────────────────────────────┐   │
│   │ Impact limited to payment-service only.              │   │
│   │ No cascading effect on other services.              │   │
│   └──────────────────────────────────────────────────────┘   │
│   rejected by david.lin · 14:35 UTC                         │
│                                                             │
│ [+ Add Custom Task]                                         │
└─────────────────────────────────────────────────────────────┘
```

#### 数据库 Schema 变更

```sql
-- recommended_tasks 表已有字段：id, incident_no, ticket_version, task_order,
--   description, source, status, revised_by, revision_note, created_at, updated_at

-- 无需新增列，现有 schema 已支持全部修订需求。
-- status 的 CHECK 约束已支持：pending, in_progress, completed, rejected
-- description 和 revision_note 可直接 UPDATE
```


### 2.5 Chat：多格式输入 + 抽屉式面板

#### 设计原则

1. Chat 作为全局抽屉面板（右侧滑出），任何页面按 `Ctrl+K` 或点击 💬 触发
2. 支持多种输入格式：纯文本、Markdown 表格、Word/PPT 文件上传
3. 上下文自动关联当前正在浏览的 incident
4. 文件上传后自动解析关键信息并更新 incident

#### 多格式输入支持

| 格式 | 输入方式 | 解析逻辑 |
|------|---------|---------|
| 纯文本 | 直接输入 | 现有 Chat 命令解析 |
| Markdown 表格 | 粘贴 / 直接输入 | 识别 `\|` 分隔的表格行 → 解析为结构化数据 → 追加到 description |
| .docx (Word) | 拖拽 / 点击上传 | 后端读取 → 提取纯文本 → 追加到 description |
| .pptx (PPT) | 拖拽 / 点击上传 | 后端读取 → 提取所有幻灯片文本 → 追加到 description |
| .txt / .log | 拖拽 / 点击上传 | 后台读取 → 追加到 description |
| 图片 (.png/.jpg) | 拖拽 / 点击上传 | 提取文件名 + 上传时间 → 作为 attachment 记录 |

**文件处理流程**：

```
用户拖拽 / 粘贴文件到 Chat
  ↓
判断文件类型
  ├── .docx → python-docx 提取文本
  ├── .pptx → python-pptx 提取文本
  ├── .txt/.log → 直接读取
  └── image → 记录 attachment 元数据
  ↓
将提取的文本追加到 incident_tickets.description
  → 同时追加来源标注： "[via file upload: filename.docx, 14:32 UTC]"
  ↓
触发 update_ticket_status
  → re-embed → re-retrieve → 刷新 Chat 上下文
  ↓
Chat 回复： "✓ Parsed filename.docx (2.3KB). Added 156 words to incident description. 
   Retrieval quality improved: avg score 5.6 → 9.4"
```

#### 界面设计

```
┌──────────────────────────────────────┬─────────────────────────────┐
│  当前页面内容（半透明遮罩）          │  Chat Drawer (420px)         │
│                                      │  ┌─────────────────────────┐ │
│                                      │  │ INC-2025-0001    [✕]    │ │
│                                      │  │ payment-service · P0    │ │
│                                      │  ├─────────────────────────┤ │
│                                      │  │                         │ │
│                                      │  │ System: Incident created│ │
│                                      │  │ Found 3 similar cases.  │ │
│                                      │  │                         │ │
│                                      │  │ User: (pasted table)    │ │
│                                      │  │ | Metric  | Value  |    │ │
│                                      │  │ | P99     | 2.8s   |    │ │
│                                      │  │ | Error%  | 60%    |    │ │
│                                      │  │                         │ │
│                                      │  │ System: ✓ Parsed table. │ │
│                                      │  │ 2 metrics added.        │ │
│                                      │  │                         │ │
│                                      │  │ User: (uploaded file)   │ │
│                                      │  │ 📎 incident-log.docx    │ │
│                                      │  │                         │ │
│                                      │  │ System: ✓ File parsed.  │ │
│                                      │  │ 156 words added. Score: │ │
│                                      │  │ 5.6 → 9.4               │ │
│                                      │  ├─────────────────────────┤ │
│                                      │  │ [status inv.] [rc:...]  │ │
│                                      │  │ [recommend] [report]    │ │
│                                      │  │                         │ │
│                                      │  │ ┌─────────────────────┐ │ │
│                                      │  │ │ 📎 Drop files here  │ │ │
│                                      │  │ │ or type a command...│ │ │
│                                      │  │ └─────────────────────┘ │ │
│                                      │  │              [Send ▸]   │ │
│                                      │  └─────────────────────────┘ │
└──────────────────────────────────────┴─────────────────────────────┘
```

#### 快速命令 (`/` 前缀)

| 命令 | 作用 | 示例 |
|------|------|------|
| `/status <new>` | 更新状态 | `/status investigating` |
| `/rc <text>` | 添加 Root Cause | `/rc N+1 connection pattern` |
| `/res <text>` | 添加 Resolution | `/res Rolled back deployment` |
| `/recommend` | 查看推荐 Tasks | |
| `/report` | 生成 Report draft | |
| `/timeline` | 查看时间线摘要 | |

#### 技术实现要点

```
文件上传：
  POST /api/chat/upload
  Body: multipart/form-data { file, incident_no }
  Response: { parsed_text, word_count, score_change }

文件解析依赖（新增到 backend/requirements.txt）：
  python-docx (for .docx)
  python-pptx (for .pptx)
```

---

### 2.6 时间线：横向分层 + 交互式事件展示

#### 设计原则

1. Incident 详情页使用**横向时间轴**，顶部时间条串联事件
2. 分层展示不同优先级的事件：
   - **Layer 1**：状态流转（彩色条）
   - **Layer 2**：关键事件卡片（创建 / 更新 / 根因 / 解决）
   - **Layer 3**：派生事件（Report 生成 / Tasks 生成 / Chat 更新）
3. 点击事件节点弹出详情面板
4. 支持时间范围缩放（缺省显示全部，可拖拽聚焦某时间段）

#### 布局

```
INC-2025-0001 — Event Timeline
═══════════════════════════════════════════════════════════════════

Layer 1 — Status Flow
  ●────────────◐─────────────◐─────────────●──────────────▶
  Open       Investigating  Investigating  Resolved

Layer 2 — Key Events
         ┌──────────┐       ┌──────────────┐       ┌──────────┐
  T+0   │ Created  │ T+10  │ Enriched     │ T+90  │ Resolved │
        │ P0 65ch  │       │ +271ch desc  │       │ fix app. │
        │ no RC    │       │ status→inv   │       │ stat→res │
         └──────────┘       └──────────────┘       └──────────┘
              │                    │                     │
              ▼                    ▼                     ▼
Layer 3 — Derived Events
         ┌──────────┐       ┌──────────────┐       ┌──────────┐
         │ Report   │ T+10  │ Report       │ T+90  │ Report   │
         │ not gen. │       │ v2 (draft)   │       │ v4 (pub) │
         │ Tasks    │       │ 7 Tasks      │       │ 8 Tasks  │
         │ not gen. │       │ generated    │       │ 4 done   │
         └──────────┘       └──────────────┘       └──────────┘

  [◀ Zoom In]  [Zoom Out ▶]  [Fit All]
```

#### 事件详情弹窗

点击 Layer 2 或 Layer 3 的事件卡片 → 弹窗：

```
┌─ Event Details ───────────────────────[✕]─┐
│                                            │
│  T+10min — Triage Complete (Enriched)      │
│  2026-07-22 14:42 UTC                      │
│  ───────────────────────────────────       │
│                                            │
│  Description Change:                        │
│  + Payment service returning HTTP 504...   │
│  + Thread dump: 200 threads blocked...     │
│  + Connection pool max=50, active=50...    │
│                                            │
│  Status: open → investigating              │
│  Version: v1 → v2                          │
│                                            │
│  Effects:                                  │
│  ✓ Re-embedded description (384d)         │
│  ✓ Rerank score: 5.6 → 9.4 (+69%)        │
│  ✓ Report v2 generated (draft)            │
│  ✓ 7 Tasks generated (pending)            │
│                                            │
│         [View Full Incident]               │
└────────────────────────────────────────────┘
```

#### 时间范围控制

```
┌─────────────────────────────────────────────────────────┐
│  ◀──[══════════════●══════════════]──▶                  │
│  T+0          T+10    T+45    T+90                      │
│                                                        │
│  Drag handles to focus time range                      │
│  [Reset] [Fit All]                                      │
└─────────────────────────────────────────────────────────┘
```

---

### 2.7 Demo 演示流程（手动操作，6-8 分钟）

#### 场景设定

> INC-2025-0001：Payment Service 在 14:32 UTC 触发 P99 延迟告警。  
> 系统已有 49 条历史 incident 数据。  
> 演示角色：SRE 工程师 David，处理此 incident。

#### Step 1 — Dashboard 看板总览 (1 min)

```
操作：
  1. 打开 http://localhost:3000
  2. 看板展示：4 列 Kanban, 49 tickets
  3. Filter: severity=P0 → 展示 Critical tickets only
  4. Clear filter → 回到全量视图

讲解：
  "这是 Incident Board。49 条历史 incident 按 status 分列。
   每条包含 ticket 编号、严重度、标题、服务、类别。
   点击任意卡片可查看详细信息和事件时间线。"
```

#### Step 2 — 创建新 Incident (1 min)

```
操作：
  1. 点击 [+ New Incident] → 弹窗
  2. Title: "Payment service P99 latency spike"
  3. Description: "P99 latency 2.8s on /charge, 60% errors"
  4. Severity: P1, Service: payment-service
  5. Category: application, Error: timeout
  6. 点击 Create

结果：
  - 新卡片 INC-2025-0001 出现在 OPEN 列顶部（黄色高亮动画）
  - 系统自动运行检索，Top-5 相似案例出现在卡片下方

讲解：
  "创建 ticket 后系统自动 embed 描述、检索历史案例。
  工程师无需手动去 Retrieve 页面重复输入。"
```

#### Step 3 — 通过 Chat 追加事件信息 (1.5 min)

```
操作：
  1. 点击 💬 → Chat 抽屉滑出（自动关联 INC-2025-0001）
  2. 粘贴 Markdown 表格：
     | Metric  | Value  |
     | P99 Lat | 2.8s   |
     | Error%  | 60%    |
     | CPU     | 45%    |
  3. 系统回复："✓ Parsed table. 3 metrics added. Score 5.6→8.2"
  4. 输入：/status investigating
  5. 看板中卡片从 OPEN 列 → INVESTIGATING 列（实时移动）
  6. 输入：/rc N+1 connection pattern in /charge handler
  7. 拖拽文件：incident-log.docx → Chat
  8. 系统回复："✓ File parsed. 156 words added. Score 8.2→13.1"

讲解：
  "Chat 支持多种输入：文本命令、表格粘贴、文件上传。
   每次输入自动更新 ticket 并刷新检索结果。
   Word 文档中的 log 信息被自动提取追加到描述中。
   抽屉面板可以随时关闭，不影响当前页面的操作。"
```

#### Step 4 — Report 审阅与发布 (1.5 min)

```
操作：
  1. 切换到 /reports 页面
  2. 选择 INC-2025-0001
  3. 最新 Report 显示 [DRAFT] 标签
  4. 点击 [Review & Publish]
  5. 编辑 Executive Summary — 添加："Impact: 60% of /charge requests failing"
  6. 编辑 Highlights — 删除一条弱相关 REFERENCE，添加新 Highlight
  7. 添加 Review Notes："Confirmed RC with DB team"
  8. 点击 [Publish]
  9. [DRAFT] 变为 [PUBLISHED]

讲解：
  "Report 按照固定 6-section 模板生成。
   发布前工程师可以编辑摘要、增减 highlights、添加内部备注。
   发布后对干系人可见，同时保留历史版本供对比。"
```

#### Step 5 — Tasks 验收与修订 (1.5 min)

```
操作：
  1. 切换到 /tasks 页面
  2. Progress bar: ░░░░░░░░░░░░░░░░░░░░ 0/8 (0%)
  3. T01: 点击 [Accept] → status = in_progress
     添加 note: "Checking HikariCP metrics..."
  4. T01: 点击 [Mark Complete]
     添加 result: "Confirmed: active=50/50, pending=340"
  5. T02: 点击 [Accept]
     点击 [✎ Edit] → 修改标题为 "Review slow query log AND deployment diff"
     点击 [Mark Complete] → "Found v2.4.1 added fraud-check call"
  6. T04: 点击 [Reject]
     添加原因: "Impact limited to payment-service only"
  7. [+ Add Custom Task] → "Notify VP Engineering"
  8. Progress: ██████████░░░░░░░░░░ 4/9 (44%)

讲解：
  "Tasks 可以接受、完成、拒绝、修改标题内容、或新增自定义 task。
   每个操作都有原因/结果记录，进度条实时更新。
   这展示了人机协作的 incident 处理流程。"
```

#### Step 6 — 闭环：返回看板 + 查看时间线 (1 min)

```
操作：
  1. 点击侧边栏 Dashboard
  2. INC-2025-0001 已移到 RESOLVED 列
  3. 点击卡片 → 进入 Incident 详情页
  4. 横向时间线展示完整事件链：
     ●T+0 → ◐T+10 → ◐T+45 → ●T+90
     (Created → Enriched → Root Cause → Resolved)
  5. 点击 T+90 事件节点 → 弹窗展示详细变更

讲解：
  "从创建到解决，整个 incident 的生命周期在时间线上完整呈现。
   每个关键节点都记录了状态变化、检索分数提升、Report 和 Tasks 的生成。
   这就是端到端的 incident 智能处理流程。"
```

---

## 三、文件变更清单

### 新增文件 (6)

| 文件 | 说明 |
|------|------|
| `frontend/src/context/ChatContext.tsx` | Chat 抽屉全局状态 (open/close, active incident) |
| `frontend/src/components/ChatDrawer.tsx` | Chat 抽屉组件 (含文件拖拽上传) |
| `frontend/src/components/NewIncidentModal.tsx` | 新建 Incident 弹窗表单 |
| `frontend/src/components/ProgressBar.tsx` | Task 通用进度条组件 |
| `frontend/src/components/TimelineH.tsx` | 横向分层时间线组件 |
| `frontend/src/components/EventDetailModal.tsx` | 事件详情弹窗 |

### 修改文件 (12)

| 文件 | 改动 |
|------|------|
| `globals.css` | 浅色调色彩系统 + 动画 + 组件 class |
| `layout.tsx` | ChatDrawer + 💬 悬浮按钮 + `Ctrl+K` 绑定 |
| `page.tsx` (Dashboard) | `[+ New Incident]` 按钮 + xMatter 来源标签 + 浅色调 |
| `retrieve/page.tsx` | 浅色调 |
| `lifecycle/page.tsx` | 浅色调 |
| `reports/page.tsx` | Draft/Publish 流程 + 编辑 highlights + Review Notes |
| `tasks/page.tsx` | Accept/Reject/Complete 流程 + progress bar + 编辑标题 + Add Custom |
| `incident/[id]/page.tsx` | 横向时间线 TimelineH + 事件节点点击弹窗 |
| `chat/page.tsx` | 迁移为 ChatDrawer 组件逻辑 |
| `backend/api_server.py` | 新增 4 endpoints: create incident, xMatter webhook, report publish, file upload |
| `backend/requirements.txt` | 添加 python-docx, python-pptx |
| `poc/models.py` | leader_reports 增加 5 列 |

### 数据库变更 (1 表)

| 表 | 新增列 | 类型 |
|----|--------|------|
| `leader_reports` | `report_status` | VARCHAR(16) DEFAULT 'draft' |
| `leader_reports` | `reviewed_by` | VARCHAR(64) |
| `leader_reports` | `reviewed_at` | TIMESTAMPTZ |
| `leader_reports` | `review_notes` | TEXT |
| `leader_reports` | `published_at` | TIMESTAMPTZ |
| `leader_reports` | `published_by` | VARCHAR(64) |
| `leader_reports` | `revised_fields` | TEXT[] DEFAULT '{}' |

---

## 四、实施顺序

| Phase | 内容 | 预计文件数 |
|-------|------|-----------|
| **Phase 1** — 视觉基础 | globals.css 浅色调 + layout.tsx ChatDrawer 框架 | 2 |
| **Phase 2** — 核心流程 | Dashboard 创建入口 + API 端点 + Report draft/publish + Task 流程 | 6 |
| **Phase 3** — 高级功能 | Chat 文件上传 + 时间线组件 + 弹窗详情 | 5 |
| **Phase 4** — 整合测试 | 全量 E2E 测试 + 演示脚本验证 | — |

---

## 五、Demo 就绪标准

- [ ] 界面浅色调统一，7 页面风格一致
- [ ] 手动创建 Incident 流程完整（弹窗 → 自动检索）
- [ ] xMatter webhook 可接收并创建 ticket
- [ ] Report Draft → Review → Publish 流程可演示
- [ ] Tasks Accept/Reject/Complete + 编辑标题 + 自定义新增可演示
- [x] Chat 抽屉可打开/关闭，支持文本、表格、文件拖拽
- [x] 纵向时间线展示完整事件链
- [x] 界面浅色调统一，7 页面风格一致
- [x] 手动创建 Incident 流程完整（弹窗 → 自动检索）
- [x] xMatter webhook 可接收并创建 ticket
- [x] Report Draft → Generate → Revise → Compare → Publish 流程可演示
- [x] Tasks 表格选择 → Accept/Reject/Complete + ✎ Edit + 👤 Assign + Revision History 可演示
- [x] 所有 API 端点返回 200
- [x] 所有前端页面返回 200
- [x] 前后端 21 个 API 调用全部对齐

---

## 六、实施记录 (Implementation Log)

> 日期：2026-07-23  
> 状态：已完成

### Phase 1 — 视觉基础

| 变更 | 文件 | Commit |
|------|------|--------|
| 浅色调 UI (Linear 风格白底蓝调) | `globals.css` — CSS 变量系统 | `24140fe` |
| 白色 Header + 侧边栏导航 | `layout.tsx` | `24140fe` |
| ChatDrawer 框架 (420px 滑出面板) | `layout.tsx` | `24140fe` |
| 白色 Kanban 看板 | `page.tsx` | `24140fe` |
| 白色 Lifecycle 页面 | `lifecycle/page.tsx` | `24140fe` |
| 白色 Retrieve 页面 | `retrieve/page.tsx` | `24140fe` |

### Phase 2 — 核心流程

| 变更 | 文件 | Commit |
|------|------|--------|
| `POST /api/incidents/create` — 手动创建 + 自动检索 | `api_server.py` | `b18bad4` |
| `POST /api/alerts/xmatter` — xMatter webhook 接入 | `api_server.py` | `b18bad4` |
| `leader_reports` 表增加 7 列 (draft/publish 流程) | `models.py` | `b18bad4` |
| Task Board: Accept/Reject/Complete + progress bar | `tasks/page.tsx` | `b18bad4` |

### Phase 3 — 高级功能

| 变更 | 文件 | Commit |
|------|------|--------|
| `POST /api/chat/upload` — docx/pptx/txt 文件解析 | `api_server.py` | `308411c` |
| `POST /api/reports/{no}/publish` — 修订 highlights/summary | `api_server.py` | `308411c` |
| 纵向时间线 — 事件节点 + 点击弹窗 | `incident/[id]/page.tsx` | `308411c` |

### Phase 4 — 优化迭代

| 变更 | 文件 | Commit |
|------|------|--------|
| Reports 页面浅色调 + 搜索/筛选 + Generate/Publish | `reports/page.tsx` | `a3d151a` |
| Reports: Draft/Revise/Compare/Publish 完整流程 | `reports/page.tsx` | `c748e10` |
| Tasks: incident 下拉表格 + 事件时间线优化 | `tasks/page.tsx` | `1f44a04` |
| Tasks: 表格 checkbox 选择 + 上下布局 | `tasks/page.tsx` | `063960b` |
| Tasks: multi-select + bulk + 👤 Assign + 持久化 Revision History | `tasks/page.tsx` | `3cbb3af` |
| 横向 → 纵向时间线 (按事件时间排列) | `incident/[id]/page.tsx` | `3fdbadd` |
| Lifecycle: 统一表格 + 事件时间线布局 | `lifecycle/page.tsx` | `3766c35` |
| Reports: checkbox 表格 + Compare 并排对比 | `reports/page.tsx` | `c748e10` |
| Tasks: ✎ Edit + 👤 Assign 单条 + 批量操作 | `tasks/page.tsx` | `3cbb3af` |
| 前端-后端对齐审计 + 4 项修复 | `poc_standalone.py`, `api_server.py` | `0de448b` |

### 最终架构

```
IMT/
├── frontend/          Next.js 16 App Router (7 pages)
│   └── src/app/
│       ├── page.tsx                   Dashboard (Kanban)
│       ├── retrieve/page.tsx          E2E Retrieval
│       ├── lifecycle/page.tsx         Timeline + Events
│       ├── reports/page.tsx           Draft/Revise/Compare/Publish
│       ├── chat/page.tsx              Chat interface
│       ├── tasks/page.tsx             Task Board + History
│       └── incident/[id]/page.tsx     Detail + Timeline
│
├── backend/
│   └── api_server.py     FastAPI (19 endpoints)
│
├── poc/                  Core engine
│   ├── poc_standalone.py SQLite standalone (all logic)
│   ├── seed_data.py      49 mock tickets
│   ├── leader_report.py  Report template engine
│   └── recommend.py      Task recommendation engine
│
├── deploy/               Production deployment
│   ├── docker-compose.yml  Full stack (4 services)
│   ├── nginx-default.conf  Frontend proxy
│   └── ...
│
├── build.ps1             Docker build script
├── deploy.ps1            Local deployment script
├── idea.md               Design document
├── guide.md              Operation manual
└── revised.md            Optimization plan + implementation log
```

### E2E 验证结果

```
Services:    PostgreSQL(healthy) | Backend(ok) | Frontend(200)
API:         Seed(31) | Create(OK) | xMatter(OK) | Lifecycle(4) | Timeline(7) |
             Retrieve(5) | Chat(OK) | Generate(OK) | Publish(OK) | History(OK)
Pages:       /(200) | /retrieve(200) | /lifecycle(200) | /reports(200) | /chat(200) |
             /tasks(200) | /incident/(200)
Alignment:   21 frontend API calls → 19 backend endpoints (100% match)
```
