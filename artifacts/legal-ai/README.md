# legal-ai — Frontend Application

The user-facing React app for قانوني AI. Served at path `/` via the Replit shared proxy.

---

## Pages

### `/` — Contract Generator (Home)
The main page. Users:
1. Pick a contract type (Employment, Rental, Service, NDA, Supplier)
2. Fill in the relevant form fields
3. Click "توليد العقد" (Generate Contract)
4. Get a full Arabic contract with the options to:
   - Copy to clipboard
   - Download as Word (`.docx`)
   - Send via WhatsApp
   - Send directly to the Contract Reviewer

### `/review` — Contract Reviewer
Users upload a PDF, DOCX, or TXT file (up to 5 MB). The AI analyzes every clause and returns a risk dashboard:

| Color | Meaning |
|---|---|
| Green | Clause is compliant and safe |
| Yellow | Clause needs legal review |
| Red | Clause is legally risky or missing |

Results can be exported as a Word report (`.docx`).

---

## Key Files

```
src/
├── pages/
│   ├── Home.tsx              Main contract generation page
│   └── ContractReviewer.tsx  Contract review + risk dashboard
│
├── components/
│   ├── ContractForms.tsx     Sub-forms: Rental, Service, NDA, Supplier
│   └── ui/                   shadcn/ui primitives (Button, Card, Form, etc.)
│
├── hooks/
│   └── use-toast.ts          Toast notification hook
│
├── lib/
│   └── utils.ts              Tailwind cn() utility
│
├── App.tsx                   Router (React Router v6)
└── main.tsx                  Entry point
```

---

## Contract Types & Forms

| Type | Key Fields | Party Name Used in Export |
|---|---|---|
| Employment (`عقد عمل`) | Employer name, employee name, salary, job title, city | Employee name |
| Rental (`عقد إيجار`) | Landlord, tenant, property address, rent, duration | Tenant name |
| Service (`عقد خدمات`) | Client, provider, service description, fee | Client name |
| NDA (`اتفاقية سرية`) | First party, second party, purpose, duration | First party name |
| Supplier (`عقد توريد`) | Buyer, supplier, goods description, price | Supplier name |

---

## State Flow (Home.tsx)

```
contractType        → which form to show
generatedContract   → the AI-returned contract text (shown in the output panel)
currentPartyName    → extracted from each form to name the exported .docx file
wordLoading         → true while the Word export request is in flight
nonEmploymentLoading → true while a non-employment form is submitting
validationWarnings  → any legal compliance warnings returned by the API
```

---

## How the "Review This" Button Works

When a contract is generated, a "مراجعة" button appears. Clicking it:
1. Saves `contractText` and `contractTypeLabel` to `sessionStorage`
2. Navigates to `/review`
3. `ContractReviewer` runs a `useEffect` on mount, reads `sessionStorage`, and automatically calls `POST /api/contracts/review-text` — no file upload needed

---

## API Calls

The employment contract form uses the generated `useGenerateContract` React Query hook from `@workspace/api-client-react`.

All other forms (Rental, Service, NDA, Supplier) use direct `fetch()` calls because those routes are not yet in the OpenAPI spec.

---

## UI Framework

- **Tailwind CSS** for styling with a dark theme (`background: hsl(222, 47%, 6%)`)
- **shadcn/ui** components: Card, Button, Form, Input, Select, Badge, Progress
- **lucide-react** icons throughout
- RTL layout enforced globally via `dir="rtl"` on the HTML root
