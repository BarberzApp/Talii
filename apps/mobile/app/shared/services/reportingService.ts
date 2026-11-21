/**
 * Reporting and blocking through the API (App Store requirement). The server
 * derives the reported user and hides blocked users in both directions.
 */

import { api } from '../lib/api';
import { logger } from '../lib/logger';
import type { ReportSubmission, BlockUserParams, Report, BlockedUser } from '../types/reporting.types';

export const reportingService = {
  /** POST /api/reports. A repeat of your own pending report returns that report. */
  async submitReport(report: ReportSubmission): Promise<Report> {
    const { report: saved } = await api.reports.create({
      contentType: report.contentType,
      contentId: report.contentId,
      reason: report.reason,
      details: report.description?.trim() || undefined,
    });
    return saved;
  },

  /** POST /api/blocks (blocking twice is harmless). */
  async blockUser(params: BlockUserParams): Promise<void> {
    await api.blocks.block(params.userIdToBlock);
  },

  /** DELETE /api/blocks/:userId */
  async unblockUser(userIdToUnblock: string): Promise<void> {
    await api.blocks.unblock(userIdToUnblock);
  },

  /** Users the caller has blocked (GET /api/blocks); empty on failure. */
  async getBlockedUsers(): Promise<BlockedUser[]> {
    try {
      return (await api.blocks.list()).blocks;
    } catch (error) {
      logger.error('Error fetching blocked users:', error);
      return [];
    }
  },

  async isUserBlocked(userId: string): Promise<boolean> {
    const blocked = await reportingService.getBlockedUsers();
    return blocked.some((b) => b.userId === userId);
  },
};
