import { HEALTH_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { HealthReport } from '@/types/health';

export function getHealth(): Promise<HealthReport> {
  return apiRequest<HealthReport>(HEALTH_PATH, {
    method: 'GET',
    acceptedStatuses: [200, 503],
    auth: false,
  });
}
