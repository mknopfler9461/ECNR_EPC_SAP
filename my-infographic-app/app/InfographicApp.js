'use client';

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  ArcElement,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  RadarController,
  Tooltip,
} from 'chart.js';
import { useEffect, useRef, useState } from 'react';

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  RadarController,
  Tooltip
);

const palette = ['#FD349C', '#00338D', '#ACEAFF', '#7213EA', '#00B8F5', '#1E49E2'];

function formatRichText(text) {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/<br\s*\/?>/g, '<br />')
    .replace(/\n/g, '<br />');
}

async function fetchGeminiWithRetry(prompt, systemInstruction) {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i <= delays.length; i += 1) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const result = await response.json();
      return result.text || '抱歉，由于未知原因未能生成内容。';
    } catch {
      if (i === delays.length) return '网络请求失败，已达到最大重试次数。请检查您的连接或稍后再试。';
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }
}

function ChartCard({ chart, children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    ChartJS.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif';
    ChartJS.defaults.color = '#475569';

    const instance = new ChartJS(canvasRef.current, {
      type: chart.type === 'horizontalBar' ? 'bar' : chart.type,
      data: {
        labels: chart.labels,
        datasets: chart.datasets.map((dataset, index) => ({
          ...dataset,
          backgroundColor: dataset.backgroundColor || palette[index % palette.length],
          borderColor: dataset.borderColor,
          borderWidth: dataset.borderColor ? 2 : 0,
          borderRadius: chart.type.includes('bar') || chart.type === 'horizontalBar' ? 4 : 0,
          hoverOffset: chart.type === 'doughnut' ? 4 : undefined,
        })),
      },
      options: {
        indexAxis: chart.type === 'horizontalBar' ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        cutout: chart.type === 'doughnut' ? '65%' : undefined,
        plugins: {
          legend: {
            display: chart.type !== 'horizontalBar',
            position: chart.type === 'doughnut' ? 'bottom' : 'top',
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
          },
        },
        scales:
          chart.type === 'radar'
            ? {
                r: {
                  angleLines: { color: '#e2e8f0' },
                  grid: { color: '#e2e8f0' },
                  pointLabels: { font: { size: 11, weight: '500' }, color: '#334155' },
                  ticks: { display: false },
                  min: 0,
                  max: 100,
                },
              }
            : chart.type === 'doughnut'
              ? {}
              : {
                  x: {
                    beginAtZero: chart.type === 'horizontalBar',
                    grid: { color: chart.type === 'horizontalBar' ? '#f1f5f9' : 'transparent' },
                  },
                  y: {
                    beginAtZero: chart.type !== 'horizontalBar',
                    grid: { color: chart.type === 'horizontalBar' ? 'transparent' : '#f1f5f9' },
                  },
                },
      },
    });

    return () => instance.destroy();
  }, [chart]);

  return (
    <div className="card">
      <h3 className="chart-title">{chart.title}</h3>
      <div className="chart-box" style={{ height: chart.height }}>
        <canvas ref={canvasRef} aria-label={chart.title} />
      </div>
      {chart.note ? <p className="chart-note">{chart.note}</p> : null}
      {children}
    </div>
  );
}

function AiSummary({ ai }) {
  const [role, setRole] = useState(ai.roles[0]?.value || '');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  async function generateSummary() {
    const selected = ai.roles.find((item) => item.value === role) || ai.roles[0];
    setLoading(true);
    setSummary(`正在为 ${selected.label} 分析数据并生成专属洞察...`);

    const prompt = `结合以下BESS行业背景信息，为"${selected.label}"撰写一段约150字的定制化高管摘要。使用专业咨询顾问口吻，必须直接指出对其岗位最关键的挑战和机遇。\n\n${ai.context}`;
    const response = await fetchGeminiWithRetry(prompt, ai.summarySystem);
    setSummary(`<strong>针对 ${selected.label} 的核心洞察：</strong><br />${formatRichText(response)}`);
    setLoading(false);
  }

  return (
    <section id="ai-summary" className="section">
      <div className="card ai-card">
        <div className="ai-header">
          <div>
            <h2>🤖 {ai.title}</h2>
            <p className="eyebrow">{ai.description}</p>
          </div>
          <div className="ai-controls">
            <select className="select" value={role} onChange={(event) => setRole(event.target.value)}>
              {ai.roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button className="button" type="button" disabled={loading} onClick={generateSummary}>
              生成摘要
            </button>
          </div>
        </div>
        {summary ? (
          <div className="summary-box">
            {loading ? (
              <>
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" /> {summary}
              </>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: summary }} />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ChatWidget({ ai }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ sender: 'ai', text: ai.chatGreeting }]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((items) => [...items, { sender: 'user', text }]);
    setLoading(true);
    const response = await fetchGeminiWithRetry(text, ai.chatSystem);
    setMessages((items) => [...items, { sender: 'ai', text: formatRichText(response), html: true }]);
    setLoading(false);
  }

  return (
    <div className="chat-widget">
      {open ? (
        <div className="chat-window">
          <div className="chat-header">
            <span>💬 {ai.chatTitle}</span>
            <button className="icon-button" type="button" aria-label="关闭聊天" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div className={`chat-message ${message.sender}`} key={`${message.sender}-${index}`}>
                {message.html ? <span dangerouslySetInnerHTML={{ __html: message.text }} /> : message.text}
              </div>
            ))}
            {loading ? (
              <div className="chat-message ai">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
            ) : null}
          </div>
          <div className="chat-input-row">
            <input
              className="input"
              value={input}
              placeholder="输入您的问题..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendMessage();
              }}
            />
            <button className="button chat-send" type="button" disabled={loading} onClick={sendMessage}>
              发送
            </button>
          </div>
        </div>
      ) : (
        <button className="chat-fab" type="button" aria-label="打开聊天" onClick={() => setOpen(true)}>
          💬
        </button>
      )}
    </div>
  );
}

function Section({ section }) {
  return (
    <section className="section" id={section.id}>
      <div className="section-heading" style={{ '--accent': section.accent }}>
        <h2>{section.title}</h2>
        <p>{section.intro}</p>
      </div>

      {section.stats ? (
        <div className="grid-two">
          <div className="card">
            <h3 className="card-title">{section.stats.title}</h3>
            <p className="eyebrow">{section.stats.description}</p>
            <div className="stats-grid">
              {section.stats.items.map((item) => (
                <div className="stat" key={`${item.value}-${item.label}`}>
                  <div className="stat-icon">{item.icon}</div>
                  <div className="stat-value">{item.value}</div>
                  <div className="stat-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          {section.charts.map((chart) => (
            <ChartCard chart={chart} key={chart.id} />
          ))}
        </div>
      ) : section.notes.length ? (
        <div className="grid-two">
          {section.charts.map((chart) => (
            <ChartCard chart={chart} key={chart.id} />
          ))}
          <div className="note-stack">
            {section.notes.map((note) => (
              <div className="note" style={{ '--note-color': note.color }} key={note.title}>
                <h4>{note.title}</h4>
                <p>{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : section.steps ? (
        <div className="grid-two">
          {section.charts.map((chart) => (
            <ChartCard chart={chart} key={chart.id} />
          ))}
          <div className="card">
            <h3 className="steps-title">{section.steps.title}</h3>
            <div className="steps">
              {section.steps.items.map((step) => (
                <div className="step" key={step.number}>
                  <div className="step-number" style={{ '--step-color': step.color }}>
                    {step.number}
                  </div>
                  <div>
                    <h4>{step.title}</h4>
                    <p dangerouslySetInnerHTML={{ __html: formatRichText(step.body) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {section.charts.map((chart) => (
            <ChartCard chart={chart} key={chart.id}>
              {section.badges.length ? (
                <div className="badge-row">
                  {section.badges.map((badge) => (
                    <span className="badge" key={badge}>
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
            </ChartCard>
          ))}
        </>
      )}
    </section>
  );
}

export default function InfographicApp({ data }) {
  const navSections = data.sections.filter((section) => section.id !== 'ai-summary');

  return (
    <main className="page">
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <span className="brand-icon">🔋</span>
            <span>{data.meta.navBrand}</span>
          </div>
          <div className="nav-links">
            {navSections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {data.meta.navLabels?.[section.id] || section.title}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <header className="hero">
        <h1>{data.hero.title}</h1>
        <p>{data.hero.subtitle}</p>
      </header>

      <div className="content">
        <AiSummary ai={data.ai} />
        {data.sections.map((section) => (
          <Section section={section} key={section.id} />
        ))}
      </div>

      <footer className="footer">
        <div className="footer-inner">
          <strong>{data.meta.footerTitle}</strong>
          <span>{data.meta.footerNote}</span>
        </div>
      </footer>
      <ChatWidget ai={data.ai} />
    </main>
  );
}
