import React from 'react';
import { User, UserStatus } from '../types';
import { CheckCircle2, XCircle, Loader2, Trash2, Check, Clock } from 'lucide-react';

interface UserRowProps {
  user: User;
  isEditing: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const UserRow: React.FC<UserRowProps> = ({ user, isEditing, onToggle, onDelete }) => {
  
  // 檢查打卡成功是否在 5 分鐘內 (300,000 毫秒)
  // 假設 user.lastCheckinSuccess 存在於 User 介面
  const isCheckinRecent = user.lastCheckinSuccess && (Date.now() - user.lastCheckinSuccess < 300000);
  
  // 簡化 Session 檢查：直接假設 App.tsx 會處理狀態
  const isSessionActive = user.isLoggedIn; 

  const getLoginStatusIcon = () => {
    // 移除複雜的 session 邏輯，只判斷後端傳來的狀態 (SUCCESS/FAILED/PROCESSING)
    switch (user.status) {
      case UserStatus.SUCCESS:
        return <CheckCircle2 className="text-green-500" size={18} />;
      case UserStatus.FAILED:
        return <XCircle className="text-red-500" size={18} />;
      case UserStatus.PROCESSING:
        return <Loader2 className="text-yellow-500 animate-spin" size={18} />;
      default:
        // PENDING / 預設狀態 (顯示一個簡單的點或空心圓)
        return isSessionActive ? (
            // 狀態邏輯從 App.tsx 傳入，這裡只負責顯示
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        ) : (
            // 未登入/待處理狀態 (顯示灰色空心圓)
            <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
        );
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl select-none group">
      
      {/* Main Container */}
      <div className="relative flex items-center">
        
        {/* Edit Mode Delete Button (未修改) */}
        <div 
          className={`overflow-hidden transition-all duration-300 ease-in-out flex items-center ${
            isEditing ? 'w-14 mr-2 opacity-100' : 'w-0 mr-0 opacity-0'
          }`}
        >
          <button
            onClick={() => onDelete(user.id)}
            className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
          >
            <Trash2 size={20} />
          </button>
        </div>

        {/* Card Content - 配色已修正 */}
        <div className="flex-1 relative flex items-center justify-between p-4 border border-slate-700 bg-slate-800 rounded-xl transition-all duration-200 ease-out z-10">
          <div className="flex items-center space-x-3 overflow-hidden">
            
            {/* 1. Login/Process Status Indicator (Left Circle) */}
            <div className="shrink-0 flex items-center justify-center w-6 h-6">
               {getLoginStatusIcon()}
            </div>
            
            <div className="flex flex-col min-w-0">
              {/* Top: User ID (Bold) */}
              <span className="font-semibold text-sm truncate text-white">
                {user.id}
              </span>
              {/* Bottom: Password - 🔥 修正這裡，直接顯示 user.password 🔥 */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Pass: {user.password || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Right Side: Checkbox Status & Toggle Switch */}
          <div className="shrink-0 pl-3 flex items-center space-x-3">
            
            {/* 2. 打卡成功方框 (5分鐘防呆) */}
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isCheckinRecent ? 'border-green-500 bg-green-500' : 'border-slate-600'
            }`}>
                {isCheckinRecent ? <Check size={14} className="text-white" /> : null}
            </div>


            {/* 3. Toggle Switch (選取打卡) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(user.id);
              }}
              className={`w-12 h-7 rounded-full flex items-center p-1 transition-colors duration-300 focus:outline-none ${
                user.isSelected ? 'bg-blue-500' : 'bg-slate-700'
              }`}
            >
              <div 
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                  user.isSelected ? 'translate-x-5' : 'translate-x-0'
                }`} 
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};