import React, { useState, useEffect, useRef } from 'react';
import { Battery, BatteryCharging, BatteryWarning, Info } from 'lucide-react';

export const BatteryIndicator = () => {
  const [level, setLevel] = useState(null);
  const [charging, setCharging] = useState(false);
  const [dischargingTime, setDischargingTime] = useState(Infinity);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const update = () => {
          setLevel(Math.round(battery.level * 100));
          setCharging(battery.charging);
          setDischargingTime(battery.dischargingTime);
        };

        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
        battery.addEventListener('dischargingtimechange', update);

        return () => {
          battery.removeEventListener('levelchange', update);
          battery.removeEventListener('chargingchange', update);
          battery.removeEventListener('dischargingtimechange', update);
        };
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (wrapperRef.current && !(wrapperRef.current as any).contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (level === null) return null;

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds === 0) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-slate-700 font-medium px-2 py-1 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
      >
        {charging ? (
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
        ) : level < 20 ? (
          <BatteryWarning className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <Battery className="w-3.5 h-3.5" />
        )}
        <span>{level}%</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 text-sm animate-in fade-in zoom-in duration-200">
          <h4 className="font-semibold text-slate-900 mb-3 border-b pb-2">Power Statistics</h4>
          <div className="space-y-2 text-slate-600">
            <div className="flex justify-between">
              <span>Source:</span>
              <span className="font-medium text-slate-900">{charging ? 'AC Power' : 'Battery'}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span className="font-medium text-slate-900">{charging ? 'N/A' : formatTime(dischargingTime)}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-medium text-slate-900">{charging ? 'Charging' : 'Discharging'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
