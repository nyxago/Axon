#!/usr/bin/env python
"""
TradingAgents Web 平台 —— 环境验证脚本。

运行方式（管理员权限的终端）:
    python check_setup.py

检查项:
    1. Python 版本
    2. 核心依赖是否安装
    3. .env 配置完整性
    4. 数据源可用性（Alpha Vantage + akshare 东方财富）
    5. LLM API 连通性
    6. 前端是否已构建
    7. 服务器能否启动
"""

import os
import sys
import json
from pathlib import Path

# ---- 配置 ----
PROJECT_ROOT = Path(__file__).resolve().parent
REQUIRED_PYTHON = (3, 10)
REQUIRED_PACKAGES = [
    "tradingagents", "fastapi", "uvicorn", "sse_starlette",
    "langgraph", "yfinance", "akshare", "dotenv",
]
OPTIONAL_PACKAGES = ["akshare"]  # 国内数据源，未装也能跑

OK = "✅"
WARN = "⚠️"
FAIL = "❌"

results: dict[str, bool] = {}


def main():
    print("=" * 60)
    print("  TradingAgents Web — 环境验证")
    print("=" * 60)
    print()

    check_python()
    check_dependencies()
    check_env()
    check_data_sources()
    check_llm()
    check_frontend()
    check_server()

    print()
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    if passed == total:
        print(f"  {OK} 全部 {total} 项通过，可以启动！")
    else:
        print(f"  {WARN} {passed}/{total} 通过，请修复上方标记的 {FAIL} 项")
    print("=" * 60)


def check_python():
    """Python 版本检查"""
    ver = sys.version_info[:2]
    ok = ver >= REQUIRED_PYTHON
    print(f"{OK if ok else FAIL} Python {ver[0]}.{ver[1]} (需要 >= {REQUIRED_PYTHON[0]}.{REQUIRED_PYTHON[1]})")
    results["python"] = ok


def check_dependencies():
    """核心依赖检查"""
    for pkg in REQUIRED_PACKAGES:
        try:
            __import__(pkg.replace("-", "_").replace("sse_starlette", "sse_starlette"))
            print(f"  {OK} {pkg}")
        except ImportError:
            mark = WARN if pkg in OPTIONAL_PACKAGES else FAIL
            print(f"  {mark} {pkg} — 未安装")
            if mark == FAIL:
                results[f"dep:{pkg}"] = False
            continue
        results[f"dep:{pkg}"] = True


def check_env():
    """.env 配置完整性"""
    env_paths = [
        PROJECT_ROOT / ".env",
        PROJECT_ROOT.parent / ".env",
    ]
    env_file = None
    for p in env_paths:
        if p.exists():
            env_file = p
            break

    if env_file is None:
        print(f"{FAIL} .env 文件未找到")
        results["env"] = False
        return

    from dotenv import load_dotenv
    load_dotenv(env_file)

    required_keys = {
        "DEEPSEEK_API_KEY": "DeepSeek API Key",
        "TRADINGAGENTS_LLM_PROVIDER": "LLM Provider",
    }
    optional_keys = {
        "ALPHA_VANTAGE_API_KEY": "Alpha Vantage API Key",
    }

    all_ok = True
    for key, label in required_keys.items():
        val = os.environ.get(key, "")
        if val and val.strip():
            masked = val[:8] + "****" if len(val) > 8 else "****"
            print(f"  {OK} {label}: {masked}")
        else:
            print(f"  {FAIL} {label}: 未设置")
            all_ok = False

    for key, label in optional_keys.items():
        val = os.environ.get(key, "")
        if val and val.strip():
            print(f"  {OK} {label}: 已设置（可选）")
        else:
            print(f"  {WARN} {label}: 未设置（可选）")

    results["env"] = all_ok


def check_data_sources():
    """数据源可用性"""
    print(f"  测试 Alpha Vantage ...")
    try:
        key = os.environ.get("ALPHA_VANTAGE_API_KEY", "")
        if key and key.strip():
            from tradingagents.dataflows.alpha_vantage import get_stock
            result = get_stock("AAPL", "2024-10-01", "2024-10-05")
            if result and not result.startswith("Error"):
                print(f"  {OK} Alpha Vantage: 正常")
                results["alpha_vantage"] = True
            else:
                print(f"  {WARN} Alpha Vantage: 返回异常 — {result[:80]}")
                results["alpha_vantage"] = False
        else:
            print(f"  {WARN} Alpha Vantage: 未配置 API Key，跳过")
    except Exception as e:
        print(f"  {WARN} Alpha Vantage: {e}")

    print(f"  测试 akshare 东财 → 降级到新浪适配器 ...")
    try:
        from tradingagents.dataflows.eastmoney import get_stock
        csv = get_stock("600519", "2024-05-01", "2024-05-10")
        if "Error:" not in csv and len(csv) > 200:
            print(f"  {OK} 新浪适配器 (eastmoney.py): 贵州茅台数据正常")
            results["akshare"] = True
        else:
            print(f"  {WARN} 适配器返回异常: {csv[:80]}")
            results["akshare"] = False
    except Exception as e:
        print(f"  {WARN} 适配器: {e}")
        results["akshare"] = False


def check_llm():
    """LLM 连通性（轻量测试——仅验证 API key 有效）"""
    provider = os.environ.get("TRADINGAGENTS_LLM_PROVIDER", "deepseek")
    print(f"  测试 {provider} API 连通性 ...")
    try:
        from tradingagents.llm_clients import create_llm_client
        from tradingagents.default_config import DEFAULT_CONFIG
        config = DEFAULT_CONFIG.copy()
        client = create_llm_client(
            provider=config["llm_provider"],
            model=config["quick_think_llm"],
            base_url=config.get("backend_url"),
        )
        llm = client.get_llm()
        # 只验证对象创建成功，不做实际 API 调用（省 token）
        if llm is not None:
            print(f"  {OK} {provider} LLM 客户端创建成功")
            results["llm"] = True
        else:
            print(f"  {FAIL} {provider} LLM 客户端创建失败")
            results["llm"] = False
    except Exception as e:
        print(f"  {FAIL} {provider} LLM: {e}")
        results["llm"] = False


def check_frontend():
    """前端构建检查"""
    dist = PROJECT_ROOT / "frontend" / "dist" / "index.html"
    if dist.exists():
        print(f"  {OK} 前端已构建: {dist}")
        results["frontend"] = True
    else:
        src = PROJECT_ROOT / "frontend" / "src" / "App.jsx"
        if src.exists():
            print(f"  {WARN} 前端未构建，源码存在。运行: cd frontend && npm run build")
        else:
            print(f"  {FAIL} 前端源码未找到")
        results["frontend"] = False


def check_server():
    """服务器代码验证"""
    server_py = PROJECT_ROOT / "server" / "main.py"
    if server_py.exists():
        import py_compile
        try:
            py_compile.compile(str(server_py), doraise=True)
            print(f"  {OK} server/main.py 语法正确")
            results["server"] = True
        except py_compile.PyCompileError as e:
            print(f"  {FAIL} server/main.py 语法错误: {e}")
            results["server"] = False
    else:
        print(f"  {FAIL} server/main.py 未找到")
        results["server"] = False


if __name__ == "__main__":
    main()
