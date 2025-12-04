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
  
  // 1. 左側圓圈：只顯示「登入狀態」
  const renderLoginStatusCircle = () => {
  switch (user.status) {
    case UserStatus.PROCESSING:
      // 正在處理：藍色旋轉圖標 (保持不變)
      return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;

    case UserStatus.SUCCESS:
      // 登入成功：綠色的勾勾圖標 (空心圓圈 + 勾)
      // 使用 CheckCircle 或類似圖標，並設置顏色和大小
      return (
        <div className="w-5 h-5 border-2 border-green-500/80 rounded-full flex items-center justify-center">
        <Check className="w-3 h-3 text-green-500/90" /></div> 
        // 如果您的圖標庫沒有 CheckCircle，可以考慮使用 Check 配合 border
        // return <div className="w-5 h-5 border-2 border-green-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-green-500" /></div>;
      );

    case UserStatus.FAILED:
      // 登入失敗：紅色的叉叉圖標 (空心圓圈 + 叉)
      // 使用 XCircle 或類似圖標，這與您的圖片樣式最接近
      return (
        <div className="w-5 h-5 border-2 border-red-500/80 rounded-full flex items-center justify-center">
        <X className="w-3 h-3 text-red-500/90" /></div>
        // 如果您的圖標庫沒有 XCircle，可以考慮使用 X 配合 border
        // return <div className="w-5 h-5 border-2 border-red-500 rounded-full flex items-center justify-center"><X className="w-3 h-3 text-red-500" /></div>;
      );
      
    default:
      // 預設/未登入：空心圓圈 (保持不變)
      return <div className="w-5 h-5 border-2 border-zinc-600 rounded-full" />;
  }
};

  // 2. Toggle 左邊的方框：顯示「打卡結果」
  const renderCheckinResultBox = () => {
    // 如果有打卡結果，顯示綠勾或紅叉
    if (user.checkinStatus === 'SUCCESS') {
      return (
        <div className="w-5 h-5 mr-3 bg-green-500/20 border border-green-500 rounded flex items-center justify-center animate-in zoom-in duration-200">
           <Check size={14} className="text-green-500" />
        </div>
      );
    }
    if (user.checkinStatus === 'FAILED') {
      return (
        <div className="w-6 h-6 mr-3 bg-red-500/20 border border-red-500 rounded flex items-center justify-center animate-in zoom-in duration-200">
           <X size={14} className="text-red-500" />
        </div>
      );
    }
    // 如果沒有打卡結果，顯示一個隱約的空框佔位，讓介面整齊 (或者您可以選擇 return null 隱藏)
    return (
        <div className="w-6 h-6 mr-3 border border-zinc-800 rounded bg-zinc-900/50" />
    );
  };

  return (
    <div 
      className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
        user.isSelected 
          ? 'bg-zinc-900 border-zinc-700'  // 選取時稍微亮一點
          : 'bg-[#18181b] border-zinc-800' // 原始深色背景
      }`}
    >
      <div className="flex items-center space-x-4 overflow-hidden">
        {/* 左側：登入狀態 */}
        <div className="flex-shrink-0">
           {renderLoginStatusCircle()}
        </div>

        {/* 中間：文字 */}
        <div className="flex flex-col min-w-0">
          <span className={`text-base font-bold truncate ${user.isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>
            {user.name}
          </span>
          <div className="flex items-center space-x-2">
             <span className="text-xs text-zinc-500 truncate">{user.id}</span>
             {user.message && (
               <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                 user.message.includes('成功') ? 'text-green-500 bg-green-500/10' : 
                 user.message.includes('失敗') || user.message.includes('錯誤') ? 'text-red-500 bg-red-500/10' :
                 'text-zinc-500 bg-zinc-800'
               }`}>
                 {user.message}
               </span>
             )}
          </div>
        </div>
      </div>

      {/* 右側：打卡結果方框 + Toggle */}
      <div className="flex items-center flex-shrink-0 ml-2">
        
        {/* (A) 打卡結果方框 (只在非編輯模式顯示) */}
        {!isEditing && renderCheckinResultBox()}

        {/* (B) Toggle 或 刪除按鈕 */}
        {isEditing ? (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(user.id); }}
            className="w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <X size={16} />
          </button>
        ) : (
          // 這是您喜歡的 iOS 風格 Toggle
          <div 
            onClick={() => onToggle(user.id)}
            className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer relative ${
                user.isSelected ? 'bg-blue-600' : 'bg-zinc-700'
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