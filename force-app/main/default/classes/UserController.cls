public with sharing class UserController {

    // ── Get all users ─────────────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<User> getUsers() {
        try {
            return [
                SELECT Id, FirstName, LastName, Name,
                       Email, Username, IsActive,
                       Profile.Name, LastLoginDate,
                       CreatedDate
                FROM User
                WHERE IsActive = true
                AND UserType = 'Standard'
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Get stats ─────────────────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getUserStats() {
        try {
            Integer usedSeats = [
                SELECT COUNT() FROM User
                WHERE IsActive = true
                AND UserType = 'Standard'
            ];
            Integer totalSeats = 20;
            return new Map<String, Integer>{
                'totalSeats' => totalSeats,
                'usedSeats'  => usedSeats,
                'available'  => totalSeats - usedSeats
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

            insert u;

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
            // Cannot deactivate yourself
            if (userId == UserInfo.getUserId()) {
                throw new AuraHandledException(
                    'You cannot deactivate your own account.'
                );
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
}