"use client"

import { FormEvent, ReactNode, useState } from "react"
import {
  ChevronRight,
  Eye,
  Filter,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
}

const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const options = {
  organizationType: ["Company", "Partnership", "LLP", "Trust", "Society"],
  businessType: ["Private Limited", "Public Limited", "Partnership", "Non Profit"],
  industryType: ["Education", "Information Technology", "Healthcare", "Manufacturing"],
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
  organizationName: "Greenfield K12 Academy",
  organizationCode: "GKA-2026",
  organizationType: "Company",
  businessType: "Private Limited",
  industryType: "Education",
  establishedDate: "2008-06-12",
  registrationNo: "REG-K12-45128",
  gstNo: "27AAACG1234H1Z5",
  panNo: "AAACG1234H",
  website: "https://greenfieldacademy.edu",
  companyDescription:
    "A K12 education organization focused on academics, arts, sports, and learner-centered digital experiences.",
  email: "office@greenfieldacademy.edu",
  phone: "+91 22 4567 8901",
  alternatePhone: "+91 22 4567 8902",
  addressLine1: "18 Knowledge Park Road, Sector 5",
  addressLine2: "Powai",
  country: "India",
  state: "Maharashtra",
  city: "Mumbai",
  postalCode: "400076",
  brandName: "Greenfield Academy",
  tagline: "Learn. Lead. Grow.",
  brandDescription:
    "A student-first brand identity used across campuses, admissions, portals, and communications.",
  timeZone: "(IST) Asia/Kolkata",
  currency: "INR - Indian Rupee",
  financialYear: "April - March",
  dateFormat: "DD/MM/YYYY",
  language: "English",
  numberFormat: "1,234.56",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  sisterCompanies: [
    {
      id: "company-1",
      name: "Greenfield Junior Campus",
      relationship: "Sister Company",
      status: "Active",
    },
    {
      id: "company-2",
      name: "Greenfield Learning Centre",
      relationship: "Sister Company",
      status: "Active",
    },
    {
      id: "company-3",
      name: "Greenfield Global Services LLP",
      relationship: "Sister Company",
      status: "Inactive",
    },
  ],
}

const PAGE_SIZE = 5

function createSisterCompany(): SisterCompany {
  return {
    id: `company-${Date.now()}`,
    name: "",
    relationship: "Sister Company",
    status: "Active",
  }
}

export default function OrganizationProfilePage() {
  const [profile, setProfile] = useState<OrganizationProfile>(initialProfile)
  const [draft, setDraft] = useState<OrganizationProfile>(initialProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)

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

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.organizationName.trim() || !draft.organizationCode.trim()) {
      setMessage("Organization name and code are required.")
      return
    }

    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      setMessage("Enter a valid email address.")
      return
    }

    setProfile({
      ...draft,
      sisterCompanies: draft.sisterCompanies.filter((company) => company.name.trim()),
    })
    setIsEditing(false)
    setMessage("Organization profile updated.")
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

  const rangeStart = visibleCompanies.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, visibleCompanies.length)

  return (
    <form
      onSubmit={handleSave}
      className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={currentProfile.status} />
              {!isEditing && <Badge variant="outline">View Mode</Badge>}
            </div>
            <h1 className="mt-3 text-xl font-semibold text-slate-950">
              Organization Profile
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Registration, contact, branding, linked company, and settings details.
            </p>
            {message && (
              <p
                className={cn(
                  "mt-2 text-sm font-medium",
                  isEditing ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {message}
              </p>
            )}
          </div>

          <HeaderActions
            isEditing={isEditing}
            onCancel={handleCancel}
            onEdit={handleEdit}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Branding">
            {isEditing ? (
              <div className="grid grid-cols-1 gap-5">
                <LogoBlock brandName={draft.brandName} showAction />
                <EditableField
                  id="brandName"
                  label="Brand Name"
                  value={draft.brandName}
                  required
                  onChange={(value) => updateField("brandName", value)}
                />
                <EditableField
                  id="tagline"
                  label="Tagline"
                  value={draft.tagline}
                  onChange={(value) => updateField("tagline", value)}
                />
                <EditableTextarea
                  id="brandDescription"
                  label="Brand Description"
                  value={draft.brandDescription}
                  onChange={(value) => updateField("brandDescription", value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <LogoBlock brandName={profile.brandName} />
                <div className="flex flex-col gap-5">
                  <ReadField label="Brand Name" value={profile.brandName} />
                  <ReadField label="Tagline" value={profile.tagline} />
                </div>
                <ReadField label="Brand Description" value={profile.brandDescription} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Contact Details">
            {isEditing ? (
              <div className="grid grid-cols-1 gap-5">
                <EditableField
                  id="email"
                  label="Email"
                  type="email"
                  value={draft.email}
                  required
                  onChange={(value) => updateField("email", value)}
                />
                <EditableField
                  id="phone"
                  label="Phone"
                  value={draft.phone}
                  required
                  onChange={(value) => updateField("phone", value)}
                />
                <EditableField
                  id="alternatePhone"
                  label="Alternate Phone"
                  value={draft.alternatePhone}
                  onChange={(value) => updateField("alternatePhone", value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <ReadField label="Email" value={profile.email} />
                <ReadField label="Phone" value={profile.phone} />
                <ReadField label="Alternate Phone" value={profile.alternatePhone} />
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Contact Information">
            {isEditing ? (
              <div className="grid grid-cols-1 gap-5">
                <EditableField
                  id="organizationName"
                  label="Organization Name"
                  value={draft.organizationName}
                  required
                  onChange={(value) => updateField("organizationName", value)}
                />
                <EditableField
                  id="organizationCode"
                  label="Organization Code"
                  value={draft.organizationCode}
                  required
                  onChange={(value) => updateField("organizationCode", value)}
                />
                <EditableSelect
                  label="Organization Type"
                  value={draft.organizationType}
                  options={options.organizationType}
                  onChange={(value) => updateField("organizationType", value)}
                />
                <EditableSelect
                  label="Business Type"
                  value={draft.businessType}
                  options={options.businessType}
                  onChange={(value) => updateField("businessType", value)}
                />
                <EditableSelect
                  label="Industry Type"
                  value={draft.industryType}
                  options={options.industryType}
                  onChange={(value) => updateField("industryType", value)}
                />
                <EditableSelect
                  label="Status"
                  value={draft.status}
                  options={options.status}
                  onChange={(value) => updateField("status", value)}
                />
                <EditableField
                  id="establishedDate"
                  label="Established Date"
                  type="date"
                  value={draft.establishedDate}
                  onChange={(value) => updateField("establishedDate", value)}
                />
                <EditableField
                  id="registrationNo"
                  label="Registration No."
                  value={draft.registrationNo}
                  onChange={(value) => updateField("registrationNo", value)}
                />
                <EditableField
                  id="gstNo"
                  label="GST No."
                  value={draft.gstNo}
                  onChange={(value) => updateField("gstNo", value)}
                />
                <EditableField
                  id="panNo"
                  label="PAN No."
                  value={draft.panNo}
                  onChange={(value) => updateField("panNo", value)}
                />
                <EditableField
                  id="website"
                  label="Website"
                  value={draft.website}
                  onChange={(value) => updateField("website", value)}
                />
                <EditableTextarea
                  id="companyDescription"
                  label="Company Description"
                  value={draft.companyDescription}
                  onChange={(value) => updateField("companyDescription", value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <ReadField label="Organization Name" value={profile.organizationName} />
                <ReadField label="Organization Code" value={profile.organizationCode} />
                <ReadField label="Organization Type" value={profile.organizationType} />
                <ReadField label="Business Type" value={profile.businessType} />
                <ReadField label="Industry Type" value={profile.industryType} />
                <ReadField label="Status" value={profile.status} />
                <ReadField label="Established Date" value={profile.establishedDate} />
                <ReadField label="Registration No." value={profile.registrationNo} />
                <ReadField label="GST No." value={profile.gstNo} />
                <ReadField label="PAN No." value={profile.panNo} />
                <ReadField label="Website" value={profile.website} />
                <ReadField label="Company Description" value={profile.companyDescription} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Address">
            {isEditing ? (
              <div className="grid grid-cols-1 gap-5">
                <EditableField
                  id="addressLine1"
                  label="Address Line 1"
                  value={draft.addressLine1}
                  required
                  onChange={(value) => updateField("addressLine1", value)}
                />
                <EditableField
                  id="addressLine2"
                  label="Address Line 2"
                  value={draft.addressLine2}
                  onChange={(value) => updateField("addressLine2", value)}
                />
                <EditableSelect
                  label="Country"
                  value={draft.country}
                  options={options.country}
                  onChange={(value) => updateField("country", value)}
                />
                <EditableField
                  id="state"
                  label="State"
                  value={draft.state}
                  required
                  onChange={(value) => updateField("state", value)}
                />
                <EditableField
                  id="city"
                  label="City"
                  value={draft.city}
                  required
                  onChange={(value) => updateField("city", value)}
                />
                <EditableField
                  id="postalCode"
                  label="Postal Code"
                  value={draft.postalCode}
                  required
                  onChange={(value) => updateField("postalCode", value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <ReadField label="Address Line 1" value={profile.addressLine1} />
                <ReadField label="Address Line 2" value={profile.addressLine2} />
                <ReadField label="Country" value={profile.country} />
                <ReadField label="State" value={profile.state} />
                <ReadField label="City" value={profile.city} />
                <ReadField label="Postal Code" value={profile.postalCode} />
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Sister Companies"
          actions={
            isEditing ? (
              <Button
                type="button"
                size="sm"
                className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    sisterCompanies: [...current.sisterCompanies, createSisterCompany()],
                  }))
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Add Sister Company
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search sister companies..."
                  className="h-9 bg-white pl-9"
                  aria-label="Search sister companies"
                />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-9">
                <Filter className="size-4" aria-hidden="true" />
                Filter
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Relationship Type</TableHead>
                  <TableHead>Status</TableHead>
                  {isEditing && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isEditing ? 4 : 3}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      No sister companies found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={company.name}
                            onChange={(event) =>
                              updateSisterCompany(company.id, "name", event.target.value)
                            }
                            className="bg-white"
                          />
                        ) : (
                          company.name
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={company.relationship}
                            onChange={(event) =>
                              updateSisterCompany(company.id, "relationship", event.target.value)
                            }
                            className="bg-white"
                          />
                        ) : (
                          company.relationship
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={company.status}
                            onValueChange={(value) =>
                              updateSisterCompany(company.id, "status", value ?? "Active")
                            }
                          >
                            <SelectTrigger variant="soft" className="bg-white">
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
                      {isEditing && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90"
                              aria-label={`View ${company.name || "sister company"}`}
                            >
                              <Eye className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90"
                              aria-label={`Edit ${company.name || "sister company"}`}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="destructive"
                              aria-label={`Remove ${company.name || "sister company"}`}
                              onClick={() => removeSisterCompany(company.id)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Showing {rangeStart} to {rangeEnd} of {visibleCompanies.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs font-medium text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Settings (Overview)"
          actions={
            !isEditing ? (
              <Button
                type="button"
                size="sm"
                className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90"
                onClick={handleEdit}
              >
                View &amp; Edit Settings
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            ) : undefined
          }
        >
          {isEditing ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              <EditableSelect
                label="Time Zone"
                value={draft.timeZone}
                options={options.timeZone}
                onChange={(value) => updateField("timeZone", value)}
              />
              <EditableSelect
                label="Currency"
                value={draft.currency}
                options={options.currency}
                onChange={(value) => updateField("currency", value)}
              />
              <EditableSelect
                label="Financial Year"
                value={draft.financialYear}
                options={options.financialYear}
                onChange={(value) => updateField("financialYear", value)}
              />
              <EditableSelect
                label="Date Format"
                value={draft.dateFormat}
                options={options.dateFormat}
                onChange={(value) => updateField("dateFormat", value)}
              />
              <EditableSelect
                label="Language"
                value={draft.language}
                options={options.language}
                onChange={(value) => updateField("language", value)}
              />
              <EditableSelect
                label="Number Format"
                value={draft.numberFormat}
                options={options.numberFormat}
                onChange={(value) => updateField("numberFormat", value)}
              />
              <WorkingDays
                days={draft.workingDays}
                isEditing
                onToggle={toggleWorkingDay}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Time Zone" value={profile.timeZone} />
              <ReadField label="Currency" value={profile.currency} />
              <ReadField label="Financial Year" value={profile.financialYear} />
              <ReadField label="Date Format" value={profile.dateFormat} />
              <ReadField label="Language" value={profile.language} />
              <ReadField label="Number Format" value={profile.numberFormat} />
              <WorkingDays days={profile.workingDays} />
            </div>
          )}
        </SectionCard>

        {isEditing && (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => setMessage("Draft saved.")}>
              <Save className="size-4" aria-hidden="true" />
              Save Draft
            </Button>
            <Button type="submit" className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90">
              <Send className="size-4" aria-hidden="true" />
              Save &amp; Publish
            </Button>
          </div>
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isEditing ? (
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
          <Button type="button" variant="outline">
            <Save className="size-4" aria-hidden="true" />
            Save Draft
          </Button>
          <Button type="submit" className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90">
            <Send className="size-4" aria-hidden="true" />
            Save &amp; Publish
          </Button>
        </>
      ) : (
        <Button
          type="button"
          onClick={onEdit}
          className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </Button>
      )}
    </div>
  )
}

function SectionCard({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ReadField({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 text-sm font-medium leading-6 text-slate-900">
        {value || "-"}
      </dd>
    </div>
  )
}

function EditableField({
  id,
  label,
  value,
  onChange,
  className,
  type = "text",
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  type?: string
  required?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="bg-white"
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
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 bg-white"
      />
    </div>
  )
}

function EditableSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "")}>
        <SelectTrigger variant="soft" className="bg-white">
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
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        {status}
      </Badge>
    )
  }

  if (status === "Inactive") {
    return (
      <Badge className="border-transparent bg-rose-100 text-rose-600 hover:bg-rose-100">
        {status}
      </Badge>
    )
  }

  return (
    <Badge className="border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100">
      {status}
    </Badge>
  )
}

function LogoBlock({
  brandName,
  showAction = false,
}: {
  brandName: string
  showAction?: boolean
}) {
  return (
    <div>
      <Label>Company Logo</Label>
      <div className="mt-2 flex size-32 items-center justify-center rounded-lg bg-blue-600 text-2xl font-bold text-white">
        {brandName
          .split(" ")
          .filter(Boolean)
          .slice(0, 3)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "ORG"}
      </div>
      {showAction && (
        <Button type="button" variant="outline" size="sm" className="mt-3 w-32">
          Change Logo
        </Button>
      )}
    </div>
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
      <Label>Working Days</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {allDays.map((day) =>
          isEditing ? (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={days.includes(day) ? "default" : "outline"}
              onClick={() => onToggle?.(day)}
            >
              {day}
            </Button>
          ) : (
            <Badge
              key={day}
              className={cn(
                days.includes(day)
                  ? "border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100"
                  : "border-border text-foreground"
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
