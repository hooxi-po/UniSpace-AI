import React, { useState } from 'react';
import { MaintenanceTicket } from '../types';
import { analyzeMaintenanceRequest } from '../services/geminiService';
import { Wrench, CheckCircle, Clock, AlertTriangle, Loader2, Sparkles, MapPin, Filter } from 'lucide-react';

const mockTickets: MaintenanceTicket[] = [
  {
    id: 'T-101',
    title: '实验室 3 空调故障',
    description: '空调外机发出巨大噪音且不制冷。',
    location: 'A 栋科学馆 302 室',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    category: '暖通空调',
    createdAt: '2023-10-24T10:00:00',
    suggestedAction: '立即检查压缩机轴承。'
  },
  {
    id: 'T-102',
    title: '投影仪故障',
    description: '投影仪灯泡间歇性闪烁。',
    location: 'B 栋阶梯教室',
    priority: 'LOW',
    status: 'OPEN',
    category: '多媒体/IT',
    createdAt: '2023-10-25T09:30:00',
    suggestedAction: '更换灯泡并检查 HDMI 连接。'
  }
];

export const Maintenance: React.FC = () => {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(mockTickets);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newTicket, setNewTicket] = useState({ description: '', location: '' });
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.description || !newTicket.location) return;

    setIsAnalyzing(true);
    
    // Call Gemini to analyze the text
    const analysis = await analyzeMaintenanceRequest(newTicket.description, newTicket.location);
    
    const ticket: MaintenanceTicket = {
      id: `T-${Math.floor(Math.random() * 1000)}`,
      title: analysis.summaryTitle || '新工单',
      description: newTicket.description,
      location: newTicket.location,
      priority: analysis.priority as any,
      status: 'OPEN',
      category: analysis.category,
      suggestedAction: analysis.suggestedAction,
      createdAt: new Date().toISOString()
    };

    setTickets([ticket, ...tickets]);
    setIsAnalyzing(false);
    setShowForm(false);
    setNewTicket({ description: '', location: '' });
  };

  const getPriorityInfo = (p: string) => {
    switch(p) {
        case 'CRITICAL': return { label: '紧急', class: 'bg-red-100 text-[#F53F3F] border-red-200' };
        case 'HIGH': return { label: '高', class: 'bg-orange-100 text-[#FF7D00] border-orange-200' };
        case 'MEDIUM': return { label: '中', class: 'bg-blue-100 text-[#165DFF] border-blue-200' };
        default: return { label: '低', class: 'bg-gray-100 text-[#86909C] border-gray-200' };
    }
  };

  const getStatusInfo = (s: string) => {
      switch(s) {
          case 'IN_PROGRESS': return { label: '处理中', color: 'text-[#165DFF]' };
          case 'RESOLVED': return { label: '已解决', color: 'text-[#00B42A]' };
          default: return { label: '待处理', color: 'text-[#FF7D00]' };
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">智慧维保中心</h1>
          <p className="text-slate-500 mt-1 text-sm">AI 驱动的工单分析与处理系统。</p>
        </div>
        <div className="flex gap-3">
            <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-sm font-medium transition-colors flex items-center gap-2 text-sm shadow-sm">
                <Filter size={16} />
                筛选
            </button>
            <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-sm font-medium transition-colors flex items-center gap-2 shadow-sm text-sm"
            >
            <Wrench size={16} />
            <span>新建工单</span>
            </button>
        </div>
      </div>

      {/* Input Form with AI Analysis Indicator */}
      {showForm && (
        <div className="bg-white p-6 rounded-sm shadow-md border border-primary-100 animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary-600"></div>
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Sparkles className="text-primary-600" size={18}/>
            智能报修
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">报修位置</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                        <input 
                        type="text" 
                        placeholder="例如：科技楼 101 室"
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 outline-none transition-all text-sm"
                        value={newTicket.location}
                        onChange={(e) => setNewTicket({...newTicket, location: e.target.value})}
                        required
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">问题类别 (可选)</label>
                    <input 
                        type="text" 
                        placeholder="AI 将自动识别类别"
                        className="w-full px-4 py-2 border border-slate-200 rounded-sm bg-slate-50 text-slate-400 cursor-not-allowed text-sm"
                        disabled
                    />
                </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">问题描述</label>
              <textarea 
                className="w-full px-4 py-2 border border-slate-200 rounded-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 outline-none transition-all h-32 resize-none text-sm"
                placeholder="请详细描述故障情况，AI 将自动分析优先级并建议维修方案..."
                value={newTicket.description}
                onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-sm transition-colors text-sm"
              >
                取消
              </button>
              <button 
                type="submit" 
                disabled={isAnalyzing}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-70 text-sm"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {isAnalyzing ? '分析中...' : '提交分析'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket List */}
      <div className="grid grid-cols-1 gap-4">
        {tickets.map((ticket) => {
            const priorityInfo = getPriorityInfo(ticket.priority);
            const statusInfo = getStatusInfo(ticket.status);
            return (
          <div key={ticket.id} className="bg-white p-5 rounded-sm shadow-sm border border-slate-100 hover:border-primary-200 transition-colors group">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityInfo.class}`}>
                    {priorityInfo.label}
                  </span>
                  <span className="text-xs font-mono text-slate-400">#{ticket.id}</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${statusInfo.color}`}>
                     {statusInfo.label}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                  {ticket.title}
                </h3>
                <p className="text-slate-600 mt-1 text-sm">{ticket.description}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={12}/> {ticket.location}</span>
                    <span className="flex items-center gap-1"><Wrench size={12}/> {ticket.category}</span>
                    <span className="flex items-center gap-1"><Clock size={12}/> {new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {ticket.suggestedAction && (
                <div className="bg-[#F2F3F5] border border-slate-200 p-3 rounded-sm md:max-w-xs w-full">
                  <p className="text-xs font-bold text-primary-600 mb-1 flex items-center gap-1">
                    <Sparkles size={12} /> AI 建议方案
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{ticket.suggestedAction}</p>
                </div>
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};