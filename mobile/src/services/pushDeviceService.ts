import { NOTIFICATIONS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';

export function registerPushDevice(token: string, platform: 'android' | 'ios'): Promise<{ registered: true }> {
  return apiRequest<{ registered: true }>(`${NOTIFICATIONS_PATH}/devices`, {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export function deactivatePushDevice(token: string): Promise<{ deactivated: true }> {
  return apiRequest<{ deactivated: true }>(`${NOTIFICATIONS_PATH}/devices`, {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}
