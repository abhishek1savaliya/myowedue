"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Globe, LoaderCircle, Lock, PlayCircle, Trash2, Upload, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import ModalPortal from "@/components/ModalPortal";
import ProgressBar from "@/components/ProgressBar";

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let unit = -1;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  if (value < 1) return "less than a second";
  if (value < 60) return `${value} sec`;
  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function fileLabel(file) {
  if (isPdfFile(file)) return "PDF";
  if (String(file?.mimeType || "").startsWith("image/")) return "Image";
  if (String(file?.mimeType || "").startsWith("video/")) return "Video";
  return "File";
}

function isPdfFile(file) {
  return String(file?.mimeType || "").toLowerCase() === "application/pdf" || String(file?.extension || "").toLowerCase() === "pdf";
}

function isImageFile(file) {
  return !isPdfFile(file) && (file?.resourceType === "image" || String(file?.mimeType || "").startsWith("image/"));
}

function isVideoFile(file) {
  return file?.resourceType === "video" || String(file?.mimeType || "").startsWith("video/");
}

function canPreviewFile(file) {
  return Boolean(file?.secureUrl && (isImageFile(file) || isVideoFile(file)));
}

const initialUploadState = {
  title: "",
  isPublic: false,
};

const FILE_PAGE_SIZE = 12;
const MAX_UPLOAD_FILES = 15;

const initialUploadProgress = {
  percent: 0,
  loaded: 0,
  total: 0,
  remainingSeconds: null,
  status: "idle",
};

function uploadToCloudinary(uploadUrl, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const startedAt = Date.now();
    let latestTotal = 0;

    request.open("POST", uploadUrl);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1);
      const loaded = Number(event.loaded || 0);
      const total = Number(event.total || 0);
      latestTotal = total;
      const bytesPerSecond = loaded / elapsedSeconds;
      const remainingSeconds = bytesPerSecond > 0 ? (total - loaded) / bytesPerSecond : null;

      onProgress({
        percent: Math.min(99, Math.round((loaded / total) * 100)),
        loaded,
        total,
        remainingSeconds,
        status: "uploading",
      });
    };

    request.onload = () => {
      let data = {};
      try {
        data = JSON.parse(request.responseText || "{}");
      } catch {
        data = {};
      }

      if (request.status >= 200 && request.status < 300) {
        onProgress({ percent: 100, loaded: latestTotal, total: latestTotal, remainingSeconds: 0, status: "saving" });
        resolve(data);
      } else {
        reject(new Error(data?.error?.message || "Cloud upload failed."));
      }
    };

    request.onerror = () => reject(new Error("Cloud upload failed."));
    request.onabort = () => reject(new Error("Upload was cancelled."));
    request.send(formData);
  });
}

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [usageBytes, setUsageBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false);
  const [filesNextCursor, setFilesNextCursor] = useState("");
  const [filesHasMore, setFilesHasMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [uploadState, setUploadState] = useState(initialUploadState);
  const [uploadProgress, setUploadProgress] = useState(initialUploadProgress);
  const [message, setMessage] = useState("");
  const loadMoreFilesRef = useRef(null);

  const usageRatio = useMemo(() => {
    if (!quotaBytes) return 0;
    return Math.min(100, (usageBytes / quotaBytes) * 100);
  }, [quotaBytes, usageBytes]);

  const usagePercentLabel = useMemo(() => {
    if (!usageRatio) return "0%";
    if (usageRatio < 1) return "<1%";
    if (usageRatio < 10) return `${usageRatio.toFixed(1)}%`;
    return `${Math.round(usageRatio)}%`;
  }, [usageRatio]);

  const selectedFiles = useMemo(() => {
    const selectedIds = new Set(selectedFileIds);
    return files.filter((file) => selectedIds.has(file.id));
  }, [files, selectedFileIds]);

  const allLoadedFilesSelected = files.length > 0 && selectedFileIds.length === files.length;
  const selectedUploadTotalBytes = useMemo(
    () => selectedUploadFiles.reduce((total, file) => total + Number(file.size || 0), 0),
    [selectedUploadFiles]
  );

  async function loadInitial() {
    setLoading(true);
    const response = await fetch(`/api/files?limit=${FILE_PAGE_SIZE}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.message || "Failed to load files.");
      setLoading(false);
      return;
    }

    setFiles(data.files || []);
    setSelectedFileIds([]);
    setFilesNextCursor(data.filesNextCursor || "");
    setFilesHasMore(Boolean(data.filesHasMore));
    setAccessRequests(data.accessRequests || []);
    setUsageBytes(Number(data.usageBytes || 0));
    setQuotaBytes(Number(data.quotaBytes || 0));
    setIsPremium(Boolean(data.isPremium));
    setLoading(false);
  }

  const loadMoreFiles = useCallback(async () => {
    if (loadingMoreFiles || !filesHasMore || !filesNextCursor) return;

    setLoadingMoreFiles(true);
    const params = new URLSearchParams({
      scope: "files",
      limit: String(FILE_PAGE_SIZE),
      cursor: filesNextCursor,
    });
    const response = await fetch(`/api/files?${params.toString()}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setLoadingMoreFiles(false);

    if (!response.ok) {
      setMessage(data.message || "Failed to load more files.");
      return;
    }

    setFiles((prev) => {
      const knownIds = new Set(prev.map((file) => file.id));
      const nextFiles = (data.files || []).filter((file) => !knownIds.has(file.id));
      return [...prev, ...nextFiles];
    });
    setFilesNextCursor(data.filesNextCursor || "");
    setFilesHasMore(Boolean(data.filesHasMore));
  }, [filesHasMore, filesNextCursor, loadingMoreFiles]);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (loading || loadingMoreFiles || !filesHasMore) return;

    const target = loadMoreFilesRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreFiles();
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filesHasMore, loadMoreFiles, loading, loadingMoreFiles]);

  useEffect(() => {
    if (!previewFile) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setPreviewFile(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewFile]);

  useEffect(() => {
    if (!deleteTarget) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setDeleteTarget(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget]);

  useEffect(() => {
    if (!bulkDeleteOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape" && workingId !== "bulk-delete") setBulkDeleteOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bulkDeleteOpen, workingId]);

  function handleFilePick(event) {
    const pickedFiles = Array.from(event.target.files || []);
    const nextFiles = pickedFiles.slice(0, MAX_UPLOAD_FILES);
    setSelectedUploadFiles(nextFiles);
    setUploadProgress(initialUploadProgress);
    setMessage("");
    if (pickedFiles.length > MAX_UPLOAD_FILES) {
      setMessage(`You can upload up to ${MAX_UPLOAD_FILES} files at once. Only the first ${MAX_UPLOAD_FILES} were selected.`);
    }
    if (nextFiles.length === 1 && !uploadState.title) {
      setUploadState((prev) => ({
        ...prev,
        title: String(nextFiles[0].name || "").replace(/\.[^.]+$/, "") || prev.title,
      }));
    } else if (nextFiles.length > 1) {
      setUploadState((prev) => ({ ...prev, title: "" }));
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (selectedUploadFiles.length === 0 || uploading) return;

    setUploading(true);
    setUploadProgress({
      percent: 0,
      loaded: 0,
      total: selectedUploadTotalBytes,
      remainingSeconds: null,
      status: "preparing",
    });
    setMessage("");

    try {
      const uploadedFiles = [];
      let completedBytes = 0;
      const startedAt = Date.now();

      for (let index = 0; index < selectedUploadFiles.length; index += 1) {
        const uploadFile = selectedUploadFiles[index];

        setUploadProgress((prev) => ({
          ...prev,
          status: "preparing",
          currentFileName: uploadFile.name,
          currentFileIndex: index + 1,
          fileCount: selectedUploadFiles.length,
        }));

        const signatureResponse = await fetch("/api/files/upload-signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadFile.name,
            mimeType: uploadFile.type,
            size: uploadFile.size,
          }),
        });
        const signatureData = await signatureResponse.json().catch(() => ({}));
        if (!signatureResponse.ok) {
          throw new Error(signatureData.message || `Failed to prepare ${uploadFile.name}.`);
        }

        const cloudinaryForm = new FormData();
        cloudinaryForm.append("file", uploadFile);
        cloudinaryForm.append("api_key", signatureData.apiKey);
        cloudinaryForm.append("timestamp", String(signatureData.timestamp));
        cloudinaryForm.append("signature", signatureData.signature);
        cloudinaryForm.append("folder", signatureData.folder);
        cloudinaryForm.append("public_id", signatureData.publicId);
        cloudinaryForm.append("filename_override", signatureData.filenameOverride);

        const uploadData = await uploadToCloudinary(signatureData.uploadUrl, cloudinaryForm, (progress) => {
          const loaded = Math.min(Number(progress.loaded || 0), Number(uploadFile.size || 0));
          const totalLoaded = completedBytes + loaded;
          const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1);
          const bytesPerSecond = totalLoaded / elapsedSeconds;
          const remainingSeconds = bytesPerSecond > 0 ? (selectedUploadTotalBytes - totalLoaded) / bytesPerSecond : null;

          setUploadProgress({
            percent: Math.min(99, Math.round((totalLoaded / selectedUploadTotalBytes) * 100)),
            loaded: totalLoaded,
            total: selectedUploadTotalBytes,
            remainingSeconds,
            status: progress.status === "saving" ? "saving" : "uploading",
            currentFileName: uploadFile.name,
            currentFileIndex: index + 1,
            fileCount: selectedUploadFiles.length,
          });
        });

        const saveResponse = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: selectedUploadFiles.length === 1 ? uploadState.title : "",
            isPublic: uploadState.isPublic,
            originalName: uploadFile.name,
            mimeType: uploadFile.type,
            bytes: uploadData.bytes || uploadFile.size,
            publicId: uploadData.public_id,
            resourceType: uploadData.resource_type || signatureData.resourceType,
            cloudinaryType: uploadData.type || "upload",
            format: uploadData.format || "",
            version: uploadData.version || 0,
            secureUrl: uploadData.secure_url,
            thumbnailUrl: uploadData.resource_type === "image" ? uploadData.secure_url : "",
            width: uploadData.width ?? null,
            height: uploadData.height ?? null,
          }),
        });
        const saveData = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok) {
          throw new Error(saveData.message || `Failed to save ${uploadFile.name}.`);
        }

        completedBytes += Number(uploadFile.size || 0);
        if (saveData.file) uploadedFiles.push(saveData.file);
      }

      setSelectedUploadFiles([]);
      setUploadState(initialUploadState);
      setUploadProgress((prev) => ({ ...prev, percent: 100, loaded: selectedUploadTotalBytes, remainingSeconds: 0, status: "complete" }));
      setFiles((prev) => [...uploadedFiles.reverse(), ...prev]);
      setUsageBytes((prev) => prev + selectedUploadTotalBytes);
      setMessage(selectedUploadFiles.length === 1 ? "File uploaded successfully." : `${selectedUploadFiles.length} files uploaded successfully.`);

      const fileInput = document.getElementById("vault-file-input");
      if (fileInput) fileInput.value = "";
      loadInitial();
    } catch (caughtError) {
      setUploadProgress((prev) => ({ ...prev, status: "error" }));
      setMessage(caughtError?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleVisibility(file) {
    setWorkingId(file.id);
    setMessage("");

    const response = await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !file.isPublic }),
    });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to update visibility.");
      return;
    }

    setFiles((prev) => prev.map((item) => (item.id === file.id ? data.file : item)));
    setMessage(data.message || "Visibility updated.");
  }

  async function removeFile(file) {
    setWorkingId(file.id);
    setMessage("");

    const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to delete file.");
      return;
    }

    setDeleteTarget(null);
    setSelectedFileIds((prev) => prev.filter((id) => id !== file.id));
    setFiles((prev) => prev.filter((item) => item.id !== file.id));
    setUsageBytes((prev) => Math.max(0, prev - Number(file.bytes || 0)));
    setMessage(data.message || "File deleted.");
    loadInitial();
  }

  async function removeSelectedFiles() {
    if (selectedFileIds.length === 0) return;

    setWorkingId("bulk-delete");
    setMessage("");

    const response = await fetch("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedFileIds }),
    });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to delete selected files.");
      return;
    }

    const deletedIds = new Set(data.deletedIds || selectedFileIds);
    const deletedBytes = files
      .filter((file) => deletedIds.has(file.id))
      .reduce((total, file) => total + Number(file.bytes || 0), 0);

    setBulkDeleteOpen(false);
    setSelectedFileIds([]);
    setFiles((prev) => prev.filter((file) => !deletedIds.has(file.id)));
    setUsageBytes((prev) => Math.max(0, prev - deletedBytes));
    setMessage(data.message || "Selected files deleted.");
    loadInitial();
  }

  function toggleFileSelection(fileId) {
    setSelectedFileIds((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]));
  }

  function toggleAllLoadedFiles() {
    setSelectedFileIds(allLoadedFilesSelected ? [] : files.map((file) => file.id));
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
    } catch {
      setMessage("Copy failed on this browser.");
    }
  }

  async function respondToRequest(requestId, status) {
    setWorkingId(requestId);
    setMessage("");

    const response = await fetch(`/api/files/access-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to update the request.");
      return;
    }

    setAccessRequests((prev) => prev.filter((item) => item.id !== requestId));
    setMessage(data.message || "Access request updated.");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Files</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Store photos, documents, and other files in Cloudinary. Free users get 1 GB of space, and premium users get 10 GB. Public links open instantly, while private links let signed-in users request access from you.
        </p>
      </header>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Storage</p>
            <h2 className="mt-2 text-2xl font-semibold text-black">
              {formatBytes(usageBytes)} used of {formatBytes(quotaBytes)}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {isPremium ? "Premium vault unlocked" : "Free vault"} with {isPremium ? "10 GB" : "1 GB"} total storage.
            </p>
          </div>
          <div className="min-w-[220px] flex-1 lg:max-w-md">
            <ProgressBar
              value={usageRatio}
              label="Storage used"
              minVisibleValue={1}
              fillClassName={isPremium ? "bg-linear-to-r from-amber-400 via-orange-500 to-rose-500" : "bg-linear-to-r from-zinc-800 to-zinc-500"}
            />
            <p className="mt-2 text-right text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{usagePercentLabel} used</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleUpload} className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Upload</p>
            <h2 className="mt-2 text-xl font-semibold text-black">Add a new file</h2>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
            <Upload className="h-7 w-7 text-zinc-500" />
            <span className="mt-3 text-sm font-medium text-zinc-700">
              {selectedUploadFiles.length === 1
                ? selectedUploadFiles[0].name
                : selectedUploadFiles.length > 1
                  ? `${selectedUploadFiles.length} files selected`
                  : "Choose photos or files"}
            </span>
            <span className="mt-1 text-xs text-zinc-500">
              {selectedUploadFiles.length > 0
                ? `${formatBytes(selectedUploadTotalBytes)} total. You can upload up to ${MAX_UPLOAD_FILES} files at once.`
                : "The upload goes directly to Cloudinary with a signed request."}
            </span>
            <input id="vault-file-input" type="file" multiple onChange={handleFilePick} disabled={uploading} className="hidden" />
          </label>

          <input
            value={uploadState.title}
            onChange={(event) => setUploadState((prev) => ({ ...prev, title: event.target.value }))}
            placeholder={selectedUploadFiles.length > 1 ? "Titles use each file name for batch uploads" : "Title (optional)"}
            disabled={selectedUploadFiles.length > 1 || uploading}
            className="w-full rounded-xl border border-zinc-300 px-3 py-3 disabled:bg-zinc-100 disabled:text-zinc-500"
          />

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-black">Make link public</p>
              <p className="text-xs text-zinc-500">Private links require your approval before another signed-in user can open them.</p>
            </div>
            <button
              type="button"
              onClick={() => setUploadState((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                uploadState.isPublic ? "bg-emerald-100 text-emerald-700" : "bg-zinc-900 text-white"
              }`}
            >
              {uploadState.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {uploadState.isPublic ? "Public" : "Private"}
            </button>
          </label>

          <button
            type="submit"
            disabled={selectedUploadFiles.length === 0 || uploading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading
              ? "Uploading..."
              : selectedUploadFiles.length > 1
                ? `Upload ${selectedUploadFiles.length} Files`
                : "Upload File"}
          </button>

          {uploadProgress.status !== "idle" ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-black">
                  {uploadProgress.status === "preparing"
                    ? "Preparing upload"
                    : uploadProgress.status === "saving"
                      ? "Saving file"
                      : uploadProgress.status === "complete"
                        ? "Upload complete"
                        : uploadProgress.status === "error"
                          ? "Upload stopped"
                          : "Uploading"}
                </span>
                <span className="font-semibold text-black">{uploadProgress.percent}%</span>
              </div>
              {uploadProgress.currentFileName ? (
                <p className="mt-2 truncate text-xs text-zinc-500">
                  File {uploadProgress.currentFileIndex} of {uploadProgress.fileCount}: {uploadProgress.currentFileName}
                </p>
              ) : null}
              <ProgressBar value={uploadProgress.percent} label="Upload progress" size="sm" className="mt-3" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  {formatBytes(uploadProgress.loaded || 0)} of {formatBytes(uploadProgress.total || selectedUploadTotalBytes || 0)}
                </span>
                <span>
                  {uploadProgress.status === "saving"
                    ? "Almost done..."
                    : uploadProgress.status === "complete"
                      ? "Done"
                      : uploadProgress.remainingSeconds == null
                        ? "Calculating time..."
                        : `${formatDuration(uploadProgress.remainingSeconds)} left`}
                </span>
              </div>
            </div>
          ) : null}

          {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
        </form>

        <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Access Queue</p>
            <h2 className="mt-2 text-xl font-semibold text-black">Private link requests</h2>
          </div>

          {loading ? (
            <Loader label="Loading requests..." />
          ) : accessRequests.length === 0 ? (
            <EmptyState text="No pending file access requests right now." />
          ) : (
            <div className="space-y-3">
              {accessRequests.map((request) => (
                <article key={request.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-black">{request.requester?.name || "User"}</p>
                  <p className="mt-1 text-xs text-zinc-500">{request.requester?.email || "No email available"}</p>
                  <p className="mt-3 text-sm text-zinc-700">
                    Requested access to <span className="font-medium">{request.file?.title || request.file?.originalName || "your file"}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={workingId === request.id}
                      onClick={() => respondToRequest(request.id, "approved")}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={workingId === request.id}
                      onClick={() => respondToRequest(request.id, "rejected")}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Vault</p>
            <h2 className="mt-2 text-2xl font-semibold text-black">Your uploaded files</h2>
          </div>
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllLoadedFiles}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm"
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                    allLoadedFilesSelected ? "border-black bg-black text-white" : "border-zinc-300 bg-white"
                  }`}
                >
                  {allLoadedFilesSelected ? <Check className="h-3 w-3" /> : null}
                </span>
                {allLoadedFilesSelected ? "Clear Selection" : "Select Loaded"}
              </button>
              {selectedFileIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Selected ({selectedFileIds.length})
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading ? (
          <Loader label="Loading files..." />
        ) : files.length === 0 ? (
          <EmptyState text="No files uploaded yet." />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {files.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                const showSelectionControl = selectedFileIds.length > 0;

                return (
                <article
                  key={file.id}
                  className={`relative overflow-hidden rounded-3xl border bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)] ${
                    isSelected ? "border-black ring-2 ring-black/10" : "border-zinc-200"
                  }`}
                >
                  {showSelectionControl ? (
                    <button
                      type="button"
                      onClick={() => toggleFileSelection(file.id)}
                      className={`absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${
                        isSelected ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-transparent"
                      }`}
                      aria-label={isSelected ? `Unselect ${file.title}` : `Select ${file.title}`}
                      aria-pressed={isSelected}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : null}
                  {canPreviewFile(file) ? (
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="group relative block aspect-[4/3] w-full overflow-hidden bg-zinc-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      aria-label={`Open ${file.title}`}
                    >
                      {isVideoFile(file) ? (
                        <>
                          <video src={file.secureUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
                            <PlayCircle className="h-14 w-14 text-white drop-shadow" />
                          </span>
                        </>
                      ) : (
                        <img src={file.previewUrl || file.secureUrl} alt={file.title} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
                      )}
                    </button>
                  ) : file.previewUrl ? (
                    <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                      <img src={file.previewUrl} alt={`${file.title} preview`} className="h-full w-full object-cover" />
                      {isPdfFile(file) ? (
                        <span className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow">
                          PDF
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#18181b_0%,#27272a_45%,#52525b_100%)] text-white">
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">{fileLabel(file)}</p>
                        <p className="mt-3 text-lg font-semibold">{file.extension ? `.${file.extension}` : "Stored"}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-black">{file.title}</h3>
                        <p className="mt-1 truncate text-sm text-zinc-500">{file.originalName}</p>
                      </div>
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                          file.isPublic ? "bg-emerald-100 text-emerald-700" : "bg-zinc-900 text-white"
                        }`}
                        title={file.isPublic ? "Public" : "Private"}
                        aria-label={file.isPublic ? "Public file" : "Private file"}
                      >
                        {file.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      <span>{fileLabel(file)}</span>
                      <span>{formatBytes(file.bytes)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(file.shareUrl, "Share link copied.")}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </button>
                      <Link
                        href={file.sharePath}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        View Link
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={workingId === file.id}
                        onClick={() => toggleVisibility(file)}
                        className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {file.isPublic ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                        {file.isPublic ? "Make Private" : "Make Public"}
                      </button>
                      <a
                        href={`/api/file-share/${file.shareToken}/download`}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        disabled={workingId === file.id}
                        onClick={() => setDeleteTarget(file)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>

            <div ref={loadMoreFilesRef} className="flex min-h-16 items-center justify-center pt-2">
              {loadingMoreFiles ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 shadow-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading more files...
                </span>
              ) : filesHasMore ? (
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Scroll for more</span>
              ) : (
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">All files loaded</span>
              )}
            </div>
          </>
        )}
      </section>

      {previewFile ? (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto bg-black/80 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={previewFile.title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewFile(null);
          }}
        >
          <div className="relative max-h-full w-full max-w-6xl">
            <button
              type="button"
              onClick={() => setPreviewFile(null)}
              className="absolute right-0 top-0 z-10 inline-flex h-10 w-10 -translate-y-12 items-center justify-center rounded-full bg-white text-black shadow-lg"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="max-h-[85vh] overflow-hidden rounded-2xl bg-black shadow-2xl">
              {isVideoFile(previewFile) ? (
                <video key={previewFile.id} src={previewFile.secureUrl} controls autoPlay playsInline className="max-h-[85vh] w-full bg-black object-contain" />
              ) : (
                <img src={previewFile.secureUrl} alt={previewFile.title} className="max-h-[85vh] w-full object-contain" />
              )}
            </div>
            <div className="mt-3 text-white">
              <p className="text-sm font-semibold">{previewFile.title}</p>
              <p className="mt-1 text-xs text-white/70">{previewFile.originalName}</p>
            </div>
          </div>
        </div>
        </ModalPortal>
      ) : null}

      {deleteTarget ? (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 flex min-h-dvh items-end justify-center overflow-y-auto bg-black/60 px-3 py-0 sm:items-center sm:px-4 sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-file-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && workingId !== deleteTarget.id) setDeleteTarget(null);
          }}
        >
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Delete File</p>
                <h2 id="delete-file-title" className="mt-2 text-xl font-semibold text-black">
                  Delete this file?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={workingId === deleteTarget.id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 disabled:opacity-60"
                aria-label="Close delete confirmation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="break-words text-sm font-semibold text-black">{deleteTarget.originalName}</p>
              <p className="mt-2 text-xs text-zinc-500">
                This will remove the file from your vault and delete the stored cloud asset.
              </p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={workingId === deleteTarget.id}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeFile(deleteTarget)}
                disabled={workingId === deleteTarget.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {workingId === deleteTarget.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {workingId === deleteTarget.id ? "Deleting..." : "Delete File"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      ) : null}

      {bulkDeleteOpen ? (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 flex min-h-dvh items-end justify-center overflow-y-auto bg-black/60 px-3 py-0 sm:items-center sm:px-4 sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-file-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && workingId !== "bulk-delete") setBulkDeleteOpen(false);
          }}
        >
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Delete Files</p>
                <h2 id="bulk-delete-file-title" className="mt-2 text-xl font-semibold text-black">
                  Delete {selectedFileIds.length} selected {selectedFileIds.length === 1 ? "file" : "files"}?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={workingId === "bulk-delete"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 disabled:opacity-60"
                aria-label="Close bulk delete confirmation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 max-h-56 space-y-2 overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              {selectedFiles.slice(0, 8).map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-black">{file.originalName}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{formatBytes(file.bytes)}</span>
                </div>
              ))}
              {selectedFiles.length > 8 ? (
                <p className="px-2 py-1 text-xs text-zinc-500">+{selectedFiles.length - 8} more selected files</p>
              ) : null}
            </div>

            <p className="mt-4 text-sm text-zinc-600">
              This will remove the selected files from your vault and delete their stored cloud assets.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={workingId === "bulk-delete"}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={removeSelectedFiles}
                disabled={workingId === "bulk-delete" || selectedFileIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {workingId === "bulk-delete" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {workingId === "bulk-delete" ? "Deleting..." : "Delete Selected"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
