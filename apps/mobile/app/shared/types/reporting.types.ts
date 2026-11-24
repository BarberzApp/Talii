/**
 * Types for user reporting and blocking (POST /api/reports, /api/blocks).
 */
import type { ApiReportContentType, ApiReportReason, BlockEntry, OwnReport } from '@barber-app/shared';

/** What can be reported: a user or profile (user id), a review (review id) or an image (its URL). */
export type ReportType = ApiReportContentType;
export type ReportReason = ApiReportReason;
/** A report as its author sees it (never reported_user_id). */
export type Report = OwnReport;
export type BlockedUser = BlockEntry;

export interface ReportSubmission {
  contentType: ReportType;
  contentId: string;
  reason: ReportReason;
  description?: string;
}

export interface BlockUserParams {
  userIdToBlock: string;
}
