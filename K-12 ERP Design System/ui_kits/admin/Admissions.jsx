(function () {
  const DS = window.EduERPDesignSystem_d63b75;
  const { Breadcrumb, Button, FilterBar, SearchInput, Select, DataTable, Badge, IconButton, Drawer, DescriptionList, CommentThread, ConfirmationDialog, ToastViewport, Toast, StatusView } = DS;
  const ERP = window.ERP;
  const AV = { pending: "warning", approved: "success", rejected: "error" };

  function Admissions() {
    const [items, setItems] = React.useState(ERP.admissions);
    const [active, setActive] = React.useState(null);
    const [confirm, setConfirm] = React.useState(null); // {id, action}
    const [toast, setToast] = React.useState(null);

    const decide = (id, action) => {
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status: action === "approve" ? "approved" : "rejected" } : a)));
      setActive(null); setConfirm(null);
      setToast({ variant: action === "approve" ? "success" : "info", msg: `Admission #${id} ${action === "approve" ? "approved" : "rejected"}.` });
      setTimeout(() => setToast(null), 3200);
    };

    const pending = items.filter((a) => a.status === "pending").length;

    return (
      <div className="kit-page">
        <Breadcrumb items={[{ label: "Home", href: "#" }, { label: "Admissions" }, { label: "Approval queue" }]} />
        <div className="kit-pagehead">
          <div>
            <h1 className="ds-h1">Admission approvals</h1>
            <p className="kit-subtitle">{pending} pending decision{pending === 1 ? "" : "s"}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" iconStart="check-check">Bulk approve</Button>
            <Button variant="primary" iconStart="plus">New application</Button>
          </div>
        </div>

        <div className="kit-toolbar">
          <FilterBar resultCount={`${items.length} applications`}>
            <div style={{ width: 220 }}><SearchInput placeholder="Search applicants…" size="sm" /></div>
            <Select size="sm" placeholder="Status" options={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }]} />
          </FilterBar>
        </div>

        <div className="kit-card-wrap">
          <DataTable
            onRowClick={(r) => setActive(r)}
            columns={[
              { key: "id", header: "App #", render: (r) => <span className="ds-code">#{r.id}</span> },
              { key: "name", header: "Applicant" },
              { key: "cls", header: "Class" },
              { key: "source", header: "Source" },
              { key: "fee", header: "Reg. fee", align: "end", render: (r) => ERP.inr(r.fee) },
              { key: "when", header: "Submitted", align: "end" },
              { key: "status", header: "Status", render: (r) => <Badge variant={AV[r.status]} dot>{r.status[0].toUpperCase() + r.status.slice(1)}</Badge> },
              { key: "_a", header: "", render: (r) => r.status === "pending" ? (
                <span style={{ display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                  <IconButton icon="check" label="Approve" size="sm" onClick={() => setConfirm({ id: r.id, action: "approve" })} />
                  <IconButton icon="x" label="Reject" size="sm" variant="danger" onClick={() => setConfirm({ id: r.id, action: "reject" })} />
                </span>) : <Button variant="link" onClick={() => setActive(r)}>View</Button> },
            ]}
            data={items}
          />
        </div>

        <Drawer open={!!active} onClose={() => setActive(null)} title={active ? `Application #${active.id}` : ""}
          footer={active && active.status === "pending" ? (
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <Button variant="secondary" fullWidth onClick={() => setConfirm({ id: active.id, action: "reject" })}>Reject</Button>
              <Button variant="primary" fullWidth iconStart="check" onClick={() => setConfirm({ id: active.id, action: "approve" })}>Approve</Button>
            </div>) : null}>
          {active && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <DescriptionList items={[
                { term: "Applicant", value: active.name }, { term: "Class applied", value: active.cls },
                { term: "Guardian", value: active.guardian }, { term: "Source", value: active.source },
                { term: "Registration fee", value: ERP.inr(active.fee) }, { term: "Submitted", value: active.when },
              ]} />
              <div>
                <p className="ds-label" style={{ marginBottom: 8 }}>Review notes</p>
                <CommentThread onSubmit={() => {}} comments={[{ id: "1", author: "Rahul K.", body: "Documents verified — birth certificate and previous marksheet on file.", timestamp: "1h ago" }]} />
              </div>
            </div>
          )}
        </Drawer>

        <ConfirmationDialog open={!!confirm}
          destructive={confirm && confirm.action === "reject"}
          title={confirm && confirm.action === "approve" ? "Approve this admission?" : "Reject this application?"}
          confirmLabel={confirm && confirm.action === "approve" ? "Approve" : "Reject"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => decide(confirm.id, confirm.action)}>
          {confirm && confirm.action === "approve"
            ? "The applicant will be enrolled and a roll number generated. A confirmation will be sent to the guardian."
            : "The applicant will be notified that their application was not accepted. This can be reversed by an admin."}
        </ConfirmationDialog>

        {toast && (
          <ToastViewport position="bottom-right">
            <Toast variant={toast.variant} title={toast.variant === "success" ? "Done" : "Updated"} onDismiss={() => setToast(null)}>{toast.msg}</Toast>
          </ToastViewport>
        )}
      </div>
    );
  }

  window.Screens = window.Screens || {};
  window.Screens.Admissions = Admissions;
})();
