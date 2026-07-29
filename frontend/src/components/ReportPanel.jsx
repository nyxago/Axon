import { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text) {
  if (!text) return '';
  const cleaned = text.replace(/FINAL TRANSACTION PROPOSAL:?\s*\*?\*?[A-Z]+\*?\*?.*$/gm, '');
  return marked.parse(cleaned);
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

