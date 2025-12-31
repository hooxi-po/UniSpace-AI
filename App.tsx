import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PropertyMap } from './components/PropertyMap';
import { Maintenance } from './components/Maintenance';
import { BusinessWorkflow } from './components/BusinessWorkflow';
import { DataGovernance } from './components/DataGovernance';
import { ReportCenter } from './components/ReportCenter';
import { ResourcePlanning } from './components/ResourcePlanning';
import { SpecializedSubsystems } from './components/SpecializedSubsystems';
import { AIChat } from './components/AIChat';
import { AppView } from './types';
import { Search, Bell, Menu } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getBreadcrumb = () => {
      switch(currentView) {
          case AppView.DASHBOARD: return '校园数字大屏';
          case AppView.WORKFLOW: return '公房业务办理';
          case AppView.BUILDINGS: return '楼宇资产';
          case AppView.GOVERNANCE: return '数据治理中心';
          case AppView.REPORTS: return '报表中心';
          case AppView.MAINTENANCE: return '智慧维保';
          case AppView.PLANNING: return '资源配置与规划';
          case AppView.SUBSYSTEMS: return '专项业务子系统';
          case AppView.CHAT: return 'AI 助手';
          default: return '';
      }
  }

  const renderContent = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard />;
      case AppView.WORKFLOW:
        return <BusinessWorkflow />;
      case AppView.BUILDINGS:
        return <PropertyMap />;
      case AppView.GOVERNANCE:
        return <DataGovernance />;
      case AppView.REPORTS:
        return <ReportCenter />;
      case AppView.MAINTENANCE:
        return <Maintenance />;
      case AppView.PLANNING:
        return <ResourcePlanning />;
      case AppView.SUBSYSTEMS:
        return <SpecializedSubsystems />;
      case AppView.CHAT:
        return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="bg-primary-50 p-6 rounded-full">
                    <div className="w-16 h-16 bg-primary-600 rounded-full animate-pulse"></div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">AI 助手已激活</h2>
                <p className="text-slate-500 max-w-md">聊天助手始终悬浮在右下角。点击图标即可开始与 UniSpace 智能助手互动！</p>
            </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F3F5] flex font-sans text-slate-900">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
                 <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    <Menu />
                 </button>
                 {/* Breadcrumbs or simple title could go here */}
                 <div className="hidden md:block text-sm font-medium text-slate-400">
                    UniSpace / <span className="text-slate-800 font-semibold">{getBreadcrumb()}</span>
                 </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative hidden md:block group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="全局搜索资产、工单、报表..." 
                        className="pl-9 pr-4 py-1.5 bg-slate-100 border border-transparent rounded-full text-sm focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none w-64 transition-all"
                    />
                </div>
                <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F53F3F] rounded-full border border-white"></span>
                </button>
                <div className="w-8 h-8 rounded-full bg-primary-100 border border-primary-200 flex items-center justify-center text-primary-700 font-bold text-xs cursor-pointer hover:ring-2 hover:ring-primary-200 transition-all">
                    管理
                </div>
            </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8 relative scroll-smooth">
            {renderContent()}
        </main>
      </div>

      {/* Floating AI Chat - Always visible */}
      <AIChat />
      
      {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
            <div className="absolute inset-0 bg-[#232324] z-50 p-6 flex flex-col md:hidden animate-in fade-in slide-in-from-left-10">
                <div className="flex justify-end mb-8">
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-white">
                        <Menu size={24} />
                    </button>
                </div>
                <div className="space-y-4">
                     {[
                        { id: AppView.DASHBOARD, label: '大数据驾驶舱' },
                        { id: AppView.WORKFLOW, label: '公房业务' },
                        { id: AppView.GOVERNANCE, label: '数据治理' },
                        { id: AppView.REPORTS, label: '报表中心' },
                        { id: AppView.PLANNING, label: '资源配置' },
                        { id: AppView.SUBSYSTEMS, label: '专项业务' },
                     ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => {
                                setCurrentView(item.id as AppView);
                                setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left py-3 px-4 rounded-md text-lg font-medium ${currentView === item.id ? 'bg-primary-600 text-white' : 'text-slate-300'}`}
                        >
                            {item.label}
                        </button>
                     ))}
                </div>
            </div>
        )}
    </div>
  );
};

export default App;
