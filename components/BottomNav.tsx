import React from 'react';
import { Home, ScanLine, Settings } from 'lucide-react';
import { Tab } from '../types';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    // 配色：背景改為 Zinc 900, 邊框改為 Zinc 800
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-[#18181b] border-t border-zinc-800 flex items-center justify-around z-50 pb-2 shadow-lg">
      {/* Left: Home */}
      <button
        onClick={() => onTabChange('home')}
        className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${
          activeTab === 'home' ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Home size={24} />
        <span className="text-xs font-medium">Users</span>
      </button>

      {/* Center: Scan (Floating) */}
      <div className="relative -top-6">
        <button
          onClick={() => onTabChange('scan')}
          className={`flex items-center justify-center w-16 h-16 rounded-full shadow-xl transition-transform transform active:scale-95 ${
            activeTab === 'scan'
              ? 'bg-blue-500 text-white ring-4 ring-[#09090b]' // Ring matches background
              : 'bg-zinc-700 text-zinc-300 ring-4 ring-[#09090b] hover:bg-zinc-600'
          }`}
        >
          <ScanLine size={32} strokeWidth={2.5} />
        </button>
      </div>

      {/* Right: Settings */}
      {/*  
      <button
        onClick={() => onTabChange('settings')}
        className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${
          activeTab === 'settings' ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Settings size={24} />
        <span className="text-xs font-medium">Settings</span>
      </button>
      */}
    </div>
  );
};