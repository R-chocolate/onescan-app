// --- START OF FILE src/components/UserRow.tsx ---
import React, { useRef } from 'react';
import { User, UserStatus } from '../types';
import { Check, X, Loader2, Trash2Icon } from 'lucide-react';
interface UserRowProps {
  user: User;
  isEditing: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  // 修正 1: 加入 onLongPress 定義
  onLongPress: (user: User) => void; 
}

export const UserRow: React.FC<UserRowProps> = ({ user, isEditing, onToggle, onDelete, onLongPress }) => {
  
  // -- 長按邏輯 --
  const timerRef = useRef<any>(null);

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      onLongPress(user);
    }, 600); 
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchMove = () => {
      if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
      }
  };

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

  // 修正 2: 確保所有路徑都回傳 null 或 JSX，不能是 void/undefined
  const renderCheckinStatusLabel = () => {
    const isRecent = (Date.now() - user.lastCheckinSuccess) < 600000;
    
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

    if (!isEditing) {
        return (
            <div className="px-2 py-1 mr-3 rounded-md bg-zinc-800/50 border border-zinc-700/50 flex items-center">
                <span className="text-[10px] font-medium text-zinc-600">未打卡</span>
            </div>
        );
    }

    // 關鍵修正：必須回傳 null
    return null;
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onMouseDown={() => { 
          timerRef.current = setTimeout(() => onLongPress(user), 600);
      }}
      onMouseUp={() => { if(timerRef.current) clearTimeout(timerRef.current); }}
      onMouseLeave={() => { if(timerRef.current) clearTimeout(timerRef.current); }}
      onContextMenu={(e) => e.preventDefault()} // 防止長按跳出右鍵選單

      className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 select-none ${
        user.isSelected 
          ? 'bg-zinc-900 border-green-700/80' 
          : 'bg-[#14171c] border-zinc-800'
      } active:scale-[0.98]`}
    >
      <div className="flex items-center space-x-4 overflow-hidden pointer-events-none"> 
        <div className="flex-shrink-0">
           {renderLoginStatusCircle()}
        </div>
        <div className="flex flex-col min-w-0">
          <span className={`text-base font-bold truncate ${user.isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>
            {user.name}
          </span>
          <div className="flex items-center space-x-2">
             <span className="text-xs text-zinc-500 truncate">{user.password}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center flex-shrink-0 ml-2 pointer-events-auto"> 
        {renderCheckinStatusLabel()}

        {isEditing ? (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(user.id); }}
            className="w-8 h-8 bg-red-500/20 text-red-600 rounded-full flex items-center justify-center"
          >
            <Trash2Icon size={15} />
          </button>
        ) : (
          <div 
            onClick={(e) => { e.stopPropagation(); onToggle(user.id); }}
            className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer relative ${
                user.isSelected ? 'bg-green-500/90' : 'bg-red-500/90'
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