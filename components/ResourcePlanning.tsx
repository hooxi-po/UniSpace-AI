import React, { useState } from 'react';
import { Calculator, Layout, CheckCircle, AlertCircle, Coins, ArrowRight, Play, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const ResourcePlanning: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'QUOTA' | 'SIMULATION' | 'ALLOCATION'>('QUOTA');

  // Mock data for Quota
  const quotaData = [
    { dept: '计算机学院', standard: 5000, actual: 5200, gap: 200, status: 'EXCESS', cost: 24000 },
    { dept: '机械工程学院', standard: 4500, actual: 4000, gap: -500, status: 'DEFICIT', cost: -10000 },
    { dept: '外国语学院', standard: 2000, actual: 2000, gap: 0, status: 'NORMAL', cost: 0 },
    { dept: '行政部门', standard: 3000, actual: 3500, gap: 500, status: 'EXCESS', cost: 60000 },
  ];

  // Mock data for Simulation
  const simulationData = [
    { name: '现行方案', capacity: 1000, utilization: 95 },
    { name: '模拟方案 A (新建理工楼)', capacity: 1500, utilization: 65 },
  ];

  const renderQuota = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg text-primary-600">
                    <Calculator size={24}/>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">定额核算自动化</h3>
                    <p className="text-slate-500 text-sm">超额收费 / 低额补贴自动计算</p>
                </div>
             </div>
             <div className="text-right">
                <div className="text-2xl font-bold text-primary-600 font-[DINAlternate-Bold]">¥ 84,000</div>
                <div className="text-xs text-slate-500">本期预计总收益</div>
             </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                        <th className="px-6 py-3">单位名称</th>
                        <th className="px-6 py-3">核定面积 (㎡)</th>
                        <th className="px-6 py-3">实际使用 (㎡)</th>
                        <th className="px-6 py-3">超额/缺额</th>
                        <th className="px-6 py-3">核算结果</th>
                        <th className="px-6 py-3 text-right">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {quotaData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-6 py-4 font-medium">{item.dept}</td>
                            <td className="px-6 py-4">{item.standard}</td>
                            <td className="px-6 py-4">{item.actual}</td>
                            <td className="px-6 py-4">
                                <span className={`flex items-center gap-1 ${item.status === 'EXCESS' ? 'text-red-500' : item.status === 'DEFICIT' ? 'text-green-500' : 'text-slate-500'}`}>
                                    {item.gap > 0 ? `+${item.gap}` : item.gap}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {item.cost > 0 ? (
                                    <span className="text-red-600 font-bold flex items-center gap-1"><Coins size={14}/> 收费 ¥{item.cost.toLocaleString()}</span>
                                ) : item.cost < 0 ? (
                                    <span className="text-green-600 font-bold flex items-center gap-1"><Coins size={14}/> 补贴 ¥{Math.abs(item.cost).toLocaleString()}</span>
                                ) : (
                                    <span className="text-slate-400">达标</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button className="text-primary-600 hover:text-primary-700">发送通知</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderSimulation = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Panel */}
            <div className="bg-white p-6 rounded-sm shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Layout size={18} className="text-primary-600"/>
                    配置模拟参数
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">模拟场景类型</label>
                        <select className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600/20 outline-none">
                            <option>单位整体搬迁</option>
                            <option>新建公房配置</option>
                            <option>临时用房周转</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">目标单位</label>
                        <select className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600/20 outline-none">
                            <option>机械工程学院</option>
                            <option>材料科学学院</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">拟分配区域</label>
                        <select className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600/20 outline-none">
                            <option>北校区 - 创新大楼</option>
                            <option>东校区 - 老实验楼</option>
                        </select>
                    </div>
                    <button className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-sm font-medium flex items-center justify-center gap-2 mt-4 transition-colors">
                        <Play size={16}/> 开始演算
                    </button>
                </div>
            </div>

            {/* Result Panel */}
            <div className="lg:col-span-2 bg-white p-6 rounded-sm shadow-sm border border-slate-100 flex flex-col">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800">模拟结果对比</h3>
                    <span className="bg-green-50 text-green-600 text-xs px-2 py-1 rounded border border-green-200">演算完成</span>
                 </div>
                 
                 <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={simulationData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#f1f5f9"/>
                            <XAxis type="number" hide/>
                            <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12, fill: '#64748b'}}/>
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="utilization" name="拥挤度 (%)" fill="#165DFF" barSize={20} radius={[0, 4, 4, 0]} />
                            <Bar dataKey="capacity" name="容纳人数" fill="#00B42A" barSize={20} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                 </div>

                 <div className="mt-6 bg-slate-50 p-4 rounded-sm border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800 mb-2">AI 评估结论</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        采用 <span className="font-bold text-primary-600">方案 A</span> 后，机械工程学院的生均面积将从 3.5㎡ 提升至 5.2㎡，且实验室利用率将保持在 65% 的合理区间，建议采纳此方案。
                    </p>
                    <div className="mt-3 flex justify-end">
                        <button className="bg-slate-800 text-white px-4 py-1.5 rounded-sm text-xs flex items-center gap-2 hover:bg-slate-900 transition-colors">
                            <Save size={14}/> 应用此方案
                        </button>
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">资源配置与规划</h1>
            <p className="text-slate-500 mt-1 text-sm">定额管理、模拟仿真与房源调配。</p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
            <button 
                onClick={() => setActiveTab('QUOTA')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'QUOTA' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                定额核算
            </button>
            <button 
                onClick={() => setActiveTab('SIMULATION')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'SIMULATION' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                配置模拟
            </button>
            <button 
                onClick={() => setActiveTab('ALLOCATION')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'ALLOCATION' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                房源调配
            </button>
        </nav>
      </div>

      <div className="pt-2">
        {activeTab === 'QUOTA' && renderQuota()}
        {activeTab === 'SIMULATION' && renderSimulation()}
        {activeTab === 'ALLOCATION' && (
            <div className="flex items-center justify-center h-64 bg-slate-50 border border-dashed border-slate-300 rounded-sm text-slate-400">
                <div className="text-center">
                    <CheckCircle size={32} className="mx-auto mb-2 text-slate-300"/>
                    <p>房源调配功能模块已就绪</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
