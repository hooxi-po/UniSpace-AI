export interface Building {
  id: string;
  name: string;
  type: 'ACADEMIC' | 'DORMITORY' | 'ADMINISTRATION' | 'RECREATION';
  totalRooms: number;
  occupancyRate: number; // 0-100
  location: string;
  image: string;
}

export interface Room {
  id: string;
  number: string;
  buildingId: string;
  capacity: number;
  features: string[];
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
}

export interface MaintenanceTicket {
  id: string;
  title: string;
  description: string;
  location: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  category: string;
  suggestedAction?: string; // From AI
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',     // 大数据分析/驾驶舱
  WORKFLOW = 'WORKFLOW',       // 公房业务
  BUILDINGS = 'BUILDINGS',     // 楼宇资产
  GOVERNANCE = 'GOVERNANCE',   // 数据治理
  REPORTS = 'REPORTS',         // 报表中心
  MAINTENANCE = 'MAINTENANCE', // 智慧维保
  PLANNING = 'PLANNING',       // 资源配置与规划 (新增)
  SUBSYSTEMS = 'SUBSYSTEMS',   // 专项业务子系统 (新增)
  CHAT = 'CHAT'
}
