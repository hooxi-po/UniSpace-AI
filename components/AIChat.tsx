import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X, Minimize2, Maximize2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { sendChatMessage } from '../services/geminiService';

export const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: '您好！我是 UniSpace 智能助手。我可以帮您查询房间详情、检测维保状态或分析校园占用数据。请问有什么可以帮您？' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Prepare history for API
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const responseText = await sendChatMessage(history, userMsg.text);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText
    };

    setMessages(prev => [...prev, botMsg]);
    setIsThinking(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-primary-600 hover:bg-primary-700 text-white p-3.5 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 z-50 flex items-center gap-2 group"
      >
        <Bot size={24} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-medium whitespace-nowrap">唤起 AI 助手</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-slate-200 animate-in slide-in-from-bottom-10 fade-in duration-300 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-primary-600 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-md">
                <Bot size={18} />
            </div>
            <div>
                <h3 className="font-bold text-sm">UniSpace 智能助手</h3>
                <p className="text-xs text-blue-100 opacity-80">由 Gemini 3.0 驱动</p>
            </div>
        </div>
        <div className="flex items-center gap-1">
            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
            <Minimize2 size={16} />
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F8FA]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-primary-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-lg rounded-bl-none shadow-sm border border-slate-100 flex items-center gap-2">
              <Loader2 className="animate-spin text-primary-600" size={14} />
              <span className="text-xs text-slate-400">思考中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入问题，例如：A 栋教学楼占用率..."
            className="flex-1 bg-slate-50 border border-transparent focus:border-primary-500 rounded-md px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-primary-500/20 outline-none placeholder-slate-400 transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};