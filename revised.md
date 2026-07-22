# IMT PoC — 优化变更方案 (Revised Plan)

> 状态：待确认 | 日期：2026-07-22

---

## 一、变更总览

| # | 变更项 | 类型 | 优先级 |
|---|--------|------|--------|
| 1 | 界面风格全局切换为浅色调 | 视觉 | P0 |
| 2 | 创建 Incident 支持手动录入 & 自动接入（xMatter 告警） | 功能 | P0 |
| 3 | Report 生成增加人工介入环节 | 流程 | P0 |
| 4 | Recommend Tasks 增加人工介入环节 | 流程 | P0 |
| 5 | Chat 改为抽屉式面板 | 交互 | P1 |
| 6 | 事件时间线展示优化 | 视觉 | P1 |
| 7 | Demo 演示流程（手动点击操作路径） | 文档 | P1 |

---

## 二、详细变更方案

### 2.1 界面风格全局切换为浅色调

**现状**：全站 dark theme（`bg-gray-950`）。

**目标**：切换为专业的浅色调企业级 UI，参考 Linear / Notion / Jira 风格。

**设计方案**：

```
色彩体系：
  背景         #FFFFFF / #F8F9FA (页面底色)
  卡片         #FFFFFF, border #E5E7EB, shadow-sm
  侧边栏       #F1F3F5
  主色调       #0066FF (蓝色系)
  成功/完成    #16A34A (绿色)
  警告/进行中  #F59E0B (琥珀色)
  错误/严重    #DC2626 (红色)
  文字         #111827 (主要) / #6B7280 (次要) / #9CA3AF (禁用)
```

**改动的文件**：
- `globals.css`：全局变量 + 颜色 token 重定义
- `layout.tsx`：侧边栏、header 背景
- 全部 7 页面：卡片、按钮、文字颜色

**改后示例**：

```
┌─────────────────────────────────────────────────────┐
│  ◫ Incident Management PoC                  v1.0   │ ← 白色 header
├──────────┬──────────────────────────────────────────┤
│ Dashboard│  Incident Board                    [⟳]  │
│ Retrieve │                                        │
│ Lifecycle│  Filter: [All][P0][P1] [All Services]   │
│ Reports  │                                        │
│ Chat     │  ┌──────┬──────┬──────┬──────┐        │
│ Tasks    │  │ OPEN │ INV. │ MIT. │ RES. │        │
│          │  │  2   │  4   │  1   │  42  │        │
│          │  │ card │ card │ card │ card │        │
│          │  └──────┴──────┴──────┴──────┘        │
└──────────┴──────────────────────────────────────────┘
```

---

### 2.2 创建 Incident 支持手动录入 & 自动接入

**现状**：创建 incident 仅通过 `ingest_ticket()` 函数或 `demo_lifecycle.py` 的 Stage 0。

**目标**：两个创建入口，覆盖真实场景。

#### 入口 A：手动录入

**页面**：Dashboard 顶部增加 `[+ New Incident]` 按钮。

**流程**：
```
点击 [+ New Incident]
  → 弹出表单弹窗
  → 必填：Title, Description, Severity, Service
  → 可选：Category, Error Type
  → 点击 Submit
  → 调用 POST /api/tickets/create
  → 自动触发：embed → 检索历史相似案例 → 返回 Top-5
  → 卡片出现在 OPEN 列顶部（新卡片高亮动画）
```

**表单字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| Title | text | ✓ | 告警标题 |
| Description | textarea | ✓ | 初始描述 |
| Severity | select | ✓ | P0/P1/P2/P3 |
| Service Name | select/text | ✓ | 受影响服务 |
| Category | select | — | database/application/network/infrastructure/security |
| Error Type | select | — | timeout/OOM/deadlock/race_condition/... |

#### 入口 B：自动接入（xMatter 告警模拟）

**触发方式**：Chat 中输入特殊命令或 `/quick-create` 页面。

**流程**：
```
模拟 xMatter webhook → POST /api/alerts/xmatter
  → 解析 JSON payload:
     { "title": "Payment service P99 latency > 2s",
       "description": "Alert triggered: P99 > 2s, node: payment-03",
       "severity": "P1",
       "service": "payment-service",
       "source": "xmatter" }
  → 自动创建 incident → embed → retrieve
  → 返回: { incident_no, top5_similar, rerank_summary }
  → 在 Dashboard 显示带有 "🤖 xMatter" 来源标签的卡片
```

**API 设计**：

```
POST /api/alerts/xmatter
  Body: { title, description, severity, service, category?, error_type? }
  Response: {
    incident_no: "INC-2025-0007",
    top5_similar: [...],
    rerank_summary: "Found 3 similar DB timeout cases"
  }
```

**Dashboard 卡片上的来源标签**：
```
┌──────────────────────────────┐
│ INC-2025-0007       [P1]    │
│ Payment service P99 > 2s    │
│ payment-service · db · v1   │
│ 🤖 xMatter                  │  ← 来源标识
└──────────────────────────────┘
```

---

### 2.3 Report 生成增加人工介入环节

**现状**：`update_ticket_status()` 自动生成 Report，无人工确认。

**目标**：Report 生成改为「系统草拟 → 人工审阅 → 确认发布」流程。

**流程设计**：

```
Incident 更新
  ↓
系统自动草拟 Report (draft)
  ↓
存入 leader_reports (status=draft)
  ↓
显示在 Incident 详情页 / Reports 页
  → 红色 "DRAFT" 标签
  → 显示 [Review & Publish] 按钮
  ↓
工程师审阅：
  - 编辑 highlights（增删改）
  - 编辑 Executive Summary 内容
  - 添加 Review Notes
  ↓
点击 [Publish]
  → status = published
  → 干系人可见
  → 发送通知（模拟）
```

**界面交互**：

```
┌─ Report Preview ──────────────────────────────────┐
│ ▎ REPORT DEMO — INC-2025-0001          [DRAFT]    │
│                                                    │
│ ▎ Key Highlights                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ [STATUS] INVESTIGATING — severity P0     [✕] │  │ ← 可删除
│  │ [ROOT CAUSE] N+1 connection pattern...  [✕] │  │
│  │ [+ Add Highlight]                            │  │ ← 可新增
│  └──────────────────────────────────────────────┘  │
│                                                    │
│ ▎ Executive Summary                    [Edit ✎]   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Payment service returning HTTP 504 Gateway.. │  │
│  │ Closest match: INC-2024-0002 (score=22)      │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│ ▎ Review Notes                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ (engineer notes here)                        │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [Save Draft]  [Publish Report]   [Discard]        │
└────────────────────────────────────────────────────┘
```

**数据库变更**：

```sql
ALTER TABLE leader_reports ADD COLUMN status VARCHAR(16) DEFAULT 'draft';
ALTER TABLE leader_reports ADD COLUMN review_notes TEXT;
ALTER TABLE leader_reports ADD COLUMN reviewed_by VARCHAR(64);
ALTER TABLE leader_reports ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE leader_reports ADD COLUMN published_at TIMESTAMPTZ;
```

---

### 2.4 Recommend Tasks 增加人工介入环节

**现状**：Tasks 自动生成并可修订，但缺少完整的「接收 → 执行 → 调整」流程。

**目标**：Task Board 增加完整的交互流程演示。

**流程设计**：

```
系统生成 Tasks (7-9 items, all pending)
  ↓
工程师逐个验收：
  ① Review Task → 判断适用性
  ② 接受 → 标记 in_progress → 添加备注
  ③ 完成 → 标记 completed → 添加 evidence/notes
  ④ 拒绝 → 标记 rejected → 添加拒绝原因
  ↓
系统根据进展自动调整：
  - 当 root_cause 确认时，相关 tasks 自动标记优先级
  - 当 status 变为 resolved 时，未完成的 tasks 提示复核
```

**Task Board 交互优化**：

```
┌─ Task Board: INC-2025-0001 ──────────────────────────────┐
│ Filter: [All] [Pending] [In Progress] [Completed]        │
│ [Expand All] [Collapse All]          Progress: 4/9 done  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ○ T01  Check connection pool metrics                    │
│   src: best-practice/timeout        [Accept] [Reject]    │
│                                                          │
│ ◐ T02  Review slow query logs                           │
│   src: best-practice/timeout                             │
│   assigned: david.lin   status: in_progress              │
│   ┌─ Evidence/Notes ────────────────────────────────┐   │
│   │ Checked slow query log: no slow queries found.  │   │
│   │ Latency is from connection wait, not query time. │   │
│   └──────────────────────────────────────────────────┘   │
│   [Mark Completed] [Mark Rejected]                       │
│                                                          │
│ ● T03  Verify recent deployment diff                    │
│   src: best-practice/timeout   status: completed         │
│   ✓ Found: v2.4.1 added fraud-check call                │
│                                                          │
│ ✕ T04  Assess blast radius                              │
│   src: sre-playbook/general   status: rejected           │
│   Reason: impact limited to payment-service only         │
│                                                          │
└──────────────────────────────────────────────────────────┘

Progress Bar:
████████░░  4/9 completed  (45%)
```

---

### 2.5 Chat 改为抽屉式面板

**现状**：Chat 是独立页面。

**目标**：Chat 改为从右侧滑出的抽屉面板，可在任意页面调用。

**交互设计**：

```
┌────────────────────────────────────────────┬───────────┐
│                                            │           │
│  当前页面内容                              │  💬       │ ← 悬浮按钮
│                                            │           │
│                                            │           │
└────────────────────────────────────────────┴───────────┘

点击 💬 →
┌──────────────────────────────┬──────────────────────────┐
│  当前页面内容（半透明遮罩）  │  Chat Panel (400px)      │
│                              │  ┌────────────────────┐  │
│                              │  │ INC-2025-0001      │  │
│                              │  │ System: Found 3... │  │
│                              │  │ User: root cause:..│  │
│                              │  │ System: ✓ Updated  │  │
│                              │  └────────────────────┘  │
│                              │  [quick actions]         │
│                              │  [input........] [Send]  │
└──────────────────────────────┴──────────────────────────┘
```

**实现方式**：
- 全局 state (React Context) 管理面板开关
- `layout.tsx` 中放置悬浮按钮和抽屉组件
- 任何页面点击 💬 或按快捷键 `Ctrl+K` 触发
- 上下文自动关联当前浏览的 incident

**快速命令支持**（预置快捷输入）：

```
/generate-report    → 为当前 incident 生成 Report draft
/recommendations    → 展示当前 Tasks
/timeline           → 展示事件时间线摘要
/status <new>       → 快速更新状态
```

---

### 2.6 事件时间线展示优化

**现状**：垂直时间线，点 + 线串联，卡片展开/折叠。

**目标**：更丰富的时间线可视化，类似 Datadog Incident Timeline。

**设计方案**：

```
INC-2025-0001 — Event Timeline
─────────────────────────────────────────────────────

  T+0min            T+10min         T+45min         T+90min
    ●────────────────●───────────────●───────────────●
    │                │               │               │
    │        ┌───────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
    │        │ enriching..  │ │ root cause  │ │ resolution │
    │        │ desc +336ch  │ │ identified  │ │ applied     │
    │        │ status→inv   │ │ rc added    │ │ status→res  │
    │        │ v1→v2        │ │ v2→v3       │ │ v3→v4       │
    │        └──────────────┘ └─────────────┘ └─────────────┘
    │
  ┌─┴──────────────┐
  │ Ticket Created │
  │ desc: 65 chars │
  │ no rc, no res  │
  └────────────────┘

  📄 Report v2     📄 Report v3    📄 Report v4
  📋 7 Tasks       📋 8 Tasks      📋 8 Tasks
```

**优化点**：

1. **横向时间轴**：顶部时间条（`T+0 → T+10 → T+45 → T+90`）
2. **分层次展示**：
   - Layer 1（顶部）：状态流转（Open → Inv. → Inv. → Resolved），渐变色条
   - Layer 2（中部）：关键事件卡片（创建 / 更新 / 根因 / 解决）
   - Layer 3（底部）：派生事件（Report 生成 / Tasks 生成）
3. **事件卡片颜色编码**：
   - 🟢 创建 → 绿色
   - 🔵 更新 → 蓝色
   - 🟡 根因 → 琥珀色
   - 🟣 解决 → 紫色
   - ⚪ Report/Tasks → 灰色
4. **可交互事件点**：点击事件卡展开详情（弹窗或内联展开）

**与现有 Lifecycle 页面的关系**：
- Lifecycle 页面保留现有纵向时间线（演示用）
- Incident 详情页新增横向时间线视图
- 两者不冲突，互为补充

---

### 2.7 Demo 演示流程（手动点击操作路径）

**总时长**：6-8 分钟

#### Step 1：Dashboard 总览（1min）

```
操作：打开 http://localhost:3000
展示：
  1. Kanban 看板 4 列，49 tickets
  2. Filter 下拉：按 P0 筛选 → 展示 Critical tickets
  3. 点击 [+ New Incident] → 手动创建新 ticket → 演示创建流程
  4. 展示自动检索结果（创建后自动弹出 Top-5）
```

#### Step 2：Incident 检索（1min）

```
操作：点击 /retrieve 页面
展示：
  1. 填写 incident 信息 → Run Retrieval
  2. 观察 Top-5 reranked 结果（含分数 + 原因）
  3. 点击任意 Top-5 卡片 → 跳转查看完整 incident 详情
```

#### Step 3：Chat 交互（1min）

```
操作：点击 💬 浮动按钮 → 展开 Chat 抽屉
展示：
  1. 输入 "update status to investigating"
     → 看板中卡片实时从 OPEN 列移到 INVESTIGATING 列
  2. 输入 "root cause: N+1 connection pattern in /charge handler"
     → Incident 详情页 Root Cause 字段更新
  3. 输入 "generate report"
     → Chat 返回 Report preview（draft 状态）
  4. 输入 "recommendations"
     → Chat 返回 8 条 tasks
```

#### Step 4：Report 审阅（1min）

```
操作：切换到 /reports
展示：
  1. 选择 INC-2025-0001
  2. 看到最新的 Report 带 [DRAFT] 标签
  3. 点击 [Review & Publish]
  4. 编辑 highlights / summary
  5. 添加 Review Notes
  6. 点击 [Publish] → [DRAFT] 变为 [PUBLISHED]
  7. 展示 v2 → v3 → v4 版本对比（新增 ROOT CAUSE highlight）
```

#### Step 5：Tasks 验收（1min）

```
操作：切换到 /tasks
展示：
  1. 8 tasks，progress bar 显示 0/8
  2. 点击 T01 [Accept] → 标记 in_progress → 添加证据 "pool active=50/50, pending=340"
  3. 点击 T01 [Mark Completed] → 标记 completed，进度 1/8
  4. 点击 T02 [Accept] → in_progress → "found v2.4.1 deployment diff"
  5. 点击 T02 [Mark Completed] → 进度 2/8
  6. 点击 T04 [Reject] → 添加原因 "impact limited to payment-service"
  7. Progress bar: ██░░░░░░  2/8  (3 rejected)
```

#### Step 6：返回看板查看闭环（1min）

```
操作：点击侧边栏 "Dashboard"
展示：
  1. INC-2025-0001 已从 OPEN 列移动到 RESOLVED 列（通过 Chat 操作）
  2. 点击卡片 → 查看完整 timeline
  3. Timeline 展示：创建 → T+10 更新 → T+45 RC → T+90 Resolved
  4. 所有 Report 和 Tasks 在 timeline 上可见
```

---

## 三、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `frontend/src/app/create/page.tsx` | 新建 Incident 表单页 |
| `frontend/src/context/ChatContext.tsx` | Chat 抽屉全局状态 |
| `frontend/src/components/ChatDrawer.tsx` | Chat 抽屉组件 |
| `frontend/src/components/NewIncidentModal.tsx` | 新建 Incident 弹窗 |
| `frontend/src/components/ProgressBar.tsx` | Task 进度条 |
| `frontend/src/components/TimelineH.tsx` | 横向时间线组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `globals.css` | 浅色调色彩系统 |
| `layout.tsx` | ChatDrawer + 悬浮按钮集成 |
| `page.tsx` (Dashboard) | +New Incident 按钮 + 来源标签 |
| `retrieve/page.tsx` | 浅色调 |
| `lifecycle/page.tsx` | 浅色调 |
| `reports/page.tsx` | +Draft/Publish 流程 + 编辑 highlights |
| `tasks/page.tsx` | +Accept/Reject/Complete 流程 + progress bar |
| `incident/[id]/page.tsx` | +横向时间线 + Draft 标签 |
| `chat/page.tsx` | 迁移为抽屉组件逻辑 |
| `backend/api_server.py` | +创建 API + xMatter webhook + draft report |

### 数据库变更

| 变更 | 说明 |
|------|------|
| `leader_reports` 增加 4 列 | status, review_notes, reviewed_by, reviewed_at, published_at |
| `incident_tickets` 增加 2 列 | source (manual/xmatter), source_payload (JSON) |

---

## 四、待确认

| # | 问题 | 选项 |
|---|------|------|
| 1 | 浅色调具体参考哪个产品风格？ | A) Linear B) Notion C) Jira D) 自定义 |
| 2 | Chat 抽屉宽度？ | A) 360px B) 400px C) 480px |
| 3 | xMatter 模拟是完全 mock 还是需要真实 webhook 格式？ | A) Mock B) 遵循真实 xMatter payload |
| 4 | Report Draft → Publish 流程中，是否需要 "干系人查看" 的模拟通知？ | A) 需要 B) 仅状态变更 |
| 5 | Task 进度条是否在 Dashboard 卡片上也展示？ | A) 需要 B) 仅在 Task Board |

确认后开始实施。
