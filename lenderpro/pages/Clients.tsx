import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, User as UserIcon, Edit2, Calendar, Clock, DollarSign, ChevronLeft } from 'lucide-react';
import { Client, Loan } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../utils';

const Clients: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [clients, setClients] = useState<Client[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    dni: '',
    phone: '',
    address: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setClients(StorageService.getClients());
    setLoans(StorageService.getLoans());
  }, [view]);

  const resetForm = () => {
    setFormData({ id: '', name: '', dni: '', phone: '', address: '' });
    setIsEditing(false);
  };

  const handleEditInit = (client: Client) => {
    setFormData({
      id: client.id,
      name: client.name,
      dni: client.dni,
      phone: client.phone,
      address: client.address
    });
    setIsEditing(true);
    setView('create');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clientPayload: Client = {
      id: isEditing ? formData.id : crypto.randomUUID(),
      name: formData.name,
      dni: formData.dni,
      phone: formData.phone,
      address: formData.address,
      createdAt: isEditing ? (selectedClient?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    
    StorageService.saveClient(clientPayload);
    setClients(prev => isEditing ? prev.map(c => c.id === clientPayload.id ? clientPayload : c) : [...prev, clientPayload]);
    if (selectedClient && selectedClient.id === clientPayload.id) setSelectedClient(clientPayload);
    
    setView(isEditing ? 'detail' : 'list');
    resetForm();
  };

  // Safe filtering that won't crash on incomplete data
  const filteredClients = clients.filter(c => {
    if (!c) return false;
    const name = c.name || '';
    const dni = c.dni || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || dni.includes(searchTerm);
  });

  const renderForm = () => (
    <div className="max-w-xl mx-auto">
         <div className="flex items-center gap-2 mb-6 cursor-pointer text-slate-500 hover:text-emerald-600" onClick={() => { resetForm(); setView(selectedClient ? 'detail' : 'list'); }}>
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Volver</span>
        </div>
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">{isEditing ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">DNI / Identificación</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                <input required type="tel" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Dirección</label>
                <textarea required className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={2}
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { resetForm(); setView(selectedClient ? 'detail' : 'list'); }} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm">Guardar</button>
              </div>
            </form>
        </div>
    </div>
  );

  const renderDetail = () => {
    if (!selectedClient) return null;
    const clientLoans = loans.filter(l => String(l.clientId) === String(selectedClient.id));
    
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2 cursor-pointer text-slate-500 hover:text-emerald-600" onClick={() => setView('list')}>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Volver a la lista</span>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 relative">
                 <button 
                    onClick={() => handleEditInit(selectedClient)}
                    className="absolute top-6 right-6 text-slate-400 hover:text-emerald-600 p-2 hover:bg-slate-50 rounded-full transition-colors"
                    title="Editar Cliente"
                >
                    <Edit2 className="w-5 h-5" />
                </button>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-2xl font-bold">
                        {(selectedClient.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-800">{selectedClient.name}</h2>
                        <p className="text-slate-500 font-mono text-sm mb-4">ID: {selectedClient.dni}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-slate-700">
                                <Phone className="w-4 h-4 text-slate-400" />
                                {selectedClient.phone}
                            </div>
                            <div className="flex items-center gap-2 text-slate-700">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {selectedClient.address}
                            </div>
                            <div className="flex items-center gap-2 text-slate-700">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                Registrado el: {formatDate(selectedClient.createdAt)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loans History */}
            <h3 className="text-lg font-bold text-slate-800 mt-8 mb-4">Historial de Préstamos</h3>
            {clientLoans.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 border border-dashed border-slate-200">
                    Este cliente no tiene préstamos registrados.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clientLoans.map(loan => {
                        const progress = loan.totalPayable > 0 ? Math.min(100, (loan.totalPaid / loan.totalPayable) * 100) : 0;
                        return (
                            <div key={loan.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xs font-bold uppercase text-emerald-600 mb-1">{loan.status}</div>
                                        <div className="text-slate-500 text-xs">{loan.type}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-900">{formatCurrency(loan.amount)}</div>
                                        <div className="text-xs text-slate-400">{formatDate(loan.startDate)}</div>
                                    </div>
                                </div>
                                
                                <div className="mb-2">
                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                        <span>Pagado: {formatCurrency(loan.totalPaid)}</span>
                                        <span>Total: {formatCurrency(loan.totalPayable)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
  };

  const renderList = () => (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800">Cartera de Clientes</h2>
            <button 
                onClick={() => { resetForm(); setView('create'); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
            >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
            </button>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
                type="text" 
                placeholder="Buscar por nombre o DNI..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map(client => (
            <div 
                key={client.id} 
                onClick={() => { setSelectedClient(client); setView('detail'); }}
                className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow cursor-pointer group relative"
            >
                <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                    <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                    <h3 className="font-semibold text-slate-800">{client.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">ID: {client.dni}</p>
                    </div>
                </div>
                </div>
                
                <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{client.address}</span>
                </div>
                </div>
            </div>
            ))}

            {filteredClients.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400">
                    No se encontraron clientes que coincidan con la búsqueda.
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div>
        {view === 'list' && renderList()}
        {view === 'create' && renderForm()}
        {view === 'detail' && renderDetail()}
    </div>
  );
};

export default Clients;