'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getApiBaseUrl,
  getFeesSession,
  joinUrl,
  readFirstString,
  readString,
  toArray,
  type ApiStatusPayload,
  type FeesSession,
  type SelectOption,
} from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SearchDropdown,
  type DropdownField,
  type DropdownValue,
  type SearchDropdownValues,
} from '@/components/search-dropdown';

type S3Row = {
  achTransactionCode: string;
  control1: string;
  destinationAccountType: string;
  ledgerFolioNumber: string;
  control2: string;
  beneficiaryAccountHolderName: string;
  control3: string;
  control4: string;
  userName: string;
  control5: string;
  amount: string;
  reservedAchItemSeqNo: string;
  reservedChecksum: string;
  reservedFlag: string;
  reservedReasonCode: string;
  destinationBankIfsc: string;
  destinationBankAccountNumber: string;
  sponsorBankIfsc: string;
  userNumber: string;
  transactionReference: string;
  productType: string;
  beneficiaryAadhaarNumber: string;
  umrn: string;
};

type S3Response = ApiStatusPayload & {
  fee_month?: unknown;
  student_data?: unknown;
  excelFile_path?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function NachS3ExcelExportPage() {
  const [session, setSession] = useState<FeesSession>(() => getFeesSession());
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [months, setMonths] = useState<SelectOption[]>([]);
  const [monthId, setMonthId] = useState('');
  const [rows, setRows] = useState<S3Row[]>([]);
  const [downloadPath, setDownloadPath] = useState('');
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadMonths = useCallback(async (nextSession: FeesSession) => {
    if (!nextSession.subInstituteId || !nextSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    setLoadingMonths(true);
    try {
      const params = new URLSearchParams();
      appendSessionParams(params, nextSession);
      const payload = await fetchLaravelJson<S3Response>(nextSession, `${getApiBaseUrl(nextSession)}/fees/NACH_s3excel_export?${params.toString()}`);
      setMonths(toMonthOptions(payload.fee_month));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load fee months.' });
    } finally {
      setLoadingMonths(false);
    }
  }, []);

  useEffect(() => {
    const nextSession = getFeesSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(nextSession);
    void loadMonths(nextSession);
  }, [loadMonths]);

  const handleSearch = async () => {
    const currentSession = getFeesSession();
    setSession(currentSession);

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    if (!monthId) {
      setMessage({ type: 'error', text: 'Please select month.' });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setRows([]);
    setDownloadPath('');
    setMessage(null);

    try {
      const params = new URLSearchParams();
      appendSessionParams(params, currentSession);
      params.set('month_id', monthId);
      appendIfValue(params, 'grade', getSingleValue(academicFilters.section));
      appendIfValue(params, 'standard', getSingleValue(academicFilters.standard));
      appendIfValue(params, 'division', getSingleValue(academicFilters.division));

      const payload = await fetchLaravelJson<S3Response>(currentSession, `${getApiBaseUrl(currentSession)}/fees/NACH_s3excel_export/create?${params.toString()}`);
      const nextRows = toS3Rows(payload.student_data);
      setRows(nextRows);
      setDownloadPath(readString(payload.excelFile_path));
      setMessage({ type: nextRows.length ? 'success' : 'info', text: payload.message || (nextRows.length ? `Loaded ${nextRows.length} S3 row${nextRows.length === 1 ? '' : 's'}.` : 'No records found.') });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to export S3 NACH data.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="S3-NACH excel export"
        description="Export NACH debit rows for the selected month and class filters."
        action={downloadPath ? (
          <a
            href={joinUrl(getApiBaseUrl(session), downloadPath)}
            download
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary-blue)] px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)]"
          >
            <Download className="h-4 w-4" />
            Export S3 excel
          </a>
        ) : undefined}
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Search">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto] lg:items-end">
          <SearchDropdown
            fields={academicFields}
            token={session.token}
            subInstituteId={session.subInstituteId}
            values={academicFilters}
            onChange={(values) => setAcademicFilters(values)}
          />
          <Field label="Month">
            <NativeSelect value={monthId} onChange={setMonthId} disabled={loadingMonths} required>
              <option value="">{loadingMonths ? 'Loading months' : 'Select month'}</option>
              {months.map((month) => (
                <option key={month.id} value={month.id}>{month.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="button" className="h-10" onClick={handleSearch} disabled={loading || loadingMonths}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel title="ACH rows">
        <Table className="min-w-[2200px]">
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead>ACH transaction code</TableHead>
              <TableHead>Control 1</TableHead>
              <TableHead>Destination account type</TableHead>
              <TableHead>Ledger folio no</TableHead>
              <TableHead>Control 2</TableHead>
              <TableHead>Beneficiary account holder</TableHead>
              <TableHead>Control 3</TableHead>
              <TableHead>Control 4</TableHead>
              <TableHead>User name</TableHead>
              <TableHead>Control 5</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>ACH item seq no</TableHead>
              <TableHead>Checksum</TableHead>
              <TableHead>Flag</TableHead>
              <TableHead>Reason code</TableHead>
              <TableHead>Destination IFSC</TableHead>
              <TableHead>Destination account no</TableHead>
              <TableHead>Sponsor IFSC</TableHead>
              <TableHead>User number</TableHead>
              <TableHead>Transaction reference</TableHead>
              <TableHead>Product type</TableHead>
              <TableHead>Aadhaar no</TableHead>
              <TableHead>UMRN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={23} label="Loading S3 ACH rows" />
            ) : rows.length > 0 ? (
              rows.map((row, index) => (
                <TableRow key={`${row.transactionReference}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell>{row.achTransactionCode}</TableCell>
                  <TableCell>{row.control1}</TableCell>
                  <TableCell>{row.destinationAccountType}</TableCell>
                  <TableCell>{row.ledgerFolioNumber}</TableCell>
                  <TableCell>{row.control2}</TableCell>
                  <TableCell>{row.beneficiaryAccountHolderName}</TableCell>
                  <TableCell>{row.control3}</TableCell>
                  <TableCell>{row.control4}</TableCell>
                  <TableCell>{row.userName}</TableCell>
                  <TableCell>{row.control5}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                  <TableCell>{row.reservedAchItemSeqNo}</TableCell>
                  <TableCell>{row.reservedChecksum}</TableCell>
                  <TableCell>{row.reservedFlag}</TableCell>
                  <TableCell>{row.reservedReasonCode}</TableCell>
                  <TableCell>{row.destinationBankIfsc}</TableCell>
                  <TableCell>{row.destinationBankAccountNumber}</TableCell>
                  <TableCell>{row.sponsorBankIfsc}</TableCell>
                  <TableCell>{row.userNumber}</TableCell>
                  <TableCell>{row.transactionReference}</TableCell>
                  <TableCell>{row.productType}</TableCell>
                  <TableCell>{row.beneficiaryAadhaarNumber}</TableCell>
                  <TableCell>{row.umrn}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow colSpan={23} label={hasSearched ? 'No S3 ACH rows found.' : 'Search to load S3 ACH rows.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}

function appendIfValue(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}

function getSingleValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function toMonthOptions(value: unknown): SelectOption[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const record = asRecord(item);
      const id = readFirstString(record, ['id', 'month_id']) || String(index);
      const label = readFirstString(record, ['name', 'month_name', 'label']) || readString(item);
      return { id, label };
    }).filter((month) => month.id && month.label);
  }

  return Object.entries(asRecord(value)).map(([id, label]) => ({
    id,
    label: readString(label),
  })).filter((month) => month.id && month.label);
}

function toS3Rows(value: unknown): S3Row[] {
  return toArray(value).map((item) => {
    const record = asRecord(item);
    return {
      achTransactionCode: readFirstString(record, ['ACH_TRANSACTION_CODE']),
      control1: readFirstString(record, ['CONTROL_1']),
      destinationAccountType: readFirstString(record, ['DESTINATION_AC_TYPE']),
      ledgerFolioNumber: readFirstString(record, ['LEDGER_FOLIO_NUMBER']),
      control2: readFirstString(record, ['CONTROL_2']),
      beneficiaryAccountHolderName: readFirstString(record, ['BENEFICIARY_AC_HOLDER_NAME']),
      control3: readFirstString(record, ['CONTROL_3']),
      control4: readFirstString(record, ['CONTROL_4']),
      userName: readFirstString(record, ['USER_NAME']),
      control5: readFirstString(record, ['CONTROL_5']),
      amount: readFirstString(record, ['AMOUNT']),
      reservedAchItemSeqNo: readFirstString(record, ['RESERVED_ACH_ITEM_SEQ_NO']),
      reservedChecksum: readFirstString(record, ['RESERVED_CHECKSUM']),
      reservedFlag: readFirstString(record, ['RESERVED_FLAG_SUCCESS_RETURN']),
      reservedReasonCode: readFirstString(record, ['RESERVED_REASON_CODE']),
      destinationBankIfsc: readFirstString(record, ['DESTINATION_BANK_IFSC_CODE']),
      destinationBankAccountNumber: readFirstString(record, ['DESTINATION_BANK_AC_NUMBER']),
      sponsorBankIfsc: readFirstString(record, ['SPONSOR_BANK_IFSC_CODE']),
      userNumber: readFirstString(record, ['USER_NUMBER']),
      transactionReference: readFirstString(record, ['TRANSACTION_REFERENCE']),
      productType: readFirstString(record, ['PRODUCT_TYPE']),
      beneficiaryAadhaarNumber: readFirstString(record, ['BENEFICIARY_ADHAAR_NUMBER']),
      umrn: readFirstString(record, ['UMRN']),
    };
  });
}
