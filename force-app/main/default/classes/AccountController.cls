public with sharing class AccountController {

    // ── Get all accounts with optional filters ────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts(
            String typeFilter,
            String industryFilter) {

        String query = 'SELECT Id, Name, AccountNumber, Type, ' +
                       'Industry, Website, Phone ' +
                       'FROM Account WHERE Id != null';

        if (String.isNotBlank(typeFilter) && typeFilter != 'All') {
            query += ' AND Type = \'' +
                     String.escapeSingleQuotes(typeFilter) + '\'';
        }

        if (String.isNotBlank(industryFilter) &&
            industryFilter != 'All') {
            query += ' AND Industry = \'' +
                     String.escapeSingleQuotes(industryFilter) + '\'';
        }

        query += ' ORDER BY Name ASC';
        return Database.query(query);
    }

    // ── Create or Update account ──────────────────────────────────────────
    @AuraEnabled
    public static Id createAccount(
            Id accountId,
            String name,
            String type,
            String industry,
            String website,
            String phone) {

        Account acc  = new Account();
        if (accountId != null) {
            acc.Id = accountId;
        }
        acc.Name     = name;
        acc.Type     = type;
        acc.Industry = industry;
        acc.Website  = website;
        acc.Phone    = phone;

        upsert acc;
        return acc.Id;
    }

    // ── Delete account ────────────────────────────────────────────────────
    @AuraEnabled
    public static void deleteAccount(Id accountId) {
        delete new Account(Id = accountId);
    }

    // ── Get distinct types for filter dropdown ────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<String> getAccountTypes() {
        List<String> types = new List<String>();
        Schema.DescribeFieldResult fieldResult =
            Account.Type.getDescribe();
        for (Schema.PicklistEntry entry :
             fieldResult.getPicklistValues()) {
            types.add(entry.getValue());
        }
        return types;
    }

    // ── Get distinct industries for filter dropdown ────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<String> getAccountIndustries() {
        List<String> industries = new List<String>();
        Schema.DescribeFieldResult fieldResult =
            Account.Industry.getDescribe();
        for (Schema.PicklistEntry entry :
             fieldResult.getPicklistValues()) {
            industries.add(entry.getValue());
        }
        return industries;
    }
}