"""Axon — Multi-Agent A-Share Analysis Terminal."""

import asyncio
import json
import logging
import os
import queue
import re
import threading
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Axon API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

AXON_HOME = Path(os.path.expanduser("~/.axon"))
AXON_HOME.mkdir(parents=True, exist_ok=True)

_CODE_RE = re.compile(r"^[A-Z]{3}\d{3}$")

# 授权码白名单文件：一行一个码，# 开头为注释
_CODES_FILE = AXON_HOME / "codes.txt"


def _valid_codes() -> set[str]:
    """读取授权码白名单。文件不存在时创建默认文件。"""
    if not _CODES_FILE.exists():
        _CODES_FILE.write_text("# Axon 授权码（一行一个）\n# 用 ssh 登录服务器编辑此文件：\n#   nano ~/.axon/codes.txt\n\n", encoding="utf-8")
    codes = set()
    for line in _CODES_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            codes.add(line)
    return codes


# ---- User helpers ----

def _user_dir(code: str) -> Path:
    d = AXON_HOME / code
    d.mkdir(parents=True, exist_ok=True)
    return d


def _user_config(code: str) -> dict:
    cf = _user_dir(code) / "config.json"
    if cf.exists():
        return json.loads(cf.read_text(encoding="utf-8"))
    return {}


def _save_user_config(code: str, config: dict) -> None:
    cf = _user_dir(code) / "config.json"
    cf.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def _get_ds_key(code: str) -> str:
    cfg = _user_config(code)
    user_key = cfg.get("ds_key", "")
    if user_key:
        return user_key
    # 兜底：管理员无限用，普通用户免费 3 次
    if code == os.getenv("AXON_ADMIN_CODE", "MOZ308"):
        return os.getenv("DEEPSEEK_API_KEY", "")
    used = cfg.get("free_used", 0)
    if used >= 3:
        return ""  # 免费次数用完
    return os.getenv("DEEPSEEK_API_KEY", "")


def _bump_usage(code: str) -> int:
    """记录一次使用，返回剩余免费次数。管理员和自有Key用户不计数."""
    cfg = _user_config(code)
    if cfg.get("ds_key", "") or code == os.getenv("AXON_ADMIN_CODE", "MOZ308"):
        return -1  # unlimited
    used = cfg.get("free_used", 0) + 1
    cfg["free_used"] = used
    _save_user_config(code, cfg)
    return max(0, 3 - used)


def _get_model_config(code: str) -> dict:
    """Return user's model preferences: {deep_model, quick_model, api_base}."""
    cfg = _user_config(code)
    return {
        "deep_model": cfg.get("deep_model", "deepseek-v4-pro"),
        "quick_model": cfg.get("quick_model", "deepseek-v4-flash"),
        "api_base": cfg.get("api_base", "https://api.deepseek.com/chat/completions"),
    }


def _results_dir(code: str) -> Path:
    d = _user_dir(code) / "logs"
    d.mkdir(parents=True, exist_ok=True)
    return d


_GRAPHS: dict[str, TradingAgentsGraph] = {}


def _get_graph(code: str, ds_key: str) -> TradingAgentsGraph:
    if code not in _GRAPHS:
        mc = _get_model_config(code)
        config = DEFAULT_CONFIG.copy()
        # Override results_dir from env var (set in event_stream before _get_graph call)
        if os.environ.get("TRADINGAGENTS_RESULTS_DIR"):
            config["results_dir"] = os.environ["TRADINGAGENTS_RESULTS_DIR"]
        if os.environ.get("TRADINGAGENTS_CACHE_DIR"):
            config["data_cache_dir"] = os.environ["TRADINGAGENTS_CACHE_DIR"]
        os.environ["DEEPSEEK_API_KEY"] = ds_key  # may be empty; user will get API error if not set
        # Inject user model preferences
        os.environ["TRADINGAGENTS_DEEP_THINK_LLM"] = mc["deep_model"]
        os.environ["TRADINGAGENTS_QUICK_THINK_LLM"] = mc["quick_model"]
        if mc["api_base"]:
            os.environ["TRADINGAGENTS_BASE_URL"] = mc["api_base"]
        _GRAPHS[code] = TradingAgentsGraph(debug=False, config=config)
    return _GRAPHS[code]


# ---- Auth ----

@app.post("/api/auth/verify")
async def verify_code(request: Request) -> JSONResponse:
    body = await request.json()
    code = (body.get("code") or "").strip()
    if not _CODE_RE.match(code):
        return JSONResponse({"error": "invalid code"}, status_code=400)
    if code not in _valid_codes():
        return JSONResponse({"error": "访问码无效，请向管理员索取"}, status_code=403)
    _user_dir(code)
    mc = _get_model_config(code)
    cfg = _user_config(code)
    has_own_key = bool(cfg.get("ds_key", ""))
    free_used = cfg.get("free_used", 0)
    is_admin = code == os.getenv("AXON_ADMIN_CODE", "MOZ308")
    remaining = -1 if (has_own_key or is_admin) else max(0, 3 - free_used)
    return JSONResponse({
        "ok": True,
        "has_key": bool(_get_ds_key(code)),
        "remaining": remaining,  # -1 = unlimited, 0-3 = remaining free
        "config": {
            "deep_model": mc["deep_model"],
            "quick_model": mc["quick_model"],
            "api_base": mc["api_base"],
            "favorites": cfg.get("favorites", ["600519", "000725", "600667", "300750"]),
        },
    })


@app.post("/api/auth/settings")
async def save_settings(request: Request) -> JSONResponse:
    body = await request.json()
    code = (body.get("code") or "").strip()
    if not _CODE_RE.match(code):
        return JSONResponse({"error": "invalid code"}, status_code=400)
    cfg = _user_config(code)
    for field in ["ds_key", "deep_model", "quick_model", "api_base"]:
        val = body.get(field, "").strip()
        if val:
            cfg[field] = val
    if "favorites" in body and isinstance(body["favorites"], list):
        cfg["favorites"] = body["favorites"]
    _save_user_config(code, cfg)
    # Clear cached graph so next analysis picks up new config
    _GRAPHS.pop(code, None)
    return JSONResponse({"ok": True})


# ---- Results (per-user) ----

def _scan_user_results(code: str) -> list[dict]:
    results_dir = _results_dir(code)
    results = []
    if not results_dir.exists():
        return results
    for td in sorted(results_dir.iterdir(), key=os.path.getmtime, reverse=True):
        if not td.is_dir():
            continue
        log_dir = td / "TradingAgentsStrategy_logs"
        if not log_dir.exists():
            continue
        for jf in sorted(log_dir.glob("full_states_log_*.json"), key=os.path.getmtime, reverse=True):
            date_str = jf.stem.replace("full_states_log_", "")
            results.append({"ticker": td.name, "date": date_str, "mtime": os.path.getmtime(jf)})
    results.sort(key=lambda r: r["mtime"], reverse=True)
    return results


def _load_user_result(code: str, ticker: str, date: str) -> dict | None:
    jf = _results_dir(code) / ticker / "TradingAgentsStrategy_logs" / f"full_states_log_{date}.json"
    if not jf.exists():
        return None
    data = json.loads(jf.read_text(encoding="utf-8"))
    return {
        "ticker": data.get("company_of_interest", ticker),
        "date": data.get("trade_date", date),
        "decision": (data.get("final_trade_decision", "") or ""),
        "market_report": (data.get("market_report", "") or ""),
        "sentiment_report": (data.get("sentiment_report", "") or ""),
        "news_report": (data.get("news_report", "") or ""),
        "fundamentals_report": (data.get("fundamentals_report", "") or ""),
        "investment_plan": (data.get("investment_plan", "") or ""),
    }


def _get_code(request: Request) -> str:
    return request.headers.get("X-Axon-Code", "").strip()


@app.get("/api/results")
async def list_results(request: Request) -> JSONResponse:
    code = _get_code(request)
    if not code:
        return JSONResponse({"error": "no access code"}, status_code=401)
    return JSONResponse([{"ticker": r["ticker"], "date": r["date"]} for r in _scan_user_results(code)])


@app.get("/api/results/{ticker}/{date}")
async def get_result(ticker: str, date: str, request: Request) -> JSONResponse:
    code = _get_code(request)
    if not code:
        return JSONResponse({"error": "no access code"}, status_code=401)
    result = _load_user_result(code, ticker, date)
    if result is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(result)


@app.get("/api/latest")
async def latest_result(request: Request) -> JSONResponse:
    code = _get_code(request)
    if not code:
        return JSONResponse({"error": "no access code"}, status_code=401)
    results = _scan_user_results(code)
    if not results:
        return JSONResponse({"error": "暂无分析结果"}, status_code=404)
    result = _load_user_result(code, results[0]["ticker"], results[0]["date"])
    if result is None:
        return JSONResponse({"error": "暂无分析结果"}, status_code=404)
    return JSONResponse(result)


# ---- SSE Analysis ----

def _format_sse(event_type: str, data: str) -> bytes:
    return f"event: {event_type}\ndata: {data}\n\n".encode("utf-8")


@app.post("/api/analyze")
async def analyze(request: Request) -> StreamingResponse:
    code = _get_code(request)
    if not code:
        return JSONResponse({"error": "no access code"}, status_code=401)

    ds_key = _get_ds_key(code)
    if not ds_key:
        cfg = _user_config(code)
        used = cfg.get("free_used", 0)
        if used >= 3 and not cfg.get("ds_key"):
            return JSONResponse({"error": f"免费试用次数已用完（{used}/3），请在设置中配置自己的 DeepSeek API Key"}, status_code=402)
        return JSONResponse({"error": "请先在设置中配置 DeepSeek API Key"}, status_code=400)

    body = await request.json()
    ticker = body.get("ticker", "").strip().upper()
    date = body.get("date", "").strip()
    if not ticker or not date:
        return JSONResponse({"error": "ticker and date required"}, status_code=400)

    agent_order = [
        "Market Analyst", "Sentiment Analyst", "News Analyst",
        "Fundamentals Analyst", "Bull Researcher", "Bear Researcher",
        "Trader", "Portfolio Manager",
    ]
    step_index = {name: i + 1 for i, name in enumerate(agent_order)}
    total = len(agent_order)

    async def event_stream():
        # Point TradingAgents to user's results dir
        user_results = str(_results_dir(code))
        os.environ["TRADINGAGENTS_RESULTS_DIR"] = user_results
        os.environ["TRADINGAGENTS_CACHE_DIR"] = str(_user_dir(code) / "cache")

        graph = _get_graph(code, ds_key)
        q: queue.Queue = queue.Queue()
        seen_agents: set[str] = set()
        done_agents: set[str] = set()
        seen_chunks: set[int] = set()
        loop = asyncio.get_running_loop()

        yield _format_sse("connected", "{}")

        def runner():
            try:
                for event in graph.propagate_stream(ticker, date):
                    q.put(event)
                q.put({"event": "done"})
            except Exception as exc:
                logger.exception("Stream error for %s on %s", ticker, date)
                q.put({"event": "error", "fatal": True, "error": str(exc)})

        thread = threading.Thread(target=runner, daemon=True)
        thread.start()

        try:
            while thread.is_alive() or not q.empty():
                try:
                    event = await loop.run_in_executor(None, q.get, True, 0.5)
                except queue.Empty:
                    continue
                evt = event.get("event")
                agent = event.get("agent", "")
                if agent and agent not in seen_agents and evt != "heartbeat":
                    seen_agents.add(agent)
                    step = step_index.get(agent, 0)
                    if step:
                        yield _format_sse("agent_start", json.dumps(
                            {"agent": agent, "step": step, "total": total}, ensure_ascii=False))
                if evt == "heartbeat":
                    continue
                elif evt == "done":
                    remaining = _bump_usage(code)
                    yield _format_sse("done", json.dumps({"remaining": remaining}))
                    return
                elif evt == "error":
                    yield _format_sse("error", json.dumps(event, ensure_ascii=False))
                    if event.get("fatal"):
                        return
                elif evt == "agent_done":
                    if agent and agent not in done_agents:
                        done_agents.add(agent)
                        yield _format_sse(evt, json.dumps(event, ensure_ascii=False))
                elif evt == "decision":
                    yield _format_sse(evt, json.dumps(event, ensure_ascii=False))
                else:
                    content = event.get("content", "")
                    if content:
                        h = hash(content)
                        if h in seen_chunks:
                            continue
                        seen_chunks.add(h)
                    yield _format_sse(evt, json.dumps(event, ensure_ascii=False))
        except Exception as exc:
            logger.exception("Consumer error for %s on %s", ticker, date)
            yield _format_sse("error", json.dumps({"error": str(exc), "fatal": True}, ensure_ascii=False))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ---- Q&A ----

INTENT_ROUTES = [
    (["均线", "MACD", "RSI", "布林", "KDJ", "成交量", "K线", "技术指标", "支撑", "阻力", "trend", "indicator", "sma", "ema"], "market_report", "Market Analyst"),
    (["资金", "主力", "散户", "情绪", "龙虎榜", "净流入", "净流出", "fund flow", "sentiment"], "sentiment_report", "Sentiment Analyst"),
    (["新闻", "宏观", "政策", "利率", "CPI", "GDP", "美联储", "news", "macro", "fed"], "news_report", "News Analyst"),
    (["估值", "PE", "PB", "ROE", "财报", "营收", "利润", "资产负债", "fundamental", "valuation", "earnings"], "fundamentals_report", "Fundamentals Analyst"),
    (["为什么", "理由", "逻辑", "决策", "评级", "减仓", "清仓", "买入", "卖出", "why", "decision", "reasoning"], "decision", "Portfolio Manager"),
]


def _find_best_segment(text: str, question: str) -> dict:
    if not text or not question:
        return {"segment": "", "source": "", "score": 0}
    paras = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 40]
    if not paras:
        paras = [text]
    q_words = set(question.lower().split())
    scored = [(sum(1 for w in q_words if len(w) > 1 and w in p.lower()), p) for p in paras]
    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_para = scored[0]
    best_idx = next((i for i, (_, p) in enumerate(scored) if p == best_para), 0)
    ctx = []
    for offset in [-1, 0, 1]:
        idx = best_idx + offset
        if 0 <= idx < len(paras):
            ctx.append(paras[idx])
    return {"segment": best_para[:600], "context": "\n\n".join(ctx)[:2000], "score": min(best_score / max(len(q_words), 1), 1.0)}


@app.post("/api/ask")
async def ask_question(request: Request) -> JSONResponse:
    code = _get_code(request)
    if not code:
        return JSONResponse({"error": "no access code"}, status_code=401)
    body = await request.json()
    ticker = body.get("ticker", "").strip().upper()
    date = body.get("date", "").strip()
    question = body.get("question", "").strip()
    if not ticker or not date or not question:
        return JSONResponse({"error": "ticker, date and question required"}, status_code=400)
    result = _load_user_result(code, ticker, date)
    if result is None:
        return JSONResponse({"error": "analysis not found"}, status_code=404)
    q_lower = question.lower()
    target_key = None
    source_agent = "Report"
    for keywords, key, agent in INTENT_ROUTES:
        if any(kw in q_lower for kw in keywords):
            target_key = key; source_agent = agent; break
    if target_key == "decision":
        search_text = result.get("decision", "")
    elif target_key:
        search_text = result.get(target_key, "")
    else:
        search_text = "\n\n".join([result.get(k, "") for k in ["market_report", "sentiment_report", "news_report", "fundamentals_report", "decision"]])
        source_agent = "Full Report"
    hit = _find_best_segment(search_text, question)
    if hit["score"] < 0.05:
        return JSONResponse({"answer": "报告中没有直接覆盖这个问题的相关内容。", "source": source_agent, "confidence": "low", "context": hit["context"][:500]})
    try:
        import httpx
        ds_key = _get_ds_key(code)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.deepseek.com/chat/completions",
                headers={"Authorization": f"Bearer {ds_key}"},
                json={"model": "deepseek-chat", "temperature": 0.3, "max_tokens": 600, "messages": [
                    {"role": "system", "content": "You are a financial report Q&A assistant. Answer based ONLY on the provided context. Be concise. Quote specific data when available. Reply in the same language as the question."},
                    {"role": "user", "content": f"Report context (source: {source_agent}):\n\n{hit['context']}\n\nQuestion: {question}\n\nAnswer:"},
                ]})
            data = resp.json()
            answer = data["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.warning("Q&A DeepSeek failed: %s", exc)
        answer = f"（LLM 调用失败）\n\n{hit['context'][:600]}"
        source_agent += " (raw)"
    return JSONResponse({"answer": answer, "source": source_agent, "confidence": "high" if hit["score"] > 0.15 else "medium"})


@app.post("/api/admin/gen-codes")
async def gen_codes(request: Request) -> JSONResponse:
    """管理员生成授权码。需要 admin key."""
    import random, string
    body = await request.json()
    admin_key = body.get("admin_key", "").strip()
    if admin_key != os.getenv("AXON_ADMIN_KEY", "axon-admin-2026"):
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    count = min(int(body.get("count", 1)), 20)
    existing = _valid_codes()
    new_codes = []
    for _ in range(count * 5):
        c = ''.join(random.choices(string.ascii_uppercase, k=3)) + ''.join(random.choices(string.digits, k=3))
        if c not in existing and c not in new_codes:
            new_codes.append(c)
        if len(new_codes) >= count:
            break
    with open(_CODES_FILE, "a", encoding="utf-8") as f:
        for c in new_codes:
            f.write(f"{c}\n")
    return JSONResponse({"codes": new_codes})


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
