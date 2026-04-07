public with sharing class ResourceRoleController {

    // ── Get all resource roles with optional status filter ─────────────────
    @AuraEnabled(cacheable=true)
    public static List<Resource_Role__c> getResourceRoles(
            String statusFilter) {

        String query = 'SELECT Id, Name, Location__c, ' +
                       'Billing_Unit__c, Price__c, Cost__c, ' +
                       'Tags__c, Is_Active__c ' +
                       'FROM Resource_Role__c WHERE Id != null';

        // Filter by active status
        if (String.isNotBlank(statusFilter)) {
            if (statusFilter == 'Active') {
                query += ' AND Is_Active__c = true';
            } else if (statusFilter == 'Inactive') {
                query += ' AND Is_Active__c = false';
            }
            // 'All' = no filter
        }

        query += ' ORDER BY Name ASC';
        return Database.query(query);
    }

    // ── Create new resource role ──────────────────────────────────────────
    @AuraEnabled
    public static Id createResourceRole(
            String name,
            String location,
            String billingUnit,
            Decimal price,
            Decimal cost,
            String tags) {

        Resource_Role__c role  = new Resource_Role__c();
        role.Name              = name;
        role.Location__c       = location;
        role.Billing_Unit__c   = billingUnit;
        role.Price__c          = price;
        role.Cost__c           = cost;
        role.Tags__c           = tags;
        role.Is_Active__c      = true; // new roles active by default

        insert role;
        return role.Id;
    }

    // ── Toggle active/inactive status ─────────────────────────────────────
    @AuraEnabled
    public static void toggleActiveStatus(
            Id roleId,
            Boolean isActive) {

        Resource_Role__c role = new Resource_Role__c(Id = roleId);
        role.Is_Active__c = isActive;
        update role;
    }

    // ── Delete resource role ──────────────────────────────────────────────
    @AuraEnabled
    public static void deleteResourceRole(Id roleId) {
        delete new Resource_Role__c(Id = roleId);
    }
}