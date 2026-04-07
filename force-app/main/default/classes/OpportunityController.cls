public with sharing class OpportunityController {

    // ── Get all opportunities for dropdown ────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getOpportunities() {
        return [
            SELECT Id, Name, AccountId, Account.Name,
                   StageName, CloseDate, Amount
            FROM Opportunity
            WHERE IsClosed = false
            ORDER BY Name ASC
        ];
    }

    // ── Get single opportunity (to auto-fill Account) ─────────────────────
    @AuraEnabled(cacheable=true)
    public static Opportunity getOpportunityById(Id oppId) {
        return [
            SELECT Id, Name, AccountId, Account.Name
            FROM Opportunity
            WHERE Id = :oppId
            LIMIT 1
        ];
    }

    // ── Create new opportunity ────────────────────────────────────────────
    @AuraEnabled
    public static Id createOpportunity(
            String name,
            Id accountId,
            String stageName,
            Date closeDate,
            Decimal amount) {

        Opportunity opp  = new Opportunity();
        opp.Name         = name;
        opp.AccountId    = accountId;
        opp.StageName    = stageName;
        opp.CloseDate    = closeDate;
        opp.Amount       = amount;

        insert opp;
        return opp.Id;
    }
}