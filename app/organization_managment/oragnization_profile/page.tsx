"use client"

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react"
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  buildSessionContext,
  getOrganizationProfile,
  saveOrganizationProfile,
  type OrgApiRecord,
  type OrgProfileApiRecord,
  type SessionContext,
} from "../_lib/institute-profile-api"

type OrganizationProfile = {
  status: "Active" | "Inactive" | "Pending Review"
  organizationName: string
  organizationCode: string
  organizationType: string
  businessType: string
  industryType: string
  establishedDate: string
  registrationNo: string
  gstNo: string
  panNo: string
  website: string
  companyDescription: string
  email: string
  phone: string
  alternatePhone: string
  addressLine1: string
  addressLine2: string
  country: string
  state: string
  city: string
  postalCode: string
  brandName: string
  tagline: string
  brandDescription: string
  timeZone: string
  currency: string
  financialYear: string
  dateFormat: string
  language: string
  numberFormat: string
  totalEmployees: string
  workingDays: string[]
  sisterCompanies: SisterCompany[]
}

type OrganizationField = Exclude<
  keyof OrganizationProfile,
  "workingDays" | "sisterCompanies"
>

type SisterCompany = {
  id: string
  name: string
  relationship: string
  status: "Active" | "Inactive"
  profile: OrganizationProfile
}

type SisterCompanyFormState = {
  mode: "add" | "edit"
  id?: string
  draft: OrganizationProfile
}

const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const options = {
  organizationType: ["Company", "Partnership", "LLP", "Trust", "Society"],
  businessType: ["Private Limited", "Public Limited", "Partnership", "Non Profit"],
  industryType: ["Information Technology", "Education", "Healthcare", "Manufacturing"],
  status: ["Active", "Pending Review", "Inactive"],
  country: ["India", "United States", "United Kingdom"],
  timeZone: ["(IST) Asia/Kolkata", "(GMT) Europe/London", "(PST) America/Los_Angeles"],
  currency: ["INR - Indian Rupee", "USD - US Dollar", "GBP - British Pound"],
  financialYear: ["April - March", "January - December", "July - June"],
  dateFormat: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
  language: ["English", "Hindi", "Spanish"],
  numberFormat: ["1,234.56", "1.234,56", "1234.56"],
}

const initialProfile: OrganizationProfile = {
  status: "Active",
  organizationName: "ABC Technologies Pvt. Ltd.",
  organizationCode: "ABC123",
  organizationType: "Company",
  businessType: "Private Limited",
  industryType: "Information Technology",
  establishedDate: "2014-08-18",
  registrationNo: "REG-GJ-AHD-2014-4821",
  gstNo: "24AABCA9812F1Z7",
  panNo: "AABCA9812F",
  website: "www.abctech.com",
  companyDescription:
    "ABC Technologies Pvt. Ltd. provides cloud, analytics, and education technology services for schools and enterprise learning teams.",
  email: "info@abctech.com",
  phone: "079-12345678",
  alternatePhone: "079-12345679",
  addressLine1: "407, Riverfront Business Park, Ashram Road",
  addressLine2: "Near Ellis Bridge",
  country: "India",
  state: "Gujarat",
  city: "Ahmedabad",
  postalCode: "380009",
  brandName: "ATP",
  tagline: "Technology for measurable growth",
  brandDescription:
    "ATP is the operating brand used for digital transformation, institutional management, and analytics solutions.",
  timeZone: "(IST) Asia/Kolkata",
  currency: "INR - Indian Rupee",
  financialYear: "April - March",
  dateFormat: "DD/MM/YYYY",
  language: "English",
  numberFormat: "1,234.56",
  totalEmployees: "248",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  sisterCompanies: [
    {
      id: "company-1",
      name: "GapstoGrowth Analytics",
      relationship: "Sister Company",
      status: "Active",
      profile: {
        status: "Active",
        organizationName: "GapstoGrowth Analytics",
        organizationCode: "GGA-2026",
        organizationType: "Company",
        businessType: "Private Limited",
        industryType: "Information Technology",
        establishedDate: "2017-03-14",
        registrationNo: "REG-GJ-AHD-2017-2194",
        gstNo: "24AAHCG5421B1Z3",
        panNo: "AAHCG5421B",
        website: "www.gapstogrowthanalytics.com",
        companyDescription:
          "GapstoGrowth Analytics delivers data warehousing, business intelligence dashboards, and predictive analytics services for education and mid-market clients.",
        email: "contact@gapstogrowthanalytics.com",
        phone: "079-40124567",
        alternatePhone: "079-40124568",
        addressLine1: "B-1202, Titanium Heights, Corporate Road",
        addressLine2: "Prahlad Nagar",
        country: "India",
        state: "Gujarat",
        city: "Ahmedabad",
        postalCode: "380015",
        brandName: "GGA",
        tagline: "Analytics that guide growth",
        brandDescription:
          "GGA is the analytics services brand for reporting, forecasting, and operational intelligence solutions.",
        timeZone: "(IST) Asia/Kolkata",
        currency: "INR - Indian Rupee",
        financialYear: "April - March",
        dateFormat: "DD/MM/YYYY",
        language: "English",
        numberFormat: "1,234.56",
        totalEmployees: "86",
        workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        sisterCompanies: [],
      },
    },
    {
      id: "company-2",
      name: "GapstoGrowth EMEA",
      relationship: "Sister Company",
      status: "Active",
      profile: {
        status: "Active",
        organizationName: "GapstoGrowth EMEA",
        organizationCode: "GGE-2026",
        organizationType: "Company",
        businessType: "Private Limited",
        industryType: "Information Technology",
        establishedDate: "2019-09-02",
        registrationNo: "REG-UK-LON-2019-7742",
        gstNo: "29AAFCG1934K1Z2",
        panNo: "AAFCG1934K",
        website: "www.gapstogrowthemea.com",
        companyDescription:
          "GapstoGrowth EMEA manages regional implementation, customer success, and platform support for clients across Europe, the Middle East, and Africa.",
        email: "hello@gapstogrowthemea.com",
        phone: "+44 20 7946 0831",
        alternatePhone: "+44 20 7946 0832",
        addressLine1: "12th Floor, Meridian House, 34 Great Eastern Street",
        addressLine2: "Shoreditch",
        country: "United Kingdom",
        state: "England",
        city: "London",
        postalCode: "EC2A 3ER",
        brandName: "GGE",
        tagline: "Regional delivery, global standards",
        brandDescription:
          "GGE represents the EMEA delivery arm for implementations, managed services, and enterprise support.",
        timeZone: "(GMT) Europe/London",
        currency: "GBP - British Pound",
        financialYear: "January - December",
        dateFormat: "DD/MM/YYYY",
        language: "English",
        numberFormat: "1,234.56",
        totalEmployees: "64",
        workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        sisterCompanies: [],
      },
    },
    {
      id: "company-3",
      name: "GapstoGrowth Cloud Labs",
      relationship: "Sister Company",
      status: "Inactive",
      profile: {
        status: "Inactive",
        organizationName: "GapstoGrowth Cloud Labs",
        organizationCode: "GCL-2026",
        organizationType: "Company",
        businessType: "Private Limited",
        industryType: "Information Technology",
        establishedDate: "2020-01-20",
        registrationNo: "REG-KA-BLR-2020-1186",
        gstNo: "29AAHCG8263M1Z6",
        panNo: "AAHCG8263M",
        website: "www.gapstogrowthcloudlabs.com",
        companyDescription:
          "GapstoGrowth Cloud Labs focuses on cloud architecture prototypes, DevOps automation, and managed infrastructure experiments.",
        email: "support@gapstogrowthcloudlabs.com",
        phone: "080-46781234",
        alternatePhone: "080-46781235",
        addressLine1: "5th Floor, Invento Tech Park, Outer Ring Road",
        addressLine2: "Marathahalli",
        country: "India",
        state: "Karnataka",
        city: "Bengaluru",
        postalCode: "560037",
        brandName: "GCL",
        tagline: "Cloud prototypes to production",
        brandDescription:
          "GCL is the cloud innovation and infrastructure engineering brand within the company group.",
        timeZone: "(IST) Asia/Kolkata",
        currency: "INR - Indian Rupee",
        financialYear: "April - March",
        dateFormat: "DD/MM/YYYY",
        language: "English",
        numberFormat: "1,234.56",
        totalEmployees: "42",
        workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        sisterCompanies: [],
      },
    },
  ],
}

const PAGE_SIZE = 5
const cardSurfaceClass =
  "gap-0 rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.16)]"

// Real starting point once the page talks to the backend: every field starts
// empty (disabled fields already render "Pending" for falsy values) and gets
// filled in from `getOrganizationProfile()` on mount. `initialProfile` above
// stays put purely as demo scaffolding for a brand-new sister company draft.
const blankProfile: OrganizationProfile = {
  status: "Active",
  organizationName: "",
  organizationCode: "",
  organizationType: "",
  businessType: "",
  industryType: "",
  establishedDate: "",
  registrationNo: "",
  gstNo: "",
  panNo: "",
  website: "",
  companyDescription: "",
  email: "",
  phone: "",
  alternatePhone: "",
  addressLine1: "",
  addressLine2: "",
  country: "",
  state: "",
  city: "",
  postalCode: "",
  brandName: "",
  tagline: "",
  brandDescription: "",
  timeZone: "",
  currency: "",
  financialYear: "",
  dateFormat: "",
  language: "",
  numberFormat: "",
  totalEmployees: "",
  workingDays: [],
  sisterCompanies: [],
}

// `org_details.registered_address` is a single opaque, comma-joined string
// (see buildRegisteredAddress below, mirroring G2G's concatenation). It is
// not reliably invertible, so this is a best-effort positional split back
// into the five UI address fields.
function splitRegisteredAddress(address: string): {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
} {
  const parts = address.split(",").map((part) => part.trim())
  return {
    addressLine1: parts[0] ?? "",
    addressLine2: parts[1] ?? "",
    city: parts[2] ?? "",
    state: parts[3] ?? "",
    postalCode: parts[4] ?? "",
    country: parts[5] ?? "",
  }
}

function buildRegisteredAddress(profile: OrganizationProfile): string {
  return [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.state,
    profile.postalCode,
    profile.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")
}

// Maps the fields the backend actually persists (see institute-profile-api.ts)
// onto an OrganizationProfile. Fields G2G itself never persists (organizationType,
// businessType, companyDescription, alternatePhone, brandName, tagline,
// brandDescription, timeZone, currency, financialYear, dateFormat, language,
// numberFormat, status) are left as whatever `base` already has.
function applyOrgRecordToProfile(
  base: OrganizationProfile,
  record: OrgApiRecord
): OrganizationProfile {
  const cin = record.cin || base.registrationNo || base.organizationCode
  const address = splitRegisteredAddress(record.registeredAddress)
  const workingDays = record.workWeek
    ? record.workWeek
        .split(",")
        .map((day) => day.trim())
        .filter((day) => allDays.includes(day))
    : base.workingDays

  return {
    ...base,
    ...address,
    organizationName: record.legalName || base.organizationName,
    organizationCode: cin || base.organizationCode,
    registrationNo: cin || base.registrationNo,
    gstNo: record.gstin || base.gstNo,
    panNo: record.pan || base.panNo,
    industryType: record.industry || base.industryType,
    totalEmployees: record.employeeCount || base.totalEmployees,
    workingDays,
    website: record.website || base.website,
    email: record.email || base.email,
    phone: record.mobileNo || base.phone,
  }
}

function mapSisterRecordToCompany(record: OrgApiRecord, index: number): SisterCompany {
  const profile = applyOrgRecordToProfile(blankProfile, record)
  return {
    id: record.id || `sister-${index}`,
    name: record.legalName,
    // relationship / status are UI-only in G2G too (not persisted columns).
    relationship: "Sister Company",
    status: "Active",
    profile: { ...profile, organizationName: record.legalName },
  }
}

function mapOrgProfileRecord(record: OrgProfileApiRecord | null): OrganizationProfile {
  if (!record) return blankProfile

  const mainProfile = applyOrgRecordToProfile(blankProfile, record)
  return {
    ...mainProfile,
    sisterCompanies: record.sisterCompanies.map(mapSisterRecordToCompany),
  }
}

// Builds the persisted-field slice of the multipart payload for one profile
// (main org or a sister company). `nameOverride` lets the sister-company row's
// inline-edited `name` win over its nested profile's organizationName.
function appendPersistedFields(
  formData: FormData,
  profile: OrganizationProfile,
  prefix = "",
  nameOverride?: string
) {
  const cin = profile.registrationNo.trim() || profile.organizationCode.trim()
  const fields: Record<string, string> = {
    legal_name: nameOverride ?? profile.organizationName,
    cin,
    gstin: profile.gstNo,
    pan: profile.panNo,
    registered_address: buildRegisteredAddress(profile),
    industry: profile.industryType,
    employee_count: profile.totalEmployees,
    work_week: profile.workingDays.join(","),
    mobile_no: profile.phone,
    country_code: "+91",
    email: profile.email,
    website: profile.website,
  }

  Object.entries(fields).forEach(([key, value]) => {
    formData.set(prefix ? `${prefix}[${key}]` : key, value)
  })
}

// Sister companies are always sent as a full replace, matching G2G/next_lms_erp's
// organizationDetailsController@store (it deletes all existing sister rows for
// the org, then re-inserts every entry in `sister_companies`).
function buildOrganizationFormData(
  session: SessionContext,
  source: OrganizationProfile
): FormData {
  const formData = new FormData()
  formData.set("type", "API")
  formData.set("formType", "organization_details")
  if (session.subInstituteId) formData.set("sub_institute_id", session.subInstituteId)
  if (session.userId) formData.set("user_id", session.userId)
  if (session.token) formData.set("token", session.token)

  appendPersistedFields(formData, source)

  source.sisterCompanies.forEach((company, index) => {
    appendPersistedFields(formData, company.profile, `sister_companies[${index}]`, company.name)
  })

  return formData
}

function createSisterCompanyProfile(company?: SisterCompany): OrganizationProfile {
  if (company?.profile) {
    return {
      ...company.profile,
      sisterCompanies: [],
    }
  }

  return {
    ...initialProfile,
    status: company?.status ?? "Active",
    organizationName: company?.name ?? "",
    organizationCode: "NEW-SC",
    registrationNo: "REG-GJ-AHD-2026-0001",
    gstNo: "24AAHCS0001N1Z1",
    panNo: "AAHCS0001N",
    website: "www.newsistercompany.com",
    companyDescription:
      "New Sister Company is a sample group entity profile used for validating company registration, contact, address, and settings workflows.",
    email: "info@newsistercompany.com",
    phone: "079-40000001",
    alternatePhone: "079-40000002",
    addressLine1: "501, Commerce Square, C.G. Road",
    addressLine2: "Navrangpura",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380006",
    brandName:
      company?.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "SC",
    tagline: "Built for connected growth",
    brandDescription:
      "SC is a placeholder brand identity for sister company onboarding and UI validation.",
    totalEmployees: "25",
    sisterCompanies: [],
  }
}

export default function OrganizationProfilePage() {
  const [profile, setProfile] = useState<OrganizationProfile>(blankProfile)
  const [draft, setDraft] = useState<OrganizationProfile>(blankProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [, setMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [sisterForm, setSisterForm] = useState<SisterCompanyFormState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError("")
    try {
      const session = buildSessionContext()
      // eslint-disable-next-line no-console
      console.log("[InstituteProfile] session", session)
      const record = await getOrganizationProfile(session)
      // eslint-disable-next-line no-console
      console.log("[InstituteProfile] record", record)
      const nextProfile = mapOrgProfileRecord(record)
      setProfile(nextProfile)
      setDraft(nextProfile)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[InstituteProfile] load failed", error)
      setLoadError(
        error instanceof Error ? error.message : "Unable to load institute profile."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const currentProfile = isEditing ? draft : profile
  const visibleCompanies = currentProfile.sisterCompanies.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(visibleCompanies.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedCompanies = visibleCompanies.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )
  const rangeStart = visibleCompanies.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, visibleCompanies.length)

  function handleEdit() {
    setDraft(profile)
    setIsEditing(true)
    setMessage("")
    setSearchTerm("")
    setPage(1)
  }

  function handleCancel() {
    setDraft(profile)
    setIsEditing(false)
    setMessage("")
    setSearchTerm("")
    setPage(1)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (sisterForm) {
      await handleSaveSisterCompany()
      return
    }

    if (!draft.organizationName.trim() || !draft.organizationCode.trim()) {
      setMessage("Company name and code are required.")
      return
    }

    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      setMessage("Enter a valid email address.")
      return
    }

    const nextDraft = {
      ...draft,
      sisterCompanies: draft.sisterCompanies.filter((company) => company.name.trim()),
    }

    try {
      const session = buildSessionContext()
      const formData = buildOrganizationFormData(session, nextDraft)
      const result = await saveOrganizationProfile(session, formData)

      if (!result.success) {
        setMessage(result.message || "Unable to save institute profile.")
        return
      }

      setProfile(nextDraft)
      setIsEditing(false)
      setMessage(result.message || "Institute profile updated.")
      await loadProfile()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save institute profile."
      )
    }
  }

  function updateField(field: OrganizationField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setMessage("")
  }

  function toggleWorkingDay(day: string) {
    setDraft((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day],
    }))
  }

  function updateSisterCompany(
    id: string,
    field: keyof SisterCompany,
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      sisterCompanies: current.sisterCompanies.map((company) =>
        company.id === id ? { ...company, [field]: value } : company
      ),
    }))
  }

  function removeSisterCompany(id: string) {
    setDraft((current) => ({
      ...current,
      sisterCompanies: current.sisterCompanies.filter((company) => company.id !== id),
    }))
  }

  function openNewSisterCompany() {
    setSisterForm({
      mode: "add",
      draft: createSisterCompanyProfile(),
    })
    setIsEditing(false)
    setSearchTerm("")
    setPage(1)
  }

  function openEditSisterCompany(company: SisterCompany) {
    setSisterForm({
      mode: "edit",
      id: company.id,
      draft: createSisterCompanyProfile(company),
    })
    setIsEditing(false)
  }

  function updateSisterFormField(field: OrganizationField, value: string) {
    setSisterForm((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              [field]: value,
            },
          }
        : current
    )
  }

  function toggleSisterWorkingDay(day: string) {
    setSisterForm((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              workingDays: current.draft.workingDays.includes(day)
                ? current.draft.workingDays.filter((item) => item !== day)
                : [...current.draft.workingDays, day],
            },
          }
        : current
    )
  }

  async function handleSaveSisterCompany() {
    if (!sisterForm) return

    const companyName = sisterForm.draft.organizationName.trim()
    if (!companyName) {
      setMessage("Sister company name is required.")
      return
    }

    const nextCompany: SisterCompany = {
      id: sisterForm.id ?? `company-${Date.now()}`,
      name: companyName,
      relationship: "Sister Company",
      status:
        sisterForm.draft.status === "Inactive"
          ? "Inactive"
          : "Active",
      profile: {
        ...sisterForm.draft,
        organizationName: companyName,
        sisterCompanies: [],
      },
    }

    const nextSisterCompanies =
      sisterForm.mode === "edit"
        ? profile.sisterCompanies.map((company) =>
            company.id === nextCompany.id ? nextCompany : company
          )
        : [...profile.sisterCompanies, nextCompany]

    try {
      const session = buildSessionContext()
      // Sister companies are a full replace: always send them alongside the
      // (unmodified) main profile fields, since the sister form itself only
      // opens while the main profile is not being edited.
      const formData = buildOrganizationFormData(session, {
        ...profile,
        sisterCompanies: nextSisterCompanies,
      })
      const result = await saveOrganizationProfile(session, formData)

      if (!result.success) {
        setMessage(result.message || "Unable to save sister company.")
        return
      }

      setProfile((current) => ({ ...current, sisterCompanies: nextSisterCompanies }))
      setDraft((current) => ({ ...current, sisterCompanies: nextSisterCompanies }))
      setSisterForm(null)
      setMessage(result.message || "Sister company saved.")
      await loadProfile()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save sister company."
      )
    }
  }

  function closeSisterForm() {
    setSisterForm(null)
    setMessage("")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4 text-[12px] text-slate-950">
        <Card className={cn(cardSurfaceClass, "items-center px-8 py-6 text-center")}>
          <p className="text-sm font-semibold text-slate-950">Loading institute profile…</p>
        </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4 text-[12px] text-slate-950">
        <Card className={cn(cardSurfaceClass, "items-center px-8 py-6 text-center")}>
          <p className="text-sm font-semibold text-red-600">{loadError}</p>
        </Card>
      </div>
    )
  }

  if (sisterForm) {
    const sisterDraft = sisterForm.draft
    const breadcrumbEnd =
      sisterForm.mode === "add"
        ? "New Sister Company"
        : sisterDraft.organizationName || "Edit Sister Company"

    return (
      <form
        onSubmit={handleSave}
        className="min-h-screen bg-[#f6f8fb] px-4 py-0 text-[12px] text-slate-950 sm:px-5 lg:px-6"
      >
        <div className="mx-auto flex w-full max-w-[1160px] min-w-0 flex-col gap-6 py-4">
          <Card
            size="sm"
            className="flex min-h-[58px] flex-row items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600">
                <Building2 className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="flex min-w-0 items-center gap-1 text-sm font-semibold">
                  <button
                    type="button"
                    className="truncate text-slate-950 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={closeSisterForm}
                  >
                    {profile.organizationName}
                  </button>
                  <span className="shrink-0 text-slate-400">/</span>
                  <span className="truncate text-slate-950" aria-current="page">
                    {breadcrumbEnd}
                  </span>
                </h1>
                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                  Manage sister company core information
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-3 text-xs"
              onClick={closeSisterForm}
            >
              <X className="size-4" aria-hidden="true" />
              Back
            </Button>
          </Card>

          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(240px,304px)_minmax(0,1fr)]">
            <Card className={cn(cardSurfaceClass, "min-h-[432px] border-x border-b border-t-0")}>
              <h2 className="text-base font-semibold">Company Logo</h2>
              <div className="mt-6 flex flex-col items-center">
                <div className="flex size-[102px] items-center justify-center rounded-xl bg-[#2f66e8] text-2xl font-bold text-white shadow-lg shadow-blue-500/20">
                  {sisterDraft.brandName || "SC"}
                </div>
                <Input
                  value={sisterDraft.brandName}
                  onChange={(event) => updateSisterFormField("brandName", event.target.value)}
                  className="mt-5 h-8 max-w-[150px] rounded-[10px] bg-white text-center"
                  aria-label="Company logo text"
                />
              </div>
              <div className="mt-6 space-y-4">
                <ReadField label="Founded" value={sisterDraft.establishedDate || "Pending"} />
                <ReadField label="Total Employees" value={sisterDraft.totalEmployees} />
              </div>
            </Card>

            <Card className={cn(cardSurfaceClass, "border-x border-b border-t-0")}>
              <SectionTitle
                title="Company Details"
                description="Core registration and identity information."
              />
              <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <EditableField
                  id="sisterOrganizationName"
                  label="Company Name"
                  value={sisterDraft.organizationName}
                  required
                  onChange={(value) => updateSisterFormField("organizationName", value)}
                />
                <EditableField
                  id="sisterOrganizationCode"
                  label="Company Code"
                  value={sisterDraft.organizationCode}
                  required
                  onChange={(value) => updateSisterFormField("organizationCode", value)}
                />
                <EditableField
                  id="sisterRegistrationNo"
                  label="Registration Number"
                  value={sisterDraft.registrationNo}
                  required
                  autoFocus
                  onChange={(value) => updateSisterFormField("registrationNo", value)}
                />
                <EditableSelect
                  label="Industry"
                  value={sisterDraft.industryType}
                  options={options.industryType}
                  required
                  onChange={(value) => updateSisterFormField("industryType", value)}
                />
                <EditableSelect
                  label="Organization Type"
                  value={sisterDraft.organizationType}
                  options={options.organizationType}
                  required
                  onChange={(value) => updateSisterFormField("organizationType", value)}
                />
                <EditableSelect
                  label="Business Type"
                  value={sisterDraft.businessType}
                  options={options.businessType}
                  required
                  onChange={(value) => updateSisterFormField("businessType", value)}
                />
                <EditableField
                  id="sisterEstablishedDate"
                  label="Established Date"
                  type="date"
                  value={sisterDraft.establishedDate}
                  required
                  onChange={(value) => updateSisterFormField("establishedDate", value)}
                />
                <EditableField
                  id="sisterTotalEmployees"
                  label="Total Employees"
                  value={sisterDraft.totalEmployees}
                  required
                  onChange={(value) => updateSisterFormField("totalEmployees", value)}
                />
                <EditableField
                  id="sisterGstNo"
                  label="GST No."
                  value={sisterDraft.gstNo}
                  required
                  onChange={(value) => updateSisterFormField("gstNo", value)}
                />
                <EditableField
                  id="sisterPanNo"
                  label="PAN No."
                  value={sisterDraft.panNo}
                  required
                  onChange={(value) => updateSisterFormField("panNo", value)}
                />
                <EditableField
                  id="sisterWebsite"
                  label="Website"
                  value={sisterDraft.website}
                  onChange={(value) => updateSisterFormField("website", value)}
                />
                <EditableTextarea
                  id="sisterCompanyDescription"
                  label="Company Description"
                  value={sisterDraft.companyDescription}
                  className="md:col-span-2"
                  required
                  onChange={(value) => updateSisterFormField("companyDescription", value)}
                />
              </div>
            </Card>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
            <Card className={cn(cardSurfaceClass, "min-h-[344px]")}>
              <SectionTitle title="Contact Information" />
              <div className="mt-6 grid grid-cols-1 gap-4">
                <EditableField
                  id="sisterEmail"
                  label="Email Address"
                  type="email"
                  value={sisterDraft.email}
                  required
                  onChange={(value) => updateSisterFormField("email", value)}
                />
                <EditableField
                  id="sisterPhone"
                  label="Phone Number"
                  value={sisterDraft.phone}
                  required
                  onChange={(value) => updateSisterFormField("phone", value)}
                />
              </div>
            </Card>

            <Card className={cn(cardSurfaceClass, "min-h-[344px]")}>
              <SectionTitle title="Registered Address" />
              <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <EditableField
                  id="sisterAddressLine1"
                  label="Address Line 1"
                  value={sisterDraft.addressLine1}
                  required
                  className="md:col-span-2"
                  onChange={(value) => updateSisterFormField("addressLine1", value)}
                />
                <EditableField
                  id="sisterAddressLine2"
                  label="Address Line 2"
                  value={sisterDraft.addressLine2}
                  className="md:col-span-2"
                  onChange={(value) => updateSisterFormField("addressLine2", value)}
                />
                <EditableField
                  id="sisterCity"
                  label="City"
                  value={sisterDraft.city}
                  required
                  onChange={(value) => updateSisterFormField("city", value)}
                />
                <EditableField
                  id="sisterState"
                  label="State"
                  value={sisterDraft.state}
                  required
                  onChange={(value) => updateSisterFormField("state", value)}
                />
                <EditableField
                  id="sisterPostalCode"
                  label="Postal Code"
                  value={sisterDraft.postalCode}
                  required
                  onChange={(value) => updateSisterFormField("postalCode", value)}
                />
                <EditableSelect
                  label="Country"
                  value={sisterDraft.country}
                  options={options.country}
                  required
                  onChange={(value) => updateSisterFormField("country", value)}
                />
              </div>
            </Card>
          </div>

          <Card className={cardSurfaceClass}>
            <SectionTitle title="Settings" />
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <EditableSelect
                label="Status"
                value={sisterDraft.status}
                options={options.status}
                onChange={(value) => updateSisterFormField("status", value)}
              />
              <EditableSelect
                label="Time Zone"
                value={sisterDraft.timeZone}
                options={options.timeZone}
                onChange={(value) => updateSisterFormField("timeZone", value)}
              />
              <EditableSelect
                label="Currency"
                value={sisterDraft.currency}
                options={options.currency}
                onChange={(value) => updateSisterFormField("currency", value)}
              />
              <EditableSelect
                label="Financial Year"
                value={sisterDraft.financialYear}
                options={options.financialYear}
                onChange={(value) => updateSisterFormField("financialYear", value)}
              />
              <EditableSelect
                label="Date Format"
                value={sisterDraft.dateFormat}
                options={options.dateFormat}
                onChange={(value) => updateSisterFormField("dateFormat", value)}
              />
              <EditableSelect
                label="Language"
                value={sisterDraft.language}
                options={options.language}
                onChange={(value) => updateSisterFormField("language", value)}
              />
              <WorkingDays
                days={sisterDraft.workingDays}
                isEditing
                onToggle={toggleSisterWorkingDay}
              />
            </div>
          </Card>

          <Card className="flex flex-row flex-wrap items-center justify-end gap-2 rounded-xl bg-white px-5 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            <Button type="button" variant="outline" onClick={closeSisterForm}>
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
              <Send className="size-4" aria-hidden="true" />
              Save Sister Company
            </Button>
          </Card>
        </div>
      </form>
    )
  }

  return (
    <form
      onSubmit={handleSave}
      className="min-h-screen bg-[#f6f8fb] px-4 py-0 text-[12px] text-slate-950 sm:px-5 lg:px-6"
    >
      <div className="mx-auto flex w-full max-w-[1160px] min-w-0 flex-col gap-6 py-4">
        <Card
          size="sm"
          className="flex min-h-[58px] flex-row items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600">
              <Landmark className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-950">
                Institute Profile
              </h1>
              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                Manage your institute&apos;s core information
              </p>
            </div>
          </div>
          <HeaderActions isEditing={isEditing} onCancel={handleCancel} onEdit={handleEdit} />
        </Card>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(240px,304px)_minmax(0,1fr)]">
          <Card
            className={cn(
              cardSurfaceClass,
              "border-x border-b border-t-0",
              isEditing && "min-h-[432px]"
            )}
          >
            <h2 className="text-base font-semibold">Company Logo</h2>
            <div className={cn("flex flex-col items-center", isEditing ? "mt-6" : "mt-5")}>
              <div className="flex size-[102px] items-center justify-center rounded-xl bg-[#2f66e8] text-2xl font-bold text-white shadow-lg shadow-blue-500/20">
                {currentProfile.brandName || "ATP"}
              </div>
              {isEditing && (
                <Input
                  value={draft.brandName}
                  onChange={(event) => updateField("brandName", event.target.value)}
                  className="mt-5 h-8 max-w-[150px] rounded-[10px] bg-white text-center"
                  aria-label="Company logo text"
                />
              )}
            </div>
            <div className={cn("space-y-4", isEditing ? "mt-6" : "mt-5")}>
              <ReadField label="Founded" value={currentProfile.establishedDate || "Pending"} />
              <ReadField label="Total Employees" value={currentProfile.totalEmployees} />
            </div>
          </Card>

          <Card className={cn(cardSurfaceClass, "border-x border-b border-t-0")}>
            <SectionTitle
              title="Company Details"
              description="Core registration and identity information."
            />
            <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
              <EditableField
                id="organizationName"
                label="Company Name"
                value={currentProfile.organizationName}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("organizationName", value)}
              />
              <EditableField
                id="organizationCode"
                label="Company Code"
                value={currentProfile.organizationCode}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("organizationCode", value)}
              />
              <EditableField
                id="registrationNo"
                label="Registration Number"
                value={currentProfile.registrationNo}
                required
                autoFocus={isEditing}
                disabled={!isEditing}
                onChange={(value) => updateField("registrationNo", value)}
              />
              <EditableSelect
                label="Industry"
                value={currentProfile.industryType}
                options={options.industryType}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("industryType", value)}
              />
              <EditableSelect
                label="Organization Type"
                value={currentProfile.organizationType}
                options={options.organizationType}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("organizationType", value)}
              />
              <EditableSelect
                label="Business Type"
                value={currentProfile.businessType}
                options={options.businessType}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("businessType", value)}
              />
              <EditableField
                id="establishedDate"
                label="Established Date"
                type="date"
                value={currentProfile.establishedDate}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("establishedDate", value)}
              />
              <EditableField
                id="totalEmployees"
                label="Total Employees"
                value={currentProfile.totalEmployees}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("totalEmployees", value)}
              />
              <EditableField
                id="gstNo"
                label="GST No."
                value={currentProfile.gstNo}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("gstNo", value)}
              />
              <EditableField
                id="panNo"
                label="PAN No."
                value={currentProfile.panNo}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("panNo", value)}
              />
              <EditableField
                id="website"
                label="Website"
                value={currentProfile.website}
                disabled={!isEditing}
                onChange={(value) => updateField("website", value)}
              />
              <EditableTextarea
                id="companyDescription"
                label="Company Description"
                value={currentProfile.companyDescription}
                className="md:col-span-2"
                disabled={!isEditing}
                required
                onChange={(value) => updateField("companyDescription", value)}
              />
            </div>
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className={cn(cardSurfaceClass, isEditing && "min-h-[344px]")}>
            <SectionTitle title="Contact Information" />
            <div className="mt-6 grid grid-cols-1 gap-4">
              <EditableField
                id="email"
                label="Email Address"
                type="email"
                value={currentProfile.email}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("email", value)}
              />
              <EditableField
                id="phone"
                label="Phone Number"
                value={currentProfile.phone}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("phone", value)}
              />
            </div>
          </Card>

          <Card className={cn(cardSurfaceClass, isEditing && "min-h-[344px]")}>
            <SectionTitle title="Registered Address" />
            <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
              <EditableField
                id="addressLine1"
                label="Address Line 1"
                value={currentProfile.addressLine1}
                required
                disabled={!isEditing}
                className="md:col-span-2"
                onChange={(value) => updateField("addressLine1", value)}
              />
              <EditableField
                id="addressLine2"
                label="Address Line 2"
                value={currentProfile.addressLine2}
                disabled={!isEditing}
                className="md:col-span-2"
                onChange={(value) => updateField("addressLine2", value)}
              />
              <EditableField
                id="city"
                label="City"
                value={currentProfile.city}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("city", value)}
              />
              <EditableField
                id="state"
                label="State"
                value={currentProfile.state}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("state", value)}
              />
              <EditableField
                id="postalCode"
                label="Postal Code"
                value={currentProfile.postalCode}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("postalCode", value)}
              />
              <EditableSelect
                label="Country"
                value={currentProfile.country}
                options={options.country}
                required
                disabled={!isEditing}
                onChange={(value) => updateField("country", value)}
              />
            </div>
          </Card>
        </div>

        <Card className={cardSurfaceClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle
              title="Sister Companies"
              icon={<Building2 className="size-4 text-blue-600" aria-hidden="true" />}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg border border-blue-200 bg-white px-3 text-blue-600 shadow-sm hover:bg-blue-50"
              onClick={openNewSisterCompany}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Sister Company
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[403px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setPage(1)
                }}
                placeholder="Search companies..."
                className="h-[26px] rounded-lg bg-white pl-9 text-[11px]"
                aria-label="Search companies"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg bg-white px-3 shadow-sm"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filter
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="h-9 px-4 text-[11px] font-semibold text-slate-950">
                    Company Name
                  </TableHead>
                  <TableHead className="h-9 px-4 text-[11px] font-semibold text-slate-950">
                    Relationship Type
                  </TableHead>
                  <TableHead className="h-9 px-4 text-[11px] font-semibold text-slate-950">
                    Status
                  </TableHead>
                  <TableHead className="h-9 px-4 text-[11px] font-semibold text-slate-950">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                      No sister companies found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedCompanies.map((company) => (
                    <TableRow key={company.id} className="h-12 odd:bg-white even:bg-slate-50">
                      <TableCell className="px-4 font-semibold">
                        {isEditing ? (
                          <Input
                            value={company.name}
                            onChange={(event) =>
                              updateSisterCompany(company.id, "name", event.target.value)
                            }
                            className="h-8 rounded-lg bg-white"
                          />
                        ) : (
                          company.name
                        )}
                      </TableCell>
                      <TableCell className="px-4 text-slate-700">
                        {isEditing ? (
                          <Input
                            value={company.relationship}
                            onChange={(event) =>
                              updateSisterCompany(company.id, "relationship", event.target.value)
                            }
                            className="h-8 rounded-lg bg-white"
                          />
                        ) : (
                          company.relationship
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        {isEditing ? (
                          <Select
                            value={company.status}
                            onValueChange={(value) =>
                              updateSisterCompany(company.id, "status", value ?? "Active")
                            }
                          >
                            <SelectTrigger variant="soft" className="h-8 w-[118px] bg-white">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <StatusBadge status={company.status} />
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            aria-label={`Edit ${company.name || "sister company"}`}
                            onClick={() => openEditSisterCompany(company)}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${company.name || "sister company"}`}
                            disabled={!isEditing}
                            onClick={() => removeSisterCompany(company.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-[11px] text-slate-600">
              Showing {rangeStart} to {rangeEnd} of {visibleCompanies.length} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full bg-white"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {currentPage}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full bg-white"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

        </Card>

        <Card className={cardSurfaceClass}>
          <SectionTitle title="Settings" />
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <EditableSelect
              label="Time Zone"
              value={currentProfile.timeZone}
              options={options.timeZone}
              disabled={!isEditing}
              onChange={(value) => updateField("timeZone", value)}
            />
            <EditableSelect
              label="Currency"
              value={currentProfile.currency}
              options={options.currency}
              disabled={!isEditing}
              onChange={(value) => updateField("currency", value)}
            />
            <EditableSelect
              label="Financial Year"
              value={currentProfile.financialYear}
              options={options.financialYear}
              disabled={!isEditing}
              onChange={(value) => updateField("financialYear", value)}
            />
            <EditableSelect
              label="Date Format"
              value={currentProfile.dateFormat}
              options={options.dateFormat}
              disabled={!isEditing}
              onChange={(value) => updateField("dateFormat", value)}
            />
            <EditableSelect
              label="Language"
              value={currentProfile.language}
              options={options.language}
              disabled={!isEditing}
              onChange={(value) => updateField("language", value)}
            />
            <EditableSelect
              label="Number Format"
              value={currentProfile.numberFormat}
              options={options.numberFormat}
              disabled={!isEditing}
              onChange={(value) => updateField("numberFormat", value)}
            />
            <WorkingDays
              days={currentProfile.workingDays}
              isEditing={isEditing}
              onToggle={toggleWorkingDay}
            />
          </div>
        </Card>

        {isEditing && (
          <Card className="flex flex-row flex-wrap items-center justify-end gap-2 rounded-xl bg-white px-5 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
              <Send className="size-4" aria-hidden="true" />
              Save & Publish
            </Button>
          </Card>
        )}
      </div>
    </form>
  )
}

function HeaderActions({
  isEditing,
  onCancel,
  onEdit,
}: {
  isEditing: boolean
  onCancel: () => void
  onEdit: () => void
}) {
  return isEditing ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 rounded-md px-3 text-xs"
      onClick={onCancel}
    >
      <X className="size-4" aria-hidden="true" />
      Cancel
    </Button>
  ) : (
    <Button
      type="button"
      size="sm"
      onClick={onEdit}
      className="h-8 rounded-md bg-blue-600 px-4 text-xs text-white hover:bg-blue-700"
    >
      <Pencil className="size-3.5" aria-hidden="true" />
      Edit
    </Button>
  )
}

function SectionTitle({
  title,
  description,
  icon,
}: {
  title: string
  description?: string
  icon?: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      {description && <p className="mt-2 text-xs text-slate-600">{description}</p>}
    </div>
  )
}

function ReadField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
        {label}
      </dt>
      <dd className="mt-2 min-w-0 text-xs font-semibold leading-5 text-slate-950">
        {value || "Pending"}
      </dd>
    </div>
  )
}

function ReadonlyField({
  label,
  value,
  className,
  multiline = false,
}: {
  label: string
  value: ReactNode
  className?: string
  multiline?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline gap-1.5 py-1 text-xs leading-5",
        multiline && "items-start",
        className
      )}
    >
      <dt className="shrink-0 font-semibold text-slate-950">{label}:</dt>
      <dd
        className={cn(
          "min-w-0 font-normal text-slate-800",
          multiline ? "whitespace-pre-wrap" : "truncate"
        )}
      >
        {value || <span className="text-slate-500">Pending</span>}
      </dd>
    </div>
  )
}

function formatReadonlyValue(value: string, type: string) {
  if (!value) return ""

  if (type !== "date") return value

  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}-${month}-${year}` : value
}

function EditableField({
  id,
  label,
  value,
  onChange,
  className,
  type = "text",
  required = false,
  disabled = false,
  autoFocus = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  type?: string
  required?: boolean
  disabled?: boolean
  autoFocus?: boolean
}) {
  if (disabled) {
    return (
      <ReadonlyField
        className={className}
        label={label}
        value={formatReadonlyValue(value, type)}
      />
    )
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-semibold text-slate-950">
        {label}
        {required && <span className="text-blue-600"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        className="h-[29px] rounded-[10px] border-slate-200 bg-white px-3 text-xs shadow-none disabled:cursor-default disabled:opacity-100"
      />
    </div>
  )
}

function EditableTextarea({
  id,
  label,
  value,
  onChange,
  className,
  required = false,
  disabled = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
  disabled?: boolean
}) {
  if (disabled) {
    return <ReadonlyField className={className} label={label} value={value} multiline />
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-semibold text-slate-950">
        {label}
        {required && <span className="text-blue-600"> *</span>}
      </Label>
      <Textarea
        id={id}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-20 rounded-[10px] border-slate-200 bg-white px-3 py-2 text-xs shadow-none disabled:cursor-default disabled:opacity-100"
      />
    </div>
  )
}

function EditableSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}) {
  if (disabled) {
    return <ReadonlyField label={label} value={value} />
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs font-semibold text-slate-950">
        {label}
        {required && <span className="text-blue-600"> *</span>}
      </Label>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue ?? "")}
        disabled={disabled}
      >
        <SelectTrigger
          variant="soft"
          className="h-[29px] rounded-[10px] border border-slate-200 bg-white px-3 text-xs shadow-none disabled:cursor-default disabled:opacity-100"
        >
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Active") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-600 hover:bg-emerald-50">
        {status}
      </Badge>
    )
  }

  if (status === "Inactive") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-[11px] text-red-500 hover:bg-red-50">
        {status}
      </Badge>
    )
  }

  return (
    <Badge className="border border-amber-200 bg-amber-50 text-[11px] text-amber-700 hover:bg-amber-50">
      {status}
    </Badge>
  )
}

function WorkingDays({
  days,
  isEditing = false,
  onToggle,
}: {
  days: string[]
  isEditing?: boolean
  onToggle?: (day: string) => void
}) {
  return (
    <div className="md:col-span-2 lg:col-span-3">
      <Label className="text-xs font-semibold text-slate-950">Working Days</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {allDays.map((day) =>
          isEditing ? (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={days.includes(day) ? "default" : "outline"}
              className={cn(days.includes(day) && "bg-blue-600 text-white hover:bg-blue-700")}
              onClick={() => onToggle?.(day)}
            >
              {day}
            </Button>
          ) : (
            <Badge
              key={day}
              className={cn(
                "border text-[11px]",
                days.includes(day)
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-white"
              )}
            >
              {day}
            </Badge>
          )
        )}
      </div>
    </div>
  )
}
