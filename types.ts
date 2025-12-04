export enum UserStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface User {
  id: string;
  name: string;
  password?: string;
  role: string;
  status: UserStatus;
  message?: string;
  isSelected: boolean;
  lastCheckedIn?: number; // Timestamp for auto-expiration
  isLoggedIn: boolean; // 標記 Session 是否有效 (用於左側圓圈)
  sessionExpiry: number; // 預計的 Session 過期時間戳 (用於檢查是否要重新登入)
  lastCheckinSuccess: number; // 上次打卡成功時間戳 (用於 5 分鐘方框)
  checkinStatus: 'SUCCESS' | 'FAILED' | null; 
}

export type Tab = 'home' | 'scan' | 'settings';

export enum ScanState {
  IDLE = 'IDLE',          // Viewfinder active
  PROCESSING = 'PROCESSING', // "Frozen" analyzing
  RESULT_PARTIAL = 'RESULT_PARTIAL', // Some failed
  RESULT_SUCCESS = 'RESULT_SUCCESS', // All success
}