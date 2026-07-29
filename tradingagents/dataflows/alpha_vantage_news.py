from .alpha_vantage_common import _make_api_request, format_datetime_for_api


def _format_news_sentiment(data: dict | str) -> str:
    """将 Alpha Vantage NEWS_SENTIMENT 原始 JSON 转为可读 Markdown，避免裸 JSON 泄露到前端。"""
    if isinstance(data, str):
        return data
    if not isinstance(data, dict):
        return str(data)

    feed = data.get("feed") or data.get("articles") or []
    if not feed:
        return str(data)

    lines = []
    for i, item in enumerate(feed[:15]):
        title = item.get("title", "")
        url = item.get("url", "")
        summary = item.get("summary", "")[:300]
        source = item.get("source", "")
        time_pub = item.get("time_published", "")
        # Format date: 20260728T190937 → 2026-07-28 19:09
        if len(time_pub) >= 14:
            time_pub = f"{time_pub[:4]}-{time_pub[4:6]}-{time_pub[6:8]} {time_pub[9:11]}:{time_pub[11:13]}"
        overall = item.get("overall_sentiment_label", "")

        lines.append(f"### {i+1}. {title}")
        if source or time_pub:
            lines.append(f"*{source} · {time_pub}*")
        if overall:
            lines.append(f"**Sentiment: {overall}**")
        if summary:
            lines.append(summary)
        if url:
            lines.append(f"[Read more]({url})")
        lines.append("")

    return "\n".join(lines) if lines else str(data)


def get_news(ticker, start_date, end_date) -> str:
    """Returns live and historical market news & sentiment data from premier news outlets worldwide.

    Covers stocks, cryptocurrencies, forex, and topics like fiscal policy, mergers & acquisitions, IPOs.

    Args:
        ticker: Stock symbol for news articles.
        start_date: Start date for news search.
        end_date: End date for news search.

    Returns:
        Dictionary containing news sentiment data or JSON string.
    """

    params = {
        "tickers": ticker,
        "time_from": format_datetime_for_api(start_date),
        "time_to": format_datetime_for_api(end_date),
    }

    return _format_news_sentiment(_make_api_request("NEWS_SENTIMENT", params))

def get_global_news(curr_date, look_back_days: int = 7, limit: int = 50) -> str:
    """Returns global market news & sentiment data without ticker-specific filtering.

    Covers broad market topics like financial markets, economy, and more.

    Args:
        curr_date: Current date in yyyy-mm-dd format.
        look_back_days: Number of days to look back (default 7).
        limit: Maximum number of articles (default 50).

    Returns:
        Dictionary containing global news sentiment data or JSON string.
    """
    from datetime import datetime, timedelta

    # Calculate start date
    curr_dt = datetime.strptime(curr_date, "%Y-%m-%d")
    start_dt = curr_dt - timedelta(days=look_back_days)
    start_date = start_dt.strftime("%Y-%m-%d")

    params = {
        "topics": "financial_markets,economy_macro,economy_monetary",
        "time_from": format_datetime_for_api(start_date),
        "time_to": format_datetime_for_api(curr_date),
        "limit": str(limit),
    }

    return _format_news_sentiment(_make_api_request("NEWS_SENTIMENT", params))


def get_insider_transactions(symbol: str) -> str:
    """Returns latest and historical insider transactions by key stakeholders.

    Covers transactions by founders, executives, board members, etc.

    Args:
        symbol: Ticker symbol. Example: "IBM".

    Returns:
        Dictionary containing insider transaction data or JSON string.
    """

    params = {
        "symbol": symbol,
    }

    return _make_api_request("INSIDER_TRANSACTIONS", params)
