'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Upload,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  Shield,
  FileText,
  X,
  Scan,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanResult {
  docType: string;
  company_name: string;
  valid: boolean;
}

interface DocSlot {
  file: File | null;
  scanning: boolean;
  scanResult: ScanResult | null;
  scanError: string | null;
}

const DOC_LABELS: { key: string; label: string; description: string }[] = [
  {
    key: 'doc1',
    label: 'SEC or DTI Registration',
    description: 'Securities & Exchange Commission or Dept of Trade & Industry certificate',
  },
  {
    key: 'doc2',
    label: 'BIR Certificate (Form 2303)',
    description: 'Bureau of Internal Revenue Certificate of Registration',
  },
  {
    key: 'doc3',
    label: 'Business Permit / Authority to Operate',
    description: "Mayor's permit or authority to operate from your LGU",
  },
];

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocumentUploadPage() {
  const router = useRouter();
  const { session } = useAuth();

  const [docs, setDocs] = useState<DocSlot[]>([
    { file: null, scanning: false, scanResult: null, scanError: null },
    { file: null, scanning: false, scanResult: null, scanError: null },
    { file: null, scanning: false, scanResult: null, scanError: null },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // -- helpers ----------------------------------------------------------------

  const uploaded = docs.filter((d) => d.file !== null).length;

  const updateSlot = (idx: number, patch: Partial<DocSlot>) =>
    setDocs((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  const scanFile = useCallback(
    async (file: File, idx: number) => {
      updateSlot(idx, { scanning: true, scanResult: null, scanError: null });
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/recruiter/documents/scan', { method: 'POST', body: form });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Scan failed' }));
          throw new Error(errData.error ?? 'Scan failed');
        }
        const data = await res.json();
        const scan = data.scan || data;
        updateSlot(idx, {
          scanning: false,
          scanResult: {
            docType: scan.documentType ?? scan.docType ?? scan.label ?? 'Unknown',
            company_name: scan.companyName ?? scan.company_name ?? '—',
            valid: scan.isValid ?? scan.valid ?? scan.is_valid ?? false,
          },
        });
      } catch (err) {
        updateSlot(idx, {
          scanning: false,
          scanError: err instanceof Error ? err.message : 'Scan failed',
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFile = useCallback(
    (file: File, idx: number) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Only PDF, PNG, or JPG files are accepted.');
        return;
      }
      if (file.size > MAX_SIZE) {
        setError('File must be under 10 MB.');
        return;
      }
      setError('');
      updateSlot(idx, { file, scanResult: null, scanError: null });
      scanFile(file, idx);
    },
    [scanFile]
  );

  const removeFile = (idx: number) => {
    updateSlot(idx, { file: null, scanning: false, scanResult: null, scanError: null });
  };

  const handleSubmit = async () => {
    if (uploaded < 3) return;
    if (!session) {
      setError('Session expired — please log in again.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const form = new FormData();
      docs.forEach((d, i) => {
        if (d.file) form.append(`doc${i + 1}`, d.file);
      });

      const res = await fetch('/api/recruiter/documents/upload-v2', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      setSuccess(true);
      setTimeout(() => router.push('/signup/pending-verification'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // -- render -----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0a0f] selection:bg-orange-500/20 selection:text-orange-200">
      {/* ambient bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-orange-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 -left-40 w-[700px] h-[700px] bg-amber-500/[0.04] rounded-full blur-[140px]" />
      </div>

      <main className="relative z-10 flex flex-col items-center px-4 py-12 sm:py-20">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 max-w-xl"
        >
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-orange-500/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Verify Your Agency</h1>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
            Upload 3 documents so we can verify your company. Our AI will scan each file
            automatically.
          </p>
        </motion.div>

        {/* progress pill */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8 w-full max-w-2xl"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm text-gray-500">Upload progress</span>
            <span className="text-sm font-medium text-orange-400">
              {uploaded} of 3 documents
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${(uploaded / 3) * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            />
          </div>
        </motion.div>

        {/* card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="w-full max-w-2xl rounded-3xl border border-white/[0.07] bg-[#111116] shadow-2xl p-5 sm:p-8"
        >
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-16 text-center"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Documents Submitted!</h2>
                <p className="text-gray-400">Redirecting to verification status…</p>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-5">
                {/* error banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* dropzones */}
                {DOC_LABELS.map((doc, idx) => (
                  <Dropzone
                    key={doc.key}
                    index={idx}
                    label={doc.label}
                    description={doc.description}
                    slot={docs[idx]}
                    onFile={(f) => handleFile(f, idx)}
                    onRemove={() => removeFile(idx)}
                  />
                ))}

                {/* info */}
                <div className="p-3.5 rounded-xl bg-blue-500/[0.07] border border-blue-500/15 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-300/80">
                    Documents will be reviewed by our team. You'll be notified once verification is complete.
                  </p>
                </div>

                {/* submit */}
                <Button
                  type="button"
                  disabled={uploaded < 3 || submitting}
                  onClick={handleSubmit}
                  className="w-full h-14 rounded-xl text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Submit for Verification
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* security badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/[0.08] border border-green-500/15 text-green-400 text-xs sm:text-sm">
            <Shield className="w-3.5 h-3.5" />
            Documents are encrypted and stored securely
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropzone component
// ---------------------------------------------------------------------------

interface DropzoneProps {
  index: number;
  label: string;
  description: string;
  slot: DocSlot;
  onFile: (file: File) => void;
  onRemove: () => void;
}

function Dropzone({ index, label, description, slot, onFile, onRemove }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // reset so re-selecting the same file still triggers
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.07 }}
    >
      {/* label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-md bg-orange-500/15 text-orange-400 text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>

      {slot.file ? (
        /* --- uploaded state --- */
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          {/* file row */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{slot.file.name}</p>
              <p className="text-xs text-gray-500">{(slot.file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              aria-label="Remove"
            >
              <X className="w-4 h-4 text-gray-500 hover:text-white" />
            </button>
          </div>

          {/* scan status */}
          <AnimatePresence mode="wait">
            {slot.scanning && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex items-center gap-2 text-xs text-orange-400">
                  <Scan className="w-3.5 h-3.5 animate-pulse" />
                  Scanning document…
                </div>
              </motion.div>
            )}

            {slot.scanResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`mt-3 p-3 rounded-lg text-xs space-y-1 ${
                    slot.scanResult.valid
                      ? 'bg-green-500/[0.08] border border-green-500/20'
                      : 'bg-yellow-500/[0.08] border border-yellow-500/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {slot.scanResult.valid ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                    )}
                    <span className={slot.scanResult.valid ? 'text-green-400' : 'text-yellow-400'}>
                      {slot.scanResult.valid ? 'Valid document' : 'Needs manual review'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <FileText className="w-3.5 h-3.5" />
                    Type: <span className="text-gray-300">{slot.scanResult.docType}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Building2 className="w-3.5 h-3.5" />
                    Company: <span className="text-gray-300">{slot.scanResult.company_name}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {slot.scanError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {slot.scanError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* --- empty dropzone --- */
        <label
          className={`block cursor-pointer rounded-xl border-2 border-dashed transition-all ${
            dragOver
              ? 'border-orange-500/50 bg-orange-500/[0.06]'
              : 'border-white/[0.08] bg-white/[0.02] hover:border-orange-500/25 hover:bg-white/[0.04]'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-sm text-white font-medium mb-0.5">
              Drop file here or <span className="text-orange-400">browse</span>
            </p>
            <p className="text-xs text-gray-500">{description}</p>
            <p className="text-[11px] text-gray-600 mt-1">PDF, PNG, JPG — max 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleChange}
            className="hidden"
          />
        </label>
      )}
    </motion.div>
  );
}
