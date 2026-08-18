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
import { LoaderCircle, Upload, FileUp, ArrowRight, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import MatchFieldsBoard, { type MatchField } from './MatchFieldsBoard';

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

const STEP_LABELS = ['Select Module', 'Match Fields', 'Map Fields', 'Import Results'];

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
            <h1 className="text-2xl font-bold text-slate-950">Import Data</h1>
            <p className="mt-1 text-sm text-slate-500">Upload CSV or Excel files to bulk-import data into ERP modules.</p>
          </div>
          {step > 1 && (
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${step > idx + 1 ? 'bg-emerald-600 text-white' : step === idx + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > idx + 1 ? <CheckCircle2 className="size-4" /> : idx + 1}
              </div>
              <span className={`text-sm font-medium ${step >= idx + 1 ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
              {idx < STEP_LABELS.length - 1 && <div className="mx-2 h-px w-8 bg-slate-200" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <FileUp className="size-5 text-blue-600" />
                Step 1: Select Module & Upload File
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="module">Module <span className="text-red-500">*</span></Label>
                  <Select value={selectedTable} onValueChange={(val) => val && setSelectedTable(val)} disabled={loadingTables}>
                    <SelectTrigger id="module">
                      <SelectValue placeholder={loadingTables ? 'Loading modules...' : 'Select a module'} />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.table_name} value={table.table_name}>
                          {table.display_table_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">CSV / Excel File <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="file"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="cursor-pointer"
                    />
                  </div>
                  {fileName && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <FileSpreadsheet className="size-4 text-emerald-600" />
                      {fileName}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                  <Button onClick={handleParse} disabled={!file || !selectedTable || uploading} className="gap-2">
                    {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    {uploading ? 'Parsing...' : 'Next: Match Fields'}
                  </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && parseResult && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-blue-600" />
                Step 2: Match Fields
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  The system found {parseResult.totalRows} rows in <span className="font-semibold">{parseResult.tableName}</span>.
                  Drag fields into <span className="font-semibold">Matched fields</span> to include them in this import.
                </p>
                <MatchFieldsBoard
                  unmatched={fieldsUnmatched}
                  matched={fieldsMatched}
                  onChange={({ unmatched, matched }) => {
                    setFieldsUnmatched(unmatched);
                    setFieldsMatched(matched);
                  }}
                />
                <div className="flex items-center justify-between border-t pt-4">
                  <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                  <Button onClick={handleContinueToMap} className="gap-2">
                    <ArrowRight className="size-4" />
                    Continue to Map Fields
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && parseResult && (
          <div className="space-y-6">
            <Card className="bg-white shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="size-5 text-blue-600" />
                  Step 3: Map Fields
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
                        <TableHead>CSV Column</TableHead>
                        <TableHead>Sample Value</TableHead>
                        <TableHead className="w-[200px]">Map To Field</TableHead>
                        <TableHead className="w-[180px]">Default Value</TableHead>
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
                  <Button onClick={handleProcess} disabled={processing} className="gap-2">
                    {processing ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {processing ? 'Importing...' : 'Import Data'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && importResult && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Import Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-500">Total Records</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{importResult.totalRecordCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-medium text-emerald-700">Inserted</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{importResult.totalInsertRecordCount}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-medium text-amber-700">Overwritten</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">{importResult.totalOverwiteRecordCount}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-700">Skipped</p>
                  <p className="mt-1 text-2xl font-bold text-blue-900">{importResult.totalSkipRecordCount}</p>
                </div>
              </div>

              {importResult.totalFailedRecordCount > 0 && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <XCircle className="size-5" />
                    <span className="font-semibold">Failed: {importResult.totalFailedRecordCount} records</span>
                  </div>
                  {importResult.totalFailedRecordArray.length > 0 && (
                    <p className="mt-1 text-xs text-red-600">Row numbers: [{importResult.totalFailedRecordArray.join(', ')}]</p>
                  )}
                </div>
              )}

              {importResult.failedFields && importResult.failedFields.length > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="size-4" />
                  Missing required field mappings: {importResult.failedFields.join(', ')}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={handleReset}>Import Another File</Button>
                <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
