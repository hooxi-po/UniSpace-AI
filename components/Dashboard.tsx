import React, { useState, useRef, Suspense } from 'react';
import { 
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { 
  Zap, Thermometer, Droplets, Wifi, Shield, Activity, 
  Layers, Map, Maximize, AlertCircle, TrendingUp, Users, MonitorPlay, Sun, CloudRain, Wind
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html, ContactShadows, Sky } from '@react-three/drei';
import * as THREE from 'three';

// Fix for React Three Fiber intrinsic elements in TypeScript
// We need to extend both the global JSX namespace and the React module's JSX namespace
// to ensure compatibility with different TypeScript configurations and React versions (18+).
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      ambientLight: any;
      directionalLight: any;
      gridHelper: any;
      coneGeometry: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      ambientLight: any;
      directionalLight: any;
      gridHelper: any;
      coneGeometry: any;
    }
  }
}

// --- Mock Data ---
const energyData = [
  { time: '00:00', value: 120 }, { time: '04:00', value: 80 },
  { time: '08:00', value: 450 }, { time: '12:00', value: 580 },
  { time: '16:00', value: 500 }, { time: '20:00', value: 300 },
  { time: '23:59', value: 150 },
];

const occupancyData = [
    { name: '教学区', value: 4500 },
    { name: '生活区', value: 3200 },
    { name: '行政区', value: 800 },
    { name: '运动区', value: 1200 },
];
const OCCUPANCY_COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F'];

// --- 3D Components ---

const BuildingBlock = ({ position, size, color, label }: { position: [number, number, number], size: [number, number, number], color: string, label?: string }) => {
    const mesh = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    return (
        <group position={new THREE.Vector3(...position)}>
            <mesh 
                ref={mesh}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
                position={[0, size[1]/2, 0]}
            >
                <boxGeometry args={[size[0], size[1], size[2]]} />
                <meshStandardMaterial color={hovered ? '#3c89ff' : color} roughness={0.3} metalness={0.1} />
            </mesh>
            {/* Windows effect */}
            <mesh position={[0, size[1]/2, size[2]/2 + 0.05]}>
                <planeGeometry args={[size[0]*0.8, size[1]*0.8]} />
                <meshBasicMaterial color="#a3c4ff" opacity={0.3} transparent />
            </mesh>
            {label && hovered && (
                <Html position={[0, size[1] + 2, 0]} center>
                    <div className="bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm whitespace-nowrap border border-white/20">
                        {label}
                    </div>
                </Html>
            )}
        </group>
    );
};

const SensorMarker = ({ position, type, status, value, label }: any) => {
    return (
        <Html position={position} center zIndexRange={[100, 0]}>
             <div className="group cursor-pointer">
                <div className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 shadow-lg transition-transform group-hover:scale-125 ${
                    status === 'normal' ? 'bg-green-500 border-white animate-pulse' : 
                    status === 'warning' ? 'bg-orange-500 border-white animate-bounce' : 
                    'bg-red-500 border-white animate-ping'
                }`}>
                    {type === 'energy' && <Zap size={10} className="text-white"/>}
                    {type === 'temp' && <Thermometer size={10} className="text-white"/>}
                    {type === 'security' && <Shield size={10} className="text-white"/>}
                </div>
                
                {/* Tooltip */}
                <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-40 bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-slate-700 z-50">
                    <div className="text-xs text-slate-400 mb-1">{label}</div>
                    <div className="font-bold text-lg font-[DINAlternate-Bold]">{value}</div>
                    <div className="flex items-center gap-1 text-[10px] mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'normal' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {status === 'normal' ? '正常' : '异常'}
                    </div>
                </div>
            </div>
        </Html>
    )
}

const CampusScene = ({ activeLayer }: { activeLayer: string }) => {
    return (
        <>
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 20, 5]} intensity={1.5} castShadow />
            <Sky sunPosition={[100, 20, 100]} />
            <Environment preset="city" />

            {/* Ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#e2e8f0" />
            </mesh>
            <gridHelper args={[100, 50, '#cbd5e1', '#f1f5f9']} />

            {/* Buildings */}
            {/* Admin Block */}
            <BuildingBlock position={[-10, 0, -5]} size={[8, 12, 6]} color="#cbd5e1" label="行政楼" />
            {/* Library */}
            <BuildingBlock position={[0, 0, -15]} size={[15, 8, 10]} color="#94a3b8" label="图书馆" />
            {/* Science Block */}
            <BuildingBlock position={[12, 0, -5]} size={[10, 15, 8]} color="#64748b" label="理工实验楼" />
            {/* Dorms */}
            <BuildingBlock position={[-15, 0, 10]} size={[6, 10, 15]} color="#f8fafc" label="西区宿舍" />
            <BuildingBlock position={[-5, 0, 10]} size={[6, 10, 15]} color="#f8fafc" label="西区宿舍 B" />
            {/* Gym */}
            <BuildingBlock position={[15, 0, 10]} size={[12, 6, 12]} color="#bae6fd" label="体育馆" />

            {/* Trees (Simple Cones) */}
            {[-8, 8, -12, 12].map((x, i) => (
                <mesh key={i} position={[x, 1.5, 5]} castShadow>
                    <coneGeometry args={[1, 3, 8]} />
                    <meshStandardMaterial color="#4ade80" />
                </mesh>
            ))}

            {/* Sensors */}
            {(activeLayer === 'ALL' || activeLayer === 'ENERGY') && (
                <>
                    <SensorMarker position={[-10, 6, -5]} type="energy" status="normal" label="行政楼能耗" value="120 kW" />
                    <SensorMarker position={[12, 10, -5]} type="temp" status="warning" label="实验室暖通" value="28°C" />
                    <SensorMarker position={[0, 5, -15]} type="energy" status="normal" label="图书馆照明" value="Online" />
                </>
            )}
             {(activeLayer === 'ALL' || activeLayer === 'SECURITY') && (
                <>
                    <SensorMarker position={[-15, 8, 10]} type="security" status="normal" label="宿舍门禁" value="Closed" />
                    <SensorMarker position={[15, 4, 10]} type="security" status="error" label="体育馆侧门" value="Open" />
                </>
            )}

            <ContactShadows opacity={0.4} scale={40} blur={2} far={10} resolution={256} color="#000000" />
            
            <OrbitControls 
                enablePan={true} 
                enableZoom={true} 
                minPolarAngle={0} 
                maxPolarAngle={Math.PI / 2.2}
                autoRotate={true}
                autoRotateSpeed={0.5}
            />
        </>
    );
};


// --- UI Components ---
const MetricCard = ({ title, value, unit, icon: Icon, color, trend }: any) => (
    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-sm border border-slate-100 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-full ${color} bg-opacity-10 text-opacity-100`}>
            <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
        <div>
            <div className="text-slate-500 text-xs mb-0.5">{title}</div>
            <div className="flex items-end gap-1">
                <span className="text-xl font-bold text-slate-800 font-[DINAlternate-Bold]">{value}</span>
                <span className="text-xs text-slate-400 mb-1">{unit}</span>
            </div>
            {trend && (
                 <div className="text-[10px] text-green-600 flex items-center mt-1">
                    <TrendingUp size={10} className="mr-0.5"/> {trend}
                 </div>
            )}
        </div>
    </div>
);

export const Dashboard: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<'ALL' | 'ENERGY' | 'SECURITY'>('ALL');
  const [weather, setWeather] = useState('sunny');

  return (
    <div className="space-y-4 animate-fade-in pb-6 h-full flex flex-col">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-sm border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MonitorPlay className="text-primary-600" />
            校园数字孪生大屏
          </h1>
          <p className="text-slate-500 text-xs mt-1">Digital Twin Campus Operation Center</p>
        </div>
        <div className="flex items-center gap-4">
            {/* Visual Controls (WebGUI style) */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-sm border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">View Control</span>
                <div className="h-4 w-px bg-slate-200"></div>
                {['ALL', 'ENERGY', 'SECURITY'].map(layer => (
                    <button 
                        key={layer}
                        onClick={() => setActiveLayer(layer as any)}
                        className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
                            activeLayer === layer ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {layer === 'ALL' ? '全景' : layer === 'ENERGY' ? '能耗' : '安防'}
                    </button>
                ))}
            </div>

            <div className="h-4 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                系统实时在线
            </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-[500px]">
        
        {/* Left Panel: Environment & Status */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            {/* Metric Cards */}
            <MetricCard title="当前在校人数" value="12,842" unit="人" icon={Users} color="bg-blue-600" trend="+1.2%" />
            <MetricCard title="今日总能耗" value="3,420" unit="kWh" icon={Zap} color="bg-orange-500" trend="-0.5%" />
            <MetricCard title="设备健康度" value="98.5" unit="分" icon={Activity} color="bg-green-500" />

            {/* Real-time Charts */}
            <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-sm flex-1">
                <h3 className="font-bold text-slate-800 text-sm mb-4 border-l-4 border-primary-600 pl-2">实时能耗趋势</h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={energyData}>
                            <defs>
                                <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ff7d00" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#ff7d00" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="time" tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                            <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                            <Tooltip contentStyle={{borderRadius: '4px', border: 'none', fontSize: '12px'}}/>
                            <Area type="monotone" dataKey="value" stroke="#ff7d00" fillOpacity={1} fill="url(#colorEnergy)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-sm flex-1">
                <h3 className="font-bold text-slate-800 text-sm mb-4 border-l-4 border-primary-600 pl-2">人员分布占比</h3>
                <div className="h-40 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={occupancyData} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                                {occupancyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={OCCUPANCY_COLORS[index % OCCUPANCY_COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="text-center">
                             <div className="text-xs text-slate-400">区域</div>
                             <div className="font-bold text-slate-800">4</div>
                         </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Center Panel: Digital Twin 3D Map */}
        <div className="col-span-12 lg:col-span-6 relative bg-slate-900 rounded-sm overflow-hidden shadow-2xl border border-slate-700 group">
            <Canvas shadows camera={{ position: [20, 20, 20], fov: 45 }}>
                <Suspense fallback={null}>
                    <CampusScene activeLayer={activeLayer} />
                </Suspense>
            </Canvas>

            {/* Title Overlay */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded border border-white/20 text-xs font-mono flex items-center gap-2">
                    <Activity size={12} className="text-green-400 animate-pulse"/> 
                    TWIN-MODEL-V3.0 ONLINE
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
                <div className="space-y-2 pointer-events-auto">
                    <div className="bg-black/60 backdrop-blur-md p-3 rounded border-l-2 border-primary-500 text-white max-w-xs">
                        <div className="text-xs text-slate-400 mb-1">系统消息</div>
                        <div className="text-xs">
                            <span className="text-orange-400 font-bold">[14:20]</span> 东区围栏检测到异常入侵信号，安保人员已派遣。
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 pointer-events-auto">
                    <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded backdrop-blur-md transition-colors"><Layers size={18}/></button>
                    <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded backdrop-blur-md transition-colors"><Map size={18}/></button>
                    <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded backdrop-blur-md transition-colors"><Maximize size={18}/></button>
                </div>
            </div>
        </div>

        {/* Right Panel: Alerts & Lists */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
             {/* Weather / Env */}
             <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-sm p-4 text-white shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20"><Droplets size={64}/></div>
                <div className="text-sm font-medium opacity-90">校园环境</div>
                <div className="flex items-end gap-2 mt-2">
                    <span className="text-3xl font-bold font-[DINAlternate-Bold]">24°C</span>
                    <span className="text-xs opacity-80 mb-1">多云</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs opacity-90">
                    <div className="flex items-center gap-1"><Droplets size={12}/> 湿度 45%</div>
                    <div className="flex items-center gap-1"><Wifi size={12}/> PM2.5 32</div>
                </div>
                {/* Simulated Weather Controls */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
                    <button onClick={() => setWeather('sunny')} className="p-1 hover:bg-white/20 rounded"><Sun size={12}/></button>
                    <button onClick={() => setWeather('rain')} className="p-1 hover:bg-white/20 rounded"><CloudRain size={12}/></button>
                </div>
             </div>

             {/* Alerts List */}
             <div className="bg-white rounded-sm border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-500"/>
                        实时告警
                    </h3>
                    <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">3</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {[
                        { title: '东区围栏红外报警', time: '14:20', level: 'high' },
                        { title: '图书馆空调机组温度过高', time: '13:45', level: 'medium' },
                        { title: 'B栋水压异常', time: '11:10', level: 'low' },
                        { title: '网络中心UPS电池预警', time: '09:30', level: 'medium' },
                    ].map((alert, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border-l-2 border-red-400 rounded-r-sm hover:bg-red-50 transition-colors cursor-pointer">
                            <div className="flex justify-between items-start">
                                <span className="text-xs font-bold text-slate-800">{alert.title}</span>
                                <span className="text-[10px] text-slate-400">{alert.time}</span>
                            </div>
                            <div className="mt-1 flex gap-2">
                                <span className={`text-[10px] px-1 rounded ${
                                    alert.level === 'high' ? 'bg-red-200 text-red-700' : 
                                    alert.level === 'medium' ? 'bg-orange-200 text-orange-700' : 'bg-blue-200 text-blue-700'
                                }`}>
                                    {alert.level === 'high' ? '紧急' : alert.level === 'medium' ? '重要' : '一般'}
                                </span>
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