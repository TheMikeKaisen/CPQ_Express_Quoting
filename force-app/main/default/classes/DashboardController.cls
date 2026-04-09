public without sharing class DashboardController {

    // ── Awaiting Approval card ────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAwaitingApproval() {
        AggregateResult result = [
            SELECT COUNT(Id) quoteCount,
                   SUM(Total_Amount__c) totalAmount
            FROM Quote
            WHERE Status = 'Pending Approval'
        ];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── Low Margin Drafts card ───────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getLowMarginDrafts() {
        // Threshold: 15%
        AggregateResult result = [
            SELECT COUNT(Id) quoteCount,
                   SUM(Total_Amount__c) totalAmount
            FROM Quote
            WHERE Status = 'Draft'
            AND Margin_Percent__c < 15
        ];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── Draft Pipeline card ───────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDraftPipeline() {
        AggregateResult result = [
            SELECT COUNT(Id) quoteCount,
                   SUM(Total_Amount__c) totalAmount
            FROM Quote
            WHERE Status = 'Draft'
        ];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── High Margin Deals card ────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getHighMarginDeals() {
        AggregateResult result = [
            SELECT COUNT(Id) quoteCount,
                   SUM(Total_Amount__c) totalAmount
            FROM Quote
            WHERE Margin_Percent__c >= 35
        ];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── Won This Month card ───────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getWonThisMonth() {
        AggregateResult result = [
            SELECT COUNT(Id) quoteCount,
                   SUM(Total_Amount__c) totalAmount
            FROM Quote
            WHERE Status = 'Approved'
            AND CreatedDate = THIS_MONTH
        ];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── Recent quotes for right panel with filtering ─────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Quote> getRecentQuotes(String statusFilter) {
        String query = 'SELECT Id, QuoteNumber, Name, Status, ' +
                       'Account.Name, Total_Amount__c, ' +
                       'CreatedDate, Margin_Percent__c ' +
                       'FROM Quote ' +
                       'WHERE CreatedById = \'' + UserInfo.getUserId() + '\'';
        
        if (String.isNotBlank(statusFilter) && statusFilter != 'All') {
            query += ' AND Status = \'' + String.escapeSingleQuotes(statusFilter) + '\'';
        }

        query += ' ORDER BY CreatedDate DESC LIMIT 5';
        return Database.query(query);
    }

    // ── Total quote count for "X quotes total" label ──────────────────────
    @AuraEnabled(cacheable=true)
    public static Integer getTotalQuoteCount(String statusFilter) {
        String query = 'SELECT COUNT() FROM Quote ' +
                       'WHERE CreatedById = \'' + UserInfo.getUserId() + '\'';
        
        if (String.isNotBlank(statusFilter) && statusFilter != 'All') {
            query += ' AND Status = \'' + String.escapeSingleQuotes(statusFilter) + '\'';
        }

        return Database.countQuery(query);
    }
}