**ApprovalCard** — an item awaiting a decision (admissions, fees, consents).

```jsx
<ApprovalCard title="Admission application #0421" requester="Meera Sharma" submittedAt="2h ago"
  meta={[{ term: "Class", value: "Grade 9" }, { term: "Fee", value: "₹2,500" }]}
  onApprove={approve} onReject={reject} onReview={review} />
```
