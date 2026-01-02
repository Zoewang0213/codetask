/**
 * 聊天界面组件
 * 与 LLM Agent 交互，显示回复和 Vega-Lite 图表
 */

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import VegaChart from './VegaChart';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  vegaLite?: any;
  timestamp: Date;
}

interface Props {
  apiUrl?: string;
}

const ChatInterface: React.FC<Props> = ({ apiUrl = 'http://localhost:5001' }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I'm your UMD Computer Science research data assistant. I can help you analyze publication data, citation patterns, author statistics, and more.

**Try asking questions like:**

- "How many papers were published each year from 2020 to 2024?"
- "Who are the top 10 authors by paper count?"
- "What are the citation statistics?"
- "Show me the yearly trend in patent citations"`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.text,
        vegaLite: data.vega_lite,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.message}. Please make sure the backend is running and ANTHROPIC_API_KEY is set.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 快捷问题
  const quickQuestions = [
    "Papers by year (2020-2024)",
    "Top 5 authors",
    "Citation statistics",
    "Yearly patent trend"
  ];

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>SciSciNet UMD Research Assistant</h2>
        <p>Powered by Claude AI</p>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-header">
              <span className="role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
              <span className="time">{msg.timestamp.toLocaleTimeString()}</span>
            </div>
            <div className="message-content">
              <ReactMarkdown
                components={{
                  // 过滤掉 vega-lite 代码块，因为会单独渲染
                  code: ({ className, children }) => {
                    if (className === 'language-vega-lite') {
                      return null;
                    }
                    return <code className={className}>{children}</code>;
                  },
                  pre: ({ children }) => {
                    // 检查是否是 vega-lite 代码块
                    const child = children as any;
                    if (child?.props?.className === 'language-vega-lite') {
                      return null;
                    }
                    return <pre>{children}</pre>;
                  }
                }}
              >
                {msg.content.replace(/```vega-lite[\s\S]*?```/g, '')}
              </ReactMarkdown>
            </div>
            {msg.vegaLite && (
              <div className="message-chart">
                <VegaChart spec={msg.vegaLite} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="message assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="quick-questions">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => setInput(q)}
            disabled={loading}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question about UMD CS research data..."
          disabled={loading}
          rows={2}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
