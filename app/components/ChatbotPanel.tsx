'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, ChevronLeft } from 'lucide-react';

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  time: string;
}

export default function ChatbotPanel({ onToggleChatbot }: { onToggleChatbot: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      text: "Hello! I'm your Teach Connect assistant. How can I help you today?",
      sender: 'bot',
      time: '10:00 AM',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      text: input.trim(),
      sender: 'user',
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const botMessage: ChatMessage = {
        id: Date.now() + 1,
        text: "Thanks for reaching out! I'm here to help with your queries about courses, schedules, and assignments.",
        sender: 'bot',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const header = (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Bot size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Teach Assistant</h3>
          <p className="text-[11px] text-emerald-600 font-medium">Online</p>
        </div>
      </div>
      <button
        onClick={onToggleChatbot}
        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
        title="Collapse Chatbot"
      >
        <ChevronLeft size={18} />
      </button>
    </div>
  );

  const messagesList = (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.sender === 'user'
                ? 'bg-[#0D6EFD] text-white rounded-br-sm'
                : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-sm'
            }`}
          >
            <p className="leading-relaxed">{msg.text}</p>
            <p
              className={`text-[10px] mt-1 ${
                msg.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
              }`}
            >
              {msg.time}
            </p>
          </div>
        </div>
      ))}
      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-500">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const footer = (
    <form onSubmit={handleSend} className="p-4 border-t border-gray-200/50">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-4 pr-2 py-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-8 h-8 bg-[#0D6EFD] hover:bg-blue-600 disabled:bg-gray-200 text-white rounded-full flex items-center justify-center transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </form>
  );

  return (
    <aside className="h-full w-full overflow-hidden rounded-[28px] border border-gray-200/50 bg-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex h-full min-h-0 flex-col ">
        {header}
        {messagesList}
        {footer}
      </div>
    </aside>
  );
}
