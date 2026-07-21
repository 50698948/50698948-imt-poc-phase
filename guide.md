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
11. [常见问题](#11-常见问题)

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
- **Leader Report Highlights** — 自动生成的 3-5 条汇报要点

最终输出：
- **生命周期汇总表** — score 趋势对比
- **Report 历史汇总** — 各版本报告的 highlights 变化

### 5.4 演示话术

> "Incident ticket 不是静态文档。随着事件发展，SRE 不断补充信息——从模糊告警到精确根因。系统每次更新时自动刷新向量、重新召回、生成汇报。从 Stage 0 到 Stage 3，召回分数从 5.6 提升到 18.3（+226%），Leader Report 从仅显示 STATUS+NEXT 演进到包含 ROOT CAUSE+ACTION+REFERENCE。"

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

v4  [STATUS] RESOLVED  |  [ROOT CAUSE] N+1 connection pattern...  |  [ACTION] Rolled back deployment...  |  [REFERENCE] INC-2024-0002  |  [REFERENCE] INC-2024-0001
```

### 6.6 演示话术

> "每次 ticket 更新，系统自动为 Leader 生成一份结构化汇报——包括当前状态、影响评估、调查进展，以及 3-5 条重点标注。汇报版本与 ticket version 一一对应，可以追溯整个 incident 生命周期中每个关键节点的状态快照。"

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

### 7.6 演示话术

> "除了向 Leader 汇报，系统还面向一线工程师生成可操作的任务推荐——按错误类型匹配 SRE playbook，从历史 ticket 的 action_plan 中提取步骤。每个 task 都可以被人工修订：标记完成、添加备注、或拒绝不适用项。这就是人机协作的 incident 处理流程。"

---

## 8. 独立模式 — 零依赖运行

### 7.1 适用场景

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

### 8.1 入库

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

### 8.2 查询

```python
from db import get_ticket_by_incident_no, get_ticket_by_id

ticket = get_ticket_by_incident_no("INC-2025-0001")
print(ticket["title"], ticket["status"], ticket["version"])
```

### 8.3 更新（触发 re-embed）

```python
from db import (
    update_ticket_description,    # 更新描述 + re-embed description
    update_ticket_root_cause,     # 更新根因 + re-embed root_cause
    update_ticket_resolution,     # 更新方案 + re-embed root_cause+resolution
    update_ticket_status,         # 状态转移 + 可选字段更新 + 自动生成 Leader Report
)

update_ticket_status("INC-2025-0001", "investigating",
    description="Enriched description...",
    error_type="timeout",
)
# ↑ 自动: version += 1, updated_at=now(), re-embed, generate leader report
```

### 8.4 Leader Report

```python
from db import get_latest_report, get_report_history

latest = get_latest_report("INC-2025-0001")
for hl in latest["highlights"]:
    print(f"  * {hl}")

history = get_report_history("INC-2025-0001")
print(f"Total reports: {len(history)}")
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

## 11. 常见问题

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

# 更新
from db import update_ticket_description
update_ticket_description("INC-2025-0001", "New longer description...")

after = get_ticket_by_incident_no("INC-2025-0001")
print(f"After:  v{after['version']}, desc_len={len(after['description'])}")
# version 自增，embedding 自动刷新
```

### Q: argv 或 RRF 参数如何调参

编辑 `config.py`：
```python
VECTOR_TOPK = 50    # 向量路径返回数
FTS_TOPK = 50       # 全文检索返回数
STRUCT_TOPK = 30    # 结构化匹配返回数
RRF_K = 60          # RRF 融合常数 k
MERGE_TOPK = 30     # RRF 融合后返回数
FINAL_TOPK = 5      # 精排后最终返回数
```
