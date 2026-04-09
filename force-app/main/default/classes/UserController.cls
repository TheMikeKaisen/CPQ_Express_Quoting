public without sharing class UserController {

    // ── Get all users ─────────────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getUsers() {
        try {
            ensureManagerAccess();
            
            // 1. Get all active Salesforce users
            List<User> users = [
                SELECT Id, FirstName, LastName, Name,
                       Email, Username, IsActive,
                       Profile.Name, LastLoginDate,
                       CreatedDate
                FROM User
                WHERE IsActive = true
                AND Profile.UserLicense.Name = 'Salesforce'
                ORDER BY Name ASC
            ];

            // 2. Get Permission Set assignments for these users
            Set<Id> userIds = (new Map<Id, User>(users)).keySet();
            List<PermissionSetAssignment> assignments = [
                SELECT AssigneeId, PermissionSet.Name 
                FROM PermissionSetAssignment 
                WHERE AssigneeId IN :userIds
                AND PermissionSet.Name IN ('CPQ_Manager_Access', 'CPQ_Salesperson_Access')
            ];

            Map<Id, String> userToRole = new Map<Id, String>();
            for (PermissionSetAssignment psa : assignments) {
                if (psa.PermissionSet.Name == 'CPQ_Manager_Access') {
                    userToRole.put(psa.AssigneeId, 'Manager');
                } else if (psa.PermissionSet.Name == 'CPQ_Salesperson_Access' && !userToRole.containsKey(psa.AssigneeId)) {
                    userToRole.put(psa.AssigneeId, 'User');
                }
            }

            // 3. Construct return list
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            for (User u : users) {
                Map<String, Object> uMap = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(u));
                
                // Add Profile info back because deserialize often flattens it
                uMap.put('ProfileName', u.Profile.Name);
                
                // Determine Role: Priority 1: Admin Profile, Priority 2: Permission Set
                String role = 'User';
                if (u.Profile.Name.contains('Administrator')) {
                    role = 'Admin';
                } else if (userToRole.containsKey(u.Id)) {
                    role = userToRole.get(u.Id);
                } else if (u.Profile.Name.contains('Manager')) {
                    role = 'Manager';
                }
                
                uMap.put('AssignedRole', role);
                results.add(uMap);
            }
            return results;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Get stats ─────────────────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getUserStats() {
        try {
            // Query actual Salesforce license usage
            List<UserLicense> licenses = [
                SELECT TotalLicenses, UsedLicenses
                FROM UserLicense
                WHERE Name = 'Salesforce'
                LIMIT 1
            ];

            Integer totalSeats = 5; // Default fallback
            Integer usedSeats = 0;

            if (!licenses.isEmpty()) {
                totalSeats = licenses[0].TotalLicenses;
                usedSeats = licenses[0].UsedLicenses;
            }

            return new Map<String, Integer>{
                'totalSeats' => totalSeats,
                'usedSeats'  => usedSeats,
                'available'  => Math.max(0, totalSeats - usedSeats)
            };
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Get available profiles ────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Profile> getProfiles() {
        try {
            return [
                SELECT Id, Name
                FROM Profile
                WHERE Name IN (
                    'System Administrator',
                    'CPQ Manager',
                    'CPQ Salesperson',
                    'Standard User'
                )
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Create new user ───────────────────────────────────────────────────
    @AuraEnabled
    public static String createUser(
            String firstName,
            String lastName,
            String email,
            String username,
            String role) {
        try {
            ensureManagerAccess();

            // Safety check: Only System Admins can create other Admins/Managers
            String currentProfileId = UserInfo.getProfileId();
            String currentProfileName = [SELECT Name FROM Profile WHERE Id = :currentProfileId].Name;
            Boolean isSystemAdmin = (currentProfileName == 'System Administrator');

            if (!isSystemAdmin && (role == 'Admin' || role == 'Manager')) {
                throw new AuraHandledException('Security Restriction: You do not have authority to create Admin or Manager roles. Only System Administrators can perform this action.');
            }

            // Step 1: Find the correct Profile
            String profileName = getProfileName(role);
            List<Profile> profiles = [
                SELECT Id, Name FROM Profile
                WHERE Name = :profileName
                LIMIT 1
            ];

            // If profile not found fallback to Standard User
            if (profiles.isEmpty()) {
                profiles = [
                    SELECT Id FROM Profile
                    WHERE Name = 'Standard User'
                    LIMIT 1
                ];
            }

            if (profiles.isEmpty()) {
                throw new AuraHandledException(
                    'No valid profile found. Please create ' +
                    'CPQ Salesperson and CPQ Manager ' +
                    'profiles in Setup first.'
                );
            }

            // Step 2: Build alias from name
            String alias = '';
            if (String.isNotBlank(firstName)) {
                alias += firstName.substring(0, 1);
            }
            if (String.isNotBlank(lastName)) {
                alias += lastName.substring(0,
                    Math.min(4, lastName.length()));
            }
            alias = alias.toLowerCase();
            // Make alias unique by adding random number
            alias = alias + String.valueOf(
                Math.abs(Math.mod(
                    Crypto.getRandomInteger(), 99))
            );

            // Step 3: Create the User record
            User u = new User();
            u.FirstName            = firstName;
            u.LastName             = lastName;
            u.Email                = email;
            u.Username             = username;
            u.Alias                = alias.left(8);
            u.CommunityNickname    = alias.left(40);
            u.EmailEncodingKey     = 'UTF-8';
            u.LanguageLocaleKey    = 'en_US';
            u.LocaleSidKey         = 'en_US';
            u.TimeZoneSidKey       = 'America/New_York';
            u.ProfileId            = profiles[0].Id;
            u.IsActive             = true;

            // Trigger welcome email with password reset path
            Database.DMLOptions dlo = new Database.DMLOptions();
            dlo.EmailHeader.triggerUserEmail = true;
            u.setOptions(dlo);

            insert u;

            // Step 4: Assign Permission Set based on role
            assignPermissionSet(u.Id, role);

            return 'Success: User ' + firstName + ' ' +
                   lastName + ' created successfully! ' +
                   'They will receive an email to set ' +
                   'their password.';

        } catch (DmlException e) {
            // Catch specific DML errors
            String errorMsg = e.getMessage();
            if (errorMsg.contains('DUPLICATE_USERNAME')) {
                throw new AuraHandledException(
                    'Username already exists. Please use ' +
                    'a different username like: ' +
                    username + '.provus'
                );
            } else if (errorMsg.contains('INVALID_EMAIL')) {
                throw new AuraHandledException(
                    'Invalid email address format.'
                );
            } else {
                throw new AuraHandledException(
                    'Error creating user: ' + errorMsg
                );
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Unexpected error: ' + e.getMessage()
            );
        }
    }

    // ── Deactivate user ───────────────────────────────────────────────────
    @AuraEnabled
    public static void deactivateUser(Id userId) {
        try {
            ensureManagerAccess();

            // 1. Cannot deactivate yourself
            if (userId == UserInfo.getUserId()) {
                throw new AuraHandledException('You cannot deactivate your own account.');
            }

            // 2. Hierarchy Check: Fetch target user's info
            User target = [
                SELECT Id, Profile.Name 
                FROM User 
                WHERE Id = :userId 
                LIMIT 1
            ];
            
            // Identify target profile/role
            Boolean targetIsAdmin = target.Profile.Name.contains('Administrator');
            Boolean targetIsManager = !targetIsAdmin && [
                SELECT count() 
                FROM PermissionSetAssignment 
                WHERE AssigneeId = :target.Id 
                AND PermissionSet.Name = 'CPQ_Manager_Access'
            ] > 0;

            // Identify current user's Admin status
            String currentProfileId = UserInfo.getProfileId();
            String currentProfileName = [SELECT Name FROM Profile WHERE Id = :currentProfileId].Name;
            Boolean isCurrentAdmin = (currentProfileName == 'System Administrator');

            // Enforce rules
            if (!isCurrentAdmin && (targetIsAdmin || targetIsManager)) {
                throw new AuraHandledException('Access Denied: You do not have permission to deactivate other Managers or Administrators. Only System Administrators can perform this action.');
            }

            User u     = new User(Id = userId);
            u.IsActive = false;
            update u;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Helper: role → profile name ───────────────────────────────────────
    private static String getProfileName(String role) {
        if (role == 'Admin')   return 'System Administrator';
        if (role == 'Manager') return 'CPQ Manager';
        return 'CPQ Salesperson';
    }

    private static void assignPermissionSet(Id userId, String role) {
        String psName = (role == 'Manager' || role == 'Admin') ? 'CPQ_Manager_Access' : 'CPQ_Salesperson_Access';
        
        List<PermissionSet> psList = [SELECT Id FROM PermissionSet WHERE Name = :psName LIMIT 1];
        if (psList.isEmpty()) return; // skip if perm set not deployed yet

        insert new PermissionSetAssignment(
            AssigneeId = userId, 
            PermissionSetId = psList[0].Id
        );
    }

    private static void ensureManagerAccess() {
        // System Admins always have access
        String profileId = UserInfo.getProfileId();
        String profileName = [SELECT Name FROM Profile WHERE Id = :profileId].Name;
        if (profileName == 'System Administrator') return;

        // Otherwise check for the Manager Permission Set
        Boolean hasManagerPS = [
            SELECT count() 
            FROM PermissionSetAssignment 
            WHERE AssigneeId = :UserInfo.getUserId() 
            AND PermissionSet.Name = 'CPQ_Manager_Access'
        ] > 0;

        if (!hasManagerPS) {
            throw new AuraHandledException('Access Denied: You do not have permission to perform this administrative action.');
        }
    }
}