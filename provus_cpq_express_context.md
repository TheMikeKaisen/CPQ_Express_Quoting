# Provus CPQ Express — Full Project Context (Updated)

## Who I Am
I am an intern at Provus. I just completed Salesforce training (Apex + LWC). My assignment is to build a CPQ Express app on Salesforce using LWC. I have 5 days to build + 1 day for testing. Deadline is next Friday.

## Important Rules from Trainer
1. **Do NOT copy the reference app exactly** — build our own version inspired by it
2. **Opportunity is REQUIRED** on every Quote
3. **Use standard objects as much as possible**
4. **AI Assistant is last priority** — only build if time allows (likely skip)
5. No Pricebook needed — use custom line items

## Reference App (for inspiration only)
https://cpqexpress.vercel.app/chat
App name: "Provus Express Quoting" running inside Salesforce Lightning

---

## Tech Stack
- Frontend: LWC (Lightning Web Components) — HTML + JS + CSS
- Backend: Apex classes (@AuraEnabled methods)
- Database: Salesforce Standard + Custom Objects (SOQL)
- Auth: Salesforce Profiles (two users: Salesperson + Manager)
- Workflow: Salesforce Approval Process (declarative)
- Environment: Scratch Org (already set up)

---

## Two Users
1. **Salesperson** — creates accounts, creates opportunities, creates quotes, adds line items, submits for approval
2. **Manager/Admin** — approves or rejects quotes, sets up Resource Roles, Products, Add-ons. Can also approve their own quotes.

---

## App Pages (Sidebar Navigation)
1. Dashboard
2. Quotes
3. Accounts
4. Resource Roles
5. Products
6. Add-ons
7. AI Assistant → STUB ONLY if time allows, otherwise skip
8. Feedback → stub
9. Take a Tour → stub
10. Settings → stub

---

## Data Model — FINAL DECISION

### Standard Objects (use as is, no recreation needed)
```
Account (standard)
    └── Opportunity (standard) ← REQUIRED on Quote
            └── Quote (standard + custom fields added)
```

### Why Standard Quote Works Now
- Opportunity is REQUIRED by trainer → standard chain works perfectly
- Account auto-fills from Opportunity → less manual entry
- Quote already has many fields we need built in

### Custom Objects (no standard equivalent)
```
Quote_Line_Item__c   ← custom (avoids Pricebook complexity)
Resource_Role__c     ← custom (no standard equivalent)
Product__c           ← custom (avoids Pricebook complexity)
Add_On__c            ← custom (no standard equivalent)
```

### Why NO Pricebook?
Standard QuoteLineItem requires PricebookEntry → Pricebook2 → Product2.
That means 3 extra setup steps before adding any product to a quote.
Instead, use custom Quote_Line_Item__c where price lives directly on Product__c/Resource_Role__c/Add_On__c.

---

## Every Object and Every Field

### 1. Account (STANDARD — use as is)
Fields already exist:
- Name
- AccountNumber
- Type (Picklist: Customer, Prospect)
- Industry
- Website
- Phone

### 2. Opportunity (STANDARD — use as is)
Fields already exist:
- Name
- AccountId (Lookup to Account)
- StageName
- CloseDate
- Amount

### 3. Quote (STANDARD + add custom fields)
Standard fields to USE:
| Standard Field | Notes |
|---|---|
| QuoteNumber | Auto Number → configure format to Q-{00001} in Setup |
| OpportunityId | Lookup(Opportunity) — REQUIRED |
| AccountId | Auto-pulled from Opportunity |
| Status | Picklist — customize values (see below) |
| Description | TextArea |
| ExpirationDate | = Valid Until date |
| Discount | Percent — overall discount |
| Subtotal | Currency |
| TotalPrice | Currency |
| GrandTotal | Currency |

Custom fields to ADD on Quote:
| Custom Field | Type | Notes |
|---|---|---|
| Start_Date__c | Date | REQUIRED |
| End_Date__c | Date | Optional |
| Time_Period__c | Picklist | Months, Quarters, Years — REQUIRED |
| Margin_Amount__c | Currency | Total - Total Cost |
| Margin_Percent__c | Percent | Margin/Subtotal × 100 |

Customize Quote Status picklist values to:
- Draft (default)
- Pending Approval
- Approved
- Rejected

### 4. Quote_Line_Item__c (CUSTOM)
| Field | Type | Notes |
|---|---|---|
| Name | Text | item name |
| Quote__c | Master-Detail(Quote) | links to standard Quote |
| Item_Type__c | Picklist | Resource Role, Product, Add-on |
| Resource_Role__c | Lookup(Resource_Role__c) | if type = Resource Role |
| Product__c | Lookup(Product__c) | if type = Product |
| Add_On__c | Lookup(Add_On__c) | if type = Add-on |
| Phase__c | Text | e.g. "Test Strategy & Setup" |
| Task__c | Text | optional |
| Start_Date__c | Date | |
| End_Date__c | Date | |
| Quantity__c | Number | default 1 |
| Base_Rate__c | Currency | original price copied from source |
| Unit_Price__c | Currency | editable, defaults to Base_Rate |
| Discount_Percent__c | Percent | per line item discount |
| Total_Price__c | Formula(Currency) | Unit_Price × Quantity × (1 - Discount%/100) |
| Cost__c | Currency | copied from Resource Role/Product/Add-on cost |
| Margin__c | Formula(Currency) | Total_Price - (Cost × Quantity) |

### 5. Resource_Role__c (CUSTOM)
| Field | Type | Notes |
|---|---|---|
| Name | Auto Number | Format: RR-{00001} |
| Location__c | Text | optional |
| Billing_Unit__c | Picklist | Hour, Day, Each |
| Price__c | Currency | what client pays |
| Cost__c | Currency | what it costs company |
| Tags__c | Text | optional |
| Is_Active__c | Checkbox | default true |

### 6. Product__c (CUSTOM)
| Field | Type | Notes |
|---|---|---|
| Name | Auto Number | Format: {00001} |
| Billing_Unit__c | Picklist | Each, Hour |
| Price__c | Currency | |
| Cost__c | Currency | |
| Tags__c | Text | optional |
| Is_Active__c | Checkbox | default true |

### 7. Add_On__c (CUSTOM)
| Field | Type | Notes |
|---|---|---|
| Name | Auto Number | Format: {00001} |
| Billing_Unit__c | Picklist | Each |
| Price__c | Currency | |
| Cost__c | Currency | |
| Tags__c | Text | optional |
| Is_Active__c | Checkbox | default true |

---

## Complete Flow (Step by Step)

### STEP 1 — Manager sets up master data
- Creates Resource Roles (e.g. QA Lead $100/hr, cost $60/hr)
- Creates Products (e.g. test product 1, $500 each, cost $350)
- Creates Add-ons (e.g. Performance Testing Package, $10,000, cost $7,500)

### STEP 2 — Salesperson creates Account
- Goes to Accounts → +New
- Fills: Name, Type (Prospect/Customer), Industry, Website, Phone

### STEP 3 — Salesperson creates Opportunity
- From Account or Opportunities page → +New
- Fills: Name, Account (lookup), Stage, Close Date

### STEP 4 — Salesperson creates Quote
- Goes to Quotes → +New
- Modal opens with:
  - Opportunity → REQUIRED dropdown
  - Account → AUTO-FILLED from selected Opportunity (read only)
  - Description → optional textarea (255 chars)
  - Quote Start Date → REQUIRED (defaults to today)
  - Quote End Date → optional
  - Time Period → REQUIRED (Months / Quarters / Years)
- Clicks CREATE → Quote created with Status = DRAFT
- Redirected to Quote detail page
- Quote Number auto-generated (Q-00001 format)

### STEP 5 — Quote Detail Page
Header always shows:
- Breadcrumb: Quotes > Q-00007
- Status badge (Draft=grey, Pending Approval=yellow, Approved=green, Rejected=red)
- Editable quote name (pencil icon)
- Total Amount, Subtotal, Margin ($ and %), Discount ($ and %)
- Start Date, End Date, Quote Time Period
- Action buttons (change based on status — see Step 8)

4 Tabs:
1. Summary
2. Line Items
3. Timeline (stub — empty)
4. Generated PDFs (stub — empty)

### STEP 6 — Add Line Items (Line Items Tab)
Table columns: Name, Task, Start Date, End Date, Quantity, Base Rate, Unit Price, Discount%, Total Price
"+Add Phase" button → adds a phase group header row
"+Add Item" button → opens Add Quote Line Items modal

Add Quote Line Items Modal:
- 3 tabs: Resource Roles (count) | Products (count) | Add-ons (count)
- Search bar: "Search by name, description, or ID..."
- Sort buttons: Name, Price, Price Filter
- List of items: checkbox + name + price/billing unit
- "Add X Items" button at bottom (X = selected count)
- On Add → items appear in line items table with data auto-copied from source

Line Items Table Row:
- Drag handle (reorder)
- Type icon (person=Resource Role, cube=Product, sparkle=Add-on)
- Name, Task (optional text)
- Start Date, End Date
- Quantity (editable number)
- Base Rate (from source record, read-only)
- Unit Price (editable, clickable)
- Discount % (editable per line)
- Total Price (auto-calculated, shown in green)
- Bottom row: TOTAL = sum of all Total Price

### STEP 7 — Summary Tab
Metadata card:
- Opportunity, Account (with edit pencil), Valid Until (ExpirationDate), Quote Time Period, Created Date, Created By, Last Modified By

3 Revenue Cards:
1. Labor Revenue → total $, cost $, margin $, count of resource roles, % of grand total
2. Products Revenue → total $, cost $, margin $, count of products, % of grand total
3. Add-ons Revenue → total $, cost $, margin $, count of add-ons, % of grand total

Approval History card (right):
- Draft: "No approval history yet. Submit this quote for approval."
- After submission: "[User] submitted for approval" + comment + timestamp
- After decision: Approved/Rejected entry with timestamp

Charts (bottom):
- Item Type Breakdown — bar chart (Labor, Products, Add-ons) Cost vs Margin bars
- Phase Breakdown — bar chart by phase Cost vs Margin bars

Phase table:
- Columns: Phase | Labor | Products | Add-ons | Total | Items

### STEP 8 — Submit for Approval
- Salesperson clicks "Submit for Approval"
- Status: DRAFT → PENDING APPROVAL (yellow badge)
- Buttons change to: Recall | Approve | Reject | Generate PDF | Save
- Approval History updates with submission + comment + timestamp

### STEP 9 — Approve / Reject / Recall
- Approve → Status = APPROVED (green badge)
- Reject → Status = REJECTED (red badge)
- Recall → Status = DRAFT (can edit again)
- Admin/Manager can approve their own quotes

Button visibility rules:
- "Submit for Approval" → only visible when Status = Draft
- "Recall" → only visible when Status = Pending Approval
- "Approve" + "Reject" → only visible when Status = Pending Approval
- "Generate PDF" → always visible (stub)
- "Save" → always visible

---

## Dashboard Page

3 Insight Cards:
1. Draft Pipeline (blue) — COUNT Draft quotes + SUM TotalPrice + "View Drafts →"
2. High Margin Deals (teal) — COUNT quotes where Margin_Percent__c >= 35 + SUM + "View Opportunities →"
3. Won This Month (green) — COUNT Approved quotes this month + SUM + "View Wins →"

Right panel — Recent Quotes:
- "Your Recent Quotes" + total count
- "Create New Quote" blue button
- List of recent quotes by current logged-in user

AI bar (top) — STUB ONLY if time allows:
- Text input placeholder
- "Ask AI" button
- Quick chip suggestions (hardcoded, no real AI)

---

## All List Pages

### Quotes List
Columns: #, ID (link→detail), Opportunity, Account, Status (badge), Created By, Created Date, Total Amount, Discount%, Margin%, Actions (clone + delete)
Filters: All Status dropdown, All Accounts dropdown
Top right: +New, Refresh, AI Assistant (stub)
Pagination: Previous | Page X of X | Next | Showing X-Y of Z

### Accounts List
Columns: #, Name (link), Account Number, Type (badge), Industry (badge), Website, Phone, Actions (delete)
Filters: All Types, All Industries
Top right: +New, Refresh, AI Assistant (stub)

### Resource Roles List
Columns: #, ID (link), Name, Location, Billing Unit, Price, Cost, Active (toggle), Actions (delete)
Filters: All Status, Filters button
Top right: +New, Import (stub), Refresh, AI Assistant (stub)

### Products List
Columns: #, ID (link), Name, Billing Unit, Price, Cost, Tags, Active (toggle), Actions (delete)
Top right: +New, Import (stub), Refresh, AI Assistant (stub)

### Add-ons List
Columns: #, ID (link), Name, Billing Unit, Price, Cost, Tags, Active (toggle), Actions (delete)
Top right: +New, Import (stub), Refresh, AI Assistant (stub)

---

## LWC Component List

```
provusExpressApp          → main container + page routing
provusSidebar             → left nav, fires navigate event on click

PAGES:
provusDashboard           → dashboard with insight cards
provusQuotesList          → quotes list + create modal
provusQuoteDetail         → quote detail (tabs container)
provusQuoteSummary        → summary tab
provusQuoteLineItems      → line items tab + add items modal
provusAccountsList        → accounts list
provusResourceRolesList   → resource roles list
provusProductsList        → products list
provusAddonsList          → add-ons list

SHARED CHILD COMPONENTS:
provusStatusBadge         → colored pill (Draft/Pending/Approved/Rejected)
provusInsightCard         → dashboard stat card
provusRevenueCard         → Labor/Products/Add-ons card on summary tab
provusApprovalHistory     → approval history panel
provusCreateQuoteModal    → create new quote modal
provusAddItemsModal       → add line items modal (3 tabs)
```

---

## Apex Controllers

```apex
QuoteController
├── getQuotes(String statusFilter, String accountFilter)
├── createQuote(Id opportunityId, String description, Date startDate, Date endDate, String timePeriod)
├── getQuoteById(Id quoteId)
├── updateQuote(Quote quote)
├── deleteQuote(Id quoteId)
├── cloneQuote(Id quoteId)
├── submitForApproval(Id quoteId, String comment)
├── approveQuote(Id quoteId)
├── rejectQuote(Id quoteId)
└── recallQuote(Id quoteId)

QuoteLineItemController
├── getLineItems(Id quoteId)
├── addLineItems(Id quoteId, List<Id> resourceRoleIds, List<Id> productIds, List<Id> addonIds)
├── updateLineItem(Quote_Line_Item__c item)
└── deleteLineItem(Id itemId)

AccountController
├── getAccounts(String typeFilter, String industryFilter)
├── createAccount(Account acc)
└── deleteAccount(Id accountId)

OpportunityController
├── getOpportunities()
└── createOpportunity(Opportunity opp)

ResourceRoleController
├── getResourceRoles(String statusFilter)
├── createResourceRole(Resource_Role__c role)
├── toggleActiveStatus(Id roleId, Boolean isActive)
└── deleteResourceRole(Id roleId)

ProductController
├── getProducts()
├── createProduct(Product__c product)
├── toggleActiveStatus(Id productId, Boolean isActive)
└── deleteProduct(Id productId)

AddonController
├── getAddons()
├── createAddon(Add_On__c addon)
├── toggleActiveStatus(Id addonId, Boolean isActive)
└── deleteAddon(Id addonId)

DashboardController
├── getDraftPipeline()      → Map<String,Object> {count, totalAmount}
├── getHighMarginDeals()    → Map<String,Object> {count, totalAmount}
├── getWonThisMonth()       → Map<String,Object> {count, totalAmount}
└── getRecentQuotes()       → List<Quote>
```

---

## Key Formulas

```
Line Item:
Total_Price__c = Unit_Price__c × Quantity__c × (1 - Discount_Percent__c/100)
Margin__c = Total_Price__c - (Cost__c × Quantity__c)

Quote (calculated in Apex, stored in custom fields):
Subtotal = SUM(Quote_Line_Item__c.Total_Price__c)
Discount_Amount = Subtotal × (Discount%/100)
Total_Amount = Subtotal - Discount_Amount
Margin_Amount = Total_Amount - SUM(Quote_Line_Item__c.Cost__c × Quantity__c)
Margin_Percent = (Margin_Amount / Subtotal) × 100

Revenue Card % contribution:
Labor% = Labor_Total / Grand_Total × 100
Products% = Products_Total / Grand_Total × 100
Addons% = Addons_Total / Grand_Total × 100

Dashboard SOQL:
Draft Pipeline:
  SELECT COUNT(Id), SUM(TotalPrice) FROM Quote WHERE Status = 'Draft'

High Margin Deals:
  SELECT COUNT(Id), SUM(TotalPrice) FROM Quote WHERE Margin_Percent__c >= 35

Won This Month:
  SELECT COUNT(Id), SUM(TotalPrice) FROM Quote
  WHERE Status = 'Approved' AND CreatedDate = THIS_MONTH
```

---

## Status Badge Colors
- Draft → grey (#6b7280)
- Pending Approval → yellow/orange (#f59e0b)
- Approved → green (#10b981)
- Rejected → red (#ef4444)

---

## What to SKIP / STUB
- AI Assistant → placeholder UI only, no real functionality
- Generate PDF → stub button (shows, no action)
- Import button → stub (shows, no action)
- Timeline tab → empty tab header only
- Generated PDFs tab → empty tab header only

---

## What CANNOT Be Skipped
- Two working users with correct permissions
- Full Quote status flow (Draft → Pending Approval → Approved/Rejected, Recall back to Draft)
- Dashboard with REAL live data from database
- All list pages with real data
- Add Items modal with 3 tabs (Resource Roles, Products, Add-ons)
- Line item calculations (Total Price, Margin auto-calculated)
- Quote totals updating when line items change
- Approval History showing on Summary tab

---

## Day-by-Day Plan

**Day 1 — Setup + Apex**
- Customize Quote Status picklist values in Setup
- Add custom fields to standard Quote object (Start_Date__c, End_Date__c, Time_Period__c, Margin_Amount__c, Margin_Percent__c)
- Create Resource_Role__c object + all fields
- Create Product__c object + all fields
- Create Add_On__c object + all fields
- Create Quote_Line_Item__c object + all fields
- Create two users (Salesperson + Manager) with profiles/permission sets
- Write ALL Apex controllers
- Test SOQL queries in Developer Console

**Day 2 — App Shell + Quotes List**
- provusExpressApp (routing container with conditional rendering)
- provusSidebar (navigation with active state)
- provusQuotesList (table, status badges, clone, delete, pagination, filters)
- provusCreateQuoteModal (Opportunity dropdown → Account auto-fill → Create)

**Day 3 — Quote Detail Page**
- provusQuoteDetail (header bar + 4 tab shells)
- provusQuoteLineItems (table with all columns + Add Item + Add Phase)
- provusAddItemsModal (3-tab modal: RR, Products, Addons with search + checkboxes)

**Day 4 — Summary Tab + Approval Flow**
- provusQuoteSummary (metadata card + 3 revenue cards + approval history panel)
- Submit for Approval / Recall / Approve / Reject button logic
- Full status flow working end to end
- Approval History updating correctly

**Day 5 — Remaining Pages + Dashboard**
- provusDashboard (3 insight cards with real data + recent quotes panel)
- provusAccountsList (table + new account modal)
- provusResourceRolesList (table + active toggle + new modal)
- provusProductsList (table + active toggle + new modal)
- provusAddonsList (table + active toggle + new modal)
- Styling polish

**Day 6 — Testing**
- Full flow as Salesperson: account → opportunity → quote → add items → submit
- Full flow as Manager: approve and reject quotes
- Check dashboard numbers are correct
- Fix all bugs
