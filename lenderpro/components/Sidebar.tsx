import React from 'react';
import { LayoutDashboard, Users, Banknote, Settings, Wallet } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'loans', label: 'Préstamos', icon: Banknote },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="w-64 bg-slate-850 text-white h-screen fixed left-0 top-0 flex flex-col shadow-xl z-20 hidden md:flex">
      <div className="p-6 border-b border-slate-700 flex items-center gap-3">
        <div className="bg-emerald-500 p-2 rounded-lg">
            <Wallet className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">LenderPro</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">AD</div>
          <div className="text-sm">
            <p className="text-white font-medium">Admin User</p>
            <p className="text-slate-500 text-xs">Gerente</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;