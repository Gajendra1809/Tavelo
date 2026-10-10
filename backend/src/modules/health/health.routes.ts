import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { getHealthReport } from './health.service';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const report = await getHealthReport();
    // 503 lets uptime checks treat a disconnected database as not ready.
    // success stays true because the API itself answered with an accurate report.
    const statusCode = report.status === 'ok' ? 200 : 503;
    sendSuccess(res, report, statusCode);
  }),
);
