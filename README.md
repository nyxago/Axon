# Axon — A 股多 Agent 智能投研系统

> 🧠 8 位 AI 分析师，一场多空辩论，一份结构化决策报告。

**Axon** 是全球首个面向 **A 股市场**的多 Agent 协作投资研究系统。基于 LangGraph 构建的 8 个专职 AI Agent（市场分析师、情绪分析师、新闻分析师、技术分析师、多空辩论组、风控官、基金经理），通过结构化辩论机制对任意 A 股标的进行全方位复盘分析，最终生成包含评级、观点、风险提示的完整决策报告。

**Forked from [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents)** (v0.3.1, MIT, 94K+ stars)

---

## 与原仓库的区别

| 维度 | TradingAgents 原版 | Axon |
|------|------|------|
| 市场 | 美股（yfinance + Alpha Vantage） | A 股（新浪财经 + akshare + Alpha Vantage） |
| 数据源 | yfinance / Alpha Vantage / FRED / Reddit / StockTwits / Polymarket | 东财新闻 / 新浪OHLCV / 资金流向 / Alpha Vantage（降级） |
| 前端 | CLI + 基础 React | Axon 指挥中心：Agent 实时状态 + Markdown 报告 + 报告问答 |
| 接口 | CLI | Web SSE 实时流 + REST API |
| 部署 | 本地 | 宝塔 + nginx + PM2 + Let's Encrypt |
| 语言 | 英文 | 双语（中文/English 切换） |

## 新增功能

- **A 股全链数据**：新浪财经 OHLCV、东方财富个股新闻、资金流向情绪指标
- **Agent 指挥中心**：8 张 Agent 卡片实时显示状态、动作、耗时
- **Markdown 报告渲染**：表格、标题、粗体完整渲染，点击展开
- **报告问答**：意图路由 + 相关度过滤 + 方案 B 上下文注入 + 来源标注
- **防御纵深**：三层 A 股后缀屏蔽（Prompt → 供应商路由 → 适配器剥离）
- **并发架构**：线程池 + asyncio.Queue，分析期间不阻塞 health check
- **历史回看**：所有分析结果持久化，一键查看

## 技术栈

| 层 | 技术 |
|------|------|
| Agent 框架 | LangGraph + LangChain |
| LLM | DeepSeek V4 Pro / Flash |
| 后端 API | FastAPI + SSE + uvicorn |
| 前端 | React 18 + Vite + marked |
| 数据源 | akshare（新浪财经 + 东方财富）+ Alpha Vantage |
| 部署 | 雨云香港 + 宝塔 + nginx + PM2 + Let's Encrypt |

## 项目结构

```
├── tradingagents/          # 原仓库 Agent 框架（含 A 股适配改动）
│   ├── agents/             # 8 个 Agent（分析师/辩论/风控/PM）
│   ├── graph/              # LangGraph 建图 + 状态传播
│   ├── dataflows/          # 数据供应商层
│   │   ├── eastmoney.py    # 东财/新浪 A 股适配器
│   │   ├── interface.py    # 供应商路由（注册 eastmoney）
│   │   └── symbol_utils.py # is_a_share() 统一入口
│   └── llm_clients/        # LLM 客户端（15+ 提供商）
├── server/                 # Web 服务层
│   └── main.py             # FastAPI + SSE + REST API
├── frontend/               # Axon Web 前端
│   └── src/
│       ├── App.jsx         # 主组件
│       └── components/
│           ├── AgentCard.jsx      # Agent 卡片
│           ├── AgentGrid.jsx      # Agent 网格
│           ├── AskPanel.jsx       # 报告问答面板
│           ├── ReportPanel.jsx    # Markdown 报告
│           ├── ActivityFeed.jsx   # 实时日志
│           ├── Sidebar.jsx        # 侧边栏
│           └── TopBar.jsx         # 顶栏（双语切换）
├── requirements.txt
└── README.md
```

## 快速开始

```bash
# 1. 克隆
git clone https://github.com/nyxago/Axon.git
cd Axon

# 2. 安装依赖
python -m venv venv && source venv/bin/activate
pip install -e .
pip install fastapi uvicorn sse-starlette akshare

# 3. 配置 LLM
cp .env.example .env
# 编辑 .env，填入 DeepSeek API Key

# 4. 启动后端
python server/main.py

# 5. 启动前端
cd frontend && npm install && npm run dev
```

## API

| 端点 | 方法 | 说明 |
|------|:--:|------|
| `/api/analyze` | POST | SSE 实时分析流 |
| `/api/results` | GET | 历史分析列表 |
| `/api/results/{ticker}/{date}` | GET | 指定分析完整结果 |
| `/api/latest` | GET | 最近一次分析 |
| `/api/ask` | POST | 报告问答 |
| `/api/health` | GET | 健康检查 |

## 变更记录

详见 `变更记录.md`（#001 ~ #025）

## License

MIT — 继承自 [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents)

---

> 张宇峰 · FDE 培训 · 2026-07-28
