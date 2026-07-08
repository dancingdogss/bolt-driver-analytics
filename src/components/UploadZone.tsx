"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  busy?: boolean;
}

/** Drag-and-drop / click zone for uploading one or more Bolt CSV files. */
export default function UploadZone({ onFiles, busy = false }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const csvFiles = Array.from(fileList).filter(
        (f) => f.name.toLowerCase().endsWith(".csv") || f.type === "text/csv",
      );
      if (csvFiles.length > 0) onFiles(csvFiles);
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        dragging
          ? "border-emerald-500 bg-emerald-950/30"
          : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {busy ? (
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      ) : (
        <UploadCloud className="h-10 w-10 text-zinc-500" />
      )}
      <div>
        <p className="font-medium text-zinc-100">
          {busy ? "Processing files…" : "Upload Bolt CSV files"}
        </p>
        <p className="text-sm text-zinc-400">
          Drag &amp; drop or click to select. You can upload multiple files.
        </p>
      </div>
    </div>
  );
}
