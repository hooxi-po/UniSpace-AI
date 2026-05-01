export interface ImpactedRoom {
  id: string;
  buildingId: string;
  floorId: string;
  floorNo: number | null;
  roomNo: string;
  roomName: string;
  roomType: string;
  status: string;
  areaM2: number | null;
}

export interface LinkedEquipment {
  id: string;
  equipmentType: string;
  name: string;
  status: string;
  featureId?: string;
  nodeId?: string;
  buildingId?: string;
}

export interface FaultImpactScope {
  impactedBuildingCount: number;
  impactedRoomCount: number;
  impactedEquipmentCount: number;
  keyBuildingIds: string[];
}

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
  topologyNodeIds?: string[];
  linkedValves?: string[];
  impactedRooms?: ImpactedRoom[];
  linkedEquipments?: LinkedEquipment[];
  healthScore?: number;
  healthSummary?: 'healthy' | 'attention' | 'risk';
  faultImpactScope?: FaultImpactScope;
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
  contextSnapshot?: Record<string, unknown>;
  parsedPayload?: Record<string, unknown> | null;
}

export interface GeoJsonFeature {
  id: string | number;
  type: 'geojson';
  properties?: Record<string, unknown>;
}
