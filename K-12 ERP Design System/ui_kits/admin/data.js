/* Sample data for the EduERP Admin UI kit. Plain globals (no module system). */
window.ERP = (function () {
  const students = [
    { id: 1, name: "Aarav Sharma", roll: 21, cls: "Grade 9 - A", guardian: "Meera Sharma", phone: "+91 98••• ••021", status: "Active", due: 0, attendance: "96%" },
    { id: 2, name: "Diya Patel", roll: 22, cls: "Grade 9 - A", guardian: "Nikhil Patel", phone: "+91 98••• ••022", status: "Fees due", due: 12500, attendance: "91%" },
    { id: 3, name: "Kabir Singh", roll: 7, cls: "Grade 9 - B", guardian: "Simran Singh", phone: "+91 98••• ••023", status: "Active", due: 0, attendance: "98%" },
    { id: 4, name: "Ananya Rao", roll: 4, cls: "Grade 10 - A", guardian: "Latha Rao", phone: "+91 98••• ••024", status: "Inactive", due: 2500, attendance: "88%" },
    { id: 5, name: "Vivaan Mehta", roll: 12, cls: "Grade 10 - A", guardian: "Rohit Mehta", phone: "+91 98••• ••025", status: "Active", due: 0, attendance: "94%" },
    { id: 6, name: "Isha Nair", roll: 18, cls: "Grade 8 - C", guardian: "Priya Nair", phone: "+91 98••• ••026", status: "Fees due", due: 8000, attendance: "90%" },
    { id: 7, name: "Reyansh Gupta", roll: 2, cls: "Grade 8 - C", guardian: "Anil Gupta", phone: "+91 98••• ••027", status: "Active", due: 0, attendance: "97%" },
    { id: 8, name: "Saanvi Iyer", roll: 30, cls: "Grade 9 - B", guardian: "Deepa Iyer", phone: "+91 98••• ••028", status: "Active", due: 0, attendance: "93%" },
  ];

  const admissions = [
    { id: "0421", name: "Rehan Khan", cls: "Grade 9", source: "Website", guardian: "Sofia Khan", fee: 2500, when: "2h ago", status: "pending" },
    { id: "0420", name: "Meher Kaur", cls: "Grade 6", source: "Walk-in", guardian: "Jasleen Kaur", fee: 2500, when: "5h ago", status: "pending" },
    { id: "0419", name: "Aryan Das", cls: "Grade 11 - Science", source: "Referral", guardian: "Bimal Das", fee: 3000, when: "Yesterday", status: "pending" },
    { id: "0418", name: "Tara Menon", cls: "Grade 4", source: "Website", guardian: "Rekha Menon", fee: 2000, when: "Yesterday", status: "approved" },
  ];

  const fees = [
    { id: 1, name: "Diya Patel", cls: "Grade 9 - A", head: "Term-2 Tuition", amount: 12500, dueDate: "15 Jul 2026", status: "Overdue" },
    { id: 2, name: "Isha Nair", cls: "Grade 8 - C", head: "Term-2 Tuition", amount: 8000, dueDate: "15 Jul 2026", status: "Pending" },
    { id: 3, name: "Ananya Rao", cls: "Grade 10 - A", head: "Transport", amount: 2500, dueDate: "20 Jul 2026", status: "Pending" },
    { id: 4, name: "Vivaan Mehta", cls: "Grade 10 - A", head: "Lab fee", amount: 1500, dueDate: "22 Jul 2026", status: "Pending" },
  ];

  const activity = [
    { id: "1", actor: "Rahul K.", action: "approved admission for", target: "Tara Menon", timestamp: "12m ago" },
    { id: "2", actor: "System", action: "generated 42 fee receipts", timestamp: "1h ago" },
    { id: "3", actor: "Priya N.", action: "marked attendance for", target: "Grade 9 - A", timestamp: "2h ago" },
    { id: "4", actor: "System", action: "published Grade 9 term-1 results", timestamp: "Yesterday" },
  ];

  const inr = (n) => "₹" + n.toLocaleString("en-IN");
  return { students, admissions, fees, activity, inr };
})();
