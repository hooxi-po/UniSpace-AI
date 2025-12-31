import React from 'react';
import { Building } from '../types';
import { Users, MapPin, ArrowRight } from 'lucide-react';

const mockBuildings: Building[] = [
  {
    id: 'B1',
    name: '工程学院大楼',
    type: 'ACADEMIC',
    totalRooms: 45,
    occupancyRate: 88,
    location: '北校区',
    image: 'https://picsum.photos/400/250?random=1'
  },
  {
    id: 'B2',
    name: '学生活动中心',
    type: 'RECREATION',
    totalRooms: 12,
    occupancyRate: 95,
    location: '中心广场',
    image: 'https://picsum.photos/400/250?random=2'
  },
  {
    id: 'B3',
    name: '第一实验楼',
    type: 'ACADEMIC',
    totalRooms: 30,
    occupancyRate: 45,
    location: '东区',
    image: 'https://picsum.photos/400/250?random=3'
  },
  {
    id: 'B4',
    name: '西区宿舍楼',
    type: 'DORMITORY',
    totalRooms: 120,
    occupancyRate: 98,
    location: '西校区',
    image: 'https://picsum.photos/400/250?random=4'
  },
  {
    id: 'B5',
    name: '行政办公楼',
    type: 'ADMINISTRATION',
    totalRooms: 50,
    occupancyRate: 60,
    location: '南门',
    image: 'https://picsum.photos/400/250?random=5'
  },
  {
    id: 'B6',
    name: '图书馆综合体',
    type: 'ACADEMIC',
    totalRooms: 20,
    occupancyRate: 72,
    location: '中心广场',
    image: 'https://picsum.photos/400/250?random=6'
  }
];

export const PropertyMap: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">资产管理</h1>
            <p className="text-slate-500 mt-1 text-sm">楼宇、房间与门禁权限管理。</p>
        </div>
        <div className="flex space-x-2">
            <select className="bg-white border border-slate-200 text-slate-700 text-sm rounded-sm px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 cursor-pointer">
                <option>全部区域</option>
                <option>北校区</option>
                <option>中心广场</option>
                <option>东区</option>
            </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockBuildings.map((building) => {
            let typeLabel = '';
            let typeColor = '';
            switch(building.type) {
                case 'ACADEMIC': typeLabel = '教学'; typeColor = 'bg-blue-50 text-blue-600'; break;
                case 'DORMITORY': typeLabel = '宿舍'; typeColor = 'bg-green-50 text-green-600'; break;
                case 'ADMINISTRATION': typeLabel = '行政'; typeColor = 'bg-gray-50 text-gray-600'; break;
                case 'RECREATION': typeLabel = '娱乐'; typeColor = 'bg-orange-50 text-orange-600'; break;
            }

            return (
          <div key={building.id} className="bg-white rounded-sm shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all group cursor-pointer">
            <div className="h-40 overflow-hidden relative">
              <img 
                src={building.image} 
                alt={building.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-xs font-bold shadow-sm ${typeColor}`}>
                {typeLabel}
              </div>
            </div>
            <div className="p-5">
              <h3 className="text-base font-bold text-slate-900 mb-1">{building.name}</h3>
              <div className="flex items-center text-slate-500 text-xs mb-4">
                <MapPin size={12} className="mr-1" />
                {building.location}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                    <span className="text-slate-500">当前占用率</span>
                    <span className={`font-semibold ${building.occupancyRate > 90 ? 'text-[#FF7D00]' : 'text-slate-700'}`}>
                        {building.occupancyRate}%
                    </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div 
                        className={`h-1.5 rounded-full ${
                            building.occupancyRate > 90 ? 'bg-[#FF7D00]' : 'bg-primary-600'
                        }`} 
                        style={{ width: `${building.occupancyRate}%` }}
                    ></div>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t border-slate-50 mt-4">
                    <div className="flex items-center text-xs text-slate-500 gap-1">
                        <Users size={14}/> {building.totalRooms} 房间
                    </div>
                    <button className="text-primary-600 hover:text-primary-700 text-xs font-medium flex items-center transition-colors">
                        查看详情 <ArrowRight size={12} className="ml-1"/>
                    </button>
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};