import React from 'react';
import { FileDown, FileSpreadsheet, Calendar, History } from 'lucide-react';

export const ReportCenter: React.FC = () => {
  const standardReports = [
    { id: 1, name: '教育部教基 8388 报表', desc: '中小学及高校校舍情况统计', format: 'Excel', lastGen: '2023-10-01' },
    { id: 2, name: '财政部 5374 资产报表', desc: '事业单位国有资产年度报告', format: 'XML/Excel', lastGen: '2022-12-31' },
    { id: 3, name: '高校实验室信息统计表', desc: '教高司函〔2023〕年度报表', format: 'Excel', lastGen: '2023-09-15' },
    { id: 4, name: '公房定额测算分析表', desc: '校内定额核算专用', format: 'Excel', lastGen: '2023-10-25' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">报表中心</h1>
            <p className="text-slate-500 mt-1 text-sm">教育部/财政部标准数据一键上报与统计。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {standardReports.map((report) => (
            <div key={report.id} className="bg-white p-6 rounded-sm shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex justify-between items-center group">
                <div className="flex items-start gap-4">
                    <div className="bg-green-50 p-3 rounded-lg text-green-600 group-hover:bg-green-100 transition-colors">
                        <FileSpreadsheet size={28} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1">{report.name}</h3>
                        <p className="text-sm text-slate-500 mb-3">{report.desc}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                             <span className="flex items-center gap-1"><Calendar size={12}/> 上次生成: {report.lastGen}</span>
                             <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">{report.format}</span>
                        </div>
                    </div>
                </div>
                <button className="bg-white border border-primary-600 text-primary-600 hover:bg-primary-50 px-4 py-2 rounded-sm font-medium transition-colors flex items-center gap-2 text-sm">
                    <FileDown size={16}/> 一键生成
                </button>
            </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-sm shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-800 mb-6 border-l-4 border-primary-600 pl-3 flex items-center gap-2">
            <History size={18} className="text-slate-400"/>
            历史下载记录
          </h3>
          <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-sm border border-dashed border-slate-200">
             暂无更多历史记录，请先生成报表
          </div>
      </div>
    </div>
  );
};
