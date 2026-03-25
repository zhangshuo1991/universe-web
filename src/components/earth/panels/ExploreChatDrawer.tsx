'use client';

import { useState } from 'react';
import Markdown from 'react-markdown';

import { useViewerStore } from '@/store/viewerStore';

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

  const recentMessages = chatHistory.slice(-4);

  const submitPrompt = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt || busy) return;
    setChatExpanded(true);
    setInput('');
    await onSend(prompt);
  };

  return (
    <section className={`chatDrawer ${chatExpanded ? 'expanded' : ''}`} aria-label="轻量对话">
      <button
        type="button"
        className="chatDrawerToggle"
        onClick={() => setChatExpanded(!chatExpanded)}
        aria-expanded={chatExpanded}
      >
        <svg className="chatDrawerIcon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
        </svg>
        <strong>{contextLabel ? `追问 ${contextLabel}` : '提问'}</strong>
        {chatHistory.length > 0 && <small>{chatHistory.length}</small>}
      </button>

      <div className="chatDrawerBody">
        {chatExpanded && recentMessages.length > 0 && (
          <div className="chatPreviewList" role="log" aria-label="最近消息">
            {recentMessages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`chatPreview ${message.role}`}>
                <span>{message.role === 'user' ? '你' : 'AI'}</span>
                {message.role === 'assistant' ? (
                  <div className="markdownBody"><Markdown>{message.content}</Markdown></div>
                ) : (
                  <p>{message.content}</p>
                )}
              </article>
            ))}
            {busy && (
              <article className="chatPreview assistant loading-pulse">
                <span>AI</span>
                <p>整理中…</p>
              </article>
            )}
          </div>
        )}

        {suggestedPrompts.length > 0 && chatExpanded && (
          <div className="promptChipGrid">
            {suggestedPrompts.map((prompt) => (
              <button key={prompt} type="button" className="promptChip" onClick={() => submitPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div className="chatComposer">
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
            placeholder={contextLabel ? `追问 ${contextLabel}…` : '输入问题…'}
            aria-label="对话输入"
            disabled={busy}
          />
          <button type="button" className="chatSendPrimary" onClick={() => submitPrompt(input)} disabled={busy || !input.trim()}>
            {busy ? '…' : '发送'}
          </button>
        </div>
      </div>
    </section>
  );
}
