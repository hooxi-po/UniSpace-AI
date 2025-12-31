import React, { useState } from 'react';
import { 
  Store, Building, Home, Beaker, Share2, FileText, 
  ArrowRight, ArrowLeft, Search, Filter, MoreHorizontal, 
  CheckCircle2, AlertCircle, Clock, Calendar, User, 
  Download, Plus, Banknote
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

// --- Subsystem 1: Commercial (经营性用房) ---
const CommercialView = ({ onBack }: { onBack: () => void }) => {
  const contracts = [
    { id: 'C-2023001', tenant: '校园星巴克', location: '图书馆一层', area: '120㎡', rent: '¥15,000/月', status: '正常', due: '2025-12-31' },
    { id: 'C-2023002', tenant: '罗森便利店', location: '北区宿舍楼下', area: '60㎡', rent: '¥8,000/月', status: '即将到期', due: '2023-11-15' },
    { id: 'C-2023003', tenant: '图文打印社', location: '教学楼 B1', area: '45㎡', rent: '¥5,500/月', status: '欠费', due: '2023-10-01' },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">经营性用房管理</h2>
            <p className="text-slate-500 text-sm">合同全生命周期管理与租金收缴。</p>
          </div>
        </div>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 hover:bg-primary-700">
          <Plus size={16} /> 新增合同
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-sm border border-slate-100 shadow-sm">
             <div className="text-slate-500 text-sm mb-1">本月应收租金</div>
             <div className="text-2xl font-bold text-slate-900 font-[DINAlternate-Bold]">¥ 245,000</div>
             <div className="mt-2 text-xs text-green-600 bg-green-50 inline-block px-2 py-0.5 rounded">收缴率 92%</div>
        </div>
        <div className="bg-white p-6 rounded-sm border border-slate-100 shadow-sm">
             <div className="text-slate-500 text-sm mb-1">即将到期合同</div>
             <div className="text-2xl font-bold text-slate-900 font-[DINAlternate-Bold]">3 <span className="text-sm font-normal text-slate-400">份</span></div>
             <button className="mt-2 text-xs text-primary-600 hover:underline">查看详情</button>
        </div>
        <div className="bg-white p-6 rounded-sm border border-slate-100 shadow-sm">
             <div className="text-slate-500 text-sm mb-1">空置招租房源</div>
             <div className="text-2xl font-bold text-slate-900 font-[DINAlternate-Bold]">5 <span className="text-sm font-normal text-slate-400">处</span></div>
             <div className="mt-2 text-xs text-slate-500">总面积 210㎡</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800">合同台账</h3>
            <div className="flex gap-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1.5 text-slate-400" size={14} />
                    <input type="text" placeholder="搜索租户或位置" className="pl-8 pr-3 py-1 text-sm border border-slate-200 rounded-sm focus:border-primary-500 outline-none"/>
                </div>
                <button className="p-1 hover:bg-slate-200 rounded"><Filter size={16} className="text-slate-500"/></button>
            </div>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">合同编号</th>
              <th className="px-6 py-3">租户名称</th>
              <th className="px-6 py-3">位置</th>
              <th className="px-6 py-3">面积</th>
              <th className="px-6 py-3">租金</th>
              <th className="px-6 py-3">状态</th>
              <th className="px-6 py-3">到期日</th>
              <th className="px-6 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-slate-500">{c.id}</td>
                <td className="px-6 py-4 font-medium text-slate-800">{c.tenant}</td>
                <td className="px-6 py-4 text-slate-600">{c.location}</td>
                <td className="px-6 py-4 text-slate-600">{c.area}</td>
                <td className="px-6 py-4 font-medium">{c.rent}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded text-xs border ${
                    c.status === '正常' ? 'bg-green-50 text-green-600 border-green-200' :
                    c.status === '即将到期' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                    'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">{c.due}</td>
                <td className="px-6 py-4 text-right text-slate-400 hover:text-primary-600 cursor-pointer">
                  <MoreHorizontal size={18} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Subsystem 2: Apartment (公寓出租) ---
const ApartmentView = ({ onBack }: { onBack: () => void }) => {
    const rooms = [
        { id: '101', type: '单人间', price: 1200, status: 'AVAILABLE', floor: 1 },
        { id: '102', type: '双人间', price: 800, status: 'OCCUPIED', floor: 1 },
        { id: '103', type: '套房', price: 2500, status: 'AVAILABLE', floor: 1 },
        { id: '201', type: '单人间', price: 1250, status: 'AVAILABLE', floor: 2 },
        { id: '202', type: '单人间', price: 1250, status: 'MAINTENANCE', floor: 2 },
        { id: '203', type: '双人间', price: 850, status: 'OCCUPIED', floor: 2 },
    ];

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">公寓出租管理</h2>
                    <p className="text-slate-500 text-sm">房源选房、资格审核与签约。</p>
                </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-sm border border-slate-100 shadow-sm mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800">房源状态视图 (教工公寓 A 栋)</h3>
                            <div className="flex gap-3 text-xs">
                                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-slate-300 rounded-sm"></div> 空闲</span>
                                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-200 rounded-sm"></div> 已租</span>
                                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-100 rounded-sm"></div> 维修</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
                            {rooms.map(room => (
                                <div key={room.id} className={`p-4 border rounded-sm flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-md ${
                                    room.status === 'AVAILABLE' ? 'border-primary-200 bg-white hover:border-primary-500' :
                                    room.status === 'OCCUPIED' ? 'border-slate-100 bg-slate-50 opacity-60' :
                                    'border-orange-200 bg-orange-50'
                                }`}>
                                    <span className="font-bold text-lg text-slate-700">{room.id}</span>
                                    <span className="text-xs text-slate-500 mt-1">{room.type}</span>
                                    {room.status === 'AVAILABLE' && <span className="text-xs font-bold text-primary-600 mt-2">¥{room.price}/月</span>}
                                    {room.status === 'MAINTENANCE' && <span className="text-xs text-orange-600 mt-2 flex items-center gap-1"><AlertCircle size={10}/> 维修中</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="bg-white p-6 rounded-sm border border-slate-100 shadow-sm h-full">
                        <h3 className="font-bold text-slate-800 mb-4 border-l-4 border-primary-600 pl-3">待审核申请</h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-sm border border-slate-100">
                                    <div className="bg-white p-2 rounded-full border border-slate-200">
                                        <User size={16} className="text-slate-500"/>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-sm text-slate-800">张伟 (讲师)</span>
                                            <span className="text-xs text-slate-400">10分钟前</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">申请房源: 101 单人间</p>
                                        <div className="flex gap-2 mt-2">
                                            <button className="flex-1 bg-primary-600 text-white text-xs py-1 rounded hover:bg-primary-700">通过</button>
                                            <button className="flex-1 bg-white border border-slate-200 text-slate-600 text-xs py-1 rounded hover:bg-slate-50">驳回</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Subsystem 3: Dormitory (学生宿舍) ---
const DormView = ({ onBack }: { onBack: () => void }) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">学生宿舍管理</h2>
                    <p className="text-slate-500 text-sm">可视化归寝管理与床位分配。</p>
                </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2 text-slate-400" size={16} />
                    <input type="text" placeholder="输入学号或姓名查询..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:ring-2 focus:ring-primary-500/20 outline-none w-64"/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { room: '301', male: true, beds: ['李明', '王强', '张三', null] },
                    { room: '302', male: true, beds: ['陈风', '赵云', '马超', '黄忠'] },
                    { room: '303', male: true, beds: ['刘备', null, null, null] },
                    { room: '304', male: true, beds: ['孙权', '周瑜', '鲁肃', '吕蒙'] },
                ].map((r, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-sm border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-800">{r.room} 室</h3>
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">男生公寓</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {r.beds.map((student, i) => (
                                <div key={i} className={`h-16 rounded border flex flex-col items-center justify-center text-xs transition-colors ${
                                    student ? 'bg-slate-50 border-slate-200' : 'bg-green-50 border-green-200 border-dashed cursor-pointer hover:bg-green-100'
                                }`}>
                                    {student ? (
                                        <>
                                            <User size={14} className="text-slate-400 mb-1"/>
                                            <span className="font-medium text-slate-700">{student}</span>
                                        </>
                                    ) : (
                                        <span className="text-green-600 font-medium">空床</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-xs text-slate-400">
                            <span>4 人间</span>
                            <span>入住率 {r.beds.filter(b => b).length}/4</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Subsystem 4: Research (科研周转房) ---
const ResearchView = ({ onBack }: { onBack: () => void }) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">科研周转房</h2>
                    <p className="text-slate-500 text-sm">基于项目的房源配置与期限管理。</p>
                </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-sm border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6">重点项目用房监控</h3>
                <div className="space-y-6">
                    {[
                        { project: '国家重点实验室 - 人工智能专项', leader: '周教授', room: '科技楼 401-405', daysLeft: 120, progress: 60, status: 'NORMAL' },
                        { project: '量子物理研究课题组', leader: '吴院士', room: '实验楼 B201', daysLeft: 15, progress: 95, status: 'WARNING' },
                        { project: '绿色能源材料研发', leader: '郑副教授', room: '新材料中心 101', daysLeft: 300, progress: 20, status: 'NORMAL' },
                    ].map((p, idx) => (
                        <div key={idx} className="flex items-center gap-6 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                            <div className="w-12 h-12 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                {p.project.substring(0,1)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <h4 className="font-bold text-slate-800">{p.project}</h4>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.status === 'WARNING' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                        {p.status === 'WARNING' ? '即将到期' : '使用中'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mb-2">负责人: {p.leader} · 占用区域: {p.room}</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${p.status === 'WARNING' ? 'bg-red-500' : 'bg-primary-600'}`} style={{width: `${p.progress}%`}}></div>
                                    </div>
                                    <span className="text-xs text-slate-500 w-24 text-right">剩余 {p.daysLeft} 天</span>
                                </div>
                            </div>
                            <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-sm hover:border-primary-600 hover:text-primary-600 transition-colors text-sm">
                                延期申请
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Subsystem 5: Shared (公房共享) ---
const SharedView = ({ onBack }: { onBack: () => void }) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">公房共享平台</h2>
                    <p className="text-slate-500 text-sm">会议室、多功能厅的分时预约管理。</p>
                </div>
                </div>
                <div className="flex gap-2">
                    <button className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-sm text-sm flex items-center gap-2">
                        <Calendar size={14}/> 今天 (10月27日)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {[
                    { name: '第一会议室', loc: '行政楼 301', cap: 30, events: [{time: '09:00 - 11:00', title: '院长办公会'}, {time: '14:00 - 16:00', title: '党支部会议'}] },
                    { name: '学术报告厅', loc: '图书馆 B1', cap: 200, events: [{time: '13:00 - 17:00', title: '人工智能前沿讲座'}] },
                    { name: '贵宾接待室', loc: '行政楼 101', cap: 10, events: [] },
                 ].map((room, idx) => (
                     <div key={idx} className="bg-white border border-slate-100 rounded-sm shadow-sm overflow-hidden">
                         <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                             <div>
                                 <h3 className="font-bold text-slate-800">{room.name}</h3>
                                 <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><CheckCircle2 size={10} className="text-green-500"/> 设备正常 · {room.loc} · {room.cap}人</p>
                             </div>
                             <button className="bg-primary-600 text-white text-xs px-3 py-1.5 rounded-sm hover:bg-primary-700">预约</button>
                         </div>
                         <div className="p-4 space-y-3">
                             {room.events.length > 0 ? room.events.map((ev, i) => (
                                 <div key={i} className="flex items-start gap-3 text-sm">
                                     <span className="font-mono text-slate-500 text-xs mt-0.5 w-20">{ev.time}</span>
                                     <div className="flex-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 truncate">
                                         {ev.title}
                                     </div>
                                 </div>
                             )) : (
                                 <div className="text-center py-6 text-slate-400 text-xs">
                                     今日暂无预约，全天空闲
                                 </div>
                             )}
                         </div>
                     </div>
                 ))}
            </div>
        </div>
    );
};

// --- Subsystem 6: Property Rights (产权住宅) ---
const PropertyRightsView = ({ onBack }: { onBack: () => void }) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">产权住宅档案</h2>
                    <p className="text-slate-500 text-sm">教职工住房档案与货币化补贴计算。</p>
                </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-sm border border-slate-100 shadow-sm">
                <div className="flex gap-4 mb-6">
                    <input type="text" placeholder="输入教职工工号或姓名..." className="flex-1 px-4 py-2 border border-slate-200 rounded-sm outline-none focus:border-primary-500"/>
                    <button className="bg-primary-600 text-white px-6 py-2 rounded-sm font-medium">查询档案</button>
                </div>
                
                <div className="border border-slate-100 rounded-sm">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                        <span className="font-bold text-slate-700">最新补贴发放记录</span>
                        <button className="text-xs text-primary-600 flex items-center gap-1"><Download size={12}/> 导出报表</button>
                    </div>
                    {[
                        { name: '王建国', id: '10023', type: '教授', subsidy: '¥ 2,400', month: '2023-10' },
                        { name: '刘淑芬', id: '10056', type: '副教授', subsidy: '¥ 1,800', month: '2023-10' },
                        { name: '张志强', id: '20011', type: '行政人员', subsidy: '¥ 1,200', month: '2023-10' },
                    ].map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                             <div className="flex items-center gap-4">
                                 <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">{p.name.substring(0,1)}</div>
                                 <div>
                                     <div className="font-bold text-slate-800 text-sm">{p.name} <span className="font-normal text-slate-400 text-xs ml-1">({p.id})</span></div>
                                     <div className="text-xs text-slate-500">{p.type}</div>
                                 </div>
                             </div>
                             <div className="text-right">
                                 <div className="font-bold text-slate-900">{p.subsidy}</div>
                                 <div className="text-xs text-slate-400">发放月份: {p.month}</div>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- Main Entry Component ---
export const SpecializedSubsystems: React.FC = () => {
  const [activeSystem, setActiveSystem] = useState<number | null>(null);

  const subsystems = [
    {
      id: 1,
      title: '经营性用房',
      icon: Store,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      stats: [{ label: '出租率', value: '92%' }, { label: '待收租金', value: '¥12.5w' }],
      desc: '招租、合同、结算全闭环',
      action: '合同管理'
    },
    {
      id: 2,
      title: '公寓出租管理',
      icon: Building,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      stats: [{ label: '待审核', value: '12' }, { label: '剩余房源', value: '5' }],
      desc: '支持移动端选房与签约',
      action: '资格审核'
    },
    {
      id: 3,
      title: '学生宿舍系统',
      icon: Home,
      color: 'text-green-600',
      bg: 'bg-green-50',
      stats: [{ label: '入住率', value: '98.5%' }, { label: '空床位', value: '142' }],
      desc: '床位分配与智能归寝管控',
      action: '入住分配'
    },
    {
      id: 4,
      title: '科研周转房',
      icon: Beaker,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      stats: [{ label: '流转中', value: '8' }, { label: '即将到期', value: '2' }],
      desc: '申请借用与配置核算',
      action: '申请审批'
    },
    {
      id: 5,
      title: '公房共享平台',
      icon: Share2,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      stats: [{ label: '今日预约', value: '45' }, { label: '活跃度', value: 'High' }],
      desc: '资源分时预约与门禁联动',
      action: '预约管理'
    },
    {
      id: 6,
      title: '产权住宅档案',
      icon: FileText,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
      stats: [{ label: '总户数', value: '1,204' }, { label: '已发放补贴', value: '99%' }],
      desc: '产权档案与货币化补贴',
      action: '档案查询'
    }
  ];

  // Render Logic
  if (activeSystem === 1) return <CommercialView onBack={() => setActiveSystem(null)} />;
  if (activeSystem === 2) return <ApartmentView onBack={() => setActiveSystem(null)} />;
  if (activeSystem === 3) return <DormView onBack={() => setActiveSystem(null)} />;
  if (activeSystem === 4) return <ResearchView onBack={() => setActiveSystem(null)} />;
  if (activeSystem === 5) return <SharedView onBack={() => setActiveSystem(null)} />;
  if (activeSystem === 6) return <PropertyRightsView onBack={() => setActiveSystem(null)} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">专项业务子系统</h1>
            <p className="text-slate-500 mt-1 text-sm">针对特定房产类型的垂直管理应用集群。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subsystems.map((sub) => (
            <div 
                key={sub.id} 
                onClick={() => setActiveSystem(sub.id)}
                className="bg-white p-6 rounded-sm shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative overflow-hidden cursor-pointer"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-lg ${sub.bg} ${sub.color}`}>
                        <sub.icon size={24} />
                    </div>
                    <button className="text-slate-400 hover:text-primary-600 transition-colors">
                        <ArrowRight size={20} />
                    </button>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">{sub.title}</h3>
                <p className="text-xs text-slate-500 mb-6 h-8">{sub.desc}</p>
                
                <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                    {sub.stats.map((stat, idx) => (
                        <div key={idx}>
                            <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                            <p className="text-base font-bold text-slate-800 font-[DINAlternate-Bold]">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-2">
                    <button className={`w-full py-2 rounded-sm text-sm font-medium border border-transparent hover:border-slate-200 transition-colors bg-slate-50 text-slate-600 group-hover:bg-primary-50 group-hover:text-primary-600 flex items-center justify-center gap-2`}>
                        {sub.action}
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
