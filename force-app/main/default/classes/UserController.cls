public with sharing class UserController {

    // ── Get all active users ──────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<User> getUsers() {
        try {
            return [
                SELECT Id, FirstName, LastName, Name,
                       Email, Username, IsActive,
                       Profile.Name, UserRole.Name,
                       LastLoginDate, CreatedDate
                FROM User
                WHERE IsActive = true
                AND UserType = 'Standard'
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Get user count stats ──────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getUserStats() {
        try {
            Integer totalUsers = [
                SELECT COUNT() FROM User
                WHERE IsActive = true
                AND UserType = 'Standard'
            ];

            // Total seats = arbitrary limit for display
            Integer totalSeats = 20;
            Integer available  = totalSeats - totalUsers;

            return new Map<String, Integer>{
                'totalSeats' => totalSeats,
                'usedSeats'  => totalUsers,
                'available'  => available
            };
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Create new user ───────────────────────────────────────────────────
    @AuraEnabled
    public static Id createUser(
            String firstName,
            String lastName,
            String email,
            String username,
            String role) {
        try {
            // Get profile based on role
            String profileName = getProfileName(role);
            Profile p = [
                SELECT Id FROM Profile
                WHERE Name = :profileName
                LIMIT 1
            ];

            User u           = new User();
            u.FirstName      = firstName;
            u.LastName       = lastName;
            u.Email          = email;
            u.Username       = username;
            u.Alias          = (firstName.substring(0,1) +
                               lastName.substring(0,
                               Math.min(4, lastName.length())))
                               .toLowerCase();
            u.EmailEncodingKey    = 'UTF-8';
            u.LanguageLocaleKey   = 'en_US';
            u.LocaleSidKey        = 'en_US';
            u.TimeZoneSidKey      = 'America/Los_Angeles';
            u.ProfileId           = p.Id;
            u.IsActive            = true;

            insert u;
            return u.Id;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Deactivate user ───────────────────────────────────────────────────
    @AuraEnabled
    public static void deactivateUser(Id userId) {
        try {
            User u    = new User(Id = userId);
            u.IsActive = false;
            update u;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Helper: map role to Salesforce profile name ───────────────────────
    private static String getProfileName(String role) {
        if (role == 'Admin')   return 'System Administrator';
        if (role == 'Manager') return 'CPQ Manager';
        return 'CPQ Salesperson'; // User role
    }

    // ── Get role display from profile name ────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, String> getUserRoleMap() {
        try {
            Map<String, String> roleMap =
                new Map<String, String>();
            for (User u : [
                SELECT Id, Profile.Name
                FROM User
                WHERE IsActive = true
                AND UserType = 'Standard'
            ]) {
                String profileName = u.Profile.Name;
                String role = 'User';
                if (profileName == 'System Administrator') {
                    role = 'Admin';
                } else if (profileName == 'CPQ Manager') {
                    role = 'Manager';
                }
                roleMap.put(u.Id, role);
            }
            return roleMap;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}