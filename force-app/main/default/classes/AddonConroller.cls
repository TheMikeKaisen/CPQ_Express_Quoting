public with sharing class AddonController {

    // ── Get all add-ons ───────────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Add_On__c> getAddons(String searchTerm) {

        String query = 'SELECT Id, Name, Billing_Unit__c, ' +
                       'Price__c, Cost__c, Tags__c, Is_Active__c ' +
                       'FROM Add_On__c WHERE Id != null';

        if (String.isNotBlank(searchTerm)) {
            query += ' AND Name LIKE \'%' +
                     String.escapeSingleQuotes(searchTerm) + '%\'';
        }

        query += ' ORDER BY Name ASC';
        return Database.query(query);
    }

    // ── Create new add-on ─────────────────────────────────────────────────
    @AuraEnabled
    public static Id createAddon(
            String name,
            String billingUnit,
            Decimal price,
            Decimal cost,
            String tags) {

        Add_On__c a     = new Add_On__c();
        a.Name          = name;
        a.Billing_Unit__c = billingUnit;
        a.Price__c      = price;
        a.Cost__c       = cost;
        a.Tags__c       = tags;
        a.Is_Active__c  = true;

        insert a;
        return a.Id;
    }

    // ── Toggle active status ──────────────────────────────────────────────
    @AuraEnabled
    public static void toggleActiveStatus(
            Id addonId,
            Boolean isActive) {

        Add_On__c a    = new Add_On__c(Id = addonId);
        a.Is_Active__c = isActive;
        update a;
    }

    // ── Delete add-on ─────────────────────────────────────────────────────
    @AuraEnabled
    public static void deleteAddon(Id addonId) {
        delete new Add_On__c(Id = addonId);
    }
}