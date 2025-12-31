import React from 'react';
import { ShieldCheck, AlertCircle, FileSearch, Database, CheckCircle2, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const scoreData = [
  { name: 'Completed', value: 88 },
  { name: 'Missing', value: 12 },
];
const COLORS = ['#165DFF', '#F2F3F5'];

const risks = [
    { id: 1, text: 'A 栋 301 室缺失使用单位信息', type: '缺失项', level: 'High' },
    { id: 2, text: '理工楼房产证编号格式错误', type: '格式错误', level: 'Medium' },
    { id: 3, text: '5 间地下室无最近安全巡检记录', type: '隐患项', level: 'High' },
    { id: 4, text: '教工宿舍 2 栋面积总和与图纸不符', type: '逻辑错误', level: 'Low' },
];

export const DataGovernance: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">数据治理中心</h1>
            <p className="text-slate-500 mt-1 text-sm">基础数据全生命周期质量评测与隐患检测。</p>
        </div>
        <div className="flex gap-2">
             <span className="text-xs text-slate-500 self-center mr-2">上次扫描: 今天 09:00</span>
             <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-sm text-sm flex items-center gap-2">
                <FileSearch size={14}/> 深度扫描
             </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Card */}
        <div className="bg-white p-6 rounded-sm shadow-sm border border-slate-100 flex flex-col items-center justify-center">
            <h3 className="text-base font-bold text-slate-800 mb-4 self-start border-l-4 border-primary-600 pl-3">数据质量得分</h3>
            <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={scoreData}
                            innerRadius={60}
                            outerRadius={80}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                            {scoreData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-primary-600 font-[DINAlternate-Bold]">88</span>
                    <span className="text-xs text-slate-400">分 / 100</span>
                </div>
            </div>
            <p className="text-sm text-slate-500 mt-2 text-center">数据质量优良，击败了 92% 的高校</p>
        </div>

        {/* Stats Grid */}
        <div className="md:col-span-2 bg-white p-6 rounded-sm shadow-sm border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-6 border-l-4 border-primary-600 pl-3">数据健康概览</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-sm">
                    <div className="flex items-center gap-2 mb-2 text-slate-600 text-sm"><Database size={16}/> 总记录数</div>
                    <div className="text-2xl font-bold text-slate-900">42,891</div>
                </div>
                <div className="p-4 bg-green-50 rounded-sm">
                    <div className="flex items-center gap-2 mb-2 text-green-700 text-sm"><CheckCircle2 size={16}/> 完整记录</div>
                    <div className="text-2xl font-bold text-green-700">38,102</div>
                </div>
                 <div className="p-4 bg-red-50 rounded-sm">
                    <div className="flex items-center gap-2 mb-2 text-red-700 text-sm"><XCircle size={16}/> 缺失/错误</div>
                    <div className="text-2xl font-bold text-red-700">124</div>
                </div>
                 <div className="p-4 bg-orange-50 rounded-sm">
                    <div className="flex items-center gap-2 mb-2 text-orange-700 text-sm"><AlertCircle size={16}/> 潜在隐患</div>
                    <div className="text-2xl font-bold text-orange-700">18</div>
                </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                    核心字段完整率: <span className="font-bold text-slate-800">99.2%</span>
                </div>
                <div className="text-sm text-slate-500">
                    图属一致性: <span className="font-bold text-slate-800">95.8%</span>
                </div>
                <div className="text-sm text-slate-500">
                    数据鲜活度: <span className="font-bold text-slate-800">92%</span>
                </div>
            </div>
        </div>
      </div>

      {/* Risk List */}
      <div className="bg-white rounded-sm shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
             <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle size={18} className="text-orange-500"/>
                自动监测异常列表
            </h3>
        </div>
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                    <th className="px-6 py-3 font-medium">问题描述</th>
                    <th className="px-6 py-3 font-medium">监测类型</th>
                    <th className="px-6 py-3 font-medium">风险等级</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {risks.map((risk) => (
                    <tr key={risk.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">{risk.text}</td>
                        <td className="px-6 py-4">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">{risk.type}</span>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                risk.level === 'High' ? 'bg-red-50 text-red-600' : 
                                risk.level === 'Medium' ? 'bg-orange-50 text-orange-600' : 
                                'bg-blue-50 text-blue-600'
                            }`}>
                                {risk.level === 'High' ? '高风险' : risk.level === 'Medium' ? '中风险' : '低风险'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button className="text-primary-600 hover:text-primary-700 font-medium">去修复</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};
