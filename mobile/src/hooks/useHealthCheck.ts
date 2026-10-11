import { useCallback, useState } from 'react';
import { ApiError } from '@/lib/apiClient';
import { getHealth } from '@/services/healthService';
import type { HealthReport } from '@/types/health';

export type HealthCheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; report: HealthReport }
  | { status: 'error'; message: string };

export function useHealthCheck() {
  const [state, setState] = useState<HealthCheckState>({ status: 'idle' });

  const check = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const report = await getHealth();
      setState({ status: 'success', report });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Something went wrong while contacting the API.';
      setState({ status: 'error', message });
    }
  }, []);

  return { state, check };
}
