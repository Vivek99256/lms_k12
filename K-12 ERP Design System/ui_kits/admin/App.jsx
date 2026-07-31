(function () {
  const DS = window.EduERPDesignSystem_d63b75;
  const {
    SidebarNav, TopbarNav, IconButton, Avatar, Menu, ThemeToggle, Icon,
    Popover, NotificationItem,
  } = DS;
  // New components resolve once the bundle recompiles; fall back to no-ops so the
  // shell never crashes if opened before a rebuild.
  const Noop = () => null;
  const ModuleTabBar = DS.ModuleTabBar || Noop;
  const CommandPalette = DS.CommandPalette || Noop;
  const AssistantPanel = DS.AssistantPanel || Noop;
  const AssistantLauncher = DS.AssistantLauncher || Noop;
  const S = window.Screens;

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
    { section: "Academics" },
    { id: "students", label: "Students", icon: "users", badge: "1.2k" },
    { id: "admissions", label: "Admissions", icon: "user-plus", badge: 3 },
    { id: "attendance", label: "Attendance", icon: "calendar-check" },
    { id: "results", label: "Results", icon: "award" },
    { section: "Operations" },
    { id: "fees", label: "Fees", icon: "wallet", badge: 4 },
    { id: "transport", label: "Transport", icon: "bus" },
    { id: "inventory", label: "Inventory", icon: "package" },
    { id: "documents", label: "Documents", icon: "folder" },
    { section: "System" },
    { id: "reports", label: "Reports", icon: "bar-chart-3" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  // Sub-module registry — the "module → sub-module" IA level (ModuleTabBar).
  const SUBMODULES = {
    fees: {
      label: "Fees", items: [
        { id: "collect", label: "Fee collection", count: 13 },
        { id: "refund", label: "Cancel / refund" },
        { id: "circular", label: "Fee circular" },
        { id: "imprest", label: "Imprest fees" },
        { id: "other", label: "Other fees" },
        { id: "structure", label: "Fee structure" },
        { id: "concession", label: "Concessions", count: 4 },
        { id: "discount", label: "Discounts" },
        { id: "reports", label: "Fee reports" },
        { id: "reminders", label: "Reminders" },
      ]
    },
    students: {
      label: "Students", items: [
        { id: "directory", label: "Directory", count: "1.2k" },
        { id: "enrollment", label: "Enrollment" },
        { id: "attendance", label: "Attendance" },
        { id: "health", label: "Health records" },
        { id: "documents", label: "Documents" },
        { id: "id-cards", label: "ID cards" },
      ]
    },
    admissions: {
      label: "Admissions", items: [
        { id: "enquiries", label: "Enquiries", count: 3 },
        { id: "applications", label: "Applications" },
        { id: "entrance", label: "Entrance tests" },
        { id: "interviews", label: "Interviews" },
        { id: "offers", label: "Offers" },
        { id: "confirmed", label: "Confirmed" },
      ]
    },
  };

  const AGENTS = [
    { id: "insights", icon: "trending-up", label: "Insights" },
    { id: "recommend", icon: "lightbulb", label: "Recommendations", badge: true },
    { id: "help", icon: "life-buoy", label: "Help" },
  ];

  const GREETING = { id: "g", role: "assistant", text: "Hello! I'm your Teach Assistant. Ask me about students, fees, attendance or reports — or pick a suggestion below.", time: "10:00 AM" };
  const SUGGESTIONS = [
    { text: "Summarise fee defaulters", icon: "wallet" },
    { text: "Draft a parent notice", icon: "mail" },
    { text: "Attendance dip this week?", icon: "calendar-check" },
  ];
  const REPLIES = {
    default: "Here's a quick read on that. In the live product I'd pull the figures for your current year and term, then offer to export or share them.",
    fee: "42 students have pending Term-2 fees totalling ₹1,13,060. Want me to draft reminders to their parents?",
    notice: "Draft ready: “Dear parent, this is a reminder that Term-2 fees are due on 15 July…”. Shall I queue it for the 42 pending families?",
    attendance: "Attendance is 94% this week, down 1.8pts from last week — Grade 7-B drove most of the dip. Open the attendance report?",
  };
  function replyFor(text) {
    const t = text.toLowerCase();
    if (t.includes("defaulter") || t.includes("fee")) return REPLIES.fee;
    if (t.includes("notice") || t.includes("parent")) return REPLIES.notice;
    if (t.includes("attendance")) return REPLIES.attendance;
    return REPLIES.default;
  }

  function Brand({ collapsed }) {
    return (
      <div className="kit-brand">
        <img src="../../assets/logo.svg" width="32" height="32" alt="" />
        {!collapsed && <span className="kit-brand__wm">Edu<em>ERP</em></span>}
      </div>
    );
  }

  function Placeholder({ title }) {
    return (
      <div className="kit-page">
        <h1 className="ds-h1">{title}</h1>
        <div className="kit-card-wrap">
          <DS.StatusView variant="empty" title={title + " module"} description="This module follows the same layout, table and form patterns shown in Dashboard, Students, Admissions and Fees." />
        </div>
      </div>
    );
  }

  function App() {
    const [nav, setNav] = React.useState("dashboard");
    const [student, setStudent] = React.useState(null);
    const [theme, setTheme] = React.useState("light");
    const [subByModule, setSubByModule] = React.useState({});
    const [cmdkOpen, setCmdkOpen] = React.useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

    // Assistant state
    const [assistOpen, setAssistOpen] = React.useState(true);
    const [agent, setAgent] = React.useState(null);
    const [messages, setMessages] = React.useState([GREETING]);
    const [typing, setTyping] = React.useState(false);
    const timer = React.useRef(null);

    const go = (id) => { setStudent(null); setNav(id); };

    // Cmd/Ctrl-K opens the command palette.
    React.useEffect(() => {
      const h = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdkOpen((o) => !o); }
      };
      document.addEventListener("keydown", h);
      return () => document.removeEventListener("keydown", h);
    }, []);

    React.useEffect(() => () => clearTimeout(timer.current), []);

    const sub = SUBMODULES[nav];
    const activeSub = (sub && (subByModule[nav] || sub.items[0].id)) || null;
    const selectSub = (id) => setSubByModule((m) => ({ ...m, [nav]: id }));

    const sendMessage = (text) => {
      setMessages((m) => [...m, { id: "u" + Date.now(), role: "user", text }]);
      setTyping(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setMessages((m) => [...m, { id: "a" + Date.now(), role: "assistant", text: replyFor(text), time: "now" }]);
        setTyping(false);
      }, 1100);
    };
    const openAssistant = (agentId) => { setAgent(agentId || null); setAssistOpen(true); };

    let content;
    if (student) content = <S.StudentDetail student={student} onBack={() => setStudent(null)} />;
    else if (nav === "dashboard") content = <S.Dashboard onNavigate={go} />;
    else if (nav === "students") content = <S.Students onOpenStudent={setStudent} />;
    else if (nav === "admissions") content = <S.Admissions />;
    else if (nav === "fees") content = <S.Fees />;
    else content = <Placeholder title={(NAV.find((n) => n.id === nav) || {}).label || "Module"} />;

    const notifications = (
      <Popover placement="bottom-end" trigger={<span className="kit-bell"><IconButton icon="bell" label="Notifications" variant="ghost" /><span className="kit-bell__dot" /></span>}>
        <div style={{ width: 320 }}>
          <div className="kit-pop-head">Notifications</div>
          <NotificationItem type="fee" unread title="Fee payment received" body="₹12,500 from Meera Sharma." timestamp="10m ago" onOpen={() => { }} />
          <NotificationItem type="admission" unread title="New admission enquiry" body="Grade 9 · via website" timestamp="1h ago" onOpen={() => { }} />
          <NotificationItem type="transport" title="Route 4 delayed" body="Bus running 15 min late." timestamp="Yesterday" onOpen={() => { }} />
        </div>
      </Popover>
    );

    const searchTrigger = (
      <button type="button" className="kit-cmdk-trigger" onClick={() => setCmdkOpen(true)}>
        <Icon name="search" size={16} />
        <span className="kit-cmdk-trigger__label">Search or jump to…</span>
        <kbd>⌘K</kbd>
      </button>
    );

    // Command palette contents
    const cmdkGroups = [
      { label: "Navigate", items: NAV.filter((n) => n.id).map((n) => ({ id: n.id, label: n.label, icon: n.icon, keywords: "module go open", onSelect: () => go(n.id) })) },
      {
        label: "Actions", items: [
          { id: "add-student", label: "Add student", icon: "user-plus", shortcut: ["A"], onSelect: () => go("students") },
          { id: "collect-fee", label: "Collect fee", icon: "wallet", keywords: "payment", onSelect: () => go("fees") },
          { id: "new-admission", label: "New admission enquiry", icon: "file-plus", onSelect: () => go("admissions") },
          { id: "ask", label: "Ask Teach Assistant", icon: "sparkles", keywords: "ai chat copilot", onSelect: () => openAssistant(null) },
          { id: "theme", label: "Toggle theme", icon: "moon", onSelect: () => setTheme((t) => (t === "light" ? "dark" : "light")) },
        ]
      },
    ];

    return (
      <div className="kit-app" data-theme={theme}>
        <aside className="kit-sidebar">
          <SidebarNav items={NAV} activeId={student ? "students" : nav} onSelect={go} collapsed={sidebarCollapsed} header={<Brand collapsed={sidebarCollapsed} />}
            footer={<div className="kit-side-foot"><Avatar name="Admin User" size="sm" />{!sidebarCollapsed && <div><div className="kit-side-foot__name">Admin User</div><div className="kit-side-foot__role">Administrator</div></div>}</div>} />
        </aside>

        <div className="kit-main">
          <TopbarNav
            brand={<IconButton icon={sidebarCollapsed ? "panel-left-open" : "panel-left-close"} label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} variant="ghost" onClick={() => setSidebarCollapsed((c) => !c)} />}
            moduleContext={<span className="kit-ctx">Springfield International</span>}
            search={searchTrigger}
            actions={<><ThemeToggle value={theme} onChange={setTheme} />{notifications}<IconButton icon="circle-help" label="Help" variant="ghost" /></>}
            account={<Menu align="end" trigger={<span style={{ cursor: "pointer" }}><Avatar name="Admin User" size="sm" /></span>} items={[{ label: "My profile", icon: "user" }, { label: "Preferences", icon: "settings" }, { divider: true }, { label: "Sign out", icon: "log-out" }]} />}
          />

          {sub && !student && (
            <div className="kit-modulebar-wrap">
              <ModuleTabBar module={sub.label} items={sub.items} activeId={activeSub} onSelect={selectSub} />
            </div>
          )}

          <main className="kit-content">{content}</main>
        </div>

        {assistOpen ? (
          <AssistantPanel
            title="Teach Assistant"
            status="Online"
            messages={messages}
            suggestions={SUGGESTIONS}
            typing={typing}
            onSend={sendMessage}
            onClose={() => setAssistOpen(false)}
            onNewChat={() => { setMessages([GREETING]); setTyping(false); }}
          />
        ) : (
          <div className="kit-railcol">
            <AssistantLauncher
              primaryLabel="Ask Teach Assistant"
              onPrimary={() => openAssistant(null)}
              activeId={agent}
              onSelect={openAssistant}
              items={AGENTS}
            />
          </div>
        )}

        <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} groups={cmdkGroups} />
      </div>
    );
  }

  window.App = App;
})();
