public with sharing class QuoteController {

    // ── Get all quotes with optional filters ──────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Quote> getQuotes(
            String statusFilter,
            String accountFilter) {

        // Build dynamic query
        String query = 'SELECT Id, QuoteNumber, Name, Status, ' +
                       'OpportunityId, Opportunity.Name, ' +
                       'AccountId, Account.Name, ' +
                       'CreatedById, CreatedBy.Name, CreatedDate, ' +
                       'TotalPrice, GrandTotal, Discount, ' +
                       'Subtotal, ExpirationDate, ' +
                       'Start_Date__c, End_Date__c, Time_Period__c, ' +
                       'Margin_Amount__c, Margin_Percent__c ' +
                       'FROM Quote';

        List<String> conditions = new List<String>();

        // Add status filter if provided
        if (String.isNotBlank(statusFilter) &&
            statusFilter != 'All') {
            conditions.add('Status = \'' +
                     String.escapeSingleQuotes(statusFilter) + '\'');
        }

        // Add account filter if provided
        if (String.isNotBlank(accountFilter) &&
            accountFilter != 'All') {
            conditions.add('AccountId = \'' +
                     String.escapeSingleQuotes(accountFilter) + '\'');
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY CreatedDate DESC';

        return Database.query(query);
    }

    // ── Get single quote by Id ────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Quote getQuoteById(Id quoteId) {
        return [
            SELECT Id, QuoteNumber, Name, Status,
                   OpportunityId, Opportunity.Name,
                   AccountId, Account.Name,
                   CreatedById, CreatedBy.Name,
                   LastModifiedById, LastModifiedBy.Name,
                   CreatedDate, LastModifiedDate,
                   TotalPrice, GrandTotal, Discount,
                   Subtotal, ExpirationDate,
                   Start_Date__c, End_Date__c,
                   Time_Period__c,
                   Margin_Amount__c, Margin_Percent__c
            FROM Quote
            WHERE Id = :quoteId
            LIMIT 1
        ];
    }

    // ── Create new quote ──────────────────────────────────────────────────
    @AuraEnabled
    public static Id createQuote(
            Id opportunityId,
            String description,
            Date startDate,
            Date endDate,
            String timePeriod) {

        // Get Account from Opportunity
        Opportunity opp = [
            SELECT Id, AccountId
            FROM Opportunity
            WHERE Id = :opportunityId
            LIMIT 1
        ];

        Quote q = new Quote();
        q.OpportunityId  = opportunityId;
        // AccountId is auto-derived from Opportunity — don't set manually
        q.Name           = 'New Quote';   // user can rename later
        q.Description    = description;
        q.Status         = 'Draft';       // always starts as Draft
        q.Start_Date__c  = startDate;
        q.End_Date__c    = endDate;
        q.Time_Period__c = timePeriod;

        insert q;
        return q.Id; // return Id so LWC can navigate to detail
    }

    // ── Update quote fields ───────────────────────────────────────────────
    @AuraEnabled
    public static void updateQuote(Quote quote) {
        update quote;
    }

    // ── Delete quote ──────────────────────────────────────────────────────
    @AuraEnabled
    public static void deleteQuote(Id quoteId) {
        Quote q = new Quote(Id = quoteId);
        delete q;
    }

    // ── Clone quote ───────────────────────────────────────────────────────
    @AuraEnabled
    public static Id cloneQuote(Id quoteId) {
        // Get original quote
        Quote original = [
            SELECT Id, OpportunityId, Name, Description,
                   Status, Start_Date__c, End_Date__c,
                   Time_Period__c, Discount
            FROM Quote
            WHERE Id = :quoteId
            LIMIT 1
        ];

        // Create clone
        Quote cloned = original.clone(false, true, false, false);
        cloned.Name   = 'Copy of ' + original.Name;
        cloned.Status = 'Draft'; // clone always starts as Draft
        insert cloned;

        // Clone line items too
        List<Quote_Line_Item__c> originalItems = [
            SELECT Name, Item_Type__c, Resource_Role__c, Product__c,
                   Add_On__c, Phase__c, Task__c,
                   Start_Date__c, End_Date__c, Quantity__c,
                   Base_Rate__c, Unit_Price__c,
                   Discount_Percent__c, Cost__c
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
        ];

        List<Quote_Line_Item__c> clonedItems = new List<Quote_Line_Item__c>();
        for (Quote_Line_Item__c item : originalItems) {
            Quote_Line_Item__c clonedItem = item.clone(false, true, false, false);
            clonedItem.Quote__c = cloned.Id;
            clonedItems.add(clonedItem);
        }

        if (!clonedItems.isEmpty()) {
            insert clonedItems;
        }

        return cloned.Id;
    }

    // ── Submit for approval ───────────────────────────────────────────────
    @AuraEnabled
    public static void submitForApproval(Id quoteId, String comment) {
        try {
            // Change status to Pending Approval
            Quote q = new Quote(Id = quoteId);
            q.Status = 'Pending Approval';
            update q;

            // Submit to Salesforce Approval Process
            // NOTE: Uncomment the code below once you have created the
            // 'Quote_Approval' Approval Process in Salesforce Setup.
            /*
            Approval.ProcessSubmitRequest req =
                new Approval.ProcessSubmitRequest();
            req.setObjectId(quoteId);
            req.setComments(comment);
            req.setProcessDefinitionNameOrId('Quote_Approval');

            Approval.ProcessResult result = Approval.process(req);

            if (!result.isSuccess()) {
                // If approval process fails, revert status
                q.Status = 'Draft';
                update q;
                throw new AuraHandledException(
                    'Approval submission failed: ' + result.getErrors()
                );
            }
            */
        } catch (Exception e) {
            throw new AuraHandledException('Approval error. Ensure the "Pending Approval" status is added to the Quote Status picklist: ' + e.getMessage());
        }
    }

    // ── Approve quote ─────────────────────────────────────────────────────
    @AuraEnabled
    public static void approveQuote(Id quoteId) {
        try {
            Quote q = new Quote(Id = quoteId);
            q.Status = 'Approved';
            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Failed to approve: ' + e.getMessage());
        }
    }

    // ── Reject quote ──────────────────────────────────────────────────────
    @AuraEnabled
    public static void rejectQuote(Id quoteId, String reason) {
        try {
            Quote q = new Quote(Id = quoteId);
            q.Status = 'Rejected';
            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Failed to reject: ' + e.getMessage());
        }
    }

    // ── Recall quote back to Draft ────────────────────────────────────────
    @AuraEnabled
    public static void recallQuote(Id quoteId) {
        try {
            Quote q = new Quote(Id = quoteId);
            q.Status = 'Draft';
            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Failed to recall: ' + e.getMessage());
        }
    }

    // ── Get all accounts for filter dropdown ──────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccountsForFilter() {
        return [
            SELECT Id, Name
            FROM Account
            ORDER BY Name ASC
        ];
    }

    // ── Recalculate quote totals from line items ──────────────────────────
@AuraEnabled
public static void recalculateQuoteTotals(Id quoteId) {
    List<Quote_Line_Item__c> qlis = [
        SELECT Total_Price__c, Cost__c, Quantity__c 
        FROM Quote_Line_Item__c 
        WHERE Quote__c = :quoteId
    ];

    Decimal revenue = 0;
    Decimal totalCost = 0;

    for(Quote_Line_Item__c item : qlis) {
        if(item.Total_Price__c != null) revenue += item.Total_Price__c;
        if(item.Cost__c != null && item.Quantity__c != null) {
            totalCost += (item.Cost__c * item.Quantity__c);
        }
    }

    Quote q = new Quote(Id = quoteId);
    // We store the revenue in Margin_Amount__c + Cost, 
    // but we need a place to store the actual Total Revenue.
    q.Margin_Amount__c = revenue - totalCost;
    q.Margin_Percent__c = (revenue > 0) ? (q.Margin_Amount__c / revenue) * 100 : 0;
    
    // IMPORTANT: If you have custom fields for Total/Subtotal, map them here:
    // q.Custom_Total_Amount__c = revenue; 
    
    update q;
}
}