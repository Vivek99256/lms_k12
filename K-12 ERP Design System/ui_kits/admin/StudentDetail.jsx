(function () {
  const DS = window.EduERPDesignSystem_d63b75;
  const { Breadcrumb, Avatar, Badge, Button, Tabs, SectionPanel, DescriptionList, TimelineItem, DataTable, Tag, Card, IconButton } = DS;
  const ERP = window.ERP;

  function StudentDetail({ student, onBack }) {
    const [tab, setTab] = React.useState("overview");
    const s = student;

    return (
      <div className="kit-page">
        <Breadcrumb items={[{ label: "Home", href: "#" }, { label: "Students", onClick: onBack }, { label: s.name }]} />
        <div className="kit-detailhead">
          <div className="kit-detailhead__id">
            <Avatar name={s.name} size="xl" />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 className="ds-h1">{s.name}</h1>
                <Badge variant={s.status === "Active" ? "success" : s.status === "Fees due" ? "warning" : "neutral"} dot>{s.status}</Badge>
              </div>
              <p className="kit-subtitle">{s.cls} · Roll {s.roll} · Admission ADM-2026-{String(1000 + s.id)}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Tag variant="brand">Day scholar</Tag><Tag>Science stream</Tag><Tag>Bus route 4</Tag>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" iconStart="printer">Print</Button>
            <Button variant="secondary" iconStart="mail">Message</Button>
            <Button variant="primary" iconStart="pencil">Edit</Button>
          </div>
        </div>

        <Tabs activeId={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "fees", label: "Fees", badge: s.due ? 1 : undefined }, { id: "attendance", label: "Attendance" }, { id: "documents", label: "Documents" }]} />

        {tab === "overview" && (
          <div className="kit-grid-detail">
            <div className="kit-col">
              <SectionPanel title="Personal details">
                <DescriptionList columns={2} items={[
                  { term: "Full name", value: s.name }, { term: "Date of birth", value: "14 Mar 2011" },
                  { term: "Gender", value: "—" }, { term: "Blood group", value: "O+" },
                  { term: "Class", value: s.cls }, { term: "Roll number", value: s.roll },
                ]} />
              </SectionPanel>
              <SectionPanel title="Guardian details">
                <DescriptionList columns={2} items={[
                  { term: "Primary guardian", value: s.guardian }, { term: "Relation", value: "Parent" },
                  { term: "Phone", value: s.phone }, { term: "Email", value: "guardian@example.com" },
                  { term: "Address", value: "42, Rose Villa, Springfield" }, { term: "Emergency", value: s.phone },
                ]} />
              </SectionPanel>
            </div>
            <aside className="kit-col">
              <Card title="Activity">
                <ol className="ds-timeline">
                  <TimelineItem tone="success" title="Term-1 fee paid" actor={"by " + s.guardian} timestamp="10 Jun" />
                  <TimelineItem tone="info" title={"Promoted to " + s.cls} timestamp="01 Apr" />
                  <TimelineItem title="Enrolled" timestamp="2019" last />
                </ol>
              </Card>
            </aside>
          </div>
        )}

        {tab === "fees" && (
          <div className="kit-card-wrap">
            <DataTable columns={[
              { key: "head", header: "Fee head" }, { key: "term", header: "Term" },
              { key: "amount", header: "Amount", align: "end" }, { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "Paid" ? "success" : "warning"} dot>{r.status}</Badge> },
            ]} data={[
              { id: 1, head: "Tuition", term: "Term 1", amount: ERP.inr(42500), status: "Paid" },
              { id: 2, head: "Tuition", term: "Term 2", amount: ERP.inr(s.due || 42500), status: s.due ? "Pending" : "Paid" },
              { id: 3, head: "Transport", term: "Annual", amount: ERP.inr(18000), status: "Paid" },
            ]} />
          </div>
        )}

        {tab === "attendance" && (
          <div className="kit-card-wrap"><Card title={"Attendance · " + s.attendance}>
            <p className="kit-subtitle" style={{ margin: 0 }}>Present 178 / 190 days this session. Detailed day-wise register available in the Attendance module.</p>
          </Card></div>
        )}
        {tab === "documents" && (
          <div className="kit-card-wrap"><DS.StatusView variant="empty" title="No documents uploaded" description="Upload birth certificate, transfer certificate and ID proof." actions={<Button variant="primary" size="sm" iconStart="upload">Upload document</Button>} /></div>
        )}
      </div>
    );
  }

  window.Screens = window.Screens || {};
  window.Screens.StudentDetail = StudentDetail;
})();
