(function () {
  const DS = window.EduERPDesignSystem_d63b75;
  const { MetricCard, ChartTile, Chart, ChartLegend, Card, ApprovalCard, ActivityFeed, Button, Badge } = DS;
  const ERP = window.ERP;

  function Dashboard({ onNavigate }) {
    return (
      <div className="kit-page">
        <div className="kit-pagehead">
          <div>
            <h1 className="ds-h1">Good morning, Admin</h1>
            <p className="kit-subtitle">Springfield International School · Academic year 2026–27</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" iconStart="download">Export</Button>
            <Button variant="primary" iconStart="plus" onClick={() => onNavigate("admissions")}>New admission</Button>
          </div>
        </div>

        <div className="kit-kpis">
          <MetricCard label="Total students" value="1,284" icon="users" trend={{ direction: "up", value: "+24", label: "this term" }} />
          <MetricCard label="Fees collected" value="₹18.4L" icon="wallet" trend={{ direction: "up", value: "+8.2%", label: "vs last month" }} />
          <MetricCard label="Avg. attendance" value="94.2%" icon="calendar-check" trend={{ direction: "down", value: "-1.1%", label: "vs last week" }} />
          <MetricCard label="Pending approvals" value="7" icon="clipboard-check" trend={{ direction: "flat", value: "3 admissions", label: "" }} />
        </div>

        <div className="kit-grid-2">
          <ChartTile
            title="Fee collection"
            subtitle="Last 6 months (₹ lakh)"
            legend={<ChartLegend items={[{ label: "Collected" }, { label: "Pending" }]} />}
          >
            <Chart type="bar" height={220}
              categories={["Feb", "Mar", "Apr", "May", "Jun", "Jul"]}
              series={[{ name: "Collected", values: [14, 18, 16, 22, 20, 26] }, { name: "Pending", values: [4, 3, 5, 2, 4, 3] }]} />
          </ChartTile>

          <Card title="Pending approvals" actions={<Button variant="link" onClick={() => onNavigate("admissions")}>View all</Button>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ERP.admissions.filter((a) => a.status === "pending").slice(0, 2).map((a) => (
                <ApprovalCard key={a.id} title={`Admission #${a.id} · ${a.name}`} requester={a.guardian} submittedAt={a.when}
                  meta={[{ term: "Class", value: a.cls }, { term: "Reg. fee", value: ERP.inr(a.fee) }]}
                  onApprove={() => onNavigate("admissions")} onReject={() => onNavigate("admissions")} onReview={() => onNavigate("admissions")} />
              ))}
            </div>
          </Card>
        </div>

        <div className="kit-grid-2">
          <Card title="Recent activity">
            <ActivityFeed items={ERP.activity} />
          </Card>
          <Card title="Quick actions">
            <div className="kit-quick">
              <button className="kit-quick__btn" onClick={() => onNavigate("students")}><span className="kit-quick__ic" style={{ background: "var(--action-subtle)", color: "var(--action-content)" }}><DS.Icon name="user-plus" size={18} /></span>New student</button>
              <button className="kit-quick__btn" onClick={() => onNavigate("fees")}><span className="kit-quick__ic" style={{ background: "var(--feedback-success-surface)", color: "var(--feedback-success-content)" }}><DS.Icon name="receipt" size={18} /></span>Collect fee</button>
              <button className="kit-quick__btn" onClick={() => onNavigate("students")}><span className="kit-quick__ic" style={{ background: "var(--feedback-info-surface)", color: "var(--feedback-info-content)" }}><DS.Icon name="calendar-check" size={18} /></span>Mark attendance</button>
              <button className="kit-quick__btn" onClick={() => onNavigate("admissions")}><span className="kit-quick__ic" style={{ background: "var(--feedback-warning-surface)", color: "var(--feedback-warning-content)" }}><DS.Icon name="file-text" size={18} /></span>Generate report</button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  window.Screens = window.Screens || {};
  window.Screens.Dashboard = Dashboard;
})();
