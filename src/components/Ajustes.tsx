import React, { useState } from 'react';
import { Settings, Shield, Database, RefreshCw, CheckCircle2, AlertTriangle, Key, Moon, Globe } from 'lucide-react';
import { User } from '../types';

interface AjustesProps {
  currentUser: User | null;
  onClearData: () => void;
}

export default function Ajustes({ currentUser, onClearData }: AjustesProps) {
  const [passMessage, setPassMessage] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass.trim()) return;
    setPassMessage('✅ Contraseña actualizada exitosamente.');
    setOldPass('');
    setNewPass('');
    setTimeout(() => setPassMessage(''), 4000);
  };

  return (
    <div className="space-y-6 font-mono">
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl shadow-md">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
          <Settings className="w-5 h-5 text-binance-yellow" />
          Ajustes del Sistema y Seguridad
        </h2>
        <p className="text-xs text-binance-gray mt-1">
          Configuración general de parámetros, cambio de clave personal y respaldo de datos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cambiar Clave */}
        <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-binance-yellow" />
            Cambiar Contraseña de Acceso
          </h3>

          {passMessage && (
            <div className="p-3 bg-binance-green/20 border border-binance-green/40 text-binance-green rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {passMessage}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] text-binance-gray font-bold block mb-1 uppercase">Contraseña Actual</label>
              <input
                type="password"
                required
                value={oldPass}
                onChange={e => setOldPass(e.target.value)}
                className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
              />
            </div>

            <div>
              <label className="text-[10px] text-binance-gray font-bold block mb-1 uppercase">Nueva Contraseña</label>
              <input
                type="password"
                required
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-binance-yellow text-binance-black font-extrabold uppercase text-xs rounded-xl shadow-md hover:bg-binance-yellow/90 cursor-pointer"
            >
              Actualizar Contraseña
            </button>
          </form>
        </div>

        {/* Respaldo y Mantenimiento */}
        <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-binance-red" />
            Mantenimiento y Respaldo Local
          </h3>

          <p className="text-xs text-binance-gray leading-relaxed">
            Sus datos se guardan y sincronizan automáticamente en tiempo real. En caso de necesitar reiniciar el estado de prueba, puede restablecer los datos por defecto.
          </p>

          <div className="pt-2">
            <button
              onClick={() => {
                if (window.confirm('¿Está seguro de restablecer los datos por defecto?')) {
                  onClearData();
                }
              }}
              className="w-full py-2.5 bg-binance-red/20 border border-binance-red/40 text-binance-red font-extrabold uppercase text-xs rounded-xl hover:bg-binance-red/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Restablecer Base de Datos Local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
