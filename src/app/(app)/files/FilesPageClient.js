"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, version as reactVersion } from "react";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  Check,
  Copy,
  Folder,
  FolderOpen,
  FolderPlus,
  Globe,
  Grid2x2,
  LayoutGrid,
  List,
  LoaderCircle,
  Lock,
  MoreVertical,
  Play,
  Plus,
  Rows3,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import ModalPortal from "@/components/ModalPortal";
import PdfViewer from "@/components/PdfViewer";
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
  const extension = String(file?.extension || file?.originalName?.split(".").pop() || "").toLowerCase();
  return !isPdfFile(file) && (file?.resourceType === "image" || String(file?.mimeType || "").startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension));
}

function isVideoFile(file) {
  const extension = String(file?.extension || file?.originalName?.split(".").pop() || "").toLowerCase();
  return file?.resourceType === "video" || String(file?.mimeType || "").startsWith("video/") || ["mp4", "webm", "mov", "m4v", "avi"].includes(extension);
}

function canPreviewFile(file) {
  return Boolean(file?.secureUrl && (isPdfFile(file) || isImageFile(file) || isVideoFile(file)));
}

function previewSource(file) {
  return file?.previewUrl || file?.thumbnailUrl || file?.secureUrl || "";
}

const initialUploadState = {
  title: "",
  isPublic: false,
};

const FILE_PAGE_SIZE = 12;
const MAX_UPLOAD_FILES = 15;
const FILE_VIEW_STORAGE_KEY = "owedue:file-view";
const CAN_USE_VIDSTACK_PLAYER = !String(reactVersion || "").startsWith("19.");

const FILE_VIEW_OPTIONS = [
  { key: "list", label: "List", icon: List },
  { key: "small", label: "Small", icon: Rows3 },
  { key: "medium", label: "Medium", icon: Grid2x2 },
  { key: "large", label: "Large", icon: LayoutGrid },
];

const FILE_VIEW_CLASSES = {
  list: {
    grid: "grid gap-3",
    card: "group relative flex min-w-0 overflow-visible rounded-lg border border-zinc-200 bg-white shadow-sm [content-visibility:auto] [contain-intrinsic-size:96px]",
    previewWrap: "h-24 w-24 shrink-0 overflow-hidden rounded-l-lg bg-zinc-100 cursor-pointer",
    fallbackWrap: "flex h-24 w-24 shrink-0 items-center justify-center rounded-l-lg bg-zinc-100",
    info: "min-w-0 flex-1 p-3 pr-12",
    title: "truncate text-sm font-medium text-black",
  },
  small: {
    grid: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
    card: "group relative overflow-visible rounded-lg border border-zinc-200 bg-white shadow-sm [content-visibility:auto] [contain-intrinsic-size:210px]",
    previewWrap: "aspect-square overflow-hidden rounded-t-lg bg-zinc-100 cursor-pointer",
    fallbackWrap: "flex aspect-square items-center justify-center rounded-t-lg bg-zinc-100",
    info: "p-3",
    title: "truncate text-sm font-medium text-black",
  },
  medium: {
    grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    card: "group relative overflow-visible rounded-lg border border-zinc-200 bg-white shadow-sm [content-visibility:auto] [contain-intrinsic-size:270px]",
    previewWrap: "aspect-square overflow-hidden rounded-t-lg bg-zinc-100 cursor-pointer",
    fallbackWrap: "flex aspect-square items-center justify-center rounded-t-lg bg-zinc-100",
    info: "p-3",
    title: "truncate text-sm font-medium text-black",
  },
  large: {
    grid: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
    card: "group relative overflow-visible rounded-lg border border-zinc-200 bg-white shadow-sm [content-visibility:auto] [contain-intrinsic-size:360px]",
    previewWrap: "aspect-[4/3] overflow-hidden rounded-t-lg bg-zinc-100 cursor-pointer",
    fallbackWrap: "flex aspect-[4/3] items-center justify-center rounded-t-lg bg-zinc-100",
    info: "p-4",
    title: "truncate text-base font-semibold text-black",
  },
};

const initialUploadProgress = {
  percent: 0,
  loaded: 0,
  total: 0,
  remainingSeconds: null,
  status: "idle",
};

const BULK_ADD_WORKING_ID = "add-to-folder-bulk";
const BULK_DELETE_WORKING_ID = "delete-files-bulk";

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

export default function FilesPageClient() {
  // File states
  const [files, setFiles] = useState([]);
  const [usageBytes, setUsageBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false);
  const [filesNextCursor, setFilesNextCursor] = useState("");
  const [filesHasMore, setFilesHasMore] = useState(false);

  // Folder states
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderMenuOpenId, setFolderMenuOpenId] = useState("");
  const [editFolderModal, setEditFolderModal] = useState({ open: false, folder: null });
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderPasswordsModal, setFolderPasswordsModal] = useState({ open: false, folderId: "", passwords: [], loading: false });
  const [folderPasswordEvents, setFolderPasswordEvents] = useState({ events: [], loading: false });
  const [addPasswordInput, setAddPasswordInput] = useState("");
  const [addPasswordHint, setAddPasswordHint] = useState("");

  // File interaction states
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadState, setUploadState] = useState(initialUploadState);
  const [uploadProgress, setUploadProgress] = useState(initialUploadProgress);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [message, setMessage] = useState("");

  // File menu states
  const [fileMenuOpenId, setFileMenuOpenId] = useState("");
  const [addToFolderModal, setAddToFolderModal] = useState({ open: false, fileIds: [], selectedFolderId: "" });
  const [folderSearchTerm, setFolderSearchTerm] = useState("");
  const [fileView, setFileView] = useState("medium");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [existingInFolderConfirm, setExistingInFolderConfirm] = useState({
    open: false,
    folderId: "",
    folderName: "",
    duplicates: [],
    fileIds: [],
  });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({ open: false, fileIds: [] });

  const loadMoreFilesRef = useRef(null);

  // Memos
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

  const selectedUploadTotalBytes = useMemo(
    () => selectedUploadFiles.reduce((total, file) => total + Number(file.size || 0), 0),
    [selectedUploadFiles]
  );

  const filteredFilesForFolder = useMemo(() => {
    if (selectedFolderId === "all") return files;
    const folder = folders.find((f) => f.id === selectedFolderId);
    if (!folder) return [];
    const folderFileIds = new Set(folder.fileIds || []);
    return files.filter((file) => folderFileIds.has(file.id));
  }, [files, folders, selectedFolderId]);

  const filteredFolders = useMemo(() => {
    if (!folderSearchTerm) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(folderSearchTerm.toLowerCase()));
  }, [folders, folderSearchTerm]);

  const selectedFolder = useMemo(
    () => (selectedFolderId === "all" ? null : folders.find((folder) => folder.id === selectedFolderId) || null),
    [folders, selectedFolderId]
  );

  const fileViewClasses = FILE_VIEW_CLASSES[fileView] || FILE_VIEW_CLASSES.medium;

  const selectedCount = selectedFileIds.length;

  useEffect(() => {
    if (!message) return undefined;

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setFolderMenuOpenId("");
      setFileMenuOpenId("");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!folderMenuOpenId && !fileMenuOpenId) return undefined;

    function handleDocumentClick(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-files-menu-root]")) return;

      setFolderMenuOpenId("");
      setFileMenuOpenId("");
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [folderMenuOpenId, fileMenuOpenId]);

  useEffect(() => {
    if (!folderMenuOpenId && !fileMenuOpenId) return undefined;

    // Use position:fixed scroll lock to avoid layout shifts.
    const scrollY = window.scrollY || 0;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    function preventBackgroundScroll(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-files-menu-root]")) return;
      event.preventDefault();
    }

    // Prevent iOS overscroll bounce behind the sheet.
    document.addEventListener("touchmove", preventBackgroundScroll, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventBackgroundScroll);
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.overflow = previousBodyOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [folderMenuOpenId, fileMenuOpenId]);

  function toggleSelectedFile(fileId) {
    setSelectedFileIds((prev) => {
      if (prev.includes(fileId)) return prev.filter((id) => id !== fileId);
      return [...prev, fileId];
    });
  }

  // Load functions
  async function loadFiles() {
    setLoading(true);
    const response = await fetch(`/api/files?limit=${FILE_PAGE_SIZE}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.message || "Failed to load files.");
      setLoading(false);
      return;
    }

    setFiles(data.files || []);
    setFilesNextCursor(data.filesNextCursor || "");
    setFilesHasMore(Boolean(data.filesHasMore));
    setUsageBytes(Number(data.usageBytes || 0));
    setQuotaBytes(Number(data.quotaBytes || 0));
    setIsPremium(Boolean(data.isPremium));
    setLoading(false);
  }

  async function loadFolders() {
    setLoadingFolders(true);
    const response = await fetch("/api/folders", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setFolders(data.folders || []);
    }
    setLoadingFolders(false);
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

  // Lifecycle
  useEffect(() => {
    loadFiles();
    loadFolders();
  }, []);

  useEffect(() => {
    const savedView = window.localStorage.getItem(FILE_VIEW_STORAGE_KEY);
    if (FILE_VIEW_OPTIONS.some((option) => option.key === savedView)) {
      setFileView(savedView);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FILE_VIEW_STORAGE_KEY, fileView);
  }, [fileView]);

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

  // File upload
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
      setUploadModalOpen(false);

      const fileInput = document.getElementById("vault-file-input");
      if (fileInput) fileInput.value = "";
      loadFiles();
    } catch (caughtError) {
      setUploadProgress((prev) => ({ ...prev, status: "error" }));
      setMessage(caughtError?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // Folder operations
  async function createFolder() {
    if (!newFolderName.trim()) {
      setMessage("Folder name is required");
      return;
    }

    setWorkingId("create-folder");
    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName }),
    });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to create folder");
      return;
    }

    setNewFolderName("");
    setNewFolderModal(false);
    setMessage("Folder created successfully");
    loadFolders();
  }

  async function updateFolder(folder, updates) {
    setWorkingId(`edit-${folder.id}`);
    const response = await fetch(`/api/folders/${folder.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to update folder");
      return;
    }

    setEditFolderModal({ open: false, folder: null });
    setMessage("Folder updated successfully");
    loadFolders();
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
    } catch {
      setMessage("Copy failed on this browser.");
    }
  }

  async function deleteFolder(folderId) {
    setWorkingId(`delete-${folderId}`);
    const response = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to delete folder");
      return;
    }

    if (selectedFolderId === folderId) {
      setSelectedFolderId("all");
    }
    setFolderMenuOpenId("");
    setMessage("Folder deleted successfully");
    loadFolders();
  }

  async function addFileToFolder(fileId, folderId) {
    return addFilesToFolder([fileId], folderId);
  }

  async function addFilesToFolder(fileIds, folderId) {
    const ids = Array.from(new Set((fileIds || []).filter(Boolean)));
    if (!folderId || folderId === "all" || ids.length === 0) return;

    setWorkingId(BULK_ADD_WORKING_ID);
    setAddToFolderModal({ open: false, fileIds: [], selectedFolderId: "" });
    setFolderSearchTerm("");
    setMessage(ids.length === 1 ? "Adding file to folder..." : `Adding ${ids.length} files to folder...`);

    try {
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(`/api/folders/${folderId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: id }),
        });
        // eslint-disable-next-line no-await-in-loop
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Failed to add file to folder");
      }

      setFileMenuOpenId("");
      setSelectedFileIds([]);
      setSelectionMode(false);
      setMessage(ids.length === 1 ? "File added to folder successfully" : `${ids.length} files added to folder successfully`);
      loadFolders();
    } catch (caughtError) {
      setMessage(caughtError?.message || "Failed to add file to folder");
    } finally {
      setWorkingId("");
    }
  }

  async function removeFileFromFolder(fileId, folderId) {
    setWorkingId(`remove-from-folder-${fileId}`);
    const response = await fetch(`/api/folders/${folderId}/files`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to remove file from folder");
      return;
    }

    setMessage("File removed from folder successfully");
    loadFolders();
  }

  async function loadFolderPasswords(folderId) {
    const response = await fetch(`/api/folders/${folderId}/passwords`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setFolderPasswordsModal((prev) => ({ ...prev, passwords: data.passwords || [] }));
    }
  }

  async function loadFolderPasswordEvents(folderId) {
    setFolderPasswordEvents((prev) => ({ ...prev, loading: true }));
    const response = await fetch(`/api/folders/${folderId}/password-events`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setFolderPasswordEvents({ events: response.ok ? data.events || [] : [], loading: false });
  }

  async function addFolderPassword(folderId) {
    if (!addPasswordInput.trim()) {
      setMessage("Password is required");
      return;
    }

    setFolderPasswordsModal((prev) => ({ ...prev, loading: true }));
    const response = await fetch(`/api/folders/${folderId}/passwords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: addPasswordInput, hint: addPasswordHint }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.message || "Failed to add password");
      setFolderPasswordsModal((prev) => ({ ...prev, loading: false }));
      return;
    }

    setAddPasswordInput("");
    setAddPasswordHint("");
    setMessage(data.message || "Password added successfully");
    await loadFolderPasswords(folderId);
    setFolderPasswordsModal((prev) => ({ ...prev, loading: false }));
    loadFolders();
  }

  async function deleteFolderPassword(folderId, passwordId) {
    setWorkingId(`delete-pwd-${passwordId}`);
    const response = await fetch(`/api/folders/${folderId}/passwords/${passwordId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to delete password");
      return;
    }

    setMessage("Password deleted successfully");
    loadFolderPasswords(folderId);
  }

  // File operations
  async function toggleVisibility(file) {
    setWorkingId(file.id);
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

    const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setWorkingId("");

    if (!response.ok) {
      setMessage(data.message || "Failed to delete file.");
      return;
    }

    setDeleteTarget(null);
    setFiles((prev) => prev.filter((item) => item.id !== file.id));
    setUsageBytes((prev) => Math.max(0, prev - Number(file.bytes || 0)));
    setMessage(data.message || "File deleted.");
    loadFiles();
  }

  async function deleteFilesBulk(fileIds) {
    const ids = Array.from(new Set((fileIds || []).filter(Boolean)));
    if (ids.length === 0) return;

    setWorkingId(BULK_DELETE_WORKING_ID);
    setBulkDeleteConfirm({ open: false, fileIds: [] });
    setMessage(ids.length === 1 ? "Deleting file..." : `Deleting ${ids.length} files...`);

    const filesById = new Map(files.map((f) => [f.id, f]));

    try {
      for (const id of ids) {
        const response = await fetch(`/api/files/${id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Failed to delete file.");

        const deletedFile = filesById.get(id);
        if (deletedFile) {
          setUsageBytes((prev) => Math.max(0, prev - Number(deletedFile.bytes || 0)));
        }
      }

      setDeleteTarget(null);
      setFileMenuOpenId("");
      setSelectedFileIds([]);
      setSelectionMode(false);
      setFiles((prev) => prev.filter((file) => !ids.includes(file.id)));
      setMessage(ids.length === 1 ? "File deleted." : `${ids.length} files deleted.`);
      loadFiles();
    } catch (caughtError) {
      setMessage(caughtError?.message || "Failed to delete files.");
    } finally {
      setWorkingId("");
    }
  }

  function openFolderPasswords(folder) {
    setFolderPasswordsModal({ open: true, folderId: folder.id, passwords: [], loading: false });
    loadFolderPasswords(folder.id);
    loadFolderPasswordEvents(folder.id);
    setFolderMenuOpenId("");
  }

  function permissionLabel(permissionType) {
    if (permissionType === "public") return "Public";
    if (permissionType === "password") return "Password";
    return "Private";
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Files</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Organize your files with custom folders. Each folder can have password protection or be made public. Free users get 1 GB
          and premium users get 10 GB.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        {/* Left Sidebar - Folders */}
        <aside className="flex w-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:w-64 lg:shrink-0">
          <div className="mb-4 shrink-0 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Folders</h2>
            <button
              onClick={() => setNewFolderModal(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
          </div>

          <nav className="space-y-1">
            {/* All Files */}
            <button
              onClick={() => {
                setSelectedFolderId("all");
                setFolderMenuOpenId("");
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                selectedFolderId === "all" ? "bg-zinc-100 text-black" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                All
              </span>
              <span className="text-xs text-zinc-500">({files.length})</span>
            </button>

            {/* Custom Folders */}
            {loadingFolders ? (
              <div className="py-2 text-center text-xs text-zinc-500">Loading folders...</div>
            ) : folders.length === 0 ? (
              <div className="py-2 text-center text-xs text-zinc-500">No folders yet</div>
            ) : (
              folders.map((folder) => (
                <div key={folder.id} className="group relative">
                  <button
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setFolderMenuOpenId("");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                      selectedFolderId === folder.id ? "bg-zinc-100 text-black" : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <span className="text-xs text-zinc-500">{folder.fileCount}</span>
                  </button>

                  {/* Folder Menu */}
                  <div className="absolute right-0 top-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      onClick={() => setFolderMenuOpenId(folderMenuOpenId === folder.id ? "" : folder.id)}
                      className="rounded-md border border-zinc-200 bg-white/95 p-1 shadow-sm hover:bg-white"
                      aria-label={`Open menu for ${folder.name}`}
                      data-files-menu-root
                    >
                      <MoreVertical className="h-4 w-4 text-zinc-500" />
                    </button>
                  </div>

                  {folderMenuOpenId === folder.id && (
                    <>
                      <ModalPortal>
                        <div
                          className="fixed inset-0 z-[2147483647] md:hidden"
                          onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setFolderMenuOpenId("");
                          }}
                        >
                          <div
                            className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-auto overscroll-contain rounded-t-2xl border border-[#374151] bg-[#111827] py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl touch-pan-y"
                            data-files-menu-root
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setEditFolderModal({ open: true, folder });
                                setFolderMenuOpenId("");
                              }}
                              className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                            >
                              Edit Folder
                            </button>
                            {folder.shareUrl ? (
                              <button
                                onClick={() => {
                                  copyText(folder.shareUrl, "Folder link copied.");
                                  setFolderMenuOpenId("");
                                }}
                                className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                              >
                                Copy Folder Link
                              </button>
                            ) : null}
                            {folder.sharePath ? (
                              <Link
                                href={folder.sharePath}
                                target="_blank"
                                onClick={() => setFolderMenuOpenId("")}
                                className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                              >
                                View Folder Link
                              </Link>
                            ) : null}
                            <button
                              onClick={() => openFolderPasswords(folder)}
                              className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                            >
                              Manage Passwords
                            </button>
                            <button
                              onClick={() => {
                                deleteFolder(folder.id);
                              }}
                              className="block w-full px-4 py-2 text-left text-sm font-medium text-[#fb7185] hover:bg-[#1f2937]"
                            >
                              Delete Folder
                            </button>
                          </div>
                        </div>
                      </ModalPortal>
                      <div
                        className="absolute right-0 top-full z-[2147483647] mt-1 hidden w-48 overflow-hidden rounded-lg border border-[#374151] bg-[#111827] py-1 shadow-lg md:block"
                        data-files-menu-root
                      >
                      <button
                        onClick={() => {
                          setEditFolderModal({ open: true, folder });
                          setFolderMenuOpenId("");
                        }}
                        className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                      >
                        Edit Folder
                      </button>
                      {folder.shareUrl ? (
                        <button
                          onClick={() => {
                            copyText(folder.shareUrl, "Folder link copied.");
                            setFolderMenuOpenId("");
                          }}
                          className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                        >
                          Copy Folder Link
                        </button>
                      ) : null}
                      {folder.sharePath ? (
                        <Link
                          href={folder.sharePath}
                          target="_blank"
                          onClick={() => setFolderMenuOpenId("")}
                          className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                        >
                          View Folder Link
                        </Link>
                      ) : null}
                      <button
                        onClick={() => openFolderPasswords(folder)}
                        className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                      >
                        Manage Passwords
                      </button>
                      <button
                        onClick={() => {
                          deleteFolder(folder.id);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm font-medium text-[#fb7185] hover:bg-[#1f2937]"
                      >
                        Delete Folder
                      </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 space-y-6">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            {/* Storage Info */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Storage</p>
                <h2 className="mt-2 text-2xl font-semibold text-black">
                  {formatBytes(usageBytes)} used of {formatBytes(quotaBytes)}
                </h2>
              </div>
              <div className="min-w-[220px] flex-1 lg:max-w-md">
                <ProgressBar
                  value={usageRatio}
                  label="Storage used"
                  minVisibleValue={1}
                  fillClassName={isPremium ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" : "bg-gradient-to-r from-zinc-800 to-zinc-500"}
                />
                <p className="mt-2 text-right text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{usagePercentLabel} used</p>
              </div>
            </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Upload</p>
                <h2 className="mt-2 text-xl font-semibold text-black">Add files</h2>
                <p className="mt-2 text-sm text-zinc-600">Upload up to {MAX_UPLOAD_FILES} files at once.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  if (uploadProgress.status === "complete") setUploadProgress(initialUploadProgress);
                  setUploadModalOpen(true);
                }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                Upload Files
              </button>
            </div>
          </section>

          {/* Files Grid */}
          {loading ? (
            <Loader />
          ) : filteredFilesForFolder.length === 0 ? (
            <EmptyState text={selectedFolderId === "all" ? "No files uploaded yet." : "No files in this folder."} />
          ) : (
            <>
              {selectedFolder ? (
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Selected Folder</p>
                      <h2 className="mt-2 text-xl font-semibold text-black">{selectedFolder.name}</h2>
                      <p className="mt-1 text-sm text-zinc-600">
                        {permissionLabel(selectedFolder.permissionType)} folder with {selectedFolder.fileCount || 0} linked files.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(selectedFolder.shareUrl, "Folder link copied.")}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </button>
                      <Link
                        href={selectedFolder.sharePath}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        View Link
                      </Link>
                    </div>
                  </div>
                </section>
              ) : null}
              <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Display</p>
                  <p className="mt-1 text-sm text-zinc-600">{filteredFilesForFolder.length} files shown</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {selectionMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedFileIds([]);
                        }}
                        className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={selectedCount === 0 || workingId === BULK_DELETE_WORKING_ID}
                        onClick={() => setBulkDeleteConfirm({ open: true, fileIds: selectedFileIds })}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                      >
                        {workingId === BULK_DELETE_WORKING_ID ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete {selectedCount ? `(${selectedCount})` : ""}
                      </button>
                      <button
                        type="button"
                        disabled={selectedCount === 0 || workingId === BULK_ADD_WORKING_ID}
                        onClick={() => {
                          setAddToFolderModal({ open: true, fileIds: selectedFileIds, selectedFolderId: "" });
                          setMessage("");
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {workingId === BULK_ADD_WORKING_ID ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Folder className="h-4 w-4" />}
                        Move to folder {selectedCount ? `(${selectedCount})` : ""}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode(true);
                        setSelectedFileIds([]);
                      }}
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Select
                    </button>
                  )}

                  <div className="grid grid-cols-4 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                    {FILE_VIEW_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = fileView === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setFileView(option.key)}
                          title={`${option.label} view`}
                          aria-label={`${option.label} view`}
                          aria-pressed={active}
                          className={`inline-flex h-9 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-semibold ${
                            active ? "bg-black text-white shadow-sm" : "text-zinc-600 hover:bg-white"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="sr-only">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            <div className={fileViewClasses.grid}>
              {filteredFilesForFolder.map((file) => (
                <div key={file.id} className={fileViewClasses.card}>
                  {selectionMode ? (
                    <button
                      type="button"
                      onClick={() => toggleSelectedFile(file.id)}
                      className="absolute left-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white/95 shadow-sm"
                      aria-label={selectedFileIds.includes(file.id) ? "Deselect file" : "Select file"}
                    >
                      {selectedFileIds.includes(file.id) ? <Check className="h-4 w-4 text-emerald-600" /> : <span className="h-4 w-4 rounded-sm border border-zinc-300" />}
                    </button>
                  ) : null}
                  {/* Preview Thumbnail */}
                  {canPreviewFile(file) ? (
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className={`${fileViewClasses.previewWrap} relative block text-left focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2`}
                      aria-label={`Preview ${file.title || file.originalName}`}
                    >
                      {isVideoFile(file) ? (
                        <>
                          <video
                            src={file.secureUrl}
                            muted
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-white shadow-lg">
                              <Play className="h-5 w-5 fill-current" />
                            </span>
                          </span>
                        </>
                      ) : (
                        <img
                          src={previewSource(file)}
                          alt={file.originalName}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </button>
                  ) : (
                    <div className={fileViewClasses.fallbackWrap}>
                      <Folder className="h-8 w-8 text-zinc-400" />
                    </div>
                  )}

                  {/* File Info */}
                  <div className={`${fileViewClasses.info} ${canPreviewFile(file) ? "cursor-pointer" : ""}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (canPreviewFile(file)) setPreviewFile(file);
                      }}
                      disabled={!canPreviewFile(file)}
                      className="block min-w-0 max-w-full text-left disabled:cursor-default"
                      aria-label={canPreviewFile(file) ? `Preview ${file.title || file.originalName}` : undefined}
                    >
                      <span className={`block ${fileViewClasses.title}`}>{file.title || file.originalName}</span>
                    </button>
                    <p className="text-xs text-zinc-500">{formatBytes(file.bytes)}</p>
                  </div>

                  {/* File Menu */}
                  <div className="absolute right-2 top-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      onClick={() => setFileMenuOpenId(fileMenuOpenId === file.id ? "" : file.id)}
                      className="rounded-md border border-zinc-200 bg-white/95 p-1 shadow-sm hover:bg-white"
                      aria-label={`Open menu for ${file.title || file.originalName}`}
                      data-files-menu-root
                    >
                      <MoreVertical className="h-4 w-4 text-zinc-500" />
                    </button>
                  </div>

                  {fileMenuOpenId === file.id && (
                    <>
                      <ModalPortal>
                        <div
                          className="fixed inset-0 z-[2147483647] md:hidden"
                          onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setFileMenuOpenId("");
                          }}
                        >
                          <div
                            className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-auto overscroll-contain rounded-t-2xl border border-[#374151] bg-[#111827] py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl touch-pan-y"
                            data-files-menu-root
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setAddToFolderModal({ open: true, fileIds: [file.id], selectedFolderId: "" });
                                setFileMenuOpenId("");
                              }}
                              className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                            >
                              Add to Folder
                            </button>
                            {selectedFolderId !== "all" ? (
                              <button
                                onClick={() => {
                                  removeFileFromFolder(file.id, selectedFolderId);
                                  setFileMenuOpenId("");
                                }}
                                className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                              >
                                Remove from Folder
                              </button>
                            ) : null}
                            <button
                              onClick={() => {
                                setDeleteTarget(file);
                                setFileMenuOpenId("");
                              }}
                              className="block w-full px-4 py-2 text-left text-sm font-medium text-[#fb7185] hover:bg-[#1f2937]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </ModalPortal>
                      <div
                        className="absolute right-0 top-8 z-[2147483647] hidden w-48 overflow-hidden rounded-lg border border-[#374151] bg-[#111827] py-1 shadow-lg md:block"
                        data-files-menu-root
                      >
                      <button
                        onClick={() => {
                          setAddToFolderModal({ open: true, fileIds: [file.id], selectedFolderId: "" });
                          setFileMenuOpenId("");
                        }}
                        className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                      >
                        Add to Folder
                      </button>
                      {selectedFolderId !== "all" ? (
                        <button
                          onClick={() => {
                            removeFileFromFolder(file.id, selectedFolderId);
                            setFileMenuOpenId("");
                          }}
                          className="block w-full px-4 py-2 text-left text-sm font-medium text-[#e5e7eb] hover:bg-[#1f2937]"
                        >
                          Remove from Folder
                        </button>
                      ) : null}
                      <button
                        onClick={() => {
                          setDeleteTarget(file);
                          setFileMenuOpenId("");
                        }}
                        className="block w-full px-4 py-2 text-left text-sm font-medium text-[#fb7185] hover:bg-[#1f2937]"
                      >
                        Delete
                      </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            </>
          )}

          {filesHasMore && <div ref={loadMoreFilesRef} className="py-8 text-center text-sm text-zinc-500">Loading more files...</div>}
        </main>
      </div>

      {/* Modals */}
      {previewFile && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[2147483647] flex min-h-dvh items-center justify-center bg-black/80 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-preview-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreviewFile(null);
            }}
          >
            <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div className="min-w-0">
                  <h2 id="file-preview-title" className="truncate text-sm font-semibold text-black">
                    {previewFile.title || previewFile.originalName}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {fileLabel(previewFile)} · {formatBytes(previewFile.bytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950 p-2 sm:p-4">
                {isPdfFile(previewFile) ? (
                  <PdfViewer
                    fileUrl={`/api/files/${previewFile.id}/content`}
                    className="h-[calc(94dvh-5.5rem)] w-full overflow-hidden rounded-lg bg-zinc-900"
                  />
                ) : isVideoFile(previewFile) ? (
                  CAN_USE_VIDSTACK_PLAYER ? (
                    <MediaPlayer
                      title={previewFile.title || previewFile.originalName}
                      src={previewFile.secureUrl}
                      controls
                      autoPlay
                      playsInline
                      className="aspect-video max-h-[calc(94dvh-5.5rem)] w-full max-w-full overflow-hidden rounded-lg bg-black text-white"
                    >
                      <MediaProvider />
                    </MediaPlayer>
                  ) : (
                    <video
                      src={previewFile.secureUrl}
                      controls
                      autoPlay
                      playsInline
                      className="max-h-[calc(94dvh-5.5rem)] w-full max-w-full rounded-lg bg-black object-contain"
                    />
                  )
                ) : (
                  <img
                    src={previewSource(previewFile)}
                    alt={previewFile.originalName}
                    className="max-h-[calc(94dvh-5.5rem)] max-w-full rounded-lg object-contain"
                  />
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[2147483647] flex min-h-dvh items-end justify-center overflow-y-auto bg-black/45 px-3 py-0 sm:items-center sm:px-4 sm:py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-files-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !uploading) setUploadModalOpen(false);
            }}
          >
            <form
              onSubmit={handleUpload}
              className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Upload</p>
                  <h2 id="upload-files-title" className="mt-2 text-xl font-semibold text-black">Add files</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 disabled:opacity-60"
                  aria-label="Close upload"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
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
                    ? `${formatBytes(selectedUploadTotalBytes)} selected`
                    : `You can upload up to ${MAX_UPLOAD_FILES} files at once.`}
                </span>
                <input id="vault-file-input" type="file" multiple onChange={handleFilePick} disabled={uploading} className="hidden" />
              </label>

              <div className="mt-4 space-y-4">
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
                    <p className="text-xs text-zinc-500">Public links are accessible to anyone.</p>
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

                {uploadProgress.status !== "idle" && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate text-zinc-600">
                        {uploadProgress.currentFileName || "Preparing upload"}
                        {uploadProgress.fileCount ? ` (${uploadProgress.currentFileIndex}/${uploadProgress.fileCount})` : ""}
                      </span>
                      <span className="shrink-0 font-semibold text-zinc-900">{uploadProgress.percent}%</span>
                    </div>
                    <ProgressBar value={uploadProgress.percent} label="Upload progress" size="sm" className="mt-3" />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                      <span>{formatBytes(uploadProgress.loaded || 0)} of {formatBytes(uploadProgress.total || selectedUploadTotalBytes || 0)}</span>
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
                )}

                {message && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    disabled={uploading}
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedUploadFiles.length === 0 || uploading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading..." : selectedUploadFiles.length > 1 ? `Upload ${selectedUploadFiles.length} Files` : "Upload File"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* New Folder Modal */}
      {newFolderModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-semibold text-black">Create New Folder</h2>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setNewFolderModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  disabled={workingId === "create-folder"}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Edit Folder Modal */}
      {editFolderModal.open && editFolderModal.folder && (
        <ModalPortal>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-semibold text-black">Edit Folder</h2>
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  defaultValue={editFolderModal.folder.name}
                  placeholder="Folder name"
                  id="edit-folder-name"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
                <label className="flex items-center gap-2">
                  <span className="text-sm text-zinc-700">Permission</span>
                  <select
                    id="edit-folder-permission"
                    defaultValue={editFolderModal.folder.permissionType || "private"}
                    className="ml-auto rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="private">Private</option>
                    <option value="password">Password protected</option>
                    <option value="public">Public</option>
                  </select>
                </label>
                <p className="text-xs text-zinc-500">
                  Public folders open by link. Password folders accept any active folder password.
                </p>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setEditFolderModal({ open: false, folder: null })}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const name = document.getElementById("edit-folder-name").value;
                    const permissionType = document.getElementById("edit-folder-permission").value;
                    updateFolder(editFolderModal.folder, { name, permissionType });
                  }}
                  disabled={workingId === `edit-${editFolderModal.folder.id}`}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Folder Passwords Modal */}
      {folderPasswordsModal.open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-4">
            <div className="flex w-full max-w-md flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl max-h-[82dvh] overflow-hidden">
              <h2 className="text-lg font-semibold text-black shrink-0">Folder Passwords</h2>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">

              {/* Password List */}
              <div className="space-y-2">
                {folderPasswordsModal.passwords.length === 0 ? (
                  <p className="text-sm text-zinc-500">No passwords yet</p>
                ) : (
                  folderPasswordsModal.passwords.map((pwd) => (
                    <div key={pwd.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-2">
                      <div>
                        <p className="text-xs font-medium text-zinc-700">{pwd.hint || "No hint"}</p>
                        <p className="text-xs text-zinc-500">{new Date(pwd.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => deleteFolderPassword(folderPasswordsModal.folderId, pwd.id)}
                        disabled={workingId === `delete-pwd-${pwd.id}`}
                        className="text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Password */}
              <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-medium text-black">Add New Password</h3>
                <input
                  type="password"
                  value={addPasswordInput}
                  onChange={(e) => setAddPasswordInput(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={addPasswordHint}
                  onChange={(e) => setAddPasswordHint(e.target.value)}
                  placeholder="Hint (optional)"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Unlock Activity */}
              <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-black">Unlock activity</h3>
                  <button
                    type="button"
                    onClick={() => loadFolderPasswordEvents(folderPasswordsModal.folderId)}
                    className="text-xs font-semibold text-zinc-700 underline underline-offset-4"
                  >
                    Refresh
                  </button>
                </div>
                {folderPasswordEvents.loading ? (
                  <div className="py-2 text-center text-xs text-zinc-500">Loading activity...</div>
                ) : folderPasswordEvents.events.length === 0 ? (
                  <p className="text-sm text-zinc-500">No activity yet</p>
                ) : (
                  <div className="space-y-2">
                    {folderPasswordEvents.events.map((event) => {
                      const matched = folderPasswordsModal.passwords.find((p) => p.id === event.matchedPasswordId);
                      const when = event.createdAt ? new Date(event.createdAt).toLocaleString() : "";
                      return (
                        <div key={event.id} className="rounded-lg border border-zinc-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-black">
                                {event.status === "success" ? "Unlocked" : "Failed unlock"}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {when}
                                {event.ip ? ` · ${event.ip}` : ""}
                              </p>
                              {event.status === "success" ? (
                                <p className="mt-1 text-xs text-zinc-600">
                                  Password: <span className="font-semibold text-black">{matched?.hint || "No hint"}</span>
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                event.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {event.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setFolderPasswordsModal({ open: false, folderId: "", passwords: [], loading: false })}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  Close
                </button>
                <button
                  onClick={() => addFolderPassword(folderPasswordsModal.folderId)}
                  disabled={folderPasswordsModal.loading || !addPasswordInput.trim()}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  Add Password
                </button>
              </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add to Folder Modal */}
      {addToFolderModal.open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-semibold text-black">
                {addToFolderModal.fileIds.length > 1 ? `Move ${addToFolderModal.fileIds.length} files to folder` : "Add File to Folder"}
              </h2>

              <input
                type="text"
                value={folderSearchTerm}
                onChange={(e) => setFolderSearchTerm(e.target.value)}
                placeholder="Search folders..."
                className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />

              <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                {filteredFolders.length === 0 ? (
                  <p className="text-sm text-zinc-500">No folders found</p>
                ) : (
                  filteredFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => setAddToFolderModal((prev) => ({ ...prev, selectedFolderId: folder.id }))}
                      disabled={workingId === BULK_ADD_WORKING_ID}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-60 ${
                        addToFolderModal.selectedFolderId === folder.id
                          ? "border-black bg-zinc-50 text-black"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {workingId === BULK_ADD_WORKING_ID ? (
                        <LoaderCircle className="h-4 w-4 animate-spin text-zinc-500" />
                      ) : (
                        <Folder className="h-4 w-4 text-zinc-400" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                      {addToFolderModal.selectedFolderId === folder.id ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                    </button>
                  ))
                )}
              </div>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setAddToFolderModal({ open: false, fileIds: [], selectedFolderId: "" })}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!addToFolderModal.selectedFolderId || workingId === BULK_ADD_WORKING_ID}
                  onClick={() => {
                    const folder = folders.find((f) => f.id === addToFolderModal.selectedFolderId);
                    const existingIds = new Set(folder?.fileIds || []);
                    const duplicates = addToFolderModal.fileIds.filter((id) => existingIds.has(id));
                    if (duplicates.length > 0) {
                      setExistingInFolderConfirm({
                        open: true,
                        folderId: folder?.id || addToFolderModal.selectedFolderId,
                        folderName: folder?.name || "this folder",
                        duplicates,
                        fileIds: addToFolderModal.fileIds,
                      });
                      return;
                    }
                    addFilesToFolder(addToFolderModal.fileIds, addToFolderModal.selectedFolderId);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {workingId === BULK_ADD_WORKING_ID ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Move
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {existingInFolderConfirm.open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-semibold text-black">Some files already exist</h2>
              <p className="mt-2 text-sm text-zinc-600">
                {existingInFolderConfirm.duplicates.length} of {existingInFolderConfirm.fileIds.length} selected files are already in{" "}
                <span className="font-semibold text-black">{existingInFolderConfirm.folderName}</span>.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setExistingInFolderConfirm({ open: false, folderId: "", folderName: "", duplicates: [], fileIds: [] })}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={workingId === BULK_ADD_WORKING_ID}
                  onClick={() => {
                    const toAdd = existingInFolderConfirm.fileIds.filter((id) => !existingInFolderConfirm.duplicates.includes(id));
                    setExistingInFolderConfirm({ open: false, folderId: "", folderName: "", duplicates: [], fileIds: [] });
                    addFilesToFolder(toAdd, existingInFolderConfirm.folderId);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {workingId === BULK_ADD_WORKING_ID ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Skip existing
                </button>
                <button
                  type="button"
                  disabled={workingId === BULK_ADD_WORKING_ID}
                  onClick={() => {
                    setExistingInFolderConfirm({ open: false, folderId: "", folderName: "", duplicates: [], fileIds: [] });
                    addFilesToFolder(existingInFolderConfirm.fileIds, existingInFolderConfirm.folderId);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {workingId === BULK_ADD_WORKING_ID ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Replace
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete File Confirmation */}
      {deleteTarget && (
        <ModalPortal>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-semibold text-black">Delete File</h2>
              <p className="mt-2 text-sm text-zinc-600">Are you sure you want to delete this file? This action cannot be undone.</p>

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeFile(deleteTarget)}
                  disabled={workingId === deleteTarget.id}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {bulkDeleteConfirm.open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-semibold text-black">Delete files</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Are you sure you want to delete {bulkDeleteConfirm.fileIds.length} selected file{bulkDeleteConfirm.fileIds.length === 1 ? "" : "s"}?
                This action cannot be undone.
              </p>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setBulkDeleteConfirm({ open: false, fileIds: [] })}
                  disabled={workingId === BULK_DELETE_WORKING_ID}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteFilesBulk(bulkDeleteConfirm.fileIds)}
                  disabled={workingId === BULK_DELETE_WORKING_ID}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {workingId === BULK_DELETE_WORKING_ID ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {message && (
        <div className="fixed inset-x-3 bottom-4 z-[2147483647] mx-auto max-w-md rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-lg sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(28rem,calc(100vw-3rem))]">
          {message}
        </div>
      )}
    </div>
  );
}
