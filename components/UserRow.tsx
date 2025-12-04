import React from 'react';
import { User, UserStatus } from '../types';
import { Check, X, Loader2 } from 'lucide-react';

interface UserRowProps {
  user: User;
  isEditing: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const UserRow: React.FC<UserRowProps> = ({ user, isEditing, onToggle, onDelete }) => {
  
  // 1. 左側圓圈：登入狀態 (Login Status)
  const renderLoginStatusCircle = () => {
    switch (user.status) {
      case UserStatus.PROCESSING:
        return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
      case UserStatus.SUCCESS:
        // 登入成功：實心綠點
        return <div className="w-5 h-5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]" />;
      case UserStatus.FAILED:
        // 登入失敗：實心紅點
        return <div className="w-5 h-5 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.4)]" />;
      default: 
        // 🔥 還原：未登入/待機狀態是「空心圓圈」
        return <div className="w-5 h-5 border-2 border-zinc-600 rounded-full" />;
    }
  };

  // 2. 右側方框：打卡結果 (Check-in Result)
  // 只有在有結果時才顯示內容，不然就是一個隱形的佔位符或空框
  const renderCheckinResultBox = () => {
    if (user.checkinStatus === 'SUCCESS') {
      return (
        <div className="w-7 h-7 bg-green-500/20 border border-green-500 rounded flex items-center justify-center mr-3 animate-in fade-in zoom-in">
           <Check size={14} className="text-green-500" />
        </div>
      );
    }
    if (user.checkinStatus === 'FAILED') {
      return (
        <div className="w-7 h-7 bg-red-500/20 border border-red-500 rounded flex items-center justify-center mr-3 animate-in fade-in zoom-in">
           <X size={14} className="text-red-500" />
        </div>
      );
    }
    // 沒有結果時，顯示一個淡淡的空框 (或是您可以選擇完全隱藏)
    return (
        <div className="w-7 h-7 border border-zinc-800 rounded mr-3 bg-zinc-900/50" />
    );
  };

  return (
    <div className="flex items-center justify-between p-4 bg-[#18181b] border-b border-zinc-800/50">
      
      {/* 左邊區塊：登入狀態 + 文字 */}
      <div className="flex items-center space-x-4 overflow-hidden">
        {/* 登入狀態圓圈 */}
        <div className="flex-shrink-0">
           {renderLoginStatusCircle()}
        </div>

        {/* 文字資訊 */}
        <div className="flex flex-col min-w-0">
          <span className="text-base font-medium text-zinc-200 truncate">
            {user.name}
          </span>
          <div className="flex items-center space-x-2">
             <span className="text-xs text-zinc-500 truncate">{user.id}</span>
             {user.message && (
               <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                 user.message.includes('成功') ? 'text-green-500' : 
                 user.message.includes('失敗') || user.message.includes('錯誤') ? 'text-red-500' :
                 'text-zinc-500'
               }`}>
                 {user.message}
               </span>
             )}
          </div>
        </div>
      </div>

      {/* 右邊區塊：打卡結果方框 + Toggle */}
      <div className="flex items-center flex-shrink-0">
        
        {/* (A) 打卡結果方框 */}
        {!isEditing && renderCheckinResultBox()}

        {/* (B) Toggle / 刪除按鈕 */}
        {isEditing ? (
          <button 
            onClick={() => onDelete(user.id)}
            className="w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={16} />
          </button>
        ) : (
          // 這是 Toggle 開關
          <div 
            onClick={() => onToggle(user.id)}
            className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                user.isSelected ? 'bg-blue-600' : 'bg-zinc-700'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                user.isSelected ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </div>
        )}
      </div>
    </div>
  );
};