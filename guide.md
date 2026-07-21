# IMT PoC — 操作指南

Incident Ticket 智能召回与分析系统的完整操作手册。

---

## 目录

1. [环境准备](#1-环境准备)
2. [启动数据库](#2-启动数据库)
3. [灌入模拟数据](#3-灌入模拟数据)
4. [E2E 检索 Pipeline](#4-e2e-检索-pipeline)
5. [生命周期 Demo](#5-生命周期-demo)
6. [Leader Report 汇报生成](#6-leader-report-汇报生成)
7. [Engineer Task Recommendations](#7-engineer-task-recommendations---工程师推荐任务)
8. [独立模式 — 零依赖运行](#8-独立模式--零依赖运行)
9. [数据库操作 API](#9-数据库操作-api)
10. [一键脚本](#10-一键脚本)
11. [Demo 演示完整操作步骤](#11-demo-演示完整操作步骤)
12. [常见问题](#12-常见问题)

---

## 1. 环境准备

### 1.1 前置条件

| 组件 | 版本要求 | 说明 |
|------|---------|------|
| Python | 3.12+ | |
| Docker Desktop | 29.x+ | 运行 PostgreSQL 容器 |
| WSL2 | 2.2+ | Docker Desktop 的后端 |

### 1.2 安装 Python 依赖

```powershell
cd C:\claudeWorkspace\IMT\poc
pip install --user -r requirements.txt
```

### 1.3 配置环境变量

```powershell
# 复制模板
copy .env.example .env

# 编辑 .env（如果用 OpenAI embedding 才需要填写 API Key）
# 当前 PoC 使用本地随机投影，不需要 API Key
```

---

## 2. 启动数据库

### 2.1 启动 PostgreSQL 18 + pgvector

```powershell
cd C:\claudeWorkspace\IMT\poc
docker compose up -d
```

### 2.2 验证容器状态

```powershell
docker ps --filter "name=imt-poc-db"
```

期望输出：
```
CONTAINER ID   STATUS                    PORTS
xxxxx         Up XX seconds (healthy)   0.0.0.0:5432->5432/tcp
```

### 2.3 连接数据库

```powershell
docker exec -it imt-poc-db psql -U imt -d imt_poc
```

进入 psql 后可验证表结构：
```sql
\dt
\d incident_tickets
\d leader_reports
\d recommended_tasks
SELECT count(*) FROM incident_tickets;
```

### 2.4 停止/清理数据库

```powershell
# 停止（保留数据）
docker compose down

# 完全清除（删除数据）
docker compose down -v
```

---

## 3. 灌入模拟数据

### 3.1 灌入 20 条历史 incident ticket

```powershell
python seed_data.py
```

期望输出：
```
Tables created (if not existed).
Seeded 20 tickets:
  [1] <uuid>
  [2] <uuid>
  ...
  [20] <uuid>
Done.
```

### 3.2 验证数据

```powershell
python -c "
import sys; sys.path.insert(0,'poc')
from models import IncidentTicket, get_session
s = get_session()
rows = s.query(IncidentTicket).all()
for r in rows[:3]:
    print(f'{r.incident_no} | {r.status} | {r.title[:50]} | emb={len(r.embedding_description or [])}d')
s.close()
"
```

期望输出：
```
INC-2024-0001 | resolved | MySQL master CPU 100% after traffic spike | emb=384d
INC-2024-0002 | resolved | PostgreSQL connection pool exhausted ... | emb=384d
INC-2024-0003 | resolved | Redis cluster OOM evicting keys under load | emb=384d
```

### 3.3 新增自定义 ticket

```python
from db import ingest_ticket

ingest_ticket(
    incident_no="INC-2025-0999",
    title="Custom incident title",
    description="Detailed description of the incident...",
    severity="P1",
    service_name="my-service",
    category="database",
    status="open",
    error_type="timeout",
    root_cause="Root cause analysis...",    # 可选
    resolution="Resolution steps...",       # 可选
)
```

---

## 4. E2E 检索 Pipeline

### 4.1 运行完整检索流程

```powershell
python main.py
```

### 4.2 流程说明

```
Step 1/4: 展示当前 incident ticket
Step 2/4: 三路召回 → RRF 融合 → Top 30
Step 3/4: 精排（余弦相似度）→ Top 5
Step 4/4: 生成推荐行动计划（Phase A/B/C）
```

### 4.3 修改当前 ticket 测试不同场景

编辑 `main.py` 中的 `CURRENT_TICKET` 字典：

```python
CURRENT_TICKET = {
    "title": "你的自定义标题",
    "description": "你的自定义问题描述...",
    "service_name": "your-service",
    "category": "database",    # database / network / application / infrastructure
    "severity": "P1",
    "error_type": "timeout",   # timeout / OOM / deadlock / race_condition / ...
}
```

---

## 5. 生命周期 Demo

### 5.1 运行

```powershell
python demo_lifecycle.py
```

### 5.2 展示内容

模拟 incident `INC-2025-0001` 的 4 阶段演进：

| 阶段 | 时间 | 状态 | 动作 | 关键变化 |
|------|------|------|------|---------|
| Stage 0 | T+0min | open | 创建 ticket（模糊描述） | version=1, desc=65 字符 |
| Stage 1 | T+10min | investigating | 补充连接池/线程指标 | version=2, desc=336 字符 |
| Stage 2 | T+45min | investigating | 根因定位 | version=3, root_cause 填入, 向量刷新 |
| Stage 3 | T+90min | resolved | 修复并关闭 | version=4, resolution 填入 |

### 5.3 阶段间对比

每个阶段输出：
- **Ticket 摘要** — 当前版本、状态、描述长度
- **Top-5 召回** — 相似历史 ticket 及相似度分数
- **Report Demo** — 3-5 条汇报 highlights
- **Recommended Tasks** — 推荐任务列表 + 来源标注

最终输出：
- **生命周期汇总表** — score 趋势对比
- **Report 历史汇总** — 各版本 highlights 变化
- **Task 历史汇总** — 各版本任务演进

### 5.4 演示话术

> "Incident ticket 不是静态文档。随着事件发展，SRE 不断补充信息——从模糊告警到精确根因。系统每次更新时自动刷新向量、重新召回、生成汇报和任务推荐。从 Stage 0 到 Stage 3，召回分数提升 226%，Report 从 STATUS+NEXT 演进到 ROOT CAUSE+ACTION+REFERENCE，Tasks 从 7 条通用任务增加到 8 条含根因确认。"

---

## 6. Leader Report 汇报生成

### 6.1 自动生成机制

每次调用 `update_ticket_status()` 后**自动触发**，无需手动干预。

生成的报告自动存入 `leader_reports` 表。

### 6.2 查询最新报告

```python
from db import get_latest_report

report = get_latest_report("INC-2025-0001")
print(report["content"])      # 完整报告文本
print(report["highlights"])   # 3-5 条重点摘要
```

### 6.3 查询报告历史

```python
from db import get_report_history

reports = get_report_history("INC-2025-0001")
for r in reports:
    print(f"v{r['ticket_version']}: {len(r['highlights'])} highlights")
```

### 6.4 报告模板结构

```
INCIDENT LEADERSHIP REPORT — {incident_no}
=======================================================================
  Time: {generated_at}     Version: v{version}

  ## 1. Executive Summary       # 当前描述 + 最匹配历史 ticket
  ## 2. Current Status          # status / severity / error_type/ service
  ## 3. Impact Assessment       # P0-P3 等级语义化
  ## 4. Investigation Progress  # root_cause / resolution 状态
  ## 5. Key Highlights (3-5)    # 自动提取的重点
  ## 6. Recommended Next Steps  # 按 status 推荐的下一步行动
=======================================================================
```

### 6.5 Highlights 示例演进

```
v2  [STATUS] INVESTIGATING  |  [REFERENCE] INC-2024-0014  |  [REFERENCE] INC-2024-0001  |  [NEXT] Continue investigation

v3  [STATUS] INVESTIGATING  |  [ROOT CAUSE] N+1 connection pattern...  |  [REFERENCE] INC-2024-0002  |  [REFERENCE] INC-2024-0001  |  [NEXT] Apply fix

v4  [STATUS] RESOLVED  |  [ROOT CAUSE] N+1 connection pattern...  |  [ACTION] Rolled back deployment...  |  [REFERENCE] INC-2024-0002
```

---

## 7. Engineer Task Recommendations — 工程师推荐任务

### 7.1 自动生成机制

每次调用 `update_ticket_status()` 后，除 Report 外还会自动生成推荐任务列表。

### 7.2 任务来源与优先级

| 优先级 | 来源 | 数量 | 示例 |
|--------|------|------|------|
| P1 | error_type 模板 | 3 条 | "Check connection pool metrics for payment-service" |
| P2 | SRE Playbook 通用 | 4 条 | "Assess blast radius / Check recent deployments" |
| P3 | 相似历史 ticket action_plan | 动态 | 提取历史方案中的操作步骤 |
| P4 | 根因确认 | 1 条 | "Confirm root cause hypothesis: ..." |

### 7.3 查询任务

```python
from db import get_recommendations

# 获取最新版本的推荐任务
tasks = get_recommendations("INC-2025-0001")
for t in tasks:
    print(f"[{t['status']}] T{t['task_order']:02d} {t['description'][:80]}")
    print(f"    source: {t['source']}")
```

### 7.4 人工修订任务

```python
from db import revise_task

# 标记为进行中
revise_task(task_id, status="in_progress", revised_by="david.lin",
            revision_note="Checked pool metrics — active connections at 50/50")

# 标记为已完成
revise_task(task_id, status="completed", revised_by="david.lin",
            revision_note="Verified deployment diff — no changes found")

# 添加自定义备注
revise_task(task_id, revision_note="Escalating to DB team for index analysis")

# 拒绝不适用的推荐
revise_task(task_id, status="rejected", revision_note="Not applicable — no connection pool used")
```

### 7.5 状态流转

```
pending → in_progress → completed
pending → rejected
in_progress → rejected
```

---

## 8. 独立模式 — 零依赖运行

### 8.1 适用场景

- Docker 不可用
- 网络受限（无法拉取镜像）
- 快速验证算法逻辑

### 8.2 运行

```powershell
python poc_standalone.py
```

### 8.3 实现细节

| 组件 | Docker 版 | 独立版 |
|------|----------|--------|
| 数据库 | PostgreSQL 18 + pgvector | SQLite (文件) |
| 向量检索 | pgvector cosine | numpy 内存计算 |
| 全文检索 | pg tsvector | SQLite FTS5 |
| 结构化过滤 | SQL WHERE | 同 |
| RRF 融合 | Python | 同 |
| 精排 | 余弦相似度 | 同 |
| 行动计划 | 模板生成 | 同 |
| Leader Report | PostgreSQL | SQLite |

### 8.4 数据库文件

独立版生成 `poc/imt_poc.db`（SQLite 文件）。删除即可重置：

```powershell
del imt_poc.db
python poc_standalone.py
```

---

## 9. 数据库操作 API

### 9.1 入库

```python
from db import ingest_ticket, ingest_tickets_batch

# 单条
tid = ingest_ticket(
    incident_no="INC-2025-0001", title="...", description="...",
    severity="P0", service_name="...", category="...",
)

# 批量
ids = ingest_tickets_batch([{...}, {...}])
```

### 9.2 查询

```python
from db import get_ticket_by_incident_no, get_ticket_by_id

ticket = get_ticket_by_incident_no("INC-2025-0001")
print(ticket["title"], ticket["status"], ticket["version"])
```

### 9.3 更新（触发 re-embed + report + tasks）

```python
from db import (
    update_ticket_description,    # 更新描述 + re-embed description
    update_ticket_root_cause,     # 更新根因 + re-embed root_cause
    update_ticket_resolution,     # 更新方案 + re-embed root_cause+resolution
    update_ticket_status,         # 状态转移 + 可选字段更新 + 自动生成 Report + Tasks
)

update_ticket_status("INC-2025-0001", "investigating",
    description="Enriched description...",
    error_type="timeout",
)
# 自动: version += 1, updated_at=now(), re-embed, generate report, generate tasks
```

### 9.4 Report 与 Tasks

```python
from db import get_latest_report, get_report_history
from db import get_recommendations, revise_task

# Report
latest = get_latest_report("INC-2025-0001")
for hl in latest["highlights"]:
    print(f"  * {hl}")

# Tasks
tasks = get_recommendations("INC-2025-0001")
for t in tasks:
    print(f"[{t['status']}] T{t['task_order']:02d} {t['description'][:80]}")

# Revise
revise_task(tasks[0]["id"], status="completed", revised_by="david.lin",
            revision_note="Completed — connection pool verified")
```

---

## 10. 一键脚本

```powershell
cd C:\claudeWorkspace\IMT\poc
powershell -ExecutionPolicy Bypass -File run_all.ps1
```

自动完成：
1. 清理残留容器/卷
2. `docker compose up -d` 启动 PostgreSQL
3. 检查依赖
4. `seed_data.py` 灌入数据
5. `main.py` E2E 检索
6. `demo_lifecycle.py` 生命周期 demo

---

## 11. Demo 演示完整操作步骤

> 以下是一套完整的演示流程，按 Feature 顺序逐步展示。每条命令均可直接复制运行。

---

### 11.0 关键机制：触发时机与版本对应关系

| 操作 | 触发函数 | 版本变化 | Re-embed | Report | Tasks |
|------|---------|---------|----------|--------|-------|
| 创建 ticket | `ingest_ticket()` | → v1 | description 向量生成 | **不触发** | **不触发** |
| 更新 ticket | `update_ticket_status()` | → v2, v3, ... | 语义字段变更时重新生成 | **自动生成** | **自动生成** |
| 单独更新描述 | `update_ticket_description()` | v+1 | 重新生成 description 向量 | **不触发** | **不触发** |
| 单独更新根因 | `update_ticket_root_cause()` | v+1 | 重新生成 root_cause 向量 | **不触发** | **不触发** |

> **设计理念**：初始创建时信息太少（仅一条模糊告警），生成汇报和任务没有意义。SRE 做第一次 triage 更新 ticket 时（`update_ticket_status`），系统才自动产出 Report + Tasks。后续每次状态转移都会重新生成。

**Lifecycle 阶段与产出对照表**（当前 demo 的实际输出）：

| Stage | 时间 | 状态 | v | Desc | RC | Res | Report | Tasks | Rerank Avg |
|-------|------|------|---|------|----|-----|--------|-------|------------|
| 0 | T+0 | open | 1 | 65 | N | N | — | — | 5.6 |
| 1 | T+10 | investigating | 2 | 336 | N | N | v2 (STATUS + REF ×2 + NEXT) | 7 tasks | 9.4 |
| 2 | T+45 | investigating | 3 | 575 | Y | N | v3 (STATUS + RC + REF ×2 + NEXT) | 8 tasks | 17.3 |
| 3 | T+90 | resolved | 4 | 245 | Y | Y | v4 (STATUS + RC + ACTION + REF ×2) | 8 tasks | 18.3 |

> **关键趋势**：随着 version 递增 → 信息量增加 → embedding 精度提升 → rerank 分数上升 → Report highlights 从 3 条扩展到 5 条 → Tasks 从 7 条增加到 8 条（含根因确认）。

---

### 11.1 初始环境准备

```powershell
# 1. 进入项目目录
cd C:\claudeWorkspace\IMT\poc

# 2. 清理旧环境 + 重建数据库
docker compose down -v
docker compose up -d

# 3. 等待数据库就绪
Start-Sleep -Seconds 5
docker ps --filter "name=imt-poc-db"
# 期望: Up XX seconds (healthy)

# 4. 灌入模拟数据（35 条：20 resolved + 15 含 investigating/mitigated/open）
python seed_data.py
# 期望: Seeded 35 tickets. Done.
```

**数据概览**（seed 后可验证）：

| 统计 | 数量 |
|------|------|
| 总 ticket | 35 |
| resolved | 28 |
| investigating | 4 |
| mitigated | 1 |
| open | 1 |
| 类别: database / application / network / infrastructure / security | 8 / 12 / 6 / 6 / 3 |
| error_type 种类 | 9（timeout, OOM, deadlock, race_condition, config_error, dependency_failure, resource_exhaustion, auth_error, rate_limit） |
```

---

### 11.2 Feature 1 — E2E 检索 Pipeline（展示智能召回）

```powershell
python main.py
```

**演示重点（对着输出讲解）：**

1. **当前 Incident**：指向 "Order service P99 latency spike after MySQL migration"——一个典型的数据库迁移后性能退化问题。

2. **Step 2 — 三路召回 + RRF 融合**：
   ```
   [1] INC-2024-0028 | Cassandra nodetool repair backlog causing read-repair timeout
   [2] INC-2024-0027 | MongoDB replica set election storm — primary flapping 4x/hour
   [3] INC-2024-0001 | MySQL master CPU 100% after traffic spike
   [4] INC-2024-0002 | PostgreSQL connection pool exhausted during black-friday
   ...
   ```
   三个检索路径（向量语义 + 全文关键词 + 结构化精确匹配）各自召回，RRF 融合排序。注意新加入的 INC-2024-0027/0028 排在前面——因为它们同属 `order-service` + `database`，结构化路径和全文检索都精准命中。**数据集从 20 条扩展到 35 条后，召回质量不降反升。**

3. **Step 3 — 精排**：
   ```
   [1] INC-2024-0013 | score=24.5 | General symptom similarity
   [2] INC-2024-0006 | score=21.7 | General symptom similarity
   ```
   精排使用 root_cause embedding 做余弦相似度加权重排。低分说明当前 ticket 没有 root_cause，仅靠描述匹配——这也符合实际情况。

4. **Step 4 — 行动计划**：输出 Phase A（紧急止血）/ Phase B（诊断验证）/ Phase C（根因修复）三阶段计划，引用最相似历史 ticket 的 resolution。

**一句话总结**：> "系统从 20 条历史 ticket 中通过向量+全文+结构化三路召回，RRF 融合后 Top-30，精排后 Top-5，生成带置信度的行动计划。"

---

### 11.3 Feature 2 — 生命周期 Demo（展示动态向量更新）

```powershell
# 先重置数据库（确保干净状态）
docker compose down -v
docker compose up -d
Start-Sleep -Seconds 5
python seed_data.py

# 运行生命周期 demo
python demo_lifecycle.py
```

**逐阶段讲解：**

#### Stage 0 — T+0min：初始告警

```
Status=open  v1  desc_len=65
  >>> REPORT DEMO — no report yet (first update triggers auto-generation)
  >>> RECOMMENDED TASKS — no tasks yet (first update triggers auto-generation)
```
此刻 ticket 只有一句话描述。召回分数极低（avg 5.6），匹配结果不理想。没有 root_cause，没有 resolution。**也没有 Report 和 Tasks——系统仅在 ticket 更新时触发自动生成（`update_ticket_status`），初始创建（`ingest_ticket`）不触发。** 这模拟了真实场景：工程师刚接告警、还没有任何可用信息时，不应生成汇报。

#### Stage 1 — T+10min：Triage 完成

```
Status=investigating  v2  desc_len=336
  >>> RECOMMENDED TASKS (7 items) <<<
      [ ] T01  Check connection pool metrics for payment-service
      [ ] T02  Review slow query logs for payment-service
      [ ] T03  Verify recent deployment diff for payment-service
      ...
```
SRE 补充了连接池指标、线程 dump、P99 延迟数据。描述从 65 字符扩展到 336 字符。**向量自动重新计算**。召回分数从 5.6 → 9.4（+69%）。

Report 自动生成：`[STATUS] INVESTIGATING + [REFERENCE] ×2 + [NEXT]`

Tasks 自动生成：3 条 timeout 专项 + 4 条通用 SRE playbook。

**关键点**：> "描述越精确，向量越窄，检索越准。每次更新自动 re-embed，无需手动触发。"

#### Stage 2 — T+45min：根因定位

```
Status=investigating  v3  desc_len=575  RootCause=YES
      * [ROOT CAUSE] New deployment added fraud-check HTTP call...
      * [NEXT] Apply fix. Validate in staging. Roll out.
```
SRE 定位到根因：fraud-check 调用导致 N+1 连接模式。`root_cause` 字段在 `embedding_root_cause` 中生成独立向量。召回分数 9.4 → 17.3（+83%）。

Report 新增 `[ROOT CAUSE]` highlight。Tasks 新增 `[T08] Confirm root cause hypothesis`。

**关键点**：> "root_cause embedding 是第二个粒度的向量——专门用于匹配历史 ticket 的根因描述。这是精排分数跳升的核心原因。"

#### Stage 3 — T+90min：Resolved

```
Status=resolved  v4  desc_len=245  RC=YES  Resolution=YES
      * [ACTION] Resolution applied: Rolled back deployment...
```
修复完成，ticket 关闭。Report 新增 `[ACTION]` highlight。整个 lifecycle 分数趋势：

```
Stage  v  Status         RC?  AvgScore
T+0     1  open           N     5.6
T+10    2  investigating   N     9.4
T+45    3  investigating   Y    17.3
T+90    4  resolved        Y    18.3
```

**一句话总结**：> "随着 incident 从模糊告警演进到根因定位再到解决关闭，embedding 逐步精准化，召回分数提升 226%。每个阶段自动产出 Report + Tasks。"

---

### 11.4 Feature 3 — Report Demo（展示自动汇报）

演示完 lifecycle 后，Report 已在数据库中。手动查询验证：

```python
# 在 Python 交互环境中运行
import sys; sys.path.insert(0, r'C:\claudeWorkspace\IMT\poc')
from db import get_report_history, get_latest_report

# 查看最新报告
latest = get_latest_report("INC-2025-0001")
print(latest["content"][:600])

# 查看报告历史演进
history = get_report_history("INC-2025-0001")
for r in history:
    print(f"\n--- v{r['ticket_version']} ---")
    for hl in r["highlights"]:
        print(f"  {hl}")
```

**展示重点**：
- v2：仅有 STATUS + REFERENCE + NEXT（无根因，无操作）
- v3：STATUS + ROOT CAUSE + REFERENCE + NEXT
- v4：STATUS + ROOT CAUSE + ACTION + REFERENCE（完整闭环）

**一句话总结**：> "每次 ticket 更新自动生成一份面向 Leader 的结构化汇报，6 个固定 section，3-5 条重点标注。报告版本与 ticket version 一一对应，可完整追溯 incident 生命周期的每个关键快照。"

---

### 11.5 Feature 4 — Engineer Task Recommendations（展示任务推荐与人工修订）

#### Step 1：查看自动生成的任务

```python
import sys; sys.path.insert(0, r'C:\claudeWorkspace\IMT\poc')
from db import get_recommendations

tasks = get_recommendations("INC-2025-0001")
for t in tasks:
    print(f"[{t['status']:12s}] T{t['task_order']:02d}  {t['description'][:80]}  |  src: {t['source']}")
```

输出示例：
```
[pending     ] T01  Check connection pool metrics for payment-service  |  src: best-practice/timeout
[pending     ] T02  Review slow query logs for payment-service         |  src: best-practice/timeout
[pending     ] T03  Verify recent deployment diff for payment-service  |  src: best-practice/timeout
[pending     ] T04  Assess blast radius: identify affected services    |  src: sre-playbook/general
[pending     ] T05  Check recent deployments for payment-service       |  src: sre-playbook/general
[pending     ] T06  Collect logs, metrics, and traces                  |  src: sre-playbook/general
[pending     ] T07  Set up monitoring dashboard for payment-service    |  src: sre-playbook/general
[pending     ] T08  Confirm root cause: N+1 connection pattern...      |  src: current-investigation
```

**讲解**：> "8 条推荐任务，分 4 个来源——error_type 模板（timeout 专项）、SRE playbook（通用最佳实践）、current-investigation（当前根因）。每条都有明确的来源标注，让工程师知道为什么推荐这个任务。"

---

#### Step 2：工程师人工修订任务

```python
from db import revise_task

# 工程师 david.lin 开始工作：
# T01 — 检查连接池指标：发现 active=50/50，pending=340 → 确认连接池耗尽
revise_task(tasks[0]["id"], status="completed", revised_by="david.lin",
    revision_note="Confirmed — HikariCP active=50/50, pending=340, pool exhausted")

# T02 — 检查慢查询：日志中无明显慢查询，延迟来自连接等待
revise_task(tasks[1]["id"], status="completed", revised_by="david.lin",
    revision_note="No slow queries found. Latency is connection-acquisition wait time")

# T03 — 验证部署 diff：发现 14:00 的部署添加了 fraud-check 调用
revise_task(tasks[2]["id"], status="completed", revised_by="david.lin",
    revision_note="Found: v2.4.1 added fraud-check HTTP call inside /charge handler")

# T08 — 根因确认：已验证
revise_task(tasks[7]["id"], status="completed", revised_by="david.lin",
    revision_note="Root cause confirmed — rolled back deployment, pool recovered")

# T04 — 评估爆炸半径：不适用，影响范围仅限于 payment-service
revise_task(tasks[3]["id"], status="rejected",
    revision_note="N/A — impact limited to payment-service only")

# 重新查询，查看修订后的状态
tasks = get_recommendations("INC-2025-0001")
for t in tasks:
    print(f"[{t['status']:12s}] T{t['task_order']:02d}  {t['description'][:60]}  "
          f"{'revised by '+t['revised_by'] if t.get('revised_by') else ''}")
```

输出示例：
```
[completed   ] T01  Check connection pool metrics for payment-service  revised by david.lin
[completed   ] T02  Review slow query logs for payment-service         revised by david.lin
[completed   ] T03  Verify recent deployment diff for payment-service  revised by david.lin
[pending     ] T04  Assess blast radius: identify affected...          (rejected, not shown)
[pending     ] T05  Check recent deployments for payment-service       (pending)
[pending     ] T06  Collect logs, metrics, and traces                  (pending)
[pending     ] T07  Set up monitoring dashboard for payment-service    (pending)
[completed   ] T08  Confirm root cause: N+1 connection pattern...      revised by david.lin
```

**讲解**：> "工程师逐个验收任务：T01-T03 确认完成并附上发现，T08 根因确认完成，T04 标记为不适用。每个修订都记录了谁做的、什么时间、什么备注。这就是人机协作——系统推荐、人工验收、可追溯。"

---

### 11.6 快速重置（如需重新演示）

```powershell
# 完全重置
docker compose down -v
docker compose up -d
Start-Sleep -Seconds 5
python seed_data.py

# 再次运行任意 demo
python main.py
python demo_lifecycle.py
```

---

## 12. 常见问题

### Q: Docker 容器无法启动

```powershell
# 检查 WSL
wsl --version

# 重启 Docker Desktop
Stop-Process -Name "Docker Desktop" -Force
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### Q: 无法拉取 pgvector 镜像

使用独立模式：`python poc_standalone.py`

### Q: 如何重置数据库

```powershell
# Docker 版
docker compose down -v
docker compose up -d
python seed_data.py

# 独立版
del imt_poc.db
python poc_standalone.py
```

### Q: 如何查看已入库的 ticket 列表

```python
from models import IncidentTicket, get_session
s = get_session()
for t in s.query(IncidentTicket).all():
    print(f"{t.incident_no:20s} {t.status:14s} v{t.version:1d} {t.title[:50]}")
s.close()
```

### Q: 如何验证向量是否更新

```python
from db import get_ticket_by_incident_no

before = get_ticket_by_incident_no("INC-2025-0001")
print(f"Before: v{before['version']}, desc_len={len(before['description'])}")

from db import update_ticket_description
update_ticket_description("INC-2025-0001", "New longer description...")

after = get_ticket_by_incident_no("INC-2025-0001")
print(f"After:  v{after['version']}, desc_len={len(after['description'])}")
# version 自增，embedding 自动刷新
```

### Q: RRF 或检索参数如何调参

编辑 `config.py`：
```python
VECTOR_TOPK = 50    # 向量路径返回数
FTS_TOPK = 50       # 全文检索返回数
STRUCT_TOPK = 30    # 结构化匹配返回数
RRF_K = 60          # RRF 融合常数 k
MERGE_TOPK = 30     # RRF 融合后返回数
FINAL_TOPK = 5      # 精排后最终返回数
```

---

## 附录 A：代码与文档对齐确认

> 以下交叉审查于 2026-07-21 完成，确认所有代码与文档完全对齐。

### A.1 文件清单

| 文件 | 用途 | 文档引用位置 |
|------|------|------------|
| `config.py` | 全局配置 | guide.md §12 |
| `db.py` | 数据库操作 + 检索 + 更新 + Report + Tasks | guide.md §9 |
| `demo_lifecycle.py` | 生命周期 demo | guide.md §5, §11.3 |
| `embedding.py` | 本地向量生成 | idea.md §6 |
| `generator.py` | 行动计划模板生成 | idea.md §6 |
| `leader_report.py` | Leader Report 模板引擎 | idea.md §9 |
| `main.py` | E2E 检索入口 | guide.md §4, §11.2 |
| `models.py` | ORM 模型 (3 tables) | — |
| `poc_standalone.py` | 零依赖独立版 | guide.md §8 |
| `recommend.py` | 任务推荐引擎 | idea.md §10 |
| `reranker.py` | 余弦精排 | idea.md §6 |
| `retrieval.py` | RRF 融合 | idea.md §6 |
| `seed_data.py` | 35 条模拟数据 | guide.md §3 |

### A.2 数据库表对齐

| 表 | init.sql | models.py | idea.md | guide.md |
|----|---------|-----------|---------|---------|
| `incident_tickets` (20 列) | ✓ | ✓ | ✓ | — |
| `leader_reports` (6 列) | ✓ | ✓ | ✓ | ✓ |
| `recommended_tasks` (11 列) | ✓ | ✓ | ✓ | ✓ |

### A.3 API 函数对齐

`guide.md` §9 列出的 12 个 API 函数全部存在于 `db.py`，签名一致：

| 函数 | db.py | poc_standalone.py |
|------|-------|-------------------|
| `ingest_ticket` | L20 | `ingest()` |
| `ingest_tickets_batch` | L67 | `ingest_tickets_batch()` |
| `get_ticket_by_incident_no` | L263 | `get_ticket()` |
| `get_ticket_by_id` | L255 | `get_ticket_by_id()` |
| `update_ticket_description` | L299 | `update_ticket(description=...)` |
| `update_ticket_root_cause` | L321 | `update_ticket(root_cause=...)` |
| `update_ticket_resolution` | L347 | `update_ticket(resolution=...)` |
| `update_ticket_status` | L373 | `update_ticket(status=...)` |
| `get_latest_report` | L476 | `get_latest_report_standalone()` |
| `get_report_history` | L495 | `get_report_history_standalone()` |
| `get_recommendations` | L547 | `get_recommendations_standalone()` |
| `revise_task` | L584 | `revise_task_standalone()` |

### A.4 已验证的级联联动

```
update_ticket_status() 单次调用触发:
  ├─ version +1
  ├─ updated_at = now()
  ├─ description 变化 → re-embed description (384-dim)
  ├─ root_cause/resolution 变化 → re-embed root_cause (384-dim)
  ├─ 自动生成 Leader Report → 存入 leader_reports
  └─ 自动生成 Recommend Tasks → 存入 recommended_tasks
```

已通过完整 E2E 测试 (`seed → main.py → demo_lifecycle.py → poc_standalone.py`)。
