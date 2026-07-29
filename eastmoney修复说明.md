# eastmoney.py 数据源修复说明

> 日期：2026-07-27 | 修复人：张宇峰 | 变更编号：#009

---

## 一、故障现象

运行 `check_setup.py` 时，akshare 东方财富数据源报错：

```
ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
```

## 二、根因分析

akshare 底层有两个 A 股数据源后端：

| 后端 | 函数 | 数据来源 |
|------|------|------|
| 东方财富 | `stock_zh_a_hist()` / `stock_zh_a_spot_em()` | `push2his.eastmoney.com` |
| 新浪财经 | `stock_zh_a_daily()` / `stock_zh_a_spot()` | `vip.stock.finance.sina.com.cn` |

经实际测试（同一台机器、同一网络、同一时刻）：

```
✅ 新浪 stock_zh_a_daily("sh600519")  → 返回 5 行数据，正常
❌ 东财 stock_zh_a_hist("600519")     → Connection reset，服务器拒绝连接
```

进一步验证：东方财富网站 `www.eastmoney.com` 可以正常访问（HTTP 200），但其数据 API 端点 `push2his.eastmoney.com` 返回 404——说明东方财富近期**变更或关闭了公开数据 API 端点**，但主站未受影响。

akshare 1.18.79 版本用的东财 API 路径已失效，这不是网络问题、不是超时问题、也不是代码 bug——是**上游数据源不可用**。

## 三、修复方案

**将 `eastmoney.py` 适配器底层从「东方财富 API」切换到「新浪财经 API」。**

理由：
1. 新浪 API 当前可用，且长期稳定（2015 年至今未变）
2. 新浪与东财提供的数据维度一致（OHLCV + 基本面 + 实时行情）
3. 修复范围局限在 `eastmoney.py` 单个文件，不影响 interface.py 路由、不影响 default_config 优先级
4. 对外接口签名完全不变——`get_stock()` / `get_fundamentals()` / `get_indicator()` 的参数和返回值格式保持不变

## 四、具体改动（3 处函数调用 + 4 处适配）

### 改动 1：`get_stock()` — 历史行情

```python
# 原（东财）
return ak.stock_zh_a_hist(symbol="600519", period="daily",
    start_date="20240501", end_date="20240510", adjust="qfq")

# 改（新浪）
return ak.stock_zh_a_daily(symbol="sh600519",
    start_date="20240501", end_date="20240510", adjust="qfq")
```

**差异**：
- 函数名：`stock_zh_a_hist` → `stock_zh_a_daily`
- 符号格式：`600519` → `sh600519`（上海加 `sh`，深圳加 `sz`）
- 列名：东财用中文（`日期`/`开盘`/`收盘`），新浪用英文（`date`/`open`/`close`）

### 改动 2：`get_fundamentals()` — 实时行情

```python
# 原（东财）
return ak.stock_zh_a_spot_em()

# 改（新浪）
return ak.stock_zh_a_spot()
```

**差异**：
- 东财 `spot_em` 列名为中文（`代码`/`名称`/`市盈率-动态`），新浪 `spot` 列名为英文（`code`/`name`/`pe`）
- 匹配时用 `code` 替代 `代码`

### 改动 3：`_fundamentals_from_history()` — 降级方案

同上，`stock_zh_a_hist` → `stock_zh_a_daily`，符号格式适配。

### 改动 4：列名映射更新

`_COLUMN_MAP` 和 `_format_ohlcv()` 需要适配新浪的英文列名。新浪的 `stock_zh_a_daily` 返回：
`date / open / high / low / close / volume / amount / outstanding_share / turnover`

### 改动 5：`_format_ohlcv()` — Date 列保持字符串

新浪返回的 `date` 列已为字符串格式 `YYYY-MM-DD`，无需 `pd.to_datetime` 再转。

### 改动 6：符号规范化 `_validate_a_symbol()`

新增 `_to_sina_symbol()` 函数，将 `600519` → `sh600519`、`000001` → `sz000001`。

### 改动 7：文件头注释更新

数据来源说明从「东方财富」改为「新浪财经」，akshare 版本适配说明。

## 五、影响范围

| 层级 | 影响 |
|------|------|
| `eastmoney.py` | 唯一改动文件 |
| `interface.py` | 无改动——路由逻辑不变，`"eastmoney"` 供应商名不变 |
| `default_config.py` | 无改动——优先级 `eastmoney,alpha_vantage,yfinance` 不变 |
| `trading_graph.py` | 无改动 |
| `server/main.py` | 无改动 |
| 前端 | 无改动 |

**对外完全透明。** 调用方不知道底层从东财切到了新浪。

## 六、FDE 学习要点

1. **依赖上游风险**：第三方开源库（akshare）封装的数据源（东财）随时可能不可用。适配器模式的核心价值就是隔离这种变更——改一个文件，调用方无感知。
2. **故障定位方法**：不是"报错了就重试"，而是逐层排除——DNS→HTTP→API→akshare→adapter，最终定位到具体端点。
3. **降级 vs 修复**：此处选择修复而非降级（yfinance 不支持 A 股），因为 A 股数据是核心需求。
4. **供应商路由不变**：interface.py 的供应商名仍然叫 `"eastmoney"`，虽然底层换了新浪——适配器的职责是完成接口契约，调用方不需要知道你从哪拿的数据。

---

> 张宇峰 · FDE 培训 Day 15 · 变更 #009 · 2026-07-27
