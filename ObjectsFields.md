## **Every Object and Every Field**

### **1. Account (STANDARD — use as is)**

Fields already exist:

- Name
- AccountNumber
- Type (Picklist: Customer, Prospect)
- Industry
- Website
- Phone

### **2. Opportunity (STANDARD — use as is)**

Fields already exist:

- Name
- AccountId (Lookup to Account)
- StageName
- CloseDate
- Amount

### **3. Quote (STANDARD + add custom fields)**

Standard fields to USE:

| Standard Field | Notes |
| --- | --- |
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

| Custom Field | Type | Notes |  |
| --- | --- | --- | --- |
| Start_Date__c | Date | REQUIRED |  |
| End_Date__c | Date | Optional |  |
| Time_Period__c | Picklist | Days, Weeks, Months, Quarters— REQUIRED |  |
| Margin_Amount__c | Currency | Total - Total Cost |  |
| Margin_Percent__c | Percent | Margin/Subtotal × 100 |  |

Customize Quote Status picklist values to:

- Draft (default)
- Pending Approval
- Approved
- Rejected

### **4. Quote_Line_Item__c (CUSTOM)**

| Field | Type | Notes |
| --- | --- | --- |
| Quote Line Item Name | Text | item name |
| Quote__c | Master-Detail(Quote) | links to standard Quote |
| Item_Type__c | Picklist | Resource Role, Product, Add-on |
| Resource_Role__c | Lookup(Resource_Role__c) | if type = Resource Role |
| Product__c | Lookup(Product__c) | if type = Product |
| Add_On__c | Lookup(Add_On__c) | if type = Add-on |
| Phase__c | Text | e.g. "Test Strategy & Setup" |
| Task__c | Text | optional |
| Start_Date__c | Date |  |
| End_Date__c | Date |  |
| Quantity__c | Number | default 1 |
| Base_Rate__c | Currency | original price copied from source |
| Unit_Price__c | Currency | editable, defaults to Base_Rate |
| Discount_Percent__c | Percent | per line item discount |
| Total_Price__c | Formula(Currency) | Unit_Price × Quantity × (1 - Discount%/100) |
| Cost__c | Currency | copied from Resource Role/Product/Add-on cost |
| Margin__c | Formula(Currency) | Total_Price - (Cost × Quantity) |

### **5. Resource_Role__c (CUSTOM)**

| Field | Type | Notes |
| --- | --- | --- |
| Name | Auto Number | Format: RR-{00001} |
| Location__c | Text | optional |
| Billing_Unit__c | Picklist | Required: Hour, Day, Each |
| Price__c | Currency | Required: what client pays |
| Cost__c | Currency | Required: what it costs company |
| Tags__c | Text | optional |
| Is_Active__c | Checkbox | default true |

### **6. Product__c (CUSTOM)**

| Field | Type | Notes |
| --- | --- | --- |
| Id | Auto Number | Format: `PR-{00001}` |
| Billing_Unit__c | Picklist | Each |
| Price__c | Currency |  |
| Cost__c | Currency |  |
| Tags__c | Text | optional |
| Is_Active__c | Checkbox | default true |
| Name | text | Product Name |
| Description | text |  |

### **7. Add_On__c (CUSTOM)**

| Field | Type | Notes |
| --- | --- | --- |
| Id | Auto Number | Format: AO-{00001} |
| Billing_Unit__c | Picklist | Each, Hour |
| Price__c | Currency |  |
| Cost__c | Currency |  |
| Tags__c | Text | optional |
| Is_Active__c | Checkbox | default true |
| Name | Text |  |

---

## **Complete Flow (Step by Step)**