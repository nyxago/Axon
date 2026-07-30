import { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

/**
 * Strip JSON blobs, code fences, and Python dict reprs from report text.
 *
 * DeepSeek / MiniMax models sometimes leak raw structured data into reports
 * when the function-calling path fails — this is the last line of defense
 * before user-visible rendering.
 */
function sanitizeReport(text) {
  if (!text || typeof text !== 'string') return text || '';

  let cleaned = text;

  // 1. Remove markdown code fences with their content
  cleaned = cleaned.replace(/```(?:json|python|text|yaml)?\s*[\s\S]*?```/g, '');

  // 2. Remove standalone JSON objects with known schema field names
  cleaned = cleaned.replace(
    /\{\s*"(?:overall_band|overall_score|confidence|narrative|recommendation|rationale|action|reasoning|rating|executive_summary|investment_thesis|entry_price|stop_loss|position_sizing|price_target|time_horizon|strategic_actions)"[\s\S]*?\}/g,
    ''
  );

  // 3. Remove Python dict reprs (single-quoted keys)
  cleaned = cleaned.replace(
    /\{\s*'(?:overall_band|overall_score|confidence|narrative|recommendation|action|reasoning|rating)[\s\S]*?\}/g,
    ''
  );

  // 4. Collapse 3+ consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

function renderMarkdown(text) {
  if (!text) return '';
  // Step 1: sanitize code/JSON leaks
  let cleaned = sanitizeReport(text);
  // Step 2: remove the raw FINAL TRANSACTION PROPOSAL block (already shown in decision section)
  cleaned = cleaned
    .replace(/FINAL\s*TRANSACTION\s*PROPOSAL:?\s*\*?\*?[A-Z_]+\*?\*?.*?(?=\n\n|$)/gims, '')
    .replace(/##\s*FINAL\s*TRANSACTION\s*PROPOSAL[\s\S]*$/gim, '');
  // Step 3: normalize markdown
  const normalized = cleaned
    .replace(/\*\*([^*]+)\*\*/g, '**$1**'); // preserve bold
  return marked.parse(normalized);
}

export default function ReportPanel({ reports }) {
  const renderedReports = useMemo(() => {
    return reports.map((r) => ({
      ...r,
      html: renderMarkdown(r.content),
    }));
  }, [reports]);

  if (reports.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: 40 }}>
        完成分析后将在此显示报告
      </div>
    );
  }

  return (
    <div className="reports-section">
      {renderedReports.map((r, i) => (
        <div key={i} className="report-card">
          <h3>{r.agent}</h3>
          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: r.html }} />
        </div>
      ))}
    </div>
  );
}
