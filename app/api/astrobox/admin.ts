import { sendApiRequest } from "./request";
import type { CommentView } from "./community";

export interface AdminCommentView extends CommentView {
  senderIpRaw?: string | null;
  senderIpLocation?: string | null;
  children: AdminCommentView[];
}

export type AdminRole = "admin" | "moderator" | "pr-reviewer" | string;
export type BanKind = "platform" | "social";
export type VipTier = "None" | "Pro" | "CreatorPlus" | "CreatorPro";
export type ReportStatus = "pending" | "resolved" | "dismissed";
export type ReportType = "comment" | "resource";

export interface ActiveBan {
  id: string;
  userId: string;
  kind: BanKind;
  reason: string;
  bannedBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokedReason?: string | null;
}

export interface AdminUserSummary {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string;
  vip: VipTier;
  vipExpireMap: Record<string, string>;
  roles: AdminRole[];
  createdAt: string;
  activeBans: ActiveBan[];
  github?: string | null;
  additionalProperties?: Record<string, unknown>;
}

export interface AdminUserDetail extends AdminUserSummary {
  banHistory: ActiveBan[];
}

export interface ListResponse<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface VipOrder {
  id: string;
  orderId: string;
  ifdianUserId: string;
  userId?: string;
  vipType: VipTier;
  month: number;
  status: string;
  createdAt: string;
  activatedAt?: string;
  expiredAt?: string;
}

export interface ReportItem {
  id: string;
  senderId: string;
  reportType: ReportType;
  commentId: string | null;
  commentParentId: string | null;
  resourceId: string | null;
  reasonCategory: string;
  reason: string;
  evidence: string[];
  status: ReportStatus;
  handledBy: string | null;
  handledAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxMessage {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  metadata: unknown;
  senderType: "system" | "admin";
  senderId: string | null;
  bulkId?: string | null;
  createdAt: string;
  readAt: string | null;
  deletedByAdminAt?: string | null;
  deletedByUserAt?: string | null;
}

function buildQuery(params: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const AdminApi = {
  users: {
    list: (query: {
      search?: string;
      role?: string;
      vip?: string;
      banStatus?: "any" | "none" | "platform" | "social";
      limit?: number;
      cursor?: string;
    }) =>
      sendApiRequest<ListResponse<AdminUserSummary>>(
        `/admin/users${buildQuery(query)}`,
        "GET",
      ),
    detail: (userId: string) =>
      sendApiRequest<AdminUserDetail>(
        `/admin/users/${encodeURIComponent(userId)}`,
        "GET",
      ),
    createBan: (
      userId: string,
      body: {
        kind: BanKind;
        reason: string;
        durationMinutes?: number;
        expiresAt?: string;
        notifyUser?: boolean;
      },
    ) =>
      sendApiRequest<ActiveBan>(
        `/admin/users/${encodeURIComponent(userId)}/bans`,
        "POST",
        undefined,
        body,
      ),
    revokeBan: (
      userId: string,
      banId: string,
      body: { reason?: string; notifyUser?: boolean },
    ) =>
      sendApiRequest<ActiveBan>(
        `/admin/users/${encodeURIComponent(userId)}/bans/${encodeURIComponent(banId)}`,
        "DELETE",
        undefined,
        body,
      ),
    adjustVip: (
      userId: string,
      body: {
        op: "set-expire" | "grant-months" | "revoke-tier" | "set-current-tier";
        tier: VipTier;
        expiresAt?: string;
        months?: number;
        reason?: string;
        notifyUser?: boolean;
      },
    ) =>
      sendApiRequest<AdminUserDetail>(
        `/admin/users/${encodeURIComponent(userId)}/vip`,
        "POST",
        undefined,
        body,
      ),
    orders: (userId: string) =>
      sendApiRequest<VipOrder[]>(
        `/admin/users/${encodeURIComponent(userId)}/vip/orders`,
        "GET",
      ),
    roles: (
      userId: string,
      body: { add?: string[]; remove?: string[] },
    ) =>
      sendApiRequest<{ roles: string[] }>(
        `/admin/users/${encodeURIComponent(userId)}/roles`,
        "POST",
        undefined,
        body,
      ),
  },
  reports: {
    list: (query: {
      status?: ReportStatus;
      reportType?: ReportType;
      senderId?: string;
      commentId?: string;
      resourceId?: string;
      limit?: number;
      cursor?: string;
    }) =>
      sendApiRequest<ListResponse<ReportItem>>(
        `/admin/reports${buildQuery(query)}`,
        "GET",
      ),
    detail: (id: string) =>
      sendApiRequest<ReportItem>(
        `/admin/reports/${encodeURIComponent(id)}`,
        "GET",
      ),
    resolve: (
      id: string,
      body: {
        status: "resolved" | "dismissed";
        resolution: string;
        notifyReporter?: boolean;
        autoBan?: {
          targetUserId: string;
          kind: BanKind;
          reason: string;
          durationMinutes?: number;
        };
      },
    ) =>
      sendApiRequest<{ report: ReportItem; autoBan: ActiveBan | null }>(
        `/admin/reports/${encodeURIComponent(id)}/resolve`,
        "POST",
        undefined,
        body,
      ),
  },
  comments: {
    detail: (commentId: string) =>
      sendApiRequest<AdminCommentView>(
        `/admin/comments/${encodeURIComponent(commentId)}`,
        "GET",
      ),
  },
  inbox: {
    send: (body: {
      target:
        | { type: "userIds"; userIds: string[] }
        | { type: "role"; role: string }
        | { type: "all" };
      title: string;
      body: string;
      kind?: string;
      metadata?: unknown;
    }) =>
      sendApiRequest<{ bulkId: string; count: number }>(
        "/admin/inbox",
        "POST",
        undefined,
        body,
      ),
    list: (query: {
      userId?: string;
      senderId?: string;
      kind?: string;
      bulkId?: string;
      includeDeleted?: boolean;
      limit?: number;
      cursor?: string;
    }) =>
      sendApiRequest<ListResponse<InboxMessage>>(
        `/admin/inbox${buildQuery(query)}`,
        "GET",
      ),
    delete: (id: string) =>
      sendApiRequest<{ ok: true }>(
        `/admin/inbox/${encodeURIComponent(id)}`,
        "DELETE",
      ),
    bulkDelete: (bulkId: string) =>
      sendApiRequest<{ deleted: number }>(
        "/admin/inbox/bulk-delete",
        "POST",
        undefined,
        { bulkId },
      ),
  },
};
