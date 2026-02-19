'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  ArrowRight
} from 'lucide-react';
import { autoDetectColumnMapping } from '@/lib/outbound/csv-parser';

interface ImportResult {
  imported: number;
  updated: number;
  duplicates: number;
  errors: number;
  errorLog: Array<{ row: number; email: string; errors: string[] }>;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Import, 4: Results
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [dedupeStrategy, setDedupeStrategy] = useState<'skip' | 'update' | 'mark_duplicate'>('skip');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);

    // Parse CSV to show preview
    const text = await selectedFile.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      alert('CSV file is empty');
      return;
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]);
    setCsvHeaders(headers);

    // Parse preview rows (first 10)
    const preview = [];
    for (let i = 1; i < Math.min(11, lines.length); i++) {
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      preview.push(row);
    }
    setCsvPreview(preview);

    // Auto-detect column mapping
    const detected = autoDetectColumnMapping(headers);
    setColumnMapping(detected);

    setStep(2);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setStep(3);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('column_mapping', JSON.stringify(columnMapping));
      formData.append('dedupe_strategy', dedupeStrategy);

      const response = await fetch('/api/outbound/contacts/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setImportResult(data.results);
        setStep(4);
      } else {
        const error = await response.json();
        alert(`Import failed: ${error.error}`);
        setStep(2);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
      setStep(2);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Import Contacts</h1>
        <p className="text-gray-400">Upload CSV file to import contacts into your database</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[
          { num: 1, label: 'Upload' },
          { num: 2, label: 'Map Columns' },
          { num: 3, label: 'Import' },
          { num: 4, label: 'Results' },
        ].map((s, index) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s.num
                    ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white'
                    : 'bg-slate-800 text-gray-500'
                }`}
              >
                {step > s.num ? <CheckCircle className="h-5 w-5" /> : s.num}
              </div>
              <span className={step >= s.num ? 'text-white' : 'text-gray-500'}>{s.label}</span>
            </div>
            {index < 3 && (
              <div
                className={`flex-1 h-1 mx-4 rounded ${
                  step > s.num ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-slate-800'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-white/10 rounded-xl p-8 backdrop-blur-sm"
        >
          <div
            className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:border-red-500/50 transition-colors cursor-pointer"
            onDrop={(e) => {
              e.preventDefault();
              const droppedFile = e.dataTransfer.files[0];
              if (droppedFile && droppedFile.name.endsWith('.csv')) {
                handleFileSelect(droppedFile);
              } else {
                alert('Please upload a CSV file');
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Upload CSV File</h3>
            <p className="text-gray-400 mb-4">Drag and drop or click to browse</p>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) handleFileSelect(selectedFile);
              }}
            />
            <p className="text-sm text-gray-500">CSV format required. Max file size: 10MB</p>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              CSV Format Requirements
            </h4>
            <ul className="text-sm text-gray-400 space-y-1 ml-7">
              <li>• Email column is required</li>
              <li>• Optional: First Name, Last Name, Phone Number</li>
              <li>• First row should contain column headers</li>
              <li>• Use commas as separators</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-4">Map CSV Columns</h3>
            <div className="space-y-3">
              {csvHeaders.map((header) => (
                <div key={header} className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-gray-400">{header}</label>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-600" />
                  <div className="flex-1">
                    <select
                      value={columnMapping[header] || ''}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, [header]: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Skip this column</option>
                      <option value="email">Email (required)</option>
                      <option value="first_name">First Name</option>
                      <option value="last_name">Last Name</option>
                      <option value="phone_number">Phone Number</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-4">Preview (first 10 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-white/10">
                  <tr>
                    {csvHeaders.map((header) => (
                      <th key={header} className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {csvPreview.map((row, index) => (
                    <tr key={index}>
                      {csvHeaders.map((header) => (
                        <td key={header} className="px-4 py-3 text-sm text-gray-300">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deduplication Strategy */}
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-4">Deduplication Strategy</h3>
            <div className="space-y-3">
              {[
                { value: 'skip', label: 'Skip Duplicates', desc: 'Keep existing contacts, ignore duplicates' },
                { value: 'update', label: 'Update Duplicates', desc: 'Merge new data into existing contacts' },
                {
                  value: 'mark_duplicate',
                  label: 'Mark as Duplicate',
                  desc: 'Create new entry but flag as duplicate',
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                    dedupeStrategy === option.value
                      ? 'bg-red-500/20 border-red-500/50'
                      : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="dedupe"
                    value={option.value}
                    checked={dedupeStrategy === option.value}
                    onChange={(e) => setDedupeStrategy(e.target.value as any)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-white font-medium">{option.label}</p>
                    <p className="text-sm text-gray-400">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={!Object.values(columnMapping).includes('email')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Import
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Importing */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-900/50 border border-white/10 rounded-xl p-12 backdrop-blur-sm text-center"
        >
          <Loader2 className="h-16 w-16 text-red-500 animate-spin mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Importing Contacts...</h3>
          <p className="text-gray-400">This may take a few moments. Please wait.</p>
        </motion.div>
      )}

      {/* Step 4: Results */}
      {step === 4 && importResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="h-8 w-8 text-green-400" />
              <h3 className="text-2xl font-bold text-white">Import Complete!</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{importResult.imported}</p>
                <p className="text-sm text-gray-400 mt-1">Imported</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-400">{importResult.updated}</p>
                <p className="text-sm text-gray-400 mt-1">Updated</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">{importResult.duplicates}</p>
                <p className="text-sm text-gray-400 mt-1">Duplicates</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-400">{importResult.errors}</p>
                <p className="text-sm text-gray-400 mt-1">Errors</p>
              </div>
            </div>
          </div>

          {importResult.errors > 0 && importResult.errorLog.length > 0 && (
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
              <h4 className="text-lg font-semibold text-white mb-4">Error Log</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {importResult.errorLog.map((error, index) => (
                  <div key={index} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-sm text-gray-300">
                      <span className="font-medium">Row {error.row}:</span> {error.email}
                    </p>
                    <p className="text-xs text-red-400 mt-1">{error.errors.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => {
                setFile(null);
                setStep(1);
                setImportResult(null);
              }}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Import Another File
            </button>
            <button
              onClick={() => (window.location.href = '/outbound/contacts')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
            >
              View Contacts
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
