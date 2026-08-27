'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  LoaderCircle,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  ListChecks,
  CheckCheck,
  RefreshCw,
  SkipForward,
  LayoutGrid,
  Search,
  Wand2,
} from 'lucide-react';
import MatchFieldsBoard, { type MatchField } from './MatchFieldsBoard';
import StepTabs, { type StepTab } from './StepTabs';
import AlertBanner from './AlertBanner';
import MetricTile from './MetricTile';

type ImportTable = { table_name: string; display_table_name: string; is_customized_table: number };
type TableField = { field: string; display_field: string; is_required: number };
type ImportResult = {
  totalRecordCount: number;
  totalFailedRecordCount: number;
  totalOverwiteRecordCount: number;
  totalInsertRecordCount: number;
  failedFields: string[];
  totalSkipRecordCount: number;
  totalFailedRecordArray: number[];
  totalOverwiteRecordArray: number[];
  totalSkipRecordArray: number[];
  successCount: number;
};

type MatchResult = {
  matched_fields?: Array<{ csv_index?: number; field?: string; display_field?: string }>;
  unmatched_csv?: number[];
  unmatched_table?: string[];
};

const STEP_TABS: StepTab[] = [
  { label: 'Select module & upload', description: 'Pick the module and choose the file to import.', icon: Upload },
  { label: 'Match fields', description: 'Confirm which columns map to ERP fields.', icon: Search },
  { label: 'Map fields', description: 'Assign remaining columns and set defaults.', icon: Wand2 },
  { label: 'Import results', description: 'See how many records were imported, skipped, or failed.', icon: ListChecks },
];

export default function ImportDataPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tables, setTables] = useState<ImportTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selectedTable, setSelectedTable] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseResult, setParseResult] = useState<{
    csvHeaderFields: string[];
    csvData: string[][];
    tableFields: TableField[];
    tableName: string;
    csvDataId: number;
    totalRows: number;
  } | null>(null);

  const [fieldsUnmatched, setFieldsUnmatched] = useState<MatchField[]>([]);
  const [fieldsMatched, setFieldsMatched] = useState<MatchField[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<number, string>>({});
  const [customText, setCustomText] = useState<Record<number, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    setError('');
    try {
      const session = buildSessionContext();
      const res = await fetch(`${API_BASE_URL}/api/import/tables`, {
        headers: createAuthHeaders(session),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== '1') throw new Error(payload.message || 'Failed to load import tables.');
      const raw = (payload.data ?? []) as ImportTable[];
      setTables(raw.filter((t) => t.is_customized_table === 1));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load import tables.');
    } finally {
      setLoadingTables(false);
    }
  }, []);

  useEffect(() => {
    // Import tables are session-scoped and only available after browser render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTables();
  }, [loadTables]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFileName(selected.name);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setFileName(dropped.name);
    }
  };

  const handleParse = async () => {
    if (!file || !selectedTable) {
      setError('Please select a module and upload a file.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const session = buildSessionContext();
      const formData = new FormData();
      formData.append('csv_file', file);
      formData.append('tablename', selectedTable);
      formData.append('header', '1');

      const res = await fetch(`${API_BASE_URL}/api/import/parse`, {
        method: 'POST',
        headers: createAuthHeaders(session),
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== '1') throw new Error(payload.message || 'Failed to parse file.');

      const data = payload.data;
      const tableFields = data.table_fields as TableField[];
      setParseResult({
        csvHeaderFields: data.csv_header_fields,
        csvData: data.csv_data,
        tableFields,
        tableName: data.table_name,
        csvDataId: data.csv_data_id,
        totalRows: data.total_rows,
      });

      const initialMapping: Record<number, string> = {};
      const initialCustom: Record<number, string> = {};
      data.csv_header_fields.forEach((_: string, idx: number) => {
        initialMapping[idx] = '0';
        initialCustom[idx] = '';
      });
      setCustomText(initialCustom);

      // Pre-split fields into Matched / Available using the backend's best-guess
      // header match, then let the user drag fields between the two lists.
      const matchedFieldNames = new Set<string>();
      try {
        const session = buildSessionContext();
        const matchRes = await fetch(`${API_BASE_URL}/api/import/match-fields`, {
          method: 'POST',
          headers: {
            ...createAuthHeaders(session),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            csv_header_fields: data.csv_header_fields,
            table_fields: tableFields,
          }),
        });
        const matchPayload = await matchRes.json();
        if (matchRes.ok && matchPayload.status === '1') {
          const matchData = matchPayload.data as MatchResult;
          (matchData.matched_fields ?? []).forEach((item) => {
            const csvIndex = typeof item.csv_index === 'number' ? item.csv_index : undefined;
            const field = typeof item.field === 'string' ? item.field : undefined;
            if (csvIndex !== undefined && field) {
              initialMapping[csvIndex] = field;
              matchedFieldNames.add(field);
            }
          });
        }
      } catch {
        // Auto-match is a convenience only; fall back to an empty Matched list.
      }

      setFieldMapping(initialMapping);
      setFieldsMatched(tableFields.filter((f) => matchedFieldNames.has(f.field)));
      setFieldsUnmatched(tableFields.filter((f) => !matchedFieldNames.has(f.field)));
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setUploading(false);
    }
  };

  const handleContinueToMap = () => {
    if (!parseResult) return;
    setError('');

    // Any field the user dragged back to "Available" loses its auto-matched
    // CSV column binding so Step 3 doesn't silently import it.
    const matchedNames = new Set(fieldsMatched.map((f) => f.field));
    setFieldMapping((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const idx = Number(key);
        if (next[idx] !== '0' && !matchedNames.has(next[idx])) next[idx] = '0';
      });
      return next;
    });
    setStep(3);
  };

  const handleProcess = async () => {
    setProcessing(true);
    setError('');
    try {
      const session = buildSessionContext();
      const fieldsArray = Object.keys(fieldMapping).map((key) => fieldMapping[Number(key)]);
      const customTextArray = Object.keys(customText).map((key) => customText[Number(key)]);

      const res = await fetch(`${API_BASE_URL}/api/import/process`, {
        method: 'POST',
        headers: {
          ...createAuthHeaders(session),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_name: parseResult?.tableName,
          csv_data_file_id: parseResult?.csvDataId,
          fields: fieldsArray,
          custom_text: customTextArray,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload.status !== '1') throw new Error(payload.message || 'Import failed.');

      setImportResult(payload.data);
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedTable('');
    setFile(null);
    setFileName('');
    setParseResult(null);
    setFieldsUnmatched([]);
    setFieldsMatched([]);
    setFieldMapping({});
    setCustomText({});
    setImportResult(null);
    setError('');
    setNotice('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalMapped = Object.values(fieldMapping).filter((v) => v !== '0').length;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto  space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Import data</h1>
            <p className="mt-1 text-sm text-slate-500">Upload a CSV or Excel file to bulk-import data into an ERP module.</p>
          </div>
          {step > 1 && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="size-4" />
              Start over
            </Button>
          )}
        </div>

        {error && (
          <AlertBanner variant="error" title="Something went wrong" onDismiss={() => setError('')}>
            {error}
          </AlertBanner>
        )}
        {notice && (
          <AlertBanner variant="success" onDismiss={() => setNotice('')}>
            {notice}
          </AlertBanner>
        )}

        <StepTabs steps={STEP_TABS} current={step - 1} />

        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 1</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Select module & upload file</h2>

              <div className="mt-5 space-y-2">
                <Label htmlFor="module">Module <span className="text-red-500">*</span></Label>
                <Select value={selectedTable} onValueChange={(val) => val && setSelectedTable(val)} disabled={loadingTables}>
                  <SelectTrigger id="module" className="w-full">
                    <SelectValue placeholder={loadingTables ? 'Loading modules…' : 'Select a module'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.table_name} value={table.table_name}>
                        {table.display_table_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">Records import into this module&apos;s table. You can review field mappings on the next steps.</p>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="file">CSV or Excel file <span className="text-red-500">*</span></Label>
                <input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-8 text-center transition-colors ${
                    file
                      ? 'border-indigo-200 bg-indigo-50/60'
                      : isDragOver
                        ? 'border-indigo-400 bg-indigo-50/60'
                        : 'border-dashed border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/40'
                  }`}
                >
                  {file ? (
                    <>
                      <span className="flex size-11 items-center justify-center rounded-xl bg-slate-900">
                        <FileSpreadsheet className="size-5 text-white" />
                      </span>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{fileName}</p>
                      <p className="text-xs text-slate-500">
                        {fileName.split('.').pop()?.toUpperCase()} spreadsheet · {(file.size / 1024).toFixed(1)} KB
                      </p>
                      <p className="mt-1 text-xs font-medium text-indigo-600">Click or drop to replace</p>
                    </>
                  ) : (
                    <>
                      <span className="flex size-11 items-center justify-center rounded-full bg-indigo-100">
                        <Upload className="size-5 text-indigo-600" />
                      </span>
                      <p className="mt-1 text-sm font-semibold text-slate-900">Drag and drop your file here</p>
                      <p className="text-xs text-slate-500">or <span className="font-semibold text-indigo-600">browse from your computer</span></p>
                      <p className="mt-1 text-[11px] text-slate-400">Accepted formats: .csv, .xlsx, .xls</p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <Button onClick={handleParse} disabled={!file || !selectedTable || uploading} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  {uploading ? 'Parsing…' : 'Upload and preview'}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 2</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">What we&apos;ll find in the file</h2>
              <div className="mt-5 flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-slate-100">
                  <Search className="size-5 text-slate-400" />
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">No file read yet</p>
                <p className="text-xs leading-relaxed text-slate-500">
                  Upload a file and this panel will show how many rows it holds and how many columns matched automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && parseResult && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 2</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Match fields</h2>
              <p className="mt-2 text-sm text-slate-500">
                Drag fields into <span className="font-semibold text-slate-700">Matched fields</span> to include them in this import.
              </p>
              <div className="mt-4">
                <MatchFieldsBoard
                  unmatched={fieldsUnmatched}
                  matched={fieldsMatched}
                  onChange={({ unmatched, matched }) => {
                    setFieldsUnmatched(unmatched);
                    setFieldsMatched(matched);
                  }}
                />
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <Button onClick={handleContinueToMap} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <ArrowRight className="size-4" />
                  Continue to map fields
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Summary</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">What we found</h2>
              <div className="mt-5 space-y-5 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <LayoutGrid className="size-4 text-indigo-600" />
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-400">Module</p>
                    <p className="text-sm font-semibold text-slate-900">{parseResult.tableName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <FileSpreadsheet className="size-4 text-emerald-600" />
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-400">File</p>
                    <p className="font-mono text-sm font-semibold text-slate-900">{fileName}</p>
                  </div>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Rows detected</p>
                  <p className="font-mono text-sm font-bold text-slate-900">{parseResult.totalRows}</p>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs text-slate-500">Fields matched</p>
                    <p className="font-mono text-xs font-semibold text-indigo-600">
                      {fieldsMatched.length} / {parseResult.tableFields.length}
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-indigo-600"
                      style={{ width: `${parseResult.tableFields.length ? (fieldsMatched.length / parseResult.tableFields.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && parseResult && (
          <div className="space-y-6">
            <Card className="bg-white shadow-sm">
              <CardHeader className="border-b">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 3</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-xl">
                  Map fields
                  <Badge variant="secondary" className="ml-2">{parseResult.totalRows} rows detected</Badge>
                  <Badge variant="outline" className="ml-1">{totalMapped}/{parseResult.csvHeaderFields.length} mapped</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">#</TableHead>
                        <TableHead>CSV column</TableHead>
                        <TableHead>Sample value</TableHead>
                        <TableHead className="w-[200px]">Map to field</TableHead>
                        <TableHead className="w-[180px]">Default value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.csvHeaderFields.map((header, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{header}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-slate-600">
                            {parseResult.csvData[0]?.[idx] ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={fieldMapping[idx] ?? '0'}
                              onValueChange={(val) => { if (val) setFieldMapping((prev) => ({ ...prev, [idx]: val })); }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Skip (don't import)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">-- skip --</SelectItem>
                                {parseResult.tableFields.map((field) => (
                                  <SelectItem key={field.field} value={field.field}>
                                    {field.display_field} {field.is_required ? '*' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-9 text-xs"
                              placeholder="Optional default..."
                              value={customText[idx] ?? ''}
                              onChange={(e) => setCustomText((prev) => ({ ...prev, [idx]: e.target.value }))}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                  <Button onClick={handleProcess} disabled={processing} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    {processing ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {processing ? 'Importing…' : 'Import data'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && importResult && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 4</p>
              <CardTitle className="mt-1 flex items-center gap-2 text-xl">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Import completed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricTile icon={ListChecks} label="Total records" value={importResult.totalRecordCount} />
                <MetricTile icon={CheckCheck} label="Inserted" value={importResult.totalInsertRecordCount} tone="success" />
                <MetricTile icon={RefreshCw} label="Overwritten" value={importResult.totalOverwiteRecordCount} tone="warning" />
                <MetricTile icon={SkipForward} label="Skipped" value={importResult.totalSkipRecordCount} tone="info" />
              </div>

              {importResult.totalFailedRecordCount > 0 && (
                <div className="mt-4">
                  <AlertBanner variant="error" title={`Failed: ${importResult.totalFailedRecordCount} records`}>
                    {importResult.totalFailedRecordArray.length > 0
                      ? `Row numbers: [${importResult.totalFailedRecordArray.join(', ')}]`
                      : 'See the source file for details.'}
                  </AlertBanner>
                </div>
              )}

              {importResult.failedFields && importResult.failedFields.length > 0 && (
                <div className="mt-4">
                  <AlertBanner variant="warning">
                    Missing required field mappings: {importResult.failedFields.join(', ')}
                  </AlertBanner>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RotateCcw className="size-4" />
                  Import another file
                </Button>
                <Button onClick={() => router.push('/dashboard')} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <LayoutGrid className="size-4" />
                  Go to dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
