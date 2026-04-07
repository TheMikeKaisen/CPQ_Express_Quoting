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

    // ── Helper: check if current user is Manager/Admin ────────
    private static Boolean isManagerOrAdmin() {
        User currentUser = [
            SELECT Id, Profile.Name
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];
        String profileName = currentUser.Profile.Name;
        return profileName == 'System Administrator' ||
               profileName == 'CPQ Manager';
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

        try {
            // Get Account from Opportunity
            Opportunity opp = [
                SELECT Id, AccountId, Pricebook2Id
                FROM Opportunity
                WHERE Id = :opportunityId
                LIMIT 1
            ];

            Quote q = new Quote();
            q.OpportunityId  = opportunityId;
            // Inherit Pricebook from Opportunity if present
            if (opp.Pricebook2Id != null) {
                q.Pricebook2Id = opp.Pricebook2Id;
            }
            
            q.Name           = 'New Quote';   // user can rename later
            q.Description    = description;
            q.Status         = 'Draft';       // always starts as Draft
            q.Start_Date__c  = startDate;
            q.End_Date__c    = endDate;
            q.Time_Period__c = timePeriod;

            insert q;
            return q.Id; // return Id so LWC can navigate to detail
        } catch (Exception e) {
            throw new AuraHandledException('Quote Creation Failed: ' + e.getMessage());
        }
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
    public static Id cloneQuote(Id quoteId, Id accountId) {
        // Get original quote with Phase List for proper structure
        Quote original = [
            SELECT Id, OpportunityId, AccountId, Name, Description,
                   Status, Start_Date__c, End_Date__c,
                   Time_Period__c, Discount, Phase_List__c
            FROM Quote
            WHERE Id = :quoteId
            LIMIT 1
        ];

        // Create clone
        Quote cloned = original.clone(false, true, false, false);
        cloned.Name   = 'Copy of ' + (original.Name != null ? original.Name : 'Quote');
        cloned.Status = 'Draft'; // clone always starts as Draft
        
        // Target a different account if provided
        if (accountId != null) {
            
            // If we change Account and it's Master-Detail to Opportunity,
            // we should try to find an Opportunity for the target account.
            List<Opportunity> targetOpps = [
                SELECT Id FROM Opportunity 
                WHERE AccountId = :accountId 
                ORDER BY LastModifiedDate DESC 
                LIMIT 1
            ];
            
            if (!targetOpps.isEmpty()) {
                cloned.OpportunityId = targetOpps[0].Id;
            } else {
                throw new AuraHandledException('No Opportunity found for the target Account. Quotes must be linked to an Opportunity belonging to the Account.');
            }
        }

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
        SELECT Total_Price__c, Cost__c, Quantity__c, End_Date__c 
        FROM Quote_Line_Item__c 
        WHERE Quote__c = :quoteId
    ];

    Decimal revenue = 0;
    Decimal totalCost = 0;
    Date maxEnd = null;

    for(Quote_Line_Item__c item : qlis) {
        if(item.Total_Price__c != null) revenue += item.Total_Price__c;
        if(item.Cost__c != null && item.Quantity__c != null) {
            totalCost += (item.Cost__c * item.Quantity__c);
        }
        if(item.End_Date__c != null) {
            if(maxEnd == null || item.End_Date__c > maxEnd) maxEnd = item.End_Date__c;
        }
    }

    // Query to get current End_Date__c for comparison
    Quote q = [SELECT Id, End_Date__c FROM Quote WHERE Id = :quoteId LIMIT 1];
    
    q.Margin_Amount__c = revenue - totalCost;
    q.Margin_Percent__c = (revenue > 0) ? (q.Margin_Amount__c / revenue) * 100 : 0;
    
    // Automatically extend quote end date if a line item exceeds it
    if (maxEnd != null && (q.End_Date__c == null || maxEnd > q.End_Date__c)) {
        q.End_Date__c = maxEnd;
    }
    
    update q;
}
}