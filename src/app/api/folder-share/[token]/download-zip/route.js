import archiver from "archiver";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { fail } from "@/lib/api";
import { fetchCloudinaryBinary } from "@/lib/cloudinary";
import { getSessionUser } from "@/lib/session";
import Folder from "@/models/Folder";
import "@/models/StoredFile";
import { verifyFolderBulkDownloadAuth } from "@/lib/folder-share-download-auth";

function folderAccessCookieName(token) {
  return `folder_access_${token}`;
}

const MAX_ZIP_FILES = 40;
const MAX_ZIP_TOTAL_BYTES = 120 * 1024 * 1024;

function zipArchiveBaseName(folderName) {
  const raw = String(folderName || "shared-folder").trim() || "shared-folder";
  return (
    raw
      .replace(/[^\x20-\x7E]+/g, "_")
      .replace(/["\\;,]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "shared-folder"
  );
}

function zipEntryName(file, used) {
  const base = String(file.originalName || `file_${file._id}`).replace(/\\/g, "/").split("/").pop() || "file";
  const safe = base.replace(/[^\w.\- ()]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "file";
  let name = safe;
  let n = 1;
  while (used.has(name)) {
    const dot = safe.lastIndexOf(".");
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : "";
    name = `${stem}_${n}${ext}`.slice(0, 120);
    n += 1;
  }
  used.add(name);
  return name;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const rawIds = Array.isArray(body.fileIds) ? body.fileIds : [];
    const fileIds = [...new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean))];

    if (fileIds.length === 0) {
      return fail("Select at least one file.", 422);
    }
    if (fileIds.length > MAX_ZIP_FILES) {
      return fail(`You can download at most ${MAX_ZIP_FILES} files at once.`, 422);
    }

    await connectDB();

    const folder = await Folder.findOne({ shareToken: token }).populate("fileIds").lean();
    if (!folder) return fail("Folder not found", 404);

    const sessionUser = await getSessionUser(request);
    const isOwner = sessionUser ? String(sessionUser._id) === String(folder.userId) : false;
    const permissionType = folder.permissionType || (folder.isPublic ? "public" : "private");
    const cookieStore = await cookies();
    const hasPasswordAccess = cookieStore.get(folderAccessCookieName(token))?.value === "1";
    const bulkAuth = typeof body.bulkAuth === "string" ? body.bulkAuth : "";
    const hasBulkAuth = permissionType === "password" && verifyFolderBulkDownloadAuth(token, bulkAuth);
    const canZip =
      isOwner || permissionType === "public" || (permissionType === "password" && (hasPasswordAccess || hasBulkAuth));

    if (!canZip) {
      return fail(permissionType === "password" ? "Enter the folder password first." : "This folder is private.", 403);
    }

    const folderFiles = folder.fileIds || [];
    const selected = [];
    let totalBytes = 0;

    for (const id of fileIds) {
      const file = folderFiles.find((item) => String(item._id) === String(id));
      if (!file) {
        return fail("One or more files are not in this folder.", 400);
      }
      totalBytes += Number(file.bytes || 0);
      selected.push(file);
    }

    if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
      return fail(`Selected files exceed the ${Math.round(MAX_ZIP_TOTAL_BYTES / (1024 * 1024))} MB limit for a single ZIP.`, 422);
    }

    const archive = archiver("zip", { zlib: { level: 6 } });
    const usedNames = new Set();
    archive.on("error", () => {});

    void (async () => {
      try {
        for (const file of selected) {
          const upstream = await fetchCloudinaryBinary(file);
          if (!upstream.ok || !upstream.body) {
            throw new Error(`Could not read ${file.originalName || "file"} (HTTP ${upstream.status}).`);
          }
          const nodeIn = Readable.fromWeb(upstream.body);
          archive.append(nodeIn, { name: zipEntryName(file, usedNames) });
        }
        await archive.finalize();
      } catch (caught) {
        archive.abort();
        archive.emit("error", caught instanceof Error ? caught : new Error(String(caught)));
      }
    })();

    const webBody = Readable.toWeb(archive);
    const base = zipArchiveBaseName(folder.name);
    const disposition = `attachment; filename="${base}.zip"; filename*=UTF-8''${encodeURIComponent(`${base}.zip`)}`;

    return new NextResponse(webBody, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to build ZIP", 500);
  }
}
