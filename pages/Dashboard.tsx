import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Wallet, Bell, Calendar, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { Loan, LoanStatus, InstallmentStatus } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, parseDate } from '../utils';

interface UpcomingInstallment {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  number: number;
  daysUntil: number;
}

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState({
    totalLent: 0,
    totalCollected: 0,
    estimatedProfit: 0,
    outstandingCapital: 0,
    activeLoansCount: 0,
    clientsCount: 0,
    chartData: [] as any[],
    upcomingInstallments: [] as UpcomingInstallment[]
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const loans = StorageService.getLoans();
      const clients = StorageService.getClients();

      const totalLent = loans.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
      const totalPayable = loans.reduce((acc, l) => acc + (Number(l.totalPayable) || 0), 0);
      const totalCollected = loans.reduce((acc, l) => acc + (Number(l.totalPaid) || 0), 0);
      
      const estimatedProfit = totalPayable - totalLent; 
      const totalOutstanding = totalPayable - totalCollected;

      // Safe Chart Data Calculation
      const chartDataMap = new Map<string, { name: string, prestado: number, recaudado: number }>();
      
      loans.forEach(loan => {
        if (!loan.startDate) return;
        try {
          const dateObj = parseDate(loan.startDate);
          if (isNaN(dateObj.getTime())) return;

          const month = dateObj.toLocaleString('es-ES', { month: 'short' });
          const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`; 
          
          if (chartDataMap.has(key)) {
            const current = chartDataMap.get(key)!;
            current.prestado += (Number(loan.amount) || 0);
            current.recaudado += (Number(loan.totalPaid) || 0);
          } else {
            chartDataMap.set(key, { 
                name: month, 
                prestado: (Number(loan.amount) || 0), 
                recaudado: (Number(loan.totalPaid) || 0) 
            });
          }
        } catch (e) {
          console.warn("Skipping invalid loan date for chart", loan);
        }
      });

      const chartData = Array.from(chartDataMap.values()).slice(-6);

      // Notification Logic
      const today = new Date();
      today.setHours(0,0,0,0);
      const next7Days = new Date(today);
      next7Days.setDate(today.getDate() + 7);

      const upcoming: UpcomingInstallment[] = [];

      loans.forEach(loan => {
        if (loan.status === LoanStatus.COMPLETED) return;
        
        const client = clients.find(c => c.id === loan.clientId);
        const installments = Array.isArray(loan.installments) ? loan.installments : [];

        installments.forEach(inst => {
          if (inst.status === InstallmentStatus.PAID) return;
          if (!inst.dueDate) return;
          
          try {
            const due = parseDate(inst.dueDate);
            due.setHours(0,0,0,0);

            if (due >= today && due <= next7Days) {
              const diffTime = due.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              
              upcoming.push({
                id: `${loan.id}-${inst.number}`,
                clientName: client?.name || 'Cliente Desconocido',
                amount: inst.amount,
                dueDate: inst.dueDate,
                number: inst.number,
                daysUntil: diffDays
              });
            }
          } catch (e) { }
        });
      });

      upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

      setMetrics({
        totalLent,
        totalCollected,
        estimatedProfit,
        outstandingCapital: totalOutstanding,
        activeLoansCount: loans.filter(l => l.status === LoanStatus.ACTIVE).length,
        clientsCount: clients.length,
        chartData,
        upcomingInstallments: upcoming
      });
    } catch (globalError) {
      console.error("Dashboard calculation error:", globalError);
      setError("Error al procesar los datos para el panel. Es posible que el archivo de respaldo contenga datos inconsistentes.");
    }
  }, []);

  if (error) {
    return (
        <div className="p-8 bg-white rounded-xl shadow-sm border border-red-100 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Error de Visualización</h3>
            <p className="text-slate-600 mb-6 max-w-lg">{error}</p>
            <p className="text-sm text-slate-500">Por favor, ve a la sección de Configuración y trata de importar el archivo nuevamente o limpiar los datos.</p>
        </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
          {subValue && <p className="text-xs text-emerald-600 mt-1 font-medium">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Panel General</h2>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Capital Colocado" 
          value={formatCurrency(metrics.totalLent)} 
          icon={Wallet} 
          color="bg-blue-500" 
          subValue={`${metrics.activeLoansCount} préstamos activos`}
        />
        <StatCard 
          title="Total Recaudado" 
          value={formatCurrency(metrics.totalCollected)} 
          icon={TrendingUp} 
          color="bg-emerald-500"
          subValue="Recuperación de cartera"
        />
        <StatCard 
          title="Interés Estimado" 
          value={formatCurrency(metrics.estimatedProfit)} 
          icon={TrendingUp} 
          color="bg-indigo-500"
          subValue="Ganancia proyectada"
        />
        <StatCard 
          title="Saldo Pendiente" 
          value={formatCurrency(metrics.outstandingCapital)} 
          icon={AlertCircle} 
          color="bg-rose-500"
          subValue="Por cobrar"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bar Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96 flex flex-col">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Flujo de Préstamos vs Cobros</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{fill: '#f8fafc'}}
                    />
                    <Bar dataKey="prestado" name="Prestado" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="recaudado" name="Recaudado" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* Recovery Circle Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-slate-800">Recuperación de Capital</h3>
                <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">En tiempo real</span>
             </div>
             
             <div className="h-full flex flex-col justify-center items-center -mt-8">
                 <div className="relative w-48 h-48">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle className="text-slate-100 stroke-current" strokeWidth="10" cx="50" cy="50" r="40" fill="transparent"></circle>
                        <circle className="text-emerald-500 progress-ring__circle stroke-current transition-all duration-1000 ease-out" strokeWidth="10" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" 
                        strokeDasharray="251.2" 
                        strokeDashoffset={251.2 - (251.2 * (metrics.totalLent > 0 ? metrics.totalCollected / (metrics.totalLent + metrics.estimatedProfit) : 0))} 
                        ></circle>
                    </svg>
                    <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-slate-800">
                             {metrics.totalLent > 0 ? Math.round((metrics.totalCollected / (metrics.totalLent + metrics.estimatedProfit)) * 100) : 0}%
                        </span>
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Recuperado</span>
                    </div>
                 </div>
                 <div className="mt-4 text-center">
                    <p className="text-slate-500 text-sm">Objetivo Mensual</p>
                    <p className="text-slate-900 font-semibold">{formatCurrency(metrics.totalLent + metrics.estimatedProfit)}</p>
                 </div>
             </div>
          </div>
        </div>

        {/* Right Column: Notifications */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 h-full max-h-[44rem] flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center rounded-t-xl">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-600" />
                Próximos Vencimientos
              </h3>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                {metrics.upcomingInstallments.length}
              </span>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
              {metrics.upcomingInstallments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Calendar className="w-12 h-12 mb-3 text-slate-200" />
                  <p className="text-sm">No hay cuotas que venzan en los próximos 7 días.</p>
                </div>
              ) : (
                metrics.upcomingInstallments.map((item) => {
                  // Determine urgency color
                  let dateColor = 'text-slate-500 bg-slate-100';
                  let iconColor = 'text-slate-400';
                  let urgencyText = 'Días restantes';
                  
                  if (item.daysUntil === 0) {
                    dateColor = 'text-rose-700 bg-rose-100';
                    iconColor = 'text-rose-500';
                    urgencyText = 'Vence hoy';
                  } else if (item.daysUntil <= 3) {
                    dateColor = 'text-amber-700 bg-amber-100';
                    iconColor = 'text-amber-500';
                    urgencyText = `En ${item.daysUntil} días`;
                  } else {
                    dateColor = 'text-emerald-700 bg-emerald-100';
                    iconColor = 'text-emerald-500';
                    urgencyText = `En ${item.daysUntil} días`;
                  }

                  return (
                    <div key={item.id} className="group p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${iconColor}`} />
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${dateColor}`}>
                            {urgencyText}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {formatDate(item.dueDate)}
                        </span>
                      </div>
                      
                      <div className="mb-1">
                         <h4 className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">
                           {item.clientName}
                         </h4>
                         <p className="text-xs text-slate-500">Cuota #{item.number}</p>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50">
                        <span className="text-xs text-slate-400">Monto cuota</span>
                        <span className="font-bold text-slate-900">{formatCurrency(item.amount)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {metrics.upcomingInstallments.length > 0 && (
                <div className="p-3 border-t border-slate-100 text-center bg-slate-50 rounded-b-xl">
                    <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center justify-center gap-1 w-full">
                        Ver calendario completo <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;