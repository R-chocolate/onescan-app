// src/services/api.ts

export const DEFAULT_API_URL = "http://localhost:5000"; 

export interface UserCredentials {
  id: string;
  password: string;
}

export interface ApiResult {
  status: string;
  results: {
    id: string;
    status: "SUCCESS" | "FAILED";
    message: string;
  }[];
}

// 修正：這裡明確定義需要 2 個參數 (URL, Users)
export const apiLoginBatch = async (baseUrl: string, users: UserCredentials[]): Promise<ApiResult> => {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/api/login_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

// 修正：這裡明確定義需要 3 個參數 (URL, QR Data, Users)
export const apiCheckinBatch = async (baseUrl: string, qrData: string, users: UserCredentials[]): Promise<ApiResult> => {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/api/checkin_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, qr_data: qrData }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Checkin Error:", error);
    throw error;
  }
};