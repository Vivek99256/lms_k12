(function () {
  const DS = window.EduERPDesignSystem_d63b75;
  const { FilterBar, SearchInput, Select, DensityToggle, DataTable, Badge, Avatar, IconButton, Menu, Pagination, Button, Breadcrumb, StatusView } = DS;
  const ERP = window.ERP;
  const SV = { Active: "success", "Fees due": "warning", Inactive: "neutral" };

  function Students({ onOpenStudent }) {
    const [q, setQ] = React.useState("");
    const [cls, setCls] = React.useState("");
    const [density, setDensity] = React.useState("cozy");
    const [sel, setSel] = React.useState([]);
    const [sortKey, setSortKey] = React.useState("name");
    const [sortDir, setSortDir] = React.useState("asc");

    let rows = ERP.students.filter((s) =>
      (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (!cls || s.cls.startsWith(cls))
    );
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const r = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? r : -r;
    });

    const activeFilters = cls ? [{ id: "cls", label: "Class: " + cls }] : [];

    return (
      <div className="kit-page">
        <Breadcrumb items={[{ label: "Home", href: "#" }, { label: "Students" }]} />
        <div className="kit-pagehead">
          <div>
            <h1 className="ds-h1">Students</h1>
            <p className="kit-subtitle">{ERP.students.length} enrolled · Academic year 2026–27</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {sel.length > 0 && <Button variant="secondary" iconStart="mail">Message ({sel.length})</Button>}
            <Button variant="secondary" iconStart="upload">Import</Button>
            <Button variant="primary" iconStart="plus">Add student</Button>
          </div>
        </div>

        <div className="kit-toolbar">
          <FilterBar
            resultCount={`${rows.length} of ${ERP.students.length}`}
            activeFilters={activeFilters}
            onRemoveFilter={() => setCls("")}
            onClearAll={() => { setCls(""); setQ(""); }}
            trailing={<><DensityToggle value={density} onChange={setDensity} /><IconButton icon="settings-2" label="Columns" variant="ghost" /></>}
          >
            <div style={{ width: 240 }}><SearchInput placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} size="sm" /></div>
            <Select size="sm" placeholder="Class" value={cls} onChange={setCls} options={[{ value: "Grade 8", label: "Grade 8" }, { value: "Grade 9", label: "Grade 9" }, { value: "Grade 10", label: "Grade 10" }]} />
          </FilterBar>
        </div>

        <div data-density={density}>
          {rows.length === 0 ? (
            <div className="kit-card-wrap"><StatusView variant="no-results" description="No students match your filters." actions={<Button variant="secondary" size="sm" onClick={() => { setQ(""); setCls(""); }}>Clear filters</Button>} /></div>
          ) : (
            <DataTable
              selectable selectedKeys={sel} onSelectionChange={setSel}
              sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); }}
              onRowClick={(r) => onOpenStudent(r)}
              columns={[
                { key: "name", header: "Student", sortable: true, render: (r) => (
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={r.name} size="sm" /><span style={{ fontWeight: 500 }}>{r.name}</span>
                  </span>) },
                { key: "cls", header: "Class", sortable: true },
                { key: "roll", header: "Roll", align: "end", sortable: true },
                { key: "attendance", header: "Attendance", align: "end", sortable: true },
                { key: "status", header: "Status", render: (r) => <Badge variant={SV[r.status]} dot>{r.status}</Badge> },
                { key: "due", header: "Balance", align: "end", sortable: true, render: (r) => r.due ? <span style={{ color: "var(--feedback-error-content)", fontWeight: 500 }}>{ERP.inr(r.due)}</span> : ERP.inr(0) },
                { key: "_a", header: "", render: (r) => (
                  <Menu align="end" trigger={<IconButton icon="more-vertical" label="Actions" variant="ghost" size="sm" />}
                    items={[{ label: "View profile", icon: "eye", onClick: () => onOpenStudent(r) }, { label: "Edit", icon: "pencil" }, { label: "Collect fee", icon: "receipt" }, { divider: true }, { label: "Deactivate", icon: "user-x", danger: true }]} />) },
              ]}
              data={rows}
            />
          )}
        </div>
        <div className="kit-toolbar" style={{ borderTop: 0 }}>
          <Pagination page={1} pageCount={Math.max(1, Math.ceil(ERP.students.length / 25))} pageSize={25} total={ERP.students.length} onPageChange={() => {}} onPageSizeChange={() => {}} />
        </div>
      </div>
    );
  }

  window.Screens = window.Screens || {};
  window.Screens.Students = Students;
})();
