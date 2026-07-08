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
      aria-label="Încarcă fișiere CSV Bolt"
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        dragging
          ? "border-emerald-500 bg-emerald-950/30"
          : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"
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
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
      ) : (
        <UploadCloud className="h-12 w-12 text-zinc-400" />
      )}
      <div className="space-y-2">
        <p className="text-xl font-semibold text-zinc-50">
          {busy ? "Se procesează fișierele…" : "Încarcă fișiere CSV Bolt"}
        </p>
        <p className="text-base text-zinc-300">
          Trage fișierele aici sau apasă pentru selectare. Poți încărca mai multe
          luni.
        </p>
        <p className="text-sm text-zinc-400">
          Acceptă fișiere .csv descărcate din Bolt → Facturi călătorie.
        </p>
        <p className="text-sm text-amber-300">
          Nu încărca poze sau PDF-uri aici. În această versiune folosim doar CSV.
        </p>
      </div>
    </div>
  );
}
