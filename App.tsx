import React, { useState, useEffect, useRef } from 'react';
import { BottomNav } from './components/BottomNav';
import { UserRow } from './components/UserRow';
import { apiLoginBatch, apiCheckinBatch } from './services/api';  // Assuming this function is updated to handle full login/checkin
import { Tab, User, UserStatus, ScanState } from './types';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  CheckCheck, 
  AlertTriangle,
  X,
  Plus,
  Edit2,
  Check,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Camera
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  
  // -- 1. LocalStorage 初始化 (資料持久化) --
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('onescan_users');
    return saved ? JSON.parse(saved) : [];
  });

  // 當 users 變動時，自動存入 LocalStorage
  useEffect(() => {
    localStorage.setItem('onescan_users', JSON.stringify(users));
  }, [users]);

  const [scanState, setScanState] = useState<ScanState>(ScanState.IDLE);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // -- App Settings (也是從 LocalStorage 讀取) --
  const [apiEndpoint, setApiEndpoint] = useState(() => {
    return localStorage.getItem('onescan_api_url') || 'https://fcu-backend-290830858385.asia-east1.run.app';
  });

  useEffect(() => {
    localStorage.setItem('onescan_api_url', apiEndpoint);
  }, [apiEndpoint]);
  
  // -- Camera State --
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const scannerRef = useRef<any>(null); 
  const isScannerRunning = useRef(false);

  // -- UI State --
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  // -- User Actions --

  const handleToggleUser = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, isSelected: !u.isSelected } : u
    ));
  };

  const handleDeleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleOpenAddModal = () => {
    setNewUserId('');
    setNewUserPassword('');
    setShowAddModal(true);
  };

  const handleConfirmAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) return;

    // IMPORTANT: The new user state must include isLoggedIn and lastCheckin
    const newUser: User = {
      id: newUserId,
      name: newUserId, 
      password: newUserPassword,
      role: 'Guest',
      status: UserStatus.PENDING,
      isSelected: true,
      isLoggedIn: false, // 預設未登入
      sessionExpiry: 0,
      lastCheckinSuccess: 0
    };

    setUsers(prev => [...prev, newUser]); 
    setShowAddModal(false);
  };
  
  // 核心邏輯：測試 Session 有效性 / 重新登入
  // 這裡假設後端會自動判斷 Session 是否有效，並只對無效的執行登入
  // 核心邏輯：執行真實登入
  const handleBatchLogin = async () => {
    // 找出所有未登入或 Session 過期的帳號 (或是你想每次都全部刷新也可以)
    // 這裡我們簡單點，只要是被選取的，或是未登入的，就重新登入
    const usersToLogin = users.filter(u => !u.isLoggedIn || u.status === UserStatus.FAILED || u.status === UserStatus.PENDING);
    
    if (usersToLogin.length === 0) {
        // 如果大家都登入了，可以強制全部刷新
        if (confirm("所有帳號看起來都已登入，要強制重新刷新嗎？")) {
             // 繼續執行
        } else {
            return;
        }
    }

    // 1. 設定 UI 狀態為轉圈圈
    setUsers(prev => prev.map(u => 
        // 只要在這次登入名單內的，都變黃色
        usersToLogin.some(t => t.id === u.id) ? { ...u, status: UserStatus.PROCESSING, message: '連線中...' } : u
    ));

    try {
        // 2. 呼叫真實 API
        const response = await apiLoginBatch(apiEndpoint, usersToLogin.map(u => ({ id: u.id, password: u.password })));
        
        // 3. 更新結果
        setUsers(prev => prev.map(u => {
            const result = response.results.find(r => r.id === u.id);
            if (result) {
                const isSuccess = result.status === 'SUCCESS';
                return {
                    ...u,
                    status: isSuccess ? UserStatus.SUCCESS : UserStatus.FAILED,
                    isLoggedIn: isSuccess,
                    // 成功的話設為 30 分鐘，失敗歸零
                    sessionExpiry: isSuccess ? Date.now() + 1000 * 60 * 30 : 0,
                    message: result.message
                };
            }
            return u;
        }));
    } catch (e) {
        // 4. 處理網路錯誤 (例如後端沒開)
        setUsers(prev => prev.map(u => 
             usersToLogin.some(t => t.id === u.id) ? { ...u, status: UserStatus.FAILED, message: '連線失敗' } : u
        ));
        alert("無法連線到後端伺服器，請檢查 IP 設定");
    }
  };
  
  // 批量全選/全不選
  const toggleSelectAll = () => {
    const allSelected = users.length > 0 && users.every(u => u.isSelected);
    setUsers(prev => prev.map(u => ({ ...u, isSelected: !allSelected })));
  };

  const handleResetStatuses = () => {
    setUsers(prev => prev.map(u => ({
      ...u,
      status: UserStatus.PENDING,
      message: undefined,
      isLoggedIn: false,
      sessionExpiry: 0,
      lastCheckinSuccess: 0
    })));
  };

  const toggleEditMode = () => setIsEditing(!isEditing);

  // -- Navigation Actions --

  const handleReturnHome = () => {
    // 關鍵：打卡成功後，自動將所有 Toggle 設為 OFF (防呆)
    setUsers(prev => prev.map(u => ({ ...u, isSelected: false }))); 
    setScanState(ScanState.IDLE);
    setScanError(null);
    setActiveTab('home');
  };

  const handleTabChange = (tab: Tab) => {
    if (tab === 'home' && activeTab === 'scan') {
      handleReturnHome();
    } else {
      setActiveTab(tab);
    }
  };

  // -- Scan Logic (Real API) --

  const handleScanSuccess = async (decodedText: string) => {
    if (scanState !== ScanState.IDLE) return; 

    // 1. 驗證
    const selectedUsers = users.filter(u => u.isSelected);
    if (selectedUsers.length === 0) {
      setScanError("未選取任何帳號");
      setTimeout(() => setScanError(null), 2000);
      return;
    }
    
    // 2. 暫停相機
    try {
        if (scannerRef.current) scannerRef.current.pause(); 
    } catch (e) { console.warn("Pause error", e); }
    
    setScanError(null);
    setScanState(ScanState.PROCESSING);
    
    setUsers(prev => prev.map(u => 
      u.isSelected ? { ...u, status: UserStatus.PROCESSING, message: '打卡中...' } : u
    ));

    try {
        // 3. 呼叫 API
        const response = await apiCheckinBatch(
            apiEndpoint, 
            decodedText, 
            selectedUsers.map(u => ({ id: u.id, password: u.password }))
        );

        // 4. 更新 User 狀態
        setUsers(prev => prev.map(u => {
          const result = response.results.find(r => r.id === u.id);
          if (result) {
              const isSuccess = result.status === 'SUCCESS';
              return { 
                  ...u, 
                  status: isSuccess ? UserStatus.SUCCESS : UserStatus.FAILED,
                  message: result.message,
                  lastCheckinSuccess: isSuccess ? Date.now() : u.lastCheckinSuccess 
              };
          }
          return u;
        }));

        // 🔥 5. 修正邏輯開始：使用「區域變數」來判斷結果，而不是讀取 state 🔥
        const failedCount = response.results.filter(r => r.status === 'FAILED').length;
        let finalState = ScanState.IDLE; // 暫存最終狀態

        if (failedCount === 0) {
          finalState = ScanState.RESULT_SUCCESS;
        } else {
          finalState = ScanState.RESULT_PARTIAL;
        }
        
        // 更新 React 狀態
        setScanState(finalState);

        // 使用「區域變數 finalState」來判斷是否要設定倒數計時
        // 這樣就不會報錯了
        if (finalState === ScanState.RESULT_SUCCESS || finalState === ScanState.RESULT_PARTIAL) {
            setTimeout(() => {
                setScanState(ScanState.IDLE);
                try {
                    if (scannerRef.current) scannerRef.current.resume();
                } catch (e) {}
            }, 3000);
        }

    } catch (e) {
        setUsers(prev => prev.map(u => 
            u.isSelected ? { ...u, status: UserStatus.FAILED, message: '請求失敗' } : u
        ));
        setScanError("API 請求錯誤");
        setScanState(ScanState.IDLE);
    }
  };

  // -- Camera Effect (Zoom Logic) --
  // ... (Zoom Logic remains the same)

  const applyZoom = (value: number) => {
    setZoomLevel(value);
    if (!scannerRef.current) return;
    
    // 1. 嘗試硬體變焦
    try {
        const videoTrack = scannerRef.current.html5QrCode?.scanner?.videoElement?.srcObject?.getVideoTracks()[0];
        if (videoTrack) {
             const capabilities = videoTrack.getCapabilities();
             if (capabilities.zoom) {
                 videoTrack.applyConstraints({ advanced: [{ zoom: value }] });
                 return; // 硬體支援，直接返回
             }
        }
    } catch (e) {
        console.log("Hardware zoom not supported", e);
    }

    // 2. 硬體不支援，這裡不做事，因為 CSS transform 會在 render 裡處理
  };


  // -- Render Views --

  const renderHome = () => {
    const selectedCount = users.filter(u => u.isSelected).length;
    const allSelected = users.length > 0 && users.every(u => u.isSelected);

    return (
      // 配色：改為 Zinc 950 (極深灰)
      <div className="flex flex-col h-full pt-12 px-4 pb-24 overflow-y-auto no-scrollbar bg-[#09090b] relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">OneScan</h1>
            <p className="text-zinc-400 text-xs">{users.length} Accounts</p>
          </div>
          <div className="flex items-center space-x-2">
            
            {/* 刷新/登入按鈕 */}
            {!isEditing && (
              <button onClick={handleBatchLogin} className="w-10 h-10 bg-[#18181b] rounded-full text-zinc-300 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                <RotateCcw size={18} />
              </button>
            )}
            
            {/* 編輯/完成按鈕 */}
            <button 
              onClick={toggleEditMode}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${isEditing ? 'bg-blue-600 text-white' : 'bg-[#18181b] text-zinc-300 shadow-md'}`}
            >
              {isEditing ? <Check size={18} /> : <Edit2 size={18} />}
              <span className="text-xs font-medium">{isEditing ? '完成' : 'Edit'}</span>
            </button>
            
            {/* 新增按鈕 */}
            <button onClick={handleOpenAddModal} className="p-2 bg-blue-600 rounded-full text-white shadow-lg active:scale-95 transition-transform">
              <Plus size={24} />
            </button>
          </div>
        </div>

        {/* List Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase">帳號列表 / 狀態</h2>
          {!isEditing && users.length > 0 && (
             <div className="flex items-center gap-3">
                 <span className="text-xs text-zinc-500 font-medium">{selectedCount} Selected</span>
                 <button onClick={toggleSelectAll} className="flex items-center space-x-2 text-xs group">
                     <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">全選</span>
                     <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${allSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                       {allSelected && <Check size={12} className="text-white" />}
                     </div>
                 </button>
             </div>
          )}
        </div>

        {/* Users List */}
        <div className="flex flex-col gap-2">
          {users.length === 0 ? (
             <div className="text-center py-20 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl">
               <p className="text-lg mb-2">👋 Welcome to OneScan</p>
               <p className="text-sm">點擊右上角的 + 新增同學帳號</p>
             </div>
          ) : (
            users.map(user => (
              <UserRow 
                key={user.id} 
                user={user} 
                isEditing={isEditing}
                onToggle={handleToggleUser}
                onDelete={handleDeleteUser}
              />
            ))
          )}
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#18181b] border border-zinc-700 w-full max-w-sm rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">新增帳號</h2>
              <form onSubmit={handleConfirmAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Account / 學號</label>
                  <input type="text" value={newUserId} onChange={e => setNewUserId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：D1234567" autoFocus />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Password</label>
                  <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300">取消</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold">新增</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderScan = () => {
    let overlay = null;
    let borderColor = "border-blue-500";

    if (scanState === ScanState.PROCESSING) {
      borderColor = "border-yellow-400";
      overlay = (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin mb-4"></div>
          <p className="text-white font-semibold animate-pulse">連線中...</p>
        </div>
      );
    } else if (scanState === ScanState.RESULT_SUCCESS) {
      borderColor = "border-green-500";
      overlay = (
        <div className="absolute inset-0 bg-green-600/95 backdrop-blur-md flex flex-col items-center justify-center z-20 px-8 text-center animate-in fade-in">
          <CheckCheck className="text-white w-24 h-24 mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">全部成功!</h2>
          <p className="text-green-100 mb-8">所有選取的帳號皆已簽到</p>
          <button onClick={handleReturnHome} className="px-8 py-3 bg-white text-green-700 font-bold rounded-full shadow-lg">完成並返回</button>
        </div>
      );
    } else if (scanState === ScanState.RESULT_PARTIAL) {
      borderColor = "border-red-500";
      overlay = (
        <div className="absolute inset-0 bg-[#09090b]/90 backdrop-blur-md flex flex-col items-center justify-center z-20 px-6 text-center animate-in zoom-in-95">
          <AlertTriangle className="text-red-500 w-16 h-16 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">部分失敗</h2>
          <p className="text-zinc-300 mb-6">請在首頁重新點選失敗的帳號</p>
          <div className="w-full max-w-[200px] h-1 bg-zinc-700 rounded-full overflow-hidden">
             <div className="h-full bg-blue-500 animate-[progress_3s_linear_forwards]"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative h-full w-full bg-black flex flex-col">
        {/* Camera Feed with Digital Zoom Fallback via CSS */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
             <div id="reader" className="w-full h-full object-cover origin-center transition-transform duration-100" style={{ transform: `scale(${zoomLevel})` }}></div>
        </div>

        {/* Viewfinder UI */}
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div className={`relative w-64 h-64 border-2 ${borderColor} rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]`}>
                {scanState === ScanState.IDLE && (
                    <div className="absolute left-2 right-2 h-0.5 bg-blue-500/80 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                )}
            </div>
        </div>

        {overlay}

        {scanError && (
          <div className="absolute top-20 left-6 right-6 z-40 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-xl flex items-center justify-center">
             <AlertTriangle size={18} className="mr-2" />
             <span className="text-sm">{scanError}</span>
          </div>
        )}

        {/* Zoom Slider */}
        {scanState === ScanState.IDLE && (
            <div className="absolute bottom-24 left-0 right-0 z-20 px-8 flex flex-col items-center">
                <div className="flex items-center space-x-4 w-full max-w-xs bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
                    <ZoomOut size={16} className="text-zinc-300" />
                    <input 
                        type="range" min="1" max="3" step="0.1" 
                        value={zoomLevel}
                        onChange={(e) => applyZoom(parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <ZoomIn size={16} className="text-zinc-300" />
                </div>
                <div className="mt-2 text-[10px] text-zinc-400">{zoomLevel.toFixed(1)}x</div>
            </div>
        )}

        <button onClick={handleReturnHome} className="absolute top-6 right-6 p-2 bg-black/40 rounded-full text-white z-30"><X size={24} /></button>
      </div> 
    );
  };

  const renderSettings = () => (
    // 配色：改為 Zinc 900
    <div className="flex flex-col h-full pt-12 px-6 pb-24 bg-[#18181b]">
      <h1 className="text-2xl font-bold text-white mb-8">設定</h1>
      <div className="bg-[#27272a] border border-zinc-800 rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">API Endpoint (後端地址)</label>
            <input 
              type="text" 
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
             <div className="w-2 h-2 rounded-full bg-green-500"></div>
             <span className="text-xs text-zinc-400">Ready</span>
          </div>
      </div>
    </div>
  );

  return (
    // 配色：主背景設為 Zinc 950
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans overflow-hidden">
      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'scan' && renderScan()}
        {activeTab === 'settings' && renderSettings()}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export default App;
