'use client';

import { useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { useViewerStore } from '@/store/viewerStore';

type ChatPanelProps = {
  onSend: (prompt: string) => Promise<void>;
  busy: boolean;
};

export function ChatPanel({ onSend, busy }: ChatPanelProps) {
  const chatHistory = useViewerStore((s) => s.chatHistory);
  const chatExpanded = useViewerStore((s) => s.chatExpanded);
  const setChatExpanded = useViewerStore((s) => s.setChatExpanded);
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput('');
    await onSend(prompt);
    // Scroll to bottom after message
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, 100);
  };

  return (
    <section className={`chatPanelWrapper ${chatExpanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="chatToggle"
        onClick={() => setChatExpanded(!chatExpanded)}
        aria-expanded={chatExpanded}
      >
        <span>AI 分析</span>
        <strong>{chatHistory.length > 0 ? `${chatHistory.length} 条消息` : '开始对话'}</strong>
      </button>

      {chatExpanded && (
        <div className="chatPanelBody">
          <div className="chatLog" ref={logRef} role="log" aria-label="AI 对话" tabIndex={0}>
            {chatHistory.length === 0 && (
              <p className="emptyState">
                输入问题让 AI 分析地球数据。例如：&quot;飞到北京&quot;、&quot;当前空间天气如何&quot;、&quot;比较东京和纽约的天气&quot;
              </p>
            )}
            {chatHistory.map((msg, i) => (
              <div key={`${msg.role}-${i}`} className={`chatBubble ${msg.role}`}>
                <span>{msg.role === 'user' ? '用户' : 'AI'}</span>
                {msg.role === 'assistant' ? (
                  <div className="markdownBody"><Markdown>{msg.content}</Markdown></div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            ))}
            {busy && (
              <div className="chatBubble assistant">
                <span>AI</span>
                <p>分析中...</p>
              </div>
            )}
          </div>

          <div className="chatInputRow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="输入问题或指令..."
              disabled={busy}
              aria-label="AI 对话输入"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy || !input.trim()}
              className="chatSendBtn"
            >
              {busy ? '...' : '发送'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
