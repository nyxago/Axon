from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

g = TradingAgentsGraph(debug=False, config=DEFAULT_CONFIG.copy())
count = 0
agents_seen = set()

for event in g.propagate_stream('600667', '2026-07-25'):
    count += 1
    evt = event.get('event', '?')
    agent = event.get('agent', '')

    if evt == 'agent_done' and agent not in agents_seen:
        agents_seen.add(agent)
        print(f'OK [{count}] {agent} DONE', flush=True)
    elif evt == 'agent_start':
        print(f'>>> [{count}] {agent} START', flush=True)
    elif evt == 'decision':
        content = event.get('content', '')[:200]
        print(f'DECISION [{count}]: {content}', flush=True)
    elif evt == 'error':
        print(f'ERROR [{count}]: {event.get("error","")[:120]}', flush=True)
        if event.get('fatal'):
            break
    elif evt == 'done':
        print(f'DONE [{count}] Analysis complete!', flush=True)
        break

print(f'Total events: {count}, Agents completed: {len(agents_seen)}', flush=True)
