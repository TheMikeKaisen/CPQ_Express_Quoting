public with sharing class DashboardController {

    private static Boolean isManagerOrAdmin() {
        Id userId = UserInfo.getUserId();
        User u = [SELECT Profile.Name FROM User WHERE Id = :userId LIMIT 1];
        
        Boolean hasManagerPS = [
            SELECT count() 
            FROM PermissionSetAssignment 
            WHERE AssigneeId = :userId 
            AND PermissionSet.Name = 'CPQ_Manager_Access'
        ] > 0;

        return u.Profile.Name == 'System Administrator' || 
               u.Profile.Name == 'CPQ Manager' || 
               hasManagerPS;
    }

    // ── Awaiting Approval card ────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAwaitingApproval() {
        String query = 'SELECT COUNT(Id) quoteCount, SUM(Total_Amount__c) totalAmount FROM Quote WHERE Status = \'Pending Approval\'';
        if (!isManagerOrAdmin()) {
            query += ' AND OwnerId = \'' + UserInfo.getUserId() + '\'';
        }
        AggregateResult result = (AggregateResult)Database.query(query)[0];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── Low Margin Drafts card ───────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getLowMarginDrafts() {
        String query = 'SELECT COUNT(Id) quoteCount, SUM(Total_Amount__c) totalAmount FROM Quote WHERE Status = \'Draft\' AND Margin_Percent__c < 15';
        if (!isManagerOrAdmin()) {
            query += ' AND OwnerId = \'' + UserInfo.getUserId() + '\'';
        }
        AggregateResult result = (AggregateResult)Database.query(query)[0];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── Draft Pipeline card ───────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDraftPipeline() {
        String query = 'SELECT COUNT(Id) quoteCount, SUM(Total_Amount__c) totalAmount FROM Quote WHERE Status = \'Draft\'';
        if (!isManagerOrAdmin()) {
            query += ' AND OwnerId = \'' + UserInfo.getUserId() + '\'';
        }
        AggregateResult result = (AggregateResult)Database.query(query)[0];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── High Margin Deals card ────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getHighMarginDeals() {
        String query = 'SELECT COUNT(Id) quoteCount, SUM(Total_Amount__c) totalAmount FROM Quote WHERE Margin_Percent__c >= 35';
        if (!isManagerOrAdmin()) {
            query += ' AND OwnerId = \'' + UserInfo.getUserId() + '\'';
        }
        AggregateResult result = (AggregateResult)Database.query(query)[0];

        return new Map<String, Object>{
            'count'       => (Integer) result.get('quoteCount'),
            'totalAmount' => (Decimal) result.get('totalAmount')
        };
    }

    // ── Won This Month card ───────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getWonThisMonth() {
        String query = 'SELECT COUNT(Id) quoteCount, SUM(Total_Amount__c) totalAmount FROM Quote WHERE Status = \'Approved\' AND CreatedDate = THIS_MONTH';
        if (!isManagerOrAdmin()) {
            query += ' AND OwnerId = \'' + UserInfo.getUserId() + '\'';
        }
        AggregateResult result = (AggregateResult)Database.query(query)[0];

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
                       'FROM Quote';
        
        List<String> conditions = new List<String>();
        
        if (String.isNotBlank(statusFilter) && statusFilter != 'All') {
            conditions.add('Status = \'' + String.escapeSingleQuotes(statusFilter) + '\'');
        }

        if (!isManagerOrAdmin()) {
            conditions.add('OwnerId = \'' + UserInfo.getUserId() + '\'');
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY CreatedDate DESC LIMIT 5';
        return Database.query(query);
    }

    // ── Total quote count for "X quotes total" label ──────────────────────
    @AuraEnabled(cacheable=true)
    public static Integer getTotalQuoteCount(String statusFilter) {
        String query = 'SELECT COUNT() FROM Quote';
        List<String> conditions = new List<String>();
        
        if (String.isNotBlank(statusFilter) && statusFilter != 'All') {
            conditions.add('Status = \'' + String.escapeSingleQuotes(statusFilter) + '\'');
        }

        if (!isManagerOrAdmin()) {
            conditions.add('OwnerId = \'' + UserInfo.getUserId() + '\'');
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        return Database.countQuery(query);
    }
}