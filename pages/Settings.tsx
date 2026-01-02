import React, { useState, useRef } from 'react';
import { Download, Upload, Trash2, Database, AlertTriangle, FileJson, RefreshCw, CheckCircle, X, XCircle } from 'lucide-react';
import { StorageService } from '../services/storage';

const Settings: React.FC = () => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(''); 
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const data = StorageService.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `lenderpro_respaldo_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error al exportar:", e);
      setToast({ show: true, message: "Hubo un error al generar el archivo.", type: 'error' });
    }
  };

  const handleImportClick = () => {
    // Forzamos el clic en el input oculto
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error("El archivo está vacío.");

        // Utilizamos StorageService para asegurar que las claves (keys) de localStorage sean las correctas
        const result = StorageService.importData(content);
        
        if (result.success) {
            // Feedback visual amigable (Toast)
            setToast({ 
                show: true, 
                message: "¡Respaldo cargado correctamente! Reiniciando sistema...", 
                type: 'success' 
            });

            // Aumentamos el tiempo a 2 segundos para que el usuario pueda leer el mensaje antes de recargar
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            setToast({ show: true, message: result.message || "Error al importar el archivo.", type: 'error' });
            setTimeout(() => setToast(null), 4000);
        }
      } catch (err: any) {
        console.error(err);
        setToast({ show: true, message: "El archivo no es un JSON válido o está corrupto.", type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
    };
    
    reader.onerror = () => {
        setToast({ show: true, message: "Error de lectura del archivo.", type: 'error' });
    };

    reader.readAsText(file);
    
    // Reset del input para permitir seleccionar el mismo archivo nuevamente si es necesario
    e.target.value = ''; 
  };

  const executeClearData = () => {
    if (deleteConfirmation !== 'BORRAR') return;
    StorageService.clearData();
    window.location.reload();
  };

  return (
    <div className="space-y-6 relative">
      <h2 className="text-2xl font-bold text-slate-800">Administración de Datos</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Export Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
            <div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                    <Download className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Copia de Seguridad</h3>
                <p className="text-slate-500 text-sm mb-6">
                    Descarga tu base de datos actual a tu computadora para guardarla.
                </p>
            </div>
            <button 
                onClick={handleExport}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
                <FileJson className="w-4 h-4" />
                Descargar JSON
            </button>
        </div>

        {/* Import Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
            <div>
                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Restaurar Copia</h3>
                <p className="text-slate-500 text-sm mb-6">
                    Carga un archivo JSON previamente descargado para recuperar tus datos.
                    <br />
                    <span className="text-emerald-600 font-semibold text-xs">Nota: La página se recargará automáticamente al finalizar.</span>
                </p>
            </div>
            
            <input 
                ref={fileInputRef}
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={handleFileChange}
            />
            
            <button 
                onClick={handleImportClick}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
                <RefreshCw className="w-4 h-4" />
                Seleccionar Archivo y Restaurar
            </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-rose-100 md:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Reiniciar de Fábrica</h3>
                        <p className="text-slate-500 text-sm mt-1">
                            Borra todos los clientes y préstamos para comenzar desde cero.
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => { setDeleteConfirmation(''); setShowDeleteModal(true); }}
                    className="px-6 py-3 border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                    <AlertTriangle className="w-4 h-4" />
                    Borrar Todo
                </button>
            </div>
        </div>
      </div>

      <div className="bg-slate-100 p-4 rounded-lg flex items-start gap-3 text-sm text-slate-600 mt-8">
         <Database className="w-5 h-5 text-slate-400 mt-0.5" />
         <div>
            <p className="font-semibold mb-1">Almacenamiento Local</p>
            <p>Tus datos se guardan en este navegador. Recuerda hacer copias de seguridad frecuentemente.</p>
         </div>
      </div>

      {/* Modal Confirmación Borrar */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4 text-rose-600">
                    <Trash2 className="w-6 h-6" />
                    <h3 className="text-xl font-bold text-slate-900">¿Borrar todo?</h3>
                </div>
                <p className="text-slate-600 mb-4">
                    Esta acción no se puede deshacer. Escribe <strong>BORRAR</strong> para confirmar.
                </p>
                <input 
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-6"
                    placeholder="Escribe BORRAR"
                />
                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancelar</button>
                    <button 
                        onClick={executeClearData}
                        disabled={deleteConfirmation !== 'BORRAR'}
                        className="px-4 py-2 bg-rose-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-700"
                    >
                        Confirmar Borrado
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 pr-10 relative ${
                toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}>
                {toast.type === 'success' ? (
                    <CheckCircle className="w-6 h-6 flex-shrink-0" />
                ) : (
                    <XCircle className="w-6 h-6 flex-shrink-0" />
                )}
                <div>
                    <h4 className="font-bold text-sm">
                        {toast.type === 'success' ? 'Éxito' : 'Error'}
                    </h4>
                    <p className={`text-xs ${toast.type === 'success' ? 'text-emerald-100' : 'text-rose-100'}`}>
                        {toast.message}
                    </p>
                </div>
                <button 
                    onClick={() => setToast(null)} 
                    className={`absolute top-2 right-2 p-1 rounded hover:bg-white/20 transition-colors ${
                        toast.type === 'success' ? 'text-emerald-200 hover:text-white' : 'text-rose-200 hover:text-white'
                    }`}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;