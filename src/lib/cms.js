import { connectDB } from "@/lib/db";
import CMSPage from "@/models/CMSPage";
import CMSAuditLog from "@/models/CMSAuditLog";
import { CMS_PAGE_KEYS, getDefaultContentForKey } from "@/lib/cmsDefaults";

export function isValidCMSPageKey(key) {
  return CMS_PAGE_KEYS.includes(String(key || ""));
}

export function normalizeCmsRole(user) {
  const role = String(user?.cmsRole || "manager");
  if (["super_admin", "manager", "team_member"].includes(role)) return role;
  return "manager";
}

export function canAccessContentEditor(user) {
  const role = normalizeCmsRole(user);
  if (role === "super_admin" || role === "manager") return true;
  return Boolean(user?.contentEditPermission);
}

export function canPublishContent(user) {
  const role = normalizeCmsRole(user);
  return role === "super_admin" || role === "manager";
}

export function canReviewSubmissions(user) {
  return canPublishContent(user);
}

export function canManagePermissions(user) {
  const role = normalizeCmsRole(user);
  return role === "super_admin" || role === "manager";
}

export async function ensureCmsPage(pageKey) {
  await connectDB();
  const key = String(pageKey);
  let page = await CMSPage.findOne({ key });
  if (!page) {
    page = await CMSPage.create({
      key,
      content: getDefaultContentForKey(key),
      version: 1,
      publishedAt: new Date(),
    });
  }
  return page;
}

export async function getPublishedContent(pageKey) {
  const key = String(pageKey);
  if (!isValidCMSPageKey(key)) {
    return { key, content: {}, version: 0, fallback: true };
  }

  const page = await ensureCmsPage(key);
  return {
    key,
    content: page.content || getDefaultContentForKey(key),
    version: page.version || 1,
    publishedAt: page.publishedAt || page.updatedAt || page.createdAt,
    fallback: false,
  };
}

function diffWalk(previousValue, nextValue, path, bucket) {
  if (previousValue === nextValue) return;

  const previousType = Object.prototype.toString.call(previousValue);
  const nextType = Object.prototype.toString.call(nextValue);

  if (previousType !== "[object Object]" || nextType !== "[object Object]") {
    bucket.push({ field: path || "root", before: previousValue, after: nextValue });
    return;
  }

  const keys = new Set([...Object.keys(previousValue || {}), ...Object.keys(nextValue || {})]);
  for (const key of keys) {
    const childPath = path ? `${path}.${key}` : key;
    const before = previousValue?.[key];
    const after = nextValue?.[key];
    if (typeof before === "object" && before !== null && typeof after === "object" && after !== null && !Array.isArray(before) && !Array.isArray(after)) {
      diffWalk(before, after, childPath, bucket);
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      bucket.push({ field: childPath, before, after });
    }
  }
}

export function computeContentDiff(previousContent, nextContent) {
  const bucket = [];
  diffWalk(previousContent || {}, nextContent || {}, "", bucket);
  return bucket.slice(0, 200);
}

export async function createCmsAuditLog({
  action,
  pageKey = null,
  actorUserId,
  actorRole,
  targetUserId = null,
  submissionId = null,
  detail = "",
  diff = [],
  previousContent = null,
  updatedContent = null,
}) {
  await connectDB();
  await CMSAuditLog.create({
    action,
    pageKey,
    actorUserId,
    actorRole,
    targetUserId,
    submissionId,
    detail,
    diff,
    previousContent,
    updatedContent,
  });
}
