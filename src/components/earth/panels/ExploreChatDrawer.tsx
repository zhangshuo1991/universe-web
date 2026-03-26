'use client';

import { useId, useState } from 'react';
import Markdown from 'react-markdown';

import { useViewerStore } from '@/store/viewerStore';
import styles from './ExploreChatDrawer.module.css';

type ExploreChatDrawerProps = {
  onSend: (prompt: string) => Promise<void>;
  busy: boolean;
  contextLabel?: string | null;
  suggestedPrompts?: string[];
};

export function ExploreChatDrawer({
  onSend,
  busy,
  contextLabel,
  suggestedPrompts = []
}: ExploreChatDrawerProps) {
  const chatHistory = useViewerStore((s) => s.chatHistory);
  const chatExpanded = useViewerStore((s) => s.chatExpanded);
  const setChatExpanded = useViewerStore((s) => s.setChatExpanded);
  const [input, setInput] = useState('');
  const panelId = useId();

  const recentMessages = chatHistory.slice(-4);

  const submitPrompt = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt || busy) return;
    setChatExpanded(true);
    setInput('');
    await onSend(prompt);
  };

  return (
    <section className={`${styles.dock} ${chatExpanded ? styles.expanded : ''}`} aria-label="轻量对话">
      <div className={styles.shell}>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setChatExpanded(!chatExpanded)}
          aria-expanded={chatExpanded}
          aria-controls={panelId}
        >
          <span className={styles.toggleLead}>
            <svg className={styles.toggleIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
          </span>
          <span className={styles.toggleCopy}>
            <strong>AI 导航</strong>
            <small>{contextLabel ? `围绕 ${contextLabel} 继续提问` : '提问地点、路线或观测目标'}</small>
          </span>
          {chatHistory.length > 0 && <span className={styles.badge}>{chatHistory.length}</span>}
        </button>

        {chatExpanded && (
          <div id={panelId} className={styles.panel}>
            {suggestedPrompts.length > 0 && (
              <div className={styles.chipRow}>
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} type="button" className={styles.chip} onClick={() => submitPrompt(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.log} role="log" aria-label="最近消息">
              {recentMessages.length === 0 && !busy && (
                <article className={`${styles.message} ${styles.assistant}`}>
                  <span className={styles.role}>AI</span>
                  <p className={styles.plainText}>可以直接说“飞到北京”或“从北京到纽约的航线示意图”。</p>
                </article>
              )}

              {recentMessages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`${styles.message} ${message.role === 'assistant' ? styles.assistant : styles.user}`}
                >
                  <span className={styles.role}>{message.role === 'user' ? '你' : 'AI'}</span>
                  {message.role === 'assistant' ? (
                    <div className={styles.markdown}>
                      <Markdown>{message.content}</Markdown>
                    </div>
                  ) : (
                    <p className={styles.plainText}>{message.content}</p>
                  )}
                </article>
              ))}

              {busy && (
                <article className={`${styles.message} ${styles.assistant} loading-pulse`}>
                  <span className={styles.role}>AI</span>
                  <p className={styles.plainText}>整理中…</p>
                </article>
              )}
            </div>

            <div className={styles.composer}>
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitPrompt(input);
                  }
                }}
                placeholder={contextLabel ? `继续追问 ${contextLabel}` : '输入问题…'}
                aria-label="对话输入"
                className={styles.input}
                disabled={busy}
              />
              <button type="button" className={styles.send} onClick={() => submitPrompt(input)} disabled={busy || !input.trim()}>
                {busy ? '…' : '发送'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
