"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { supabase, KB_BUCKET } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Upload,
  File,
  FileText,
  FileSpreadsheet,
  Trash2,
  Download,
  Search,
  FolderOpen,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const ALLOWED_EXTENSIONS = [
  "csv",
  "xls",
  "xlsx",
  "docx",
  "pdf",
  "txt",
  "mdx",
  "md",
  "rtf",
  "json",
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface KBFile {
  name: string;
  metadata?: { size?: number };
  created_at: string;
  updated_at: string;
  id: string;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["csv", "xls", "xlsx"].includes(ext))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (["pdf"].includes(ext))
    return <FileText className="h-5 w-5 text-red-500" />;
  if (["docx", "doc", "rtf"].includes(ext))
    return <FileText className="h-5 w-5 text-blue-500" />;
  if (["mdx", "md"].includes(ext))
    return <FileText className="h-5 w-5 text-purple-500" />;
  return <File className="h-5 w-5 text-gray-500" />;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function KnowledgebasePage() {
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const { t, locale } = useI18n();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase.storage
        .from(KB_BUCKET)
        .list("", {
          limit: 200,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (fetchError) throw fetchError;

      // Filter out folder placeholders
      const fileList = (data || []).filter(
        (f) => f.name && !f.name.endsWith("/") && f.id
      );
      setFiles(fileList as unknown as KBFile[]);
    } catch (err: any) {
      setError(err?.message || "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesToUpload = Array.from(fileList);

      // Validate extensions
      const invalid = filesToUpload.filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        return !ALLOWED_EXTENSIONS.includes(ext);
      });

      if (invalid.length > 0) {
        setError(
          `Unsupported file type(s): ${invalid.map((f) => f.name).join(", ")}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
        );
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        for (const file of filesToUpload) {
          const { error: uploadError } = await supabase.storage
            .from(KB_BUCKET)
            .upload(file.name, file, { upsert: true });

          if (uploadError) throw uploadError;
        }
        await fetchFiles();
      } catch (err: any) {
        setError(err?.message || "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [fetchFiles]
  );

  const deleteFile = useCallback(
    async (name: string) => {
      try {
        setError(null);
        const { error: delError } = await supabase.storage
          .from(KB_BUCKET)
          .remove([name]);
        if (delError) throw delError;
        await fetchFiles();
      } catch (err: any) {
        setError(err?.message || "Delete failed");
      }
    },
    [fetchFiles]
  );

  const getPublicUrl = (name: string) => {
    return `${SUPABASE_URL}/storage/v1/object/public/${KB_BUCKET}/${encodeURIComponent(name)}`;
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fileCountLabel = `${files.length} ${files.length !== 1 ? t("files") : t("file")}`;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-screen flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {t("knowledgeBaseTitle")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("knowledgeBaseDesc")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {fileCountLabel}
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {t("upload")}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchFiles")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
            />
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 font-medium underline"
            >
              {t("dismiss")}
            </button>
          </div>
        )}

        {/* Content area with drag-and-drop */}
        <div
          className="relative flex-1 overflow-y-auto px-6 py-4"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-purple-400 bg-purple-50/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-purple-500" />
                <p className="text-sm font-medium text-purple-700">
                  {t("dropFilesHere")}
                </p>
                <p className="text-xs text-purple-500">
                  {ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Uploading indicator */}
          {isUploading && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-purple-50 px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 animate-bounce rounded-full bg-purple-400"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <span className="text-sm text-purple-700">
                {t("uploadingFiles")}
              </span>
            </div>
          )}

          {/* Loading state */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            /* Empty state */
            <div
              className={cn(
                "flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
                "border-gray-200 bg-gray-50/50"
              )}
            >
              <FolderOpen className="h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                {searchQuery
                  ? t("noFilesMatchSearch")
                  : t("noFilesUploadedYet")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {searchQuery
                  ? t("tryDifferentSearch")
                  : t("dragAndDropFiles")}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  <Upload className="h-4 w-4" />
                  {t("uploadFiles")}
                </button>
              )}
            </div>
          ) : (
            /* File list */
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("name")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("size")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("uploaded")}
                    </th>
                    <th className="w-24 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="border-b transition-colors last:border-b-0 hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.name)}
                          <span className="text-sm font-medium text-foreground">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatBytes(file.metadata?.size || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(file.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={getPublicUrl(file.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                            title={t("download")}
                          >
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </a>
                          <button
                            onClick={() => deleteFile(file.name)}
                            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-red-50"
                            title={t("delete")}
                          >
                            <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
