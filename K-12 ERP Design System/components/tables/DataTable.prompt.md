**DataTable** — the workhorse for data-heavy modules. Sorting, row selection, sticky header, empty + loading states. Wrap density with `[data-density]` on an ancestor.

```jsx
<DataTable
  selectable
  selectedKeys={sel} onSelectionChange={setSel}
  sortKey={sk} sortDir={sd} onSort={(k,d)=>{setSk(k);setSd(d)}}
  columns={[
    { key: "name", header: "Student", sortable: true },
    { key: "class", header: "Class" },
    { key: "status", header: "Status", render: r => <Badge variant="success" dot>{r.status}</Badge> },
    { key: "due", header: "Due", align: "end", sortable: true },
  ]}
  data={rows}
/>
```

Right-align numeric columns with `align: "end"`. Provide custom cells via `render`.
