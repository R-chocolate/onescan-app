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
  
  // 1. 左側圓圈：保持只顯示「登入狀態」
  const renderLoginStatusCircle = () => {
    switch (user.status) {
      case UserStatus.PROCESSING:
        return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
      case UserStatus.SUCCESS:
        return (
          <div className="w-5 h-5 border-2 border-green-500/80 rounded-full flex items-center justify-center">
            <Check className="w-3 h-3 text-green-500/90" />
          </div> 
        );
      case UserStatus.FAILED:
        return (
          <div className="w-5 h-5 border-2 border-red-500/80 rounded-full flex items-center justify-center">
            <X className="w-3 h-3 text-red-500/90" />
          </div>
        );
      default:
        return <div className="w-5 h-5 border-2 border-zinc-600 rounded-full" />;
    }
  };

  // 2. 新增：右側狀態標籤 (取代原本的方框與中間的文字狀態)
  const renderCheckinStatusLabel = () => {
    // 判斷是否在 10 分鐘內 (10 * 60 * 1000 = 600000 毫秒)
    const isRecent = (Date.now() - user.lastCheckinSuccess) < 600000;
    
    // 如果不在編輯模式，且有狀態，且是最近發生的
    if (!isEditing && user.checkinStatus && isRecent) {
      if (user.checkinStatus === 'SUCCESS') {
        return (
          <div className="px-2 py-1 mr-3 rounded-md bg-green-500/10 border border-green-500/20 flex items-center space-x-1 animate-in fade-in duration-300">
             <span className="text-[10px] font-bold text-green-500">打卡成功</span>
          </div>
        );
      }
      if (user.checkinStatus === 'FAILED') {
        return (
          <div className="px-2 py-1 mr-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-center space-x-1 animate-in fade-in duration-300">
             <span className="text-[10px] font-bold text-red-500">打卡失敗</span>
          </div>
        );
      }
    }

    // 預設狀態 (未打卡 或 超過10分鐘)
    if (!isEditing) {
        return (
            <div className="px-2 py-1 mr-3 rounded-md bg-zinc-800/50 border border-zinc-700/50 flex items-center">
                <span className="text-[10px] font-medium text-zinc-500">未打卡</span>
            </div>
        );
    }

    return null;
  };

  return (
    <div 
      className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
        user.isSelected 
          ? 'bg-zinc-900 border-green-700/80' 
          : 'bg-[#14171c] border-zinc-800'
      }`}
    >
      <div className="flex items-center space-x-4 overflow-hidden">
        {/* 左側：登入狀態圓圈 */}
        <div className="flex-shrink-0">
           {renderLoginStatusCircle()}
        </div>

        {/* 中間：文字 (已移除 message badge) */}
        <div className="flex flex-col min-w-0">
          <span className={`text-base font-bold truncate ${user.isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>
            {user.name}
          </span>
          <div className="flex items-center space-x-2">
             <span className="text-xs text-zinc-500 truncate">{user.password}</span>
          </div>
        </div>
      </div>

      {/* 右側：打卡狀態標籤 + Toggle */}
      <div className="flex items-center flex-shrink-0 ml-2">
        
        {/* (A) 新的打卡狀態標籤 (位於 Toggle 左邊) */}
        {renderCheckinStatusLabel()}

        {/* (B) Toggle 或 刪除按鈕 */}
        {isEditing ? (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(user.id); }}
            className="w-8 h-8 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <X size={16} />
          </button>
        ) : (
          <div 
            onClick={() => onToggle(user.id)}
            className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer relative ${
                user.isSelected ? 'bg-green-500/85' : 'bg-red-500/85'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
                user.isSelected ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </div>
        )}
      </div>
    </div>
  );
};