# Incident Ticket 智能召回与分析 — PoC 设计

## 1. 目标

给定当前 incident ticket，从 PostgreSQL 18 + pgvector 中召回历史类似 ticket，结合 LLM 综合分析，输出推荐行动计划。

**PoC 范围**：端到端验证可行性，不追求生产级性能和规模。

---

## 2. 数据模型

### incident_tickets 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| incident_no | VARCHAR(32) UNIQUE | 人类可读的 ticket 编号 |
| title | TEXT | 标题 |
| description | TEXT | 问题描述 |
| root_cause | TEXT (nullable) | 根因（已解决时填写） |
| resolution | TEXT (nullable) | 解决方案 |
| action_plan | TEXT (nullable) | 行动计划 |
| severity | VARCHAR(16) | P0 / P1 / P2 / P3 |
| service_name | VARCHAR(128) | 受影响服务 |
| category | VARCHAR(64) | 分类 |
| status | VARCHAR(16) | open / investigating / mitigated / resolved |
| error_type | VARCHAR(64) | timeout / OOM / panic / deadlock / ... |
| keywords | TEXT[] | 提取关键词 |
| embedding_description | VECTOR(384) | 问题描述向量（离线 384d，LLM 模式可用 1536d） |
| embedding_root_cause | VECTOR(384) | 根因+方案向量（同上） |
| created_at / updated_at / resolved_at | TIMESTAMPTZ | 时间 |
| version | INT | 更新计数器 |

### 索引

- `ivfflat` 索引 on `embedding_description` (cosine)
- `ivfflat` 索引 on `embedding_root_cause` (cosine)
- GIN 索引 on `to_tsvector('english', title || ' ' || description || ' ' || coalesce(root_cause, ''))`

---

## 3. 检索 Pipeline（PoC 三级）

```
                  ┌─ 路径A: 语义向量检索 ──┐
当前Ticket ───────┼─ 路径B: 全文检索FS ───┼── RRF融合(Top30) ── LLM精排(Top5) ── 行动计划生成
                  └─ 路径C: 结构化过滤 ───┘
```

### 3.1 多路召回（粗排）

| 路径 | 方法 | 返回数 |
|------|------|--------|
| A - 语义检索 | `embedding_description <=> query_embedding` (cosine) | Top-50 |
| B - 全文检索 | `ts_rank(... , plainto_tsquery(...))` | Top-50 |
| C - 结构化匹配 | `service_name = ? AND category = ? AND severity >= ?` | Top-30 |

### 3.2 RRF 融合

```
RRF( doc ) = Σ ( 1 / (k + rank_i) )   , k = 60
```

合并去重后取 Top-30。

### 3.3 精排

对 Top-30 候选统一送入 LLM 做批量打分（listwise ranking），评估维度：
- 根因是否一致（权重最高）
- 症状重叠度
- 方案可复用性
- 影响组件是否重叠

取 Top-5~10 作为最终召回。

---

## 4. 召回质量提升要点（PoC 级别）

| 要点 | PoC 实现 |
|------|----------|
| 多粒度向量 | description 向量 + root_cause 向量，检索用前者，精排时后者加权 |
| 多路召回融合 | 向量 + 全文 + 结构化，RRF 融合防止单一通路偏差 |
| LLM 精排 | 批量 listwise ranking，检查因果一致性 |
| Query Expansion | LLM 把当前 ticket 改写为2种变体，多次查询取并集 |
| 结构化过滤 | 精确匹配 service/category/error_type 缩小候选范围 |

---

## 5. 行动计划生成

将当前 ticket + Top-K 历史 ticket 一并送入 LLM，prompt 要求输出：

1. **对齐分析**：当前症状与历史 ticket 的对应关系
2. **根因推测**（按概率降序），引用历史 resolution 做证据
3. **分步行动计划**：紧急止血 → 定位验证 → 根因修复
4. **置信度标注**：high / medium / low + 依据

---

## 6. 实施步骤（PoC）

| 序号 | 步骤 | 产出 |
|------|------|------|
| 1 | 搭建 PostgreSQL 18 + pgvector 环境 | docker-compose.yml |
| 2 | 建表 + 索引 | SQL migration |
| 3 | 编写 embedding 生成模块 | embedding.py (OpenAI / 本地模型) |
| 4 | 编写数据入库模块 | db.py (ingest) |
| 5 | 生成 50+ 条模拟 ticket 并入库 | seed_data.py |
| 6 | 实现多路检索 + RRF 融合 | retrieval.py |
| 7 | 实现 LLM 精排 | reranker.py |
| 8 | 实现行动计划生成 | generator.py |
| 9 | E2E 验证 | main.py 跑通全链路 |

---

## 7. 待验证假设

1. **多粒度向量比单向量召回命中率更高**（定量对比 MRR / Recall@K）
2. **RRF 融合三路优于纯向量检索**（消融实验）
3. **LLM 精排能识别“描述相似但根因不同”的 case**（构造易混淆样本测试）
4. **Query Expansion 能提升 Recall**（对比单次 vs 多次查询的 Recall@K）

---

## 8. Ticket 生命周期与向量动态更新

Incident ticket 随 event 持续发生而不断更新（description/root_cause/resolution），
embedding 必须随之刷新才能保证召回质量不退化。

### 8.1 新增字段

| 字段 | 作用 |
|------|------|
| `updated_at` | 记录最后更新时间 |
| `version` | 计数器，每次更新 +1 |
| `status` 扩展 | `open → investigating → mitigated → resolved` 四态流转 |

### 8.2 更新 API（`db.py`）

| 函数 | 行为 |
|------|------|
| `update_ticket_description(no, text)` | 更新描述 + 自动重新 embed description |
| `update_ticket_root_cause(no, text)` | 更新根因 + 自动重新 embed root_cause |
| `update_ticket_resolution(no, text)` | 更新方案 + 自动重新 embed root_cause+resolution |
| `update_ticket_status(no, status, ...)` | 状态转移 + 可选附带更新描述/根因/方案并 re-embed |

### 8.3 生命周期 Demo（`demo_lifecycle.py`）

模拟一个真实 incident 从模糊告警到完整解决的演进过程：

```
Stage 0 (T+0min):  模糊描述，仅 "payment service failing" → 召回质量低
Stage 1 (T+10min): SRE 补充详情（线程/连接池指标）→ 召回质量提升
Stage 2 (T+45min): 根因定位（N+1 连接模式）→ embedding_root_cause 精准命中历史
Stage 3 (T+90min): 解决 + resolution 入库 → status=resolved, 完整闭环
```

每个阶段输出 Top-5 召回结果 + 最终汇总表展示 score 随阶段递增的趋势。

运行方式：`python demo_lifecycle.py`

---

## 9. Leadership Report — 动态生成 Leader 汇报

每次 incident ticket 更新时，自动生成面向 Leader 的结构化汇报报告。
报告包含 3-5 条重点标注（highlights）。

### 9.1 报告模板

```
INCIDENT LEADERSHIP REPORT
  1. Executive Summary    — 当前状态 + 最相似历史 ticket 匹配
  2. Current Status       — status / severity / error_type / service
  3. Impact Assessment    — 按 severity 等级描述影响面
  4. Investigation Progress — root_cause 是否已定位 / resolution 是否已实施
  5. Key Highlights (3-5) — 动态标注
  6. Recommended Next Steps — 按 status 推荐下一步动作
```

### 9.2 Highlights 生成规则

| 优先级 | 条件 | 内容 |
|--------|------|------|
| HL1 | 始终 | `[STATUS]` 当前状态 + 严重级别 |
| HL2 | root_cause 已填写 | `[ROOT CAUSE]` 根因摘要 |
| HL3 | resolution 已填写 | `[ACTION]` 已执行操作 |
| HL4-5 | 存在相似 ticket | `[REFERENCE]` 历史类似 case |
| HL 末 | 始终 | `[NEXT]` 下一步建议 |

### 9.3 数据库

新增 `leader_reports` 表，关联到每个 ticket version，存储完整报告文本 + highlights 数组。

### 9.4 实现文件

`leader_report.py`：报告模板引擎 + highlights 自动提取逻辑。

每次 `update_ticket_status()` 调用结束后自动生成并持久化一份报告。
可通过 `get_latest_report(incident_no)` / `get_report_history(incident_no)` 查询。

---

## 10. Engineer Task Recommendations — 可人工修订的任务推荐

每次 ticket 更新时，自动为处理工程师生成推荐任务列表。工程师可以标记完成/拒绝/添加备注。

### 10.1 任务生成规则

| 来源 | 示例 | 优先级 |
|------|------|--------|
| error_type 模板 | "Check connection pool metrics for {service}" | 最高 (3条) |
| SRE playbook 通用 | "Assess blast radius / Check recent deployments" | 中 (4条) |
| 相似历史 ticket action_plan | 提取历史 solution 中的操作步骤 | 低 |
| 当前根因确认 | "Confirm root cause hypothesis: ..." | 有 root_cause 时追加 |

### 10.2 数据库

新增 `recommended_tasks` 表，字段含：task_order, description, source, status (pending/in_progress/completed/rejected), revised_by, revision_note。

### 10.3 实现文件

`recommend.py`：任务推荐引擎 — 按 error_type 匹配 SRE playbook 模板，提取历史 action_plan。

### 10.4 人工修订 API

```python
from db import revise_task
revise_task(task_id, status="completed", revised_by="david.lin", revision_note="Verified pool metrics — back to normal")
```

### 10.4 数据表

| 表 | 用途 |
|------|------|
| `incident_tickets` | 核心 ticket 数据 + 向量 |
| `leader_reports` | 汇报报告（每版本一份） |
| `recommended_tasks` | 推荐任务（可人工修订） |
