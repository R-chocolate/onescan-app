import React, { useState, useEffect, useRef } from 'react';
import { BottomNav } from './components/BottomNav';
import { UserRow } from './components/UserRow';
import { apiLoginBatch, apiCheckinBatch, apiGetHistory } from './services/api';
import { Tab, User, UserStatus, ScanState, CheckinRecord } from './types';
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
  Loader2,
  Focus,
  Scan,
  Clock,
  MapPin,
  Calendar
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  
  // -- LocalStorage --
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('onescan_users');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('onescan_users', JSON.stringify(users));
  }, [users]);

  const [scanState, setScanState] = useState<ScanState>(ScanState.IDLE);
  const [scanError, setScanError] = useState<string | null>(null);

  // [修正] 這裡直接寫死，不使用 useState，也不讀取 localStorage
  // 這樣就解決了 "setApiEndpoint not found" 的錯誤，也保證連線正確
  const apiEndpoint = 'https://fcu-backend-290830858385.asia-east1.run.app';
  
  // -- Camera State --
  const scannerRef = useRef<any>(null); 
  const isScannerRunning = useRef(false);
  const initialPinchDistance = useRef<number | null>(null);
  const initialZoomLevel = useRef<number>(1.0);
  const [tapEffect, setTapEffect] = useState<{x: number, y: number} | null>(null);

  // 硬體變焦
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [zoomCap, setZoomCap] = useState<{min: number, max: number, step: number} | null>(null);
  const [isHardwareZoomSupported, setIsHardwareZoomSupported] = useState(false);

  // -- Pull to Refresh --
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // -- UI State --
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  // -- History Modal State --
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [historyRecords, setHistoryRecords] = useState<CheckinRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // -- Camera Init --
   useEffect(() => {
    if (activeTab === 'scan' && scanState === ScanState.IDLE) {
      const timeoutId = setTimeout(() => {
        if (!scannerRef.current) {
            try {
                // @ts-ignore
                const html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;
            } catch (e) { console.error("Init failed", e); }
        }

        const config = { 
            fps: 15,
            qrbox: { width: 300, height: 300 }, 
            useBarCodeDetectorIfSupported: true,
            videoConstraints: {
                facingMode: "environment", 
                width: { min: 1920, ideal: 3840, max: 4096 }, 
                height: { min: 1080, ideal: 2160, max: 2160 },
                aspectRatio: { ideal: 1.7777777778 },
                advanced: [
                    { focusMode: "continuous" },
                    { exposureMode: "continuous" },
                    { whiteBalanceMode: "continuous" }
                ]
            }
        };
        
        if (!isScannerRunning.current && scannerRef.current) {
            isScannerRunning.current = true;
            scannerRef.current.start(
                { facingMode: "environment" }, 
                config,
                (decodedText: string) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage: string) => { }
            ).then(() => {
                setTimeout(() => {
                    try {
                        const videoElement = document.querySelector("#reader video") as HTMLVideoElement;
                        const track = videoElement?.srcObject instanceof MediaStream 
                            ? videoElement.srcObject.getVideoTracks()[0] 
                            : null;

                        if (track) {
                            const capabilities = track.getCapabilities();
                            // @ts-ignore
                            if (capabilities.zoom) {
                                setIsHardwareZoomSupported(true);
                                setZoomCap({
                                    // @ts-ignore
                                    min: capabilities.zoom.min,
                                    // @ts-ignore
                                    max: capabilities.zoom.max,
                                    // @ts-ignore
                                    step: capabilities.zoom.step
                                });
                                // @ts-ignore
                                setZoomLevel(capabilities.zoom.min);
                            }
                        }
                    } catch (e) {}
                }, 500);
            }).catch((err: any) => {
                console.error("Camera Error", err);
                isScannerRunning.current = false;
                setScanError("相機啟動失敗");
            });
        }
      }, 300); 

      return () => clearTimeout(timeoutId);
    } else {
      if (scannerRef.current && isScannerRunning.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current.clear();
              isScannerRunning.current = false;
              setIsHardwareZoomSupported(false);
          }).catch((err: any) => console.warn(err));
      }
    }
    
    return () => {
        if (scannerRef.current && isScannerRunning.current) {
            isScannerRunning.current = false;
            scannerRef.current.stop().catch(() => {}).finally(() => {
                scannerRef.current.clear().catch(() => {});
            });
        }
    };
  }, [activeTab, scanState]);

  // -- Actions --
  const handleToggleUser = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, isSelected: !u.isSelected, checkinStatus: null } : u
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
    const newUser: User = {
      id: newUserId, name: newUserId, password: newUserPassword,
      role: 'Guest', status: UserStatus.PENDING, isSelected: true, isLoggedIn: false, sessionExpiry: 0, lastCheckinSuccess: 0,
      checkinStatus: null
    };
    setUsers(prev => [...prev, newUser]); 
    setShowAddModal(false);
  };
  
  // 長按查看紀錄
  const handleLongPressUser = async (user: User) => {
    if (isEditing) return;
    setHistoryUser(user);
    setHistoryRecords([]);
    setIsLoadingHistory(true);

    try {
        const records = await apiGetHistory(apiEndpoint, { id: user.id, password: user.password });
        setHistoryRecords(records);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
      setHistoryUser(null);
  };
  
  const handleBatchLogin = async () => {
    const usersToLogin = users.filter(u => !u.isLoggedIn || u.status === UserStatus.FAILED || u.status === UserStatus.PENDING);
    if (usersToLogin.length === 0) {
         if (!confirm("所有帳號看起來都已登入，要強制重新刷新嗎？")) return;
    }
    setUsers(prev => prev.map(u => 
        usersToLogin.some(t => t.id === u.id) ? { ...u, status: UserStatus.PROCESSING, message: '連線中...' } : u
    ));
    try {
        const response = await apiLoginBatch(apiEndpoint, usersToLogin.map(u => ({ id: u.id, password: u.password })));
        setUsers(prev => prev.map(u => {
            const result = response.results.find(r => r.id === u.id);
            if (result) {
                const isSuccess = result.status === 'SUCCESS';
                return { 
                  ...u, 
                  status: isSuccess ? UserStatus.SUCCESS : UserStatus.FAILED, 
                  isLoggedIn: isSuccess, 
                  sessionExpiry: isSuccess ? Date.now() + 1000 * 60 * 30 : 0, 
                  message: result.message,
                  checkinStatus: null
                };
            }
            return u;
        }));
    } catch (e) {
        setUsers(prev => prev.map(u => ({ ...u, status: UserStatus.FAILED, message: '連線失敗' })));
        alert("無法連線到後端伺服器");
    }
  };
  
  const toggleSelectAll = () => {
    const allSelected = users.length > 0 && users.every(u => u.isSelected);
    setUsers(prev => prev.map(u => ({ ...u, isSelected: !allSelected, checkinStatus: null })));
  };

  const toggleEditMode = () => setIsEditing(!isEditing);

  const handleReturnHome = () => {
    setUsers(prev => prev.map(u => ({ ...u, isSelected: false }))); 
    setScanState(ScanState.IDLE);
    setScanError(null);
    setActiveTab('home');
  };

  const handleTabChange = (tab: Tab) => {
    if (tab === 'home' && activeTab === 'scan') handleReturnHome();
    else setActiveTab(tab);
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (scanState !== ScanState.IDLE) return; 
    const selectedUsers = users.filter(u => u.isSelected);
    if (selectedUsers.length === 0) {
      setScanError("未選取任何帳號");
      setTimeout(() => setScanError(null), 2000);
      return;
    }
    
    try { if (scannerRef.current) scannerRef.current.pause(); } catch (e) {}
    setScanError(null);
    setScanState(ScanState.PROCESSING);
    
    setUsers(prev => prev.map(u => u.isSelected ? { ...u, message: '打卡中...' } : u));

    try {
        const response = await apiCheckinBatch(apiEndpoint, decodedText, selectedUsers.map(u => ({ id: u.id, password: u.password })));
        
        setUsers(prev => prev.map(u => {
          const result = response.results.find(r => r.id === u.id);
          if (result) {
              const isSuccess = result.status === 'SUCCESS';
              return { 
                  ...u, 
                  checkinStatus: isSuccess ? 'SUCCESS' : 'FAILED', 
                  message: result.message, 
                  lastCheckinSuccess: Date.now() 
              };
          }
          return u;
        }));

        const failedCount = response.results.filter(r => r.status === 'FAILED').length;
        let finalState = failedCount === 0 ? ScanState.RESULT_SUCCESS : ScanState.RESULT_PARTIAL;
        setScanState(finalState);
        
        if (finalState === ScanState.RESULT_SUCCESS || finalState === ScanState.RESULT_PARTIAL) {
            setTimeout(() => {
                setScanState(ScanState.IDLE);
                try { if (scannerRef.current) scannerRef.current.resume(); } catch (e) {}
            }, 3000);
        }
    } catch (e) {
        setUsers(prev => prev.map(u => u.isSelected ? { 
            ...u, 
            checkinStatus: 'FAILED', 
            message: '請求失敗',
            lastCheckinSuccess: Date.now() 
        } : u));
        setScanError("API 請求錯誤");
        setScanState(ScanState.IDLE);
    }
  };

  const applyZoom = (value: number) => {
    setZoomLevel(value);
    if (isHardwareZoomSupported) {
        try {
            const videoElement = document.querySelector("#reader video") as HTMLVideoElement;
            const track = videoElement?.srcObject instanceof MediaStream 
                ? videoElement.srcObject.getVideoTracks()[0] 
                : null;
            if (track) {
                track.applyConstraints({
                    // @ts-ignore
                    advanced: [{ zoom: value }]
                }).catch(e => console.log("Zoom failed", e));
            }
        } catch (e) { }
    } 
  };

  const handleCameraTap = (e: React.TouchEvent | React.MouseEvent) => {
    // @ts-ignore
    if (e.touches && e.touches.length > 1) return;
    // @ts-ignore
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    // @ts-ignore
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    setTapEffect({ x: clientX, y: clientY });
    setTimeout(() => setTapEffect(null), 800);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          initialPinchDistance.current = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
          initialZoomLevel.current = zoomLevel;
      } else if (e.touches.length === 1) {
          handleCameraTap(e);
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance.current) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const currentDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
          const scaleFactor = currentDist / initialPinchDistance.current;
          
          let delta = (scaleFactor - 1) * 2;
          if (zoomCap) delta = delta * (zoomCap.max - zoomCap.min) * 0.5;
          
          let newZoom = initialZoomLevel.current + delta;
          const max = zoomCap ? zoomCap.max : 5;
          const min = zoomCap ? zoomCap.min : 1;
          newZoom = Math.min(Math.max(newZoom, min), max);

          applyZoom(newZoom);
      }
  };

  const handleTouchEnd = () => { initialPinchDistance.current = null; };
  const handlePullStart = (e: React.TouchEvent) => { if (scrollContainerRef.current?.scrollTop === 0) setPullStartY(e.touches[0].clientY); };
  const handlePullMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - pullStartY;
    if (scrollContainerRef.current?.scrollTop === 0 && diff > 0 && !isRefreshing) setPullDistance(diff / 2.5);
    else setPullDistance(0);
  };
  
  const handlePullEnd = () => {
    if (pullDistance > 80) { 
        setIsRefreshing(true); 
        window.location.reload(); 
    } 
    setPullDistance(0);
  };

  const renderHome = () => {
    const selectedCount = users.filter(u => u.isSelected).length;
    const allSelected = users.length > 0 && users.every(u => u.isSelected);
    return (
      <div 
        className="flex flex-col h-full pt-12 px-4 pb-24 overflow-y-auto no-scrollbar bg-[#09090b] relative"
        ref={scrollContainerRef}
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
      >
        <div className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-transform duration-200" style={{ transform: `translateY(${isRefreshing ? 60 : pullDistance}px)`, opacity: isRefreshing || pullDistance > 0 ? 1 : 0 }}>
            <div className="bg-zinc-800 p-2 rounded-full shadow-lg border border-zinc-700">
                {isRefreshing ? <Loader2 className="animate-spin text-blue-500" size={20} /> : <RotateCcw size={20} className={`text-zinc-400 transition-transform ${pullDistance > 60 ? 'rotate-180' : ''}`} />}
            </div>
        </div>
        <div style={{ transform: `translateY(${isRefreshing ? 60 : pullDistance}px)`, transition: isRefreshing ? 'transform 0.2s' : 'none' }}>
            <div className="flex items-center justify-between mb-6 relative">
              <div><h1 className="text-2xl font-bold text-white">OneScan</h1><p className="text-zinc-400 text-xs">{users.length} Accounts</p></div>
              <span className="absolute right-0 -top-4 text-[10px] text-zinc-600 font-medium tracking-wide">建議用瀏覽器開啟</span>
              <div className="flex items-center space-x-2">
                {!isEditing && <button onClick={() => handleBatchLogin()} className="w-10 h-10 bg-[#18181b] rounded-full text-zinc-300 flex items-center justify-center shadow-lg active:scale-95 transition-transform"><RotateCcw size={18} /></button>}
                <button onClick={toggleEditMode} className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${isEditing ? 'bg-blue-600 text-white' : 'bg-[#18181b] text-zinc-300 shadow-md'}`}>{isEditing ? <Check size={18} /> : <Edit2 size={18} />}<span className="text-xs font-medium">{isEditing ? 'Done' : 'Edit'}</span></button>
                <button onClick={handleOpenAddModal} className="p-2 bg-blue-600 rounded-full text-white shadow-lg active:scale-95 transition-transform"><Plus size={24} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase">帳號列表 / 登入狀態</h2>
              {!isEditing && users.length > 0 && <div className="flex items-center gap-3"><span className="text-xs text-zinc-500 font-medium">{selectedCount} Selected</span><button onClick={toggleSelectAll} className="flex items-center space-x-2 text-xs group"><span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">全選</span><div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${allSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>{allSelected && <Check size={12} className="text-white" />}</div></button></div>}
            </div>
            <div className="flex flex-col gap-2">
              {users.length === 0 ? <div className="text-center py-20 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl"><p className="text-lg mb-2">👋 Welcome to OneScan</p><p className="text-sm">點擊右上角的 + 新增同學帳號</p></div> : 
              users.map(user => (
                  <UserRow 
                      key={user.id} 
                      user={user} 
                      isEditing={isEditing} 
                      onToggle={handleToggleUser} 
                      onDelete={handleDeleteUser} 
                      onLongPress={handleLongPressUser} // 傳遞長按函式
                  />
              ))}
            </div>
        </div>
        {/* Add User Modal */}
        {showAddModal && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-[#18181b] border border-zinc-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl"><h2 className="text-xl font-bold text-white mb-4">新增帳號</h2><form onSubmit={handleConfirmAddUser} className="space-y-4"><div><label className="block text-xs text-zinc-400 mb-1">Account / NID帳號</label><input type="text" value={newUserId} onChange={e => setNewUserId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="D1234567" autoFocus /></div><div><label className="block text-xs text-zinc-400 mb-1">Password / NID密碼</label><input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" /></div><div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300">取消</button><button type="submit" className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold">新增</button></div></form></div></div>}
        
        {/* History Modal */}
        {historyUser && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity" 
                onClick={closeHistoryModal}
            />
            
            <div className="relative w-full max-w-sm bg-[#18181b] border-t border-zinc-700 sm:border rounded-t-2xl sm:rounded-2xl p-6 pointer-events-auto animate-in slide-in-from-bottom-10 duration-200 shadow-2xl">
                <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6 sm:hidden" />
                
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">{historyUser.name}</h2>
                        <p className="text-xs text-zinc-400 mt-1">打卡紀錄</p>
                    </div>
                    <button onClick={closeHistoryModal} className="p-2 bg-zinc-800 rounded-full text-zinc-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {isLoadingHistory ? (
                        <div className="py-10 flex flex-col items-center text-zinc-500">
                            <Loader2 className="animate-spin mb-2" />
                            <span className="text-xs">讀取中...</span>
                        </div>
                    ) : historyRecords.length === 0 ? (
                        <div className="py-10 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            <Calendar size={24} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">今日尚無紀錄</p>
                        </div>
                    ) : (
                        historyRecords.map((record, index) => (
                            <div key={index} className={`flex items-center justify-between p-3 border rounded-xl ${record.isToday ? 'bg-zinc-900 border-zinc-700' : 'bg-transparent border-zinc-800 opacity-60'}`}>
                                <div className="flex items-center space-x-3">
                                    <div className={`w-2 h-2 rounded-full ${record.isToday ? 'bg-green-500' : 'bg-zinc-500'}`} />
                                    <div>
                                        <div className="flex items-center text-sm font-bold text-zinc-200">
                                            {record.courseName}
                                        </div>
                                        <div className="flex items-center text-xs text-zinc-500 mt-1">
                                            <Clock size={10} className="mr-1" />
                                            {record.time}
                                            <span className="mx-2">|</span>
                                            <span>第 {record.section} 節</span>
                                        </div>
                                    </div>
                                </div>
                                {record.isToday && (
                                    <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded">
                                        Today
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
      </div>
    );
  };

  const renderScan = () => {
    let overlay = null;
    if (scanState === ScanState.PROCESSING) {
      overlay = <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 pointer-events-none"><div className="w-16 h-16 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin mb-4"></div><p className="text-white font-semibold animate-pulse">連線中...</p></div>;
    } else if (scanState === ScanState.RESULT_SUCCESS) {
      overlay = <div className="absolute inset-0 bg-green-600/95 backdrop-blur-md flex flex-col items-center justify-center z-20 px-8 text-center animate-in fade-in"><CheckCheck className="text-white w-24 h-24 mb-4" /><h2 className="text-3xl font-bold text-white mb-2">全部成功!</h2><p className="text-green-100 mb-8">所有選取的帳號皆已簽到</p><button onClick={handleReturnHome} className="px-8 py-3 bg-white text-green-700 font-bold rounded-full shadow-lg">完成並返回</button></div>;
    } else if (scanState === ScanState.RESULT_PARTIAL) {
      overlay = <div className="absolute inset-0 bg-[#09090b]/90 backdrop-blur-md flex flex-col items-center justify-center z-20 px-6 text-center animate-in zoom-in-95"><AlertTriangle className="text-red-500 w-16 h-16 mb-4" /><h2 className="text-2xl font-bold text-white mb-2">部分失敗</h2><p className="text-zinc-300 mb-6">請在首頁重新點選失敗的帳號</p><div className="w-full max-w-[200px] h-1 bg-zinc-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500 animate-[progress_3s_linear_forwards]"></div></div></div>;
    }

    return (
      <div className="relative w-full bg-black flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
        <div 
            className="absolute inset-0 flex items-center justify-center bg-black touch-none"
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        >
             <div id="reader" className="w-full h-full"></div>
             <style>{`
                #reader video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important; 
                }
             `}</style>
        </div>

        {overlay}
        {tapEffect && (
            <div 
                className="absolute w-20 h-20 border-2 border-yellow-400 rounded-full animate-[ping_0.5s_ease-out_forwards] pointer-events-none z-30 flex items-center justify-center"
                style={{ left: tapEffect.x - 40, top: tapEffect.y - 40 }}
            >
                <Focus size={24} className="text-yellow-400 opacity-80" />
            </div>
        )}
        
        {scanError && <div className="absolute top-20 left-6 right-6 z-40 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-xl flex items-center justify-center animate-bounce"><AlertTriangle size={18} className="mr-2" /><span className="text-sm">{scanError}</span></div>}

        {scanState === ScanState.IDLE && (
            <div className="absolute bottom-24 left-0 right-0 z-20 px-8 flex flex-col items-center pointer-events-auto">
                <div className="flex items-center space-x-4 w-full max-w-xs bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
                    <ZoomOut size={16} className="text-zinc-300" />
                    <input 
                        type="range" 
                        min={zoomCap ? zoomCap.min : 1} 
                        max={zoomCap ? zoomCap.max : 5} 
                        step={zoomCap ? zoomCap.step : 0.1}
                        value={zoomLevel}
                        disabled={!isHardwareZoomSupported} 
                        onChange={(e) => applyZoom(parseFloat(e.target.value))}
                        className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isHardwareZoomSupported ? 'bg-zinc-600 accent-blue-500' : 'bg-zinc-700 accent-zinc-500'}`}
                    />
                    <ZoomIn size={16} className="text-zinc-300" />
                </div>
                <div className="mt-2 flex flex-col items-center space-y-1 opacity-80">
                     <div className="flex items-center space-x-1">
                        <Scan size={12} className="text-yellow-400" />
                        <p className="text-[10px] text-yellow-100 font-medium">使用雙指可快速縮放</p>
                     </div>
                </div>
            </div>
        )}
        <button onClick={handleReturnHome} className="absolute top-6 right-6 p-2 bg-black/40 rounded-full text-white z-30 backdrop-blur-sm active:scale-90 transition-transform pointer-events-auto"><X size={24} /></button>
      </div> 
    );
  };

  // [修正] Settings 頁面改為唯讀，不再嘗試修改 apiEndpoint
  const renderSettings = () => (
    <div className="flex flex-col h-full pt-12 px-6 pb-24 bg-[#18181b]">
      <h1 className="text-2xl font-bold text-white mb-8">設定</h1>
      <div className="bg-[#27272a] border border-zinc-800 rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">API Endpoint</label>
            {/* 這裡把 onChange 拿掉了，並加上 readOnly */}
            <input 
                type="text" 
                value={apiEndpoint} 
                readOnly
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-400 text-sm focus:outline-none cursor-not-allowed" 
            />
          </div>
          <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-xs text-zinc-400">Ready</span></div>
      </div>
    </div>
  );

  return (
    <div className="w-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans overflow-hidden" style={{ height: '100dvh' }}>
      <main className="flex-1 relative overflow-hidden">{activeTab === 'home' && renderHome()}{activeTab === 'scan' && renderScan()}{activeTab === 'settings' && renderSettings()}</main>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export default App;