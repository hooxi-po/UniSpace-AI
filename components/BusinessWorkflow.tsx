import React from 'react';
import { FileText, ArrowRight, CheckCircle2, Clock, User, Building, Landmark, School } from 'lucide-react';

export const BusinessWorkflow: React.FC = () => {
  const levels = [
    { title: '使用人', icon: User, desc: '发起申请 / 报修', bg: 'bg-blue-50', text: 'text-blue-600' },
    { title: '使用单位', icon: Building, desc: '二级单位初审', bg: 'bg-indigo-50', text: 'text-indigo-600' },
    { title: '主管部门', icon: Landmark, desc: '资产处复审 / 调配', bg: 'bg-purple-50', text: 'text-purple-600' },
    { title: '统筹部门', icon: School, desc: '校级决策 / 规划', bg: 'bg-slate-50', text: 'text-slate-600' },
  ];

  const tasks = [
    { id: 'WF-2023001', type: '公房分配', subject: '计算机学院新增实验室申请', currentLevel: '主管部门', status: '待审批', date: '2023-10-26' },
    { id: 'WF-2023002', type: '维修改造', subject: '老图书馆外墙修缮申报', currentLevel: '统筹部门', status: '论证中', date: '2023-10-25' },
    { id: 'WF-2023003', type: '用房调整', subject: '行政楼 305 办公室退还', currentLevel: '使用单位', status: '已通过', date: '2023-10-24' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">公房业务全流程管理</h1>
            <p className="text-slate-500 mt-1 text-sm">四级管理体系，全业务流程线上闭环。</p>
        </div>
        <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-sm text-sm font-medium transition-colors shadow-sm">
            + 发起业务
        </button>
      </div>

      {/* Multi-level Diagram */}
      <div className="bg-white p-8 rounded-sm shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 bg-primary-600 text-white text-xs px-2 py-1 rounded-br-lg font-medium">四级管理体系</div>
        <div className="flex flex-col md:flex-row justify-between items-center relative z-10 gap-6 md:gap-0">
            {levels.map((level, index) => (
                <div key={index} className="flex items-center flex-1 w-full md:w-auto">
                    <div className="flex flex-col items-center text-center flex-1">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${level.bg} ${level.text} shadow-sm border-2 border-white ring-1 ring-slate-100`}>
                            <level.icon size={28} />
                        </div>
                        <h3 className="font-bold text-slate-800">{level.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">{level.desc}</p>
                    </div>
                    {index < levels.length - 1 && (
                        <div className="hidden md:flex flex-col items-center mx-4 text-slate-300">
                            <div className="h-0.5 w-16 bg-slate-200"></div>
                            <ArrowRight size={16} className="-mt-2.5 bg-white rounded-full"/>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>

      {/* Active Workflows */}
      <div className="bg-white rounded-sm shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-primary-600"/>
                待办事项
            </h3>
            <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">3 个待办</span>
        </div>
        <div className="divide-y divide-slate-100">
            {tasks.map(task => (
                <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${task.status === '待审批' ? 'bg-orange-100 text-orange-600' : task.status === '论证中' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            <Clock size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-slate-800 group-hover:text-primary-600 transition-colors">{task.subject}</span>
                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{task.type}</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                单号: {task.id} · 提交于 {task.date} · 当前环节: <span className="font-semibold text-slate-700">{task.currentLevel}</span>
                            </p>
                        </div>
                    </div>
                    <button className="text-sm text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-sm font-medium transition-colors">
                        处理
                    </button>
                </div>
            ))}
        </div>
        <div className="p-4 border-t border-slate-100 text-center">
            <button className="text-xs text-slate-500 hover:text-primary-600 transition-colors">查看全部已办业务</button>
        </div>
      </div>
    </div>
  );
};
