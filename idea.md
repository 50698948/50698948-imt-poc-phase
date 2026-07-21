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
| title | TEXT | 标题 |
| description | TEXT | 问题描述 |
| root_cause | TEXT (nullable) | 根因（已解决时填写） |
| resolution | TEXT (nullable) | 解决方案 |
| action_plan | TEXT (nullable) | 行动计划 |
| severity | VARCHAR(16) | P0 / P1 / P2 / P3 |
| service_name | VARCHAR(128) | 受影响服务 |
| category | VARCHAR(64) | 分类 |
| status | VARCHAR(16) | open / resolved |
| error_type | VARCHAR(64) | timeout / OOM / panic / deadlock / ... |
| keywords | TEXT[] | 提取关键词 |
| embedding_description | VECTOR(1536) | 问题描述向量 |
| embedding_root_cause | VECTOR(1536) | 根因+方案向量（已解决才有） |
| created_at / resolved_at | TIMESTAMPTZ | 时间 |

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
