"""Reusable report-tree writer shared by the CLI and the programmatic API.

Writes a run's per-section markdown (analysts, research, trading, risk,
portfolio) plus a consolidated ``complete_report.md`` under ``save_path``. The
CLI and ``TradingAgentsGraph.save_reports`` both call this, so a headless / API
run produces the same on-disk report tree a CLI run does.
"""

from datetime import datetime
from pathlib import Path

from tradingagents.agents.utils.agent_utils import sanitize_report_text


def write_report_tree(final_state: dict, ticker: str, save_path) -> Path:
    """Save a completed run's reports to ``save_path``; return the complete-report path."""
    save_path = Path(save_path)
    save_path.mkdir(parents=True, exist_ok=True)
    sections = []

    # 1. Analysts
    analysts_dir = save_path / "1_analysts"
    analyst_parts = []
    if final_state.get("market_report"):
        analysts_dir.mkdir(exist_ok=True)
        clean = sanitize_report_text(final_state["market_report"])
        (analysts_dir / "market.md").write_text(clean, encoding="utf-8")
        analyst_parts.append(("Market Analyst", clean))
    if final_state.get("sentiment_report"):
        analysts_dir.mkdir(exist_ok=True)
        clean = sanitize_report_text(final_state["sentiment_report"])
        (analysts_dir / "sentiment.md").write_text(clean, encoding="utf-8")
        analyst_parts.append(("Sentiment Analyst", clean))
    if final_state.get("news_report"):
        analysts_dir.mkdir(exist_ok=True)
        clean = sanitize_report_text(final_state["news_report"])
        (analysts_dir / "news.md").write_text(clean, encoding="utf-8")
        analyst_parts.append(("News Analyst", clean))
    if final_state.get("fundamentals_report"):
        analysts_dir.mkdir(exist_ok=True)
        clean = sanitize_report_text(final_state["fundamentals_report"])
        (analysts_dir / "fundamentals.md").write_text(clean, encoding="utf-8")
        analyst_parts.append(("Fundamentals Analyst", clean))
    if analyst_parts:
        content = "\n\n".join(f"### {name}\n{text}" for name, text in analyst_parts)
        sections.append(f"## I. Analyst Team Reports\n\n{content}")

    # 2. Research
    if final_state.get("investment_debate_state"):
        research_dir = save_path / "2_research"
        debate = final_state["investment_debate_state"]
        research_parts = []
        if debate.get("bull_history"):
            research_dir.mkdir(exist_ok=True)
            clean = sanitize_report_text(debate["bull_history"])
            (research_dir / "bull.md").write_text(clean, encoding="utf-8")
            research_parts.append(("Bull Researcher", clean))
        if debate.get("bear_history"):
            research_dir.mkdir(exist_ok=True)
            clean = sanitize_report_text(debate["bear_history"])
            (research_dir / "bear.md").write_text(clean, encoding="utf-8")
            research_parts.append(("Bear Researcher", clean))
        if debate.get("judge_decision"):
            research_dir.mkdir(exist_ok=True)
            clean = sanitize_report_text(debate["judge_decision"])
            (research_dir / "manager.md").write_text(clean, encoding="utf-8")
            research_parts.append(("Research Manager", clean))
        if research_parts:
            content = "\n\n".join(f"### {name}\n{text}" for name, text in research_parts)
            sections.append(f"## II. Research Team Decision\n\n{content}")

    # 3. Trading
    if final_state.get("trader_investment_plan"):
        trading_dir = save_path / "3_trading"
        trading_dir.mkdir(exist_ok=True)
        clean_trader = sanitize_report_text(final_state["trader_investment_plan"])
        (trading_dir / "trader.md").write_text(clean_trader, encoding="utf-8")
        sections.append(f"## III. Trading Team Plan\n\n### Trader\n{clean_trader}")

    # 4. Risk Management
    if final_state.get("risk_debate_state"):
        risk_dir = save_path / "4_risk"
        risk = final_state["risk_debate_state"]
        risk_parts = []
        if risk.get("aggressive_history"):
            risk_dir.mkdir(exist_ok=True)
            clean = sanitize_report_text(risk["aggressive_history"])
            (risk_dir / "aggressive.md").write_text(clean, encoding="utf-8")
            risk_parts.append(("Aggressive Analyst", clean))
        if risk.get("conservative_history"):
            risk_dir.mkdir(exist_ok=True)
            clean = sanitize_report_text(risk["conservative_history"])
            (risk_dir / "conservative.md").write_text(clean, encoding="utf-8")
            risk_parts.append(("Conservative Analyst", clean))
        if risk.get("neutral_history"):
            risk_dir.mkdir(exist_ok=True)
            clean = sanitize_report_text(risk["neutral_history"])
            (risk_dir / "neutral.md").write_text(clean, encoding="utf-8")
            risk_parts.append(("Neutral Analyst", clean))
        if risk_parts:
            content = "\n\n".join(f"### {name}\n{text}" for name, text in risk_parts)
            sections.append(f"## IV. Risk Management Team Decision\n\n{content}")

        # 5. Portfolio Manager
        if risk.get("judge_decision"):
            portfolio_dir = save_path / "5_portfolio"
            portfolio_dir.mkdir(exist_ok=True)
            clean = sanitize_report_text(risk["judge_decision"])
            (portfolio_dir / "decision.md").write_text(clean, encoding="utf-8")
            sections.append(f"## V. Portfolio Manager Decision\n\n### Portfolio Manager\n{clean}")

    # Write consolidated report
    header = f"# Trading Analysis Report: {ticker}\n\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    (save_path / "complete_report.md").write_text(header + "\n\n".join(sections), encoding="utf-8")
    return save_path / "complete_report.md"
