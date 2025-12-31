import React from 'react';
import { LayoutDashboard, Building2, Wrench, MessageSquareText, Settings, LogOut, GraduationCap, FileText, ShieldCheck, Briefcase, Calculator, AppWindow, MonitorPlay } from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const decisionItems = [
    { id: AppView.DASHBOARD, label: '数字大屏', icon: MonitorPlay },
    { id: AppView.REPORTS, label: '报表中心', icon: FileText },
    { id: AppView.GOVERNANCE, label: '数据治理', icon: ShieldCheck },
  ];

  const coreItems = [
    { id: AppView.BUILDINGS, label: '楼宇资产', icon: Building2 },
    { id: AppView.PLANNING, label: '资源配置', icon: Calculator },
    { id: AppView.WORKFLOW, label: '公房业务', icon: Briefcase },
    { id: AppView.MAINTENANCE, label: '智慧维保', icon: Wrench },
  ];

  const specializedItems = [
    { id: AppView.SUBSYSTEMS, label: '专项业务', icon: AppWindow },
    { id: AppView.CHAT, label: 'AI 助手', icon: MessageSquareText },
  ];

  const renderNavGroup = (title: string, items: any[]) => (
    <div className="mb-2">
        <div className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
        </div>
        <nav className="px-3 space-y-0.5">
            {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
                <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md transition-all duration-200 group font-medium text-sm
                    ${isActive 
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' 
                    : 'text-slate-400 hover:bg-[#373739] hover:text-white'}`}
                >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                <span>{item.label}</span>
                </button>
            );
            })}
        </nav>
    </div>
  );

  return (
    <div className="hidden md:flex flex-col w-64 bg-[#232324] text-slate-300 h-screen sticky top-0 border-r border-slate-800 overflow-y-auto">
      <div className="p-6 flex items-center space-x-3 text-white">
        <div className="bg-primary-600 p-2 rounded-lg">
            <GraduationCap size={24} />
        </div>
        <span className="text-xl font-bold tracking-tight">UniSpace</span>
      </div>

      <div className="flex-1 py-2">
        {renderNavGroup('决策支持', decisionItems)}
        {renderNavGroup('核心管理', coreItems)}
        {renderNavGroup('专项应用', specializedItems)}
      </div>

      <div className="p-4 border-t border-slate-700/50">
        <button className="flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-white transition-colors w-full text-sm">
          <Settings size={18} />
          <span>系统设置</span>
        </button>
        <button className="flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-red-400 transition-colors w-full mt-1 text-sm">
          <LogOut size={18} />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );
};
