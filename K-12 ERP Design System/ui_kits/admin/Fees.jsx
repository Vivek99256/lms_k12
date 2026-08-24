(function () {
  const DS = window.EduERPDesignSystem_d63b75;
  const { Breadcrumb, Button, MetricCard, DataTable, Badge, IconButton, Modal, TextField, Select, DescriptionList, ToastViewport, Toast } = DS;
  const ERP = window.ERP;

  function Fees() {
    const [rows, setRows] = React.useState(ERP.fees);
    const [pay, setPay] = React.useState(null);
    const [method, setMethod] = React.useState("cash");
    const [toast, setToast] = React.useState(null);

    const collect = () => {
      const rec = "FEE-2026-" + Math.floor(1000 + Math.random() * 9000);
      setRows((prev) => prev.filter((r) => r.id !== pay.id));
      setToast({ name: pay.name, amount: pay.amount, rec });
      setPay(null); setMethod("cash");
      setTimeout(() => setToast(null), 4000);
    };

    const outstanding = rows.reduce((a, r) => a + r.amount, 0);

    return (
      <div className="kit-page">
        <Breadcrumb items={[{ label: "Home", href: "#" }, { label: "Fees" }, { label: "Outstanding dues" }]} />
        <div className="kit-pagehead">
          <div>
            <h1 className="ds-h1">Fees</h1>
            <p className="kit-subtitle">Outstanding dues and collection</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" iconStart="file-text">Report</Button>
            <Button variant="primary" iconStart="plus">Create invoice</Button>
          </div>
        </div>

        <div className="kit-kpis kit-kpis--3">
          <MetricCard variant="stat" label="Collected (term)" value="₹18.4L" icon="wallet" trend={{ direction: "up", value: "+8.2%" }} />
          <MetricCard variant="stat" label="Outstanding" value={ERP.inr(outstanding)} icon="alert-circle" />
          <MetricCard variant="stat" label="Defaulters" value={String(rows.length)} icon="users" />
        </div>

        <div className="kit-card-wrap">
          <DataTable columns={[
            { key: "name", header: "Student" },
            { key: "cls", header: "Class" },
            { key: "head", header: "Fee head" },
            { key: "dueDate", header: "Due date" },
            { key: "amount", header: "Amount", align: "end", render: (r) => <span style={{ fontWeight: 600 }}>{ERP.inr(r.amount)}</span> },
            { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "Overdue" ? "error" : "warning"} dot>{r.status}</Badge> },
            { key: "_a", header: "", render: (r) => <Button variant="tertiary" size="sm" iconStart="receipt" onClick={() => setPay(r)}>Collect</Button> },
          ]} data={rows} emptyTitle="All dues cleared" emptyText="No outstanding fees for this scope." />
        </div>

        <Modal open={!!pay} onClose={() => setPay(null)} title="Collect payment"
          description={pay ? `${pay.name} · ${pay.cls}` : ""}
          footer={<>
            <Button variant="secondary" onClick={() => setPay(null)}>Cancel</Button>
            <Button variant="primary" iconStart="check" onClick={collect}>Collect {pay ? ERP.inr(pay.amount) : ""}</Button>
          </>}>
          {pay && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <DescriptionList variant="two-column" items={[{ term: "Fee head", value: pay.head }, { term: "Amount due", value: ERP.inr(pay.amount) }, { term: "Due date", value: pay.dueDate }]} />
              <Select label="Payment method" value={method} onChange={setMethod} options={[{ value: "cash", label: "Cash" }, { value: "card", label: "Card" }, { value: "upi", label: "UPI" }, { value: "netbanking", label: "Net banking" }]} />
              <TextField label="Reference / transaction ID" placeholder="Optional" iconStart="hash" />
            </div>
          )}
        </Modal>

        {toast && (
          <ToastViewport position="bottom-right">
            <Toast variant="success" title="Payment received" onDismiss={() => setToast(null)}>
              {ERP.inr(toast.amount)} from {toast.name}. Receipt <span className="ds-code">{toast.rec}</span> issued.
            </Toast>
          </ToastViewport>
        )}
      </div>
    );
  }

  window.Screens = window.Screens || {};
  window.Screens.Fees = Fees;
})();
