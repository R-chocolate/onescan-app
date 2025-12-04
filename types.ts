export type Tab = 'home' | 'scan' | 'settings';

export enum UserStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum ScanState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  RESULT_SUCCESS = 'RESULT_SUCCESS',
  RESULT_PARTIAL = 'RESULT_PARTIAL',
}

export interface CheckinRecord {
  courseName: string; // 課程名稱
  section: string;    // 節次
  time: string;       // 登錄時間 (日期 + 時間)
  isToday: boolean;   // 是否為今日紀錄
}

export interface User {
  id: string;
  name: string;
  password?: string;
  role: string;
  status: UserStatus;
  isSelected: boolean;
  isLoggedIn: boolean;
  sessionExpiry: number;
  lastCheckinSuccess: number; // 上次打卡動作的時間戳記
  message?: string;
  checkinStatus?: 'SUCCESS' | 'FAILED' | null; // 用於顯示打卡結果標籤
}