export interface PipeNode {
  id: string;
  type: 'water' | 'sewage' | 'drain';
  status: 'normal' | 'warning' | 'critical';
  pressure: number;
  flowRate: number;
  coordinates: { x: number; y: number }[];
  // Asset Ledger Details
  diameter: string; // e.g., DN200
  material: string; // e.g., PE, Cast Iron
  depth: number; // meters
  installDate: string;
  lastMaintain: string;
  connectedBuildingIds: string[];
}

export interface Building {
  id: string;
  name: string;
  type: 'dorm' | 'lab' | 'canteen' | 'admin';
  status: 'normal' | 'warning';
  coordinates: { x: number; y: number };
  connectedPipeId: string;
  // Drill down info
  rooms: number;
  keyEquipment: string[]; // e.g., ["Booster Pump A", "Valve B"]
  powerConsumption: number; // kWh
}

export interface WorkOrder {
  id: string;
  targetId: string;
  type: 'inspection' | 'repair' | 'maintenance';
  status: 'pending' | 'processing' | 'completed';
  description: string;
  date: string;
}

export interface Alert {
  id: string;
  message: string;
  timestamp: string;
  level: 'info' | 'warning' | 'critical';
  location: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}
