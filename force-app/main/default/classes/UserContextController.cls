public with sharing class UserContextController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getCurrentUserContext() {
        try {
            User u = [
                SELECT Id, Name, Email, Profile.Name
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];

            String profileName = u.Profile.Name;
            
            // Managers and Admins have elevated permissions.
            // We check for the CPQ_Manager_Access permission set for robust identification.
            Boolean hasManagerPS = [
                SELECT count() 
                FROM PermissionSetAssignment 
                WHERE AssigneeId = :u.Id 
                AND PermissionSet.Name = 'CPQ_Manager_Access'
            ] > 0;

            Boolean isManager = profileName == 'System Administrator' || hasManagerPS;
            // Managers and Salespeople can both create business data.
            Boolean canCreateData = isManager || profileName == 'CPQ Salesperson' || profileName == 'Standard User';
            
            return new Map<String, Object>{
                'userId'        => u.Id,
                'userName'      => u.Name,
                'email'         => u.Email,
                'isManager'     => isManager,
                'canCreateData' => canCreateData,
                'profileName'   => profileName
            };
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
