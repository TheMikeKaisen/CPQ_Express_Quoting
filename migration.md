# Provus CPQ Express — Scratch Org Migration Guide
### (With Agentforce / Einstein AI Support)

This document walks you through creating a new Salesforce scratch org configured for **Agentforce** and **Einstein AI**, migrating the full CPQ Express codebase into it, and getting it running end-to-end.

---

## Why You Need a New Scratch Org

Your current scratch org was created with this minimal `project-scratch-def.json`:
```json
{ "edition": "Enterprise", "features": ["EnableSetPasswordInApi"] }
```

**Agentforce and Einstein AI require additional features and settings** that must be declared at org creation time and cannot be added to an existing scratch org. Specifically:
- `AgentforceStandardAgents` feature flag
- `EinsteinGPTForSalesforce` or `GenerativeAiFeatures` feature flag
- `DataCloud` (recommended for grounding agents with your CPQ data)
- Explicit Einstein settings enabled in `settings`

---

## Part 1 — Update Scratch Org Definition File

**File:** `config/project-scratch-def.json`

Replace the current content with the following:

```json
{
    "orgName": "Provus CPQ Express — AI",
    "edition": "Enterprise",
    "features": [
        "EnableSetPasswordInApi",
        "AgentforceStandardAgents",
        "EinsteinGPTForCRM",
        "EinsteinGPTForSales",
        "GenerativeAiFeatures",
        "DataCloud"
    ],
    "settings": {
        "lightningExperienceSettings": {
            "enableS1DesktopEnabled": true
        },
        "mobileSettings": {
            "enableS1EncryptedStoragePref2": false
        },
        "userManagementSettings": {
            "enableEnhancedPermsetMgmt": true
        },
        "einsteinSettings": {
            "einsteinEnabled": true
        },
        "languageSettings": {
            "language": "en_US"
        }
    },
    "adminEmail": "h.karthiknair@gmail.com"
}
```

> **Note:** `DataCloud` requires your Dev Hub org to have a Data Cloud license. If it fails, remove that feature and add it later.

---

## Part 2 — Create the New Scratch Org

### Step 1: Verify Dev Hub is connected

```bash
sf org list
```

Look for a Dev Hub org in the output. If none is connected:
```bash
sf org login web --set-default-dev-hub --alias DevHub
```

### Step 2: Create the new scratch org

```bash
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias CPQ-AI-Org \
  --duration-days 30 \
  --set-default
```

> Use `--duration-days 30` to give yourself enough time. Maximum is 30 days for scratch orgs.

### Step 3: Open the org to verify it launched

```bash
sf org open --target-org CPQ-AI-Org
```

---

## Part 3 — Salesforce Setup: Platform Settings (Do This Before Deploying Code)

These steps must be done manually in the UI because they are org-level configurations that cannot be scripted.

### 3.1 — Enable Einstein / Generative AI

1. Go to **Setup → Einstein Setup**
2. Toggle **Turn on Einstein** → ON
3. Go to **Setup → Generative AI → Generative AI Settings**
4. Enable **Generative AI**
5. Accept any Terms of Service

### 3.2 — Enable Agentforce

1. Go to **Setup → Agentforce Agents**
2. Click **Get Started** if prompted
3. Agentforce should now be available for configuration

### 3.3 — Create Custom Profiles (IMPORTANT — Must match existing code)

Your Apex controllers check for these exact profile names. Create them manually:

1. Go to **Setup → Profiles → New Profile**
2. Create **"CPQ Salesperson"** — Clone from "Standard User"
3. Create **"CPQ Manager"** — Clone from "Standard User"

> These profiles are referenced in `UserController.cls` and `UserContextController.cls`. If you skip this, user creation and role detection will break.

### 3.4 — Enable Quote Object Standard Features

The project uses the standard Salesforce **Quote** object with custom fields.

1. Go to **Setup → Quotes Settings**
2. Enable **Quotes**

---

## Part 4 — Deploy All Source Metadata

Now deploy everything from your local project to the new scratch org.

### Step 1: Deploy all source

```bash
sf project deploy start \
  --source-dir force-app \
  --target-org CPQ-AI-Org
```

### Step 2: Verify deployment (check for errors in output)

If you get errors:
- `FIELD_INTEGRITY_EXCEPTION` → The standard Quote object needs to be enabled first (Step 3.4)
- `Unable to find Apex action method` → Deploy Apex classes first, then LWC
- `Profile not found` → Create the CPQ Salesperson and CPQ Manager profiles first (Step 3.3)

### Step 3: If full deploy fails, deploy in layers

```bash
# Layer 1: Custom objects and fields first
sf project deploy start \
  --source-dir force-app/main/default/objects \
  --target-org CPQ-AI-Org

# Layer 2: Apex classes
sf project deploy start \
  --source-dir force-app/main/default/classes \
  --target-org CPQ-AI-Org

# Layer 3: Permission sets
sf project deploy start \
  --source-dir force-app/main/default/permissionsets \
  --target-org CPQ-AI-Org

# Layer 4: LWC components and everything else
sf project deploy start \
  --source-dir force-app/main/default/lwc \
  --source-dir force-app/main/default/flexipages \
  --source-dir force-app/main/default/applications \
  --target-org CPQ-AI-Org
```

---

## Part 5 — What Gets Migrated (Full Inventory)

### Custom Objects

| Object | API Name | Description |
|---|---|---|
| Quote (Standard) | `Quote` | Native SF Quote object with CPQ custom fields |
| Quote Line Items | `Quote_Line_Item__c` | Each row in a quote (resource, product, addon) |
| Product | `Product__c` | Product catalog |
| Resource Role | `Resource_Role__c` | Staffing roles (e.g. Fullstack Dev) |
| Add-On | `Add_On__c` | Additional services catalog |
| Company Profile | `Company_Profile__c` | Branding/company info for PDF generation |
| Quote Document | `Quote_Document__c` | Saved PDF snapshots |

### Custom Fields on Quote (Standard Object)

| Field | API Name | Type |
|---|---|---|
| End Date | `End_Date__c` | Date |
| Margin Amount | `Margin_Amount__c` | Formula/Currency |
| Margin Percent | `Margin_Percent__c` | Formula/Percent |
| Phase List | `Phase_List__c` | Long Text (JSON) |
| Start Date | `Start_Date__c` | Date |
| Subtotal | `Subtotal__c` | Formula/Currency |
| Time Period | `Time_Period__c` | Picklist (Days/Weeks/Months/Quarters) |
| Total Amount | `Total_Amount__c` | Formula/Currency |

### Custom Fields on Quote_Line_Item__c

| Field | API Name | Type |
|---|---|---|
| Add On | `Add_On__c` | Lookup (Add_On__c) |
| Base Rate | `Base_Rate__c` | Currency |
| Billing Unit | `Billing_Unit__c` | Picklist (Hour/Day/Each) |
| Cost | `Cost__c` | Currency |
| Discount Percent | `Discount_Percent__c` | Percent |
| Duration | `Duration__c` | Number |
| End Date | `End_Date__c` | Date |
| Item Type | `Item_Type__c` | Picklist (Resource Role/Product/Add-on) |
| Line Total | `Line_Total__c` | Currency (Formula) |
| Margin | `Margin__c` | Currency (Formula) |
| Phase | `Phase__c` | Text |
| Product | `Product__c` | Lookup (Product__c) |
| Quantity | `Quantity__c` | Number |
| Quote | `Quote__c` | Master-Detail (Quote) |
| Resource Role | `Resource_Role__c` | Lookup (Resource_Role__c) |
| Start Date | `Start_Date__c` | Date |
| Task | `Task__c` | Text |
| Total Price | `Total_Price__c` | Currency (Formula) |
| Unit Price | `Unit_Price__c` | Currency |

### Apex Classes (12 total)

| Class | Purpose |
|---|---|
| `AccountController` | Account SOQL queries for the dropdown |
| `AddonController` | Add-on catalog CRUD |
| `CompanySettingsController` | Save/load company branding (logo, address) |
| `DashboardController` | Metrics for the home dashboard |
| `OpportunityController` | Opportunity SOQL for quote linking |
| `ProductController` | Product catalog CRUD |
| `QuoteController` | Core quote operations + branding bridge |
| `QuoteLineItemController` | Line item CRUD, phase management, summaries |
| `QuotePdfController` | Save/load/delete PDF snapshot documents |
| `ResourceRoleController` | Resource role catalog CRUD |
| `UserContextController` | Returns current user's role/profile/admin status |
| `UserController` | Team management — create/deactivate users |

### LWC Components (20 total)

| Component | Purpose |
|---|---|
| `provusExpressApp` | Root shell app with navigation |
| `provusDashboard` | Home metrics dashboard |
| `provusSidebar` | Navigation sidebar |
| `provusQuotesList` | Quotes table with filters |
| `provusQuoteDetail` | Quote detail view with tabs |
| `provusQuoteLineItems` | Line items table with inline editing |
| `provusQuoteSummary` | Quote summary tab |
| `provusQuoteTimeline` | Timeline/Gantt tab |
| `provusGeneratePdfModal` | PDF generation modal |
| `provusCreateQuoteModal` | Create new quote modal |
| `provusCloneQuoteModal` | Clone quote modal |
| `provusAddItemsModal` | Add line items modal |
| `provusAccountsList` | Accounts catalog page |
| `provusProductsList` | Products catalog page |
| `provusAddonsList` | Add-ons catalog page |
| `provusResourceRolesList` | Resource roles catalog page |
| `provusSettings` | Settings panel (team, company, general) |
| `provusApprovalHistory` | Approval history viewer |
| `provusStatusBadge` | Reusable status indicator badge |
| `provusRevenueCard` | Revenue metric card component |

### Permission Sets

| Permission Set | API Name | Who Gets It |
|---|---|---|
| CPQ Manager Access | `CPQ_Manager_Access` | Managers — can approve/reject, manage users |
| CPQ Salesperson Access | `CPQ_Salesperson_Access` | Salespeople — can create/edit own quotes |

---

## Part 6 — Post-Deploy Manual Configuration

### 6.1 — Assign Permission Sets to Your Admin User

After deployment, run this in the **Developer Console** or VS Code **Execute Anonymous**:

```apex
// Replace 'your.email@example.com' with your admin user's email
User u = [SELECT Id FROM User WHERE Email = 'h.karthiknair@gmail.com' AND IsActive = true LIMIT 1];

PermissionSet managerPS = [SELECT Id FROM PermissionSet WHERE Name = 'CPQ_Manager_Access' LIMIT 1];
insert new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = managerPS.Id);
```

### 6.2 — Create the Lightning App Page

The app uses a Flexipage. After deployment:

1. Go to **Setup → Lightning App Builder**
2. Look for `provusExpressApp` in the list
3. If missing, create a new App Page and drag the `c:provusExpressApp` component onto it
4. Activate the page and assign it to the relevant profiles

### 6.3 — Add to Navigation Menu (App Launcher)

1. Go to **Setup → App Manager**
2. Find or create your Lightning App
3. Add the `provusExpressApp` tab to the navigation
4. Assign the app to **CPQ Salesperson** and **CPQ Manager** profiles

### 6.4 — Validate Custom Profile Names

Open **Developer Console → Execute Anonymous** and run:

```apex
List<Profile> profiles = [SELECT Id, Name FROM Profile WHERE Name IN ('CPQ Salesperson', 'CPQ Manager', 'System Administrator')];
for (Profile p : profiles) {
    System.debug('Found profile: ' + p.Name + ' - ID: ' + p.Id);
}
```

You should see all 3 profiles in the output. If `CPQ Salesperson` or `CPQ Manager` are missing, go back to Step 3.3.

---

## Part 7 — Agentforce Configuration (After Base App is Working)

Only begin this section once the CPQ app itself is fully working in the new org.

### 7.1 — Deploy Agentforce Apex Actions

Create `force-app/main/default/classes/AgentforceQuoteActions.cls` with `@InvocableMethod` annotations.
Refer to `agentforce_implementation_guide.md` in the project root for the full Apex code.

```bash
sf project deploy start \
  --source-dir force-app/main/default/classes/AgentforceQuoteActions.cls \
  --target-org CPQ-AI-Org
```

### 7.2 — Register Actions in Agentforce Setup

1. **Setup → Agentforce Agents → Actions → New Action**
2. Action Type: `Apex`
3. Select `AgentforceQuoteActions` class
4. Register each `@InvocableMethod` as a separate named Action

### 7.3 — Create the Provus CPQ Agent

1. **Setup → Agentforce Agents → New Agent**
2. Name: `Provus CPQ Assistant`
3. Add Topics (Quote Management, Staffing/Line Items, General Help)
4. Configure System Prompt (see `agentforce_implementation_guide.md`)
5. Activate the Agent

### 7.4 — Grant Agentforce Permissions

Update both permission sets to include Agentforce access:
- Add `AgentforceQuoteActions` class to both `CPQ_Manager_Access` and `CPQ_Salesperson_Access`
- Go to **Setup → Permission Sets → CPQ Manager Access → Apex Class Access → Add AgentforceQuoteActions**

### 7.5 — Add the AI Panel to Your App

In `provusExpressApp.html`, add the built-in Agentforce panel:
```html
<template if:true={showAi}>
    <einstein-copilot></einstein-copilot>
</template>
```
Or build a custom `provusAiAssistant` component using `ConnectApi.AgentConversation`.

---

## Part 8 — Troubleshooting Common Migration Issues

| Error | Cause | Fix |
|---|---|---|
| `FIELD_INTEGRITY_EXCEPTION on Quote` | Quote standard object not enabled | Setup → Quotes Settings → Enable Quotes |
| `Unable to find Apex action method referenced as X` | Deploy Apex before LWC | Deploy classes layer before lwc layer |
| `NoAccessException: User.ProfileId` | Missing `without sharing` on UserController | Already fixed — ensure your `UserController.cls` is `public without sharing` |
| `Profile not found: CPQ Manager` | Custom profile not created | Manually create profiles in Setup → Profiles |
| `Agentforce not available` | Feature not enabled on Dev Hub | Contact Salesforce support to enable Agentforce on your Dev Hub org |
| `Einstein Setup not visible` | Einstein not enabled | Setup → Einstein Setup → Turn on Einstein |
| `Permission set deploy error: Field X not found` | Object not yet deployed | Always deploy objects before permission sets |

---

## Part 9 — Full Execution Order (Checklist)

Follow this exact sequence for a smooth migration:

```
[ ] 1. Update config/project-scratch-def.json with AI features
[ ] 2. Create new scratch org: sf org create scratch ...
[ ] 3. Open org: sf org open
[ ] 4. MANUAL: Enable Einstein (Setup → Einstein Setup)
[ ] 5. MANUAL: Enable Agentforce (Setup → Agentforce Agents)
[ ] 6. MANUAL: Enable Quotes (Setup → Quotes Settings)
[ ] 7. MANUAL: Create "CPQ Salesperson" profile (clone Standard User)
[ ] 8. MANUAL: Create "CPQ Manager" profile (clone Standard User)
[ ] 9. Deploy objects: sf project deploy start --source-dir force-app/main/default/objects
[ ]10. Deploy classes: sf project deploy start --source-dir force-app/main/default/classes
[ ]11. Deploy permission sets: sf project deploy start --source-dir force-app/main/default/permissionsets
[ ]12. Deploy everything else: sf project deploy start --source-dir force-app
[ ]13. MANUAL: Assign CPQ_Manager_Access permission set to your admin user (via Execute Anonymous)
[ ]14. MANUAL: Configure Lightning App page and App Manager navigation
[ ]15. Smoke test: Open the app, create a quote, add line items
[ ]16. Deploy AgentforceQuoteActions.cls
[ ]17. MANUAL: Register Agentforce Actions in Setup
[ ]18. MANUAL: Create Provus CPQ Agent, add Topics, activate
[ ]19. MANUAL: Update permission sets to allow Agentforce class access
[ ]20. Test AI panel: Open app, ask AI to "create a quote for Acme"
```

---

> **Tip:** Keep a separate terminal tab running `sf project deploy start --source-dir force-app --target-org CPQ-AI-Org` for quick re-deploys after code changes.
