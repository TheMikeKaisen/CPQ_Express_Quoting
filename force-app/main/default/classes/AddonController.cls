public with sharing class AddonController {

    // ── Get all add-ons with optional search and status filters ──────────
    @AuraEnabled(cacheable=true)
    public static List<Add_On__c> getAddons(
            String searchTerm,
            String statusFilter) {

        String query = 'SELECT Id, Name, Name__c, Billing_Unit__c, ' +
                       'Price__c, Cost__c, Tags__c, Is_Active__c ' +
                       'FROM Add_On__c';

        List<String> conditions = new List<String>();

        if (String.isNotBlank(searchTerm)) {
            conditions.add('Name__c LIKE \'%' +
                     String.escapeSingleQuotes(searchTerm) + '%\'');
        }

        if (String.isNotBlank(statusFilter)) {
            if (statusFilter == 'Active') {
                conditions.add('Is_Active__c = true');
            } else if (statusFilter == 'Inactive') {
                conditions.add('Is_Active__c = false');
            }
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY Name__c ASC';
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

        Add_On__c a       = new Add_On__c();
        a.Name__c         = name;
        a.Billing_Unit__c = billingUnit;
        a.Price__c        = price;
        a.Cost__c         = cost;
        a.Tags__c         = tags;
        a.Is_Active__c    = true;

        insert a;
        return a.Id;
    }

    // ── Toggle active status ──────────────────────────────────────────────
    @AuraEnabled
    public static void toggleActiveStatus(
            Id addonId,
            Boolean isActive) {

        Add_On__c a    = new Add_On__c();
        a.Id           = addonId;
        a.Is_Active__c = isActive;
        update a;
    }

    // ── Delete add-on ─────────────────────────────────────────────────────
    @AuraEnabled
    public static void deleteAddon(Id addonId) {
        Add_On__c a = new Add_On__c();
        a.Id = addonId;
        delete a;
    }
}