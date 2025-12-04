import React from 'react';
import { User, UserStatus } from '../types';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';

interface UserRowProps {
  user: User;
  isEditing: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const UserRow: React.FC<UserRowProps> = ({ user, isEditing, onToggle, onDelete }) => {
  
  // 左側圓圈：登入狀態 (Login Session)
  const renderStatusIcon = () => {
    switch (user.status) {
      case UserStatus.PROCESSING:
        return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
      case UserStatus.SUCCESS:
        return <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"><Check size={12} className="text-white" /></div>;
      case UserStatus.FAILED:
        return <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><X size={12} className="text-white" /></div>;
      default: // PENDING
        return <div className="w-5 h-5 border-2 border-zinc-600 rounded-full" />;
    }
  };

  // 右側方框：打卡結果 (Check-in Result) 或 選取狀態
  const renderCheckBox = () => {
    // 優先顯示打卡結果 (如果有)
    if (user.checkinStatus === 'SUCCESS') {
      return (
        <div className="w-6 h-6 bg-green-500 border-2 border-green-500 rounded flex items-center justify-center transition-colors">
           <Check size={16} className="text-white" />
        </div>
      );
    }
    if (user.checkinStatus === 'FAILED') {
      return (
        <div className="w-6 h-6 bg-red-500 border-2 border-red-500 rounded flex items-center justify-center transition-colors">
           <X size={16} className="text-white" />
        </div>
      );
    }

    // 如果沒有打卡結果，顯示一般的選取狀態 (灰色/藍色)
    return (
      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
        user.isSelected 
          ? 'bg-blue-600 border-blue-600' 
          : 'border-zinc-600 bg-transparent group-hover:border-zinc-500'
      }`}>
        {user.isSelected && <Check size={14} className="text-white" />}
      </div>
    );
  };

  return (
    <div 
      onClick={() => !isEditing && onToggle(user.id)}
      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${
        user.isSelected ? 'bg-zinc-800/80 border-blue-500/30' : 'bg-[#18181b] border-zinc-800'
      }`}
    >
      <div className="flex items-center space-x-4 overflow-hidden">
        {/* 左側：登入狀態圓圈 */}
        <div className="flex-shrink-0">
           {renderStatusIcon()}
        </div>

        {/* 中間：文字資訊 */}
        <div className="flex flex-col min-w-0">
          <span className={`text-base font-bold truncate ${user.isSelected ? 'text-white' : 'text-zinc-400'}`}>
            {user.name}
          </span>
          <div className="flex items-center space-x-2">
             <span className="text-xs text-zinc-500 truncate">{user.id}</span>
             {user.message && (
               <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                 user.message.includes('成功') ? 'bg-green-500/10 text-green-400' : 
                 user.message.includes('失敗') || user.message.includes('錯誤') ? 'bg-red-500/10 text-red-400' :
                 'bg-zinc-700 text-zinc-400'
               }`}>
                 {user.message}
               </span>
             )}
          </div>
        </div>
      </div>

      {/* 右側：方框 (選取/打卡結果) 或 刪除按鈕 */}
      <div className="flex-shrink-0 ml-3">
        {isEditing ? (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(user.id); }}
            className="w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center"
          >
            <X size={16} />
          </button>
        ) : (
          // 這裡顯示方框
          renderCheckBox()
        )}
      </div>
    </div>
  );
};