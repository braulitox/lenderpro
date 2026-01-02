import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Calculator, Calendar, DollarSign, ChevronRight, CheckCircle, AlertCircle, Clock, Edit2, RefreshCw, Receipt, X, Filter } from 'lucide-react';
import { Client, Loan, Frequency, LoanType, LoanStatus, InstallmentStatus, InterestType } from '../types';
import { StorageService } from '../services/storage';
import { calculateSchedule, formatCurrency, formatDate, getInstallmentStatus, addTime, calculateDurationFromDates, parseDate, toISODate } from '../utils';

const Loans: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LoanStatus | 'ALL'>('ALL');
  
  // Estado para el Toast de notificación
  const [toast, setToast] = useState<{ show: boolean; message: string } | null>(null);

  // Refs for Date Inputs (kept for focus management if needed)
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    clientId: '',
    amount: 1000,
    interestRate: 10,
    interestType: InterestType.PERCENTAGE,
    frequency: Frequency.MONTHLY,
    duration: 12,
    type: LoanType.SIMPLE,
    startDate: toISODate(new Date()),
    endDate: ''
  });

  useEffect(() => {
    setLoans(StorageService.getLoans());
    setClients(StorageService.getClients());
  }, [view, selectedLoan]);

  // Initial End Date Calculation if not set
  useEffect(() => {
    if (view === 'create' && !isEditing && !formData.endDate && formData.startDate) {
        const start = parseDate(formData.startDate);
        const end = addTime(start, formData.frequency, formData.duration);
        setFormData(prev => ({ ...prev, endDate: toISODate(end) }));
    }
  }, [view, isEditing, formData.startDate, formData.frequency, formData.duration]);

  const resetForm = () => {
    setFormData({
      id: '',
      clientId: '',
      amount: 1000,
      interestRate: 10,
      interestType: InterestType.PERCENTAGE,
      frequency: Frequency.MONTHLY,
      duration: 12,
      type: LoanType.SIMPLE,
      startDate: toISODate(new Date()),
      endDate: ''
    });
    setIsEditing(false);
  };

  const handleEditInit = (loan: Loan) => {
    setFormData({
      id: loan.id,
      clientId: loan.clientId,
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestType: loan.interestType || InterestType.PERCENTAGE, // fallback for old data
      frequency: loan.frequency,
      duration: loan.duration,
      type: loan.type,
      startDate: loan.startDate.split('T')[0],
      endDate: loan.endDate ? loan.endDate.split('T')[0] : ''
    });
    setIsEditing(true);
    setView('create');
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    // value is YYYY-MM-DD from input[type=date]
    if (!value) {
        setFormData(prev => ({ ...prev, [field === 'start' ? 'startDate' : 'endDate']: '' }));
        return;
    }

    if (field === 'start') {
        // If start changes, shift end date based on duration
        const newStart = parseDate(value);
        const newEnd = addTime(newStart, formData.frequency, formData.duration);
        setFormData(prev => ({ 
            ...prev, 
            startDate: value, 
            endDate: toISODate(newEnd)
        }));
    } else {
        // If end changes, recalculate duration
        const duration = calculateDurationFromDates(formData.startDate, value, formData.frequency);
        setFormData(prev => ({ 
            ...prev, 
            endDate: value, 
            duration: duration > 0 ? duration : 1 
        }));
    }
  };

  const handleDurationChange = (value: number) => {
     const start = parseDate(formData.startDate);
     const newEnd = addTime(start, formData.frequency, value);
     setFormData(prev => ({
         ...prev,
         duration: value,
         endDate: toISODate(newEnd)
     }));
  };

  const handleFrequencyChange = (freq: Frequency) => {
      const start = parseDate(formData.startDate);
      const newEnd = addTime(start, freq, formData.duration);
      setFormData(prev => ({
          ...prev,
          frequency: freq,
          endDate: toISODate(newEnd)
      }));
  };

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try { return crypto.randomUUID(); } catch(e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Recalculate schedule based on current form data
    const schedule = calculateSchedule(
      Number(formData.amount),
      Number(formData.interestRate),
      formData.interestType,
      formData.frequency,
      Number(formData.duration),
      formData.type,
      formData.startDate
    );

    // If editing, attempt to preserve "PAID" status from the previous version of the loan
    // CAUTION: This assumes the user accepts "rewriting history" regarding amounts if they changed rates/capital.
    if (isEditing && selectedLoan) {
        schedule.forEach((newInst) => {
            const oldInst = selectedLoan.installments.find(i => i.number === newInst.number);
            if (oldInst && oldInst.status === InstallmentStatus.PAID) {
                newInst.status = InstallmentStatus.PAID;
                newInst.paymentDate = oldInst.paymentDate;
                // Note: We update the amount to the NEW calculation, but keep it marked as paid.
                // This effectively updates the ledger to the new terms.
            }
        });
    }

    const totalPayable = schedule.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaid = schedule.reduce((acc, curr) => curr.status === InstallmentStatus.PAID ? acc + curr.amount : acc, 0);
    const actualEndDate = schedule.length > 0 ? schedule[schedule.length - 1].dueDate : formData.endDate;

    const loanPayload: Loan = {
      id: isEditing ? formData.id : generateUUID(),
      clientId: formData.clientId,
      amount: Number(formData.amount),
      interestRate: Number(formData.interestRate),
      interestType: formData.interestType,
      frequency: formData.frequency,
      duration: Number(formData.duration),
      type: formData.type,
      startDate: formData.startDate,
      endDate: actualEndDate,
      installments: schedule,
      status: schedule.every(i => i.status === InstallmentStatus.PAID) ? LoanStatus.COMPLETED : LoanStatus.ACTIVE,
      totalPayable,
      totalPaid
    };

    if (isEditing) StorageService.updateLoan(loanPayload);
    else StorageService.saveLoan(loanPayload);
    
    setLoans(prev => isEditing ? prev.map(l => l.id === loanPayload.id ? loanPayload : l) : [...prev, loanPayload]);
    if (selectedLoan && selectedLoan.id === loanPayload.id) setSelectedLoan(loanPayload);
    
    resetForm();
    setView('list');
  };

  const handlePayInstallment = (installmentNumber: number) => {
    if (!selectedLoan) return;
    const updatedLoan = StorageService.payInstallment(selectedLoan.id, installmentNumber);
    if (updatedLoan) {
        setSelectedLoan(updatedLoan);
        
        // Mostrar Toast de confirmación
        setToast({
            show: true,
            message: `Pago registrado. Nuevo total recaudado: ${formatCurrency(updatedLoan.totalPaid)}`
        });

        // Ocultar Toast automáticamente después de 3 segundos
        setTimeout(() => {
            setToast(null);
        }, 4000);
    }
  };

  // --- Real-time Simulation Preview ---
  const simulationPreview = useMemo(() => {
    if (!formData.amount || !formData.duration) return null;
    
    const simSchedule = calculateSchedule(
        Number(formData.amount) || 0,
        Number(formData.interestRate) || 0,
        formData.interestType,
        formData.frequency,
        Number(formData.duration) || 1,
        formData.type,
        formData.startDate || new Date().toISOString()
    );

    const totalSimulated = simSchedule.reduce((acc, curr) => acc + curr.amount, 0);
    const interestSimulated = simSchedule.reduce((acc, curr) => acc + curr.interest, 0);
    const firstQuota = simSchedule.length > 0 ? simSchedule[0].amount : 0;

    return { total: totalSimulated, interest: interestSimulated, quota: firstQuota };
  }, [formData]);


  const renderCreateForm = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 cursor-pointer text-slate-500 hover:text-emerald-600" onClick={() => { resetForm(); setView('list'); }}>
        <span className="text-sm">← Volver a la lista</span>
      </div>
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            {isEditing ? 'Editar Préstamo' : 'Simular y Crear Préstamo'}
          </h2>
          {isEditing && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">Modo Edición</span>}
        </div>
        <form onSubmit={handleSaveLoan} className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Seleccionar Cliente</label>
                    <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                        <option value="">-- Seleccione --</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name} - {c.dni}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Monto Capital</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input type="number" min="1" required className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                            value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 col-span-full md:col-span-1">
                    <label className="block text-sm font-bold text-slate-700 mb-3">Configuración de Interés</label>
                    <div className="flex gap-2 mb-3">
                         <button type="button" 
                            onClick={() => setFormData({...formData, interestType: InterestType.PERCENTAGE})}
                            className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${formData.interestType === InterestType.PERCENTAGE ? 'bg-emerald-100 border-emerald-500 text-emerald-700 font-bold' : 'bg-white border-slate-300 text-slate-500'}`}>
                            % Porcentaje
                         </button>
                         <button type="button" 
                            onClick={() => setFormData({...formData, interestType: InterestType.FIXED_AMOUNT})}
                            className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${formData.interestType === InterestType.FIXED_AMOUNT ? 'bg-emerald-100 border-emerald-500 text-emerald-700 font-bold' : 'bg-white border-slate-300 text-slate-500'}`}>
                            $ Monto Fijo
                         </button>
                    </div>
                    <div className="relative">
                        {formData.interestType === InterestType.FIXED_AMOUNT && (
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                        )}
                        <input type="number" step="0.1" required className={`w-full border border-slate-300 rounded-lg py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 ${formData.interestType === InterestType.FIXED_AMOUNT ? 'pl-8 pr-3' : 'px-3'}`}
                            value={formData.interestRate} onChange={e => setFormData({...formData, interestRate: Number(e.target.value)})} />
                        {formData.interestType === InterestType.PERCENTAGE && (
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        {formData.interestType === InterestType.PERCENTAGE 
                            ? (formData.type === LoanType.SIMPLE ? 'Tasa global total sobre el capital.' : 'Tasa por periodo.') 
                            : 'Monto total de ganancia (Interés) a cobrar.'}
                    </p>
                </div>

                <div className="col-span-full border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-500" /> Tiempo y Frecuencia
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Frecuencia</label>
                            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                                value={formData.frequency} onChange={e => handleFrequencyChange(e.target.value as Frequency)}>
                                {Object.values(Frequency).map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        
                        {/* Start Date */}
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Inicio</label>
                            <div className="relative">
                                <input 
                                    ref={startDateRef}
                                    type="date" 
                                    required 
                                    placeholder="dd/mm/aaaa"
                                    className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer cursor-text"
                                    value={formData.startDate} 
                                    onChange={e => handleDateChange('start', e.target.value)} 
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 pointer-events-none">
                                    <Calendar className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {/* End Date */}
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Término</label>
                            <div className="relative">
                                <input 
                                    ref={endDateRef}
                                    type="date" 
                                    required 
                                    placeholder="dd/mm/aaaa"
                                    className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer cursor-text"
                                    value={formData.endDate} 
                                    onChange={e => handleDateChange('end', e.target.value)} 
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 pointer-events-none">
                                    <Calendar className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Nº Cuotas (Calc)</label>
                            <input type="number" min="1" required className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900 font-bold"
                                value={formData.duration} onChange={e => handleDurationChange(Number(e.target.value))} />
                        </div>
                    </div>
                </div>

                <div className="col-span-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Amortización</label>
                    <div className="flex gap-4">
                        {Object.values(LoanType).map(t => (
                            <label key={t} className={`flex items-center gap-2 cursor-pointer border p-3 rounded-lg transition-all ${formData.type === t ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                                <input type="radio" name="loanType" value={t} checked={formData.type === t} 
                                    onChange={() => setFormData({...formData, type: t})} 
                                    className="text-emerald-600 focus:ring-emerald-500"/>
                                <span className="text-sm font-medium text-slate-700">{t}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Live Simulation Preview */}
                <div className="col-span-full bg-emerald-50 rounded-xl p-4 border border-emerald-100 mt-2 animate-in fade-in duration-300">
                    <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Resumen de Simulación (Calculado automáticamente)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Cuota Estimada</p>
                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(simulationPreview?.quota || 0)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Total Interés</p>
                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(simulationPreview?.interest || 0)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Total a Pagar</p>
                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(simulationPreview?.total || 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => { resetForm(); setView('list'); }} className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm hover:shadow-md transition-all">
                    {isEditing ? 'Guardar Cambios' : 'Crear Préstamo'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );

  const renderDetail = () => {
    if (!selectedLoan) return null;
    const client = clients.find(c => c.id === selectedLoan.clientId);
    
    // Sort paid installments by date descending
    const paidInstallments = selectedLoan.installments.filter(i => i.status === InstallmentStatus.PAID);
    paidInstallments.sort((a, b) => {
        if (!a.paymentDate) return 1;
        if (!b.paymentDate) return -1;
        return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2 cursor-pointer text-slate-500 hover:text-emerald-600" onClick={() => setView('list')}>
                <span className="text-sm">← Volver a la lista</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 relative">
                <button 
                    onClick={() => handleEditInit(selectedLoan)}
                    className="absolute top-6 right-6 text-slate-400 hover:text-emerald-600 p-2 hover:bg-slate-50 rounded-full transition-colors"
                    title="Editar Préstamo"
                >
                    <Edit2 className="w-5 h-5" />
                </button>

                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pr-12">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-800">{client?.name}</h2>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedLoan.status === LoanStatus.ACTIVE ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {selectedLoan.status}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 flex gap-2">
                             <span>{selectedLoan.type}</span>
                             <span>•</span>
                             <span>{selectedLoan.frequency}</span>
                             <span>•</span>
                             <span>{selectedLoan.interestType === InterestType.FIXED_AMOUNT ? `Interés Fijo: ${formatCurrency(selectedLoan.interestRate)}` : `Tasa: ${selectedLoan.interestRate}%`}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500">Monto del Préstamo</p>
                        <p className="text-2xl font-bold text-slate-900">{formatCurrency(selectedLoan.amount)}</p>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-semibold">Total a Pagar</p>
                        <p className="text-lg font-bold text-slate-800">{formatCurrency(selectedLoan.totalPayable)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-semibold">Total Pagado</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(selectedLoan.totalPaid)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-semibold">Inicio</p>
                        <p className="text-sm font-medium text-slate-700">{formatDate(selectedLoan.startDate)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-semibold">Término</p>
                        <p className="text-sm font-medium text-slate-700">{formatDate(selectedLoan.endDate)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-semibold text-slate-800">Cronograma de Pagos</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-3 text-left">#</th>
                                <th className="px-6 py-3 text-left">Vencimiento</th>
                                <th className="px-6 py-3 text-right">Cuota</th>
                                <th className="px-6 py-3 text-right">Capital</th>
                                <th className="px-6 py-3 text-right">Interés</th>
                                <th className="px-6 py-3 text-center">Estado</th>
                                <th className="px-6 py-3 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {selectedLoan.installments.map((inst) => {
                                const realStatus = getInstallmentStatus(inst);
                                let statusColor = 'bg-slate-100 text-slate-600';
                                if (inst.status === InstallmentStatus.PAID) statusColor = 'bg-emerald-100 text-emerald-700';
                                else if (realStatus === InstallmentStatus.LATE) statusColor = 'bg-rose-100 text-rose-700';
                                else if (inst.status === InstallmentStatus.PENDING) statusColor = 'bg-blue-50 text-blue-700';

                                return (
                                    <tr key={inst.number} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{inst.number}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(inst.dueDate)}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">{formatCurrency(inst.amount)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 text-right">{formatCurrency(inst.capital)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 text-right">{formatCurrency(inst.interest)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                                {inst.status === InstallmentStatus.PAID ? 'Pagado' : realStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {inst.status !== InstallmentStatus.PAID && (
                                                <button 
                                                    onClick={() => handlePayInstallment(inst.number)}
                                                    className="text-xs bg-emerald-500 text-white px-3 py-1 rounded hover:bg-emerald-600 transition-colors shadow-sm"
                                                >
                                                    Pagar
                                                </button>
                                            )}
                                            {inst.status === InstallmentStatus.PAID && (
                                                <span className="text-xs text-slate-400">{formatDate(inst.paymentDate || '')}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* NEW: Payment History Section */}
            {paidInstallments.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                             <Receipt className="w-4 h-4 text-emerald-600" />
                             Historial de Pagos Registrados
                        </h3>
                        <span className="text-xs font-medium text-slate-500">{paidInstallments.length} pagos</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-3 text-left">Fecha Pago</th>
                                    <th className="px-6 py-3 text-left">Cuota</th>
                                    <th className="px-6 py-3 text-right">Monto</th>
                                    <th className="px-6 py-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paidInstallments.map((inst) => (
                                    <tr key={`pay-${inst.number}`} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                                            {formatDate(inst.paymentDate!)}
                                            <span className="text-xs text-slate-400 block ml-0">
                                                {new Date(inst.paymentDate!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">Cuota #{inst.number}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">{formatCurrency(inst.amount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                                                Completado
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const renderList = () => {
    const filteredLoans = loans.filter(loan => {
        if (filterStatus === 'ALL') return true;
        return loan.status === filterStatus;
    });

    return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Préstamos ({filteredLoans.length})</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select 
                    className="w-full sm:w-48 pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm appearance-none"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as LoanStatus | 'ALL')}
                >
                    <option value="ALL">Todos los Estados</option>
                    {Object.values(LoanStatus).map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2">
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-400"></div>
                </div>
            </div>
            <button 
              onClick={() => { resetForm(); setView('create'); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nuevo Préstamo
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredLoans.map(loan => {
            const client = clients.find(c => c.id === loan.clientId);
            const progress = Math.min(100, (loan.totalPaid / loan.totalPayable) * 100);
            return (
                <div key={loan.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group" onClick={() => { setSelectedLoan(loan); setView('detail'); }}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                                <DollarSign className="w-6 h-6" />
                             </div>
                             <div>
                                <h3 className="font-bold text-lg text-slate-800">{client?.name || 'Cliente Eliminado'}</h3>
                                <p className="text-sm text-slate-500">{loan.type} • {loan.frequency}</p>
                             </div>
                        </div>
                        <div className="text-right">
                             <p className="text-sm text-slate-500">Saldo Pendiente</p>
                             <p className="font-bold text-slate-900 text-lg">{formatCurrency(loan.totalPayable - loan.totalPaid)}</p>
                        </div>
                    </div>
                    
                    <div className="mt-6">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Progreso de pago</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                         <div className="flex gap-4 text-sm">
                             <div className="flex items-center gap-1 text-slate-600">
                                <Calendar className="w-4 h-4" />
                                {formatDate(loan.startDate)}
                             </div>
                             <div className="flex items-center gap-1 text-slate-600">
                                <Clock className="w-4 h-4" />
                                {loan.duration} cuotas
                             </div>
                             <div className={`px-2 py-0.5 rounded text-xs font-bold ${loan.status === LoanStatus.ACTIVE ? 'bg-emerald-100 text-emerald-700' : loan.status === LoanStatus.DEFAULTED ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                                {loan.status}
                             </div>
                         </div>
                         <div className="text-emerald-600 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                            Ver detalles <ChevronRight className="w-4 h-4" />
                         </div>
                    </div>
                </div>
            );
        })}
        {filteredLoans.length === 0 && (
            <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                {filterStatus === 'ALL' 
                    ? "No hay préstamos registrados. Crea el primero para comenzar." 
                    : `No hay préstamos con estado "${filterStatus}".`}
            </div>
        )}
      </div>
    </div>
  )};

  return (
    <div className="relative">
      {view === 'list' && renderList()}
      {view === 'create' && renderCreateForm()}
      {view === 'detail' && renderDetail()}

      {/* Toast Notification */}
      {toast && toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-emerald-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 pr-10 relative">
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                    <h4 className="font-bold text-sm">¡Pago Exitoso!</h4>
                    <p className="text-xs text-emerald-100">{toast.message}</p>
                </div>
                <button 
                    onClick={() => setToast(null)} 
                    className="absolute top-2 right-2 p-1 text-emerald-200 hover:text-white hover:bg-emerald-700/50 rounded"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Loans;