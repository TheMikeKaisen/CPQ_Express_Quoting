import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getUsers from
    '@salesforce/apex/UserController.getUsers';
import getUserStats from
    '@salesforce/apex/UserController.getUserStats';
import createUser from
    '@salesforce/apex/UserController.createUser';
import deactivateUser from
    '@salesforce/apex/UserController.deactivateUser';

// Avatar colours for initials
const AVATAR_COLORS = [
    '#4f46e5', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#0891b2',
    '#1d4ed8', '#b45309'
];

export default class ProvusSettings extends LightningElement {

    @track activeTab     = 'users'; // default to users tab
    @track showModal     = false;
    @track isLoading     = true;
    @track isCreating    = false;
    @track errorMessage  = '';

    // Stats
    @track totalSeats     = 20;
    @track usedSeats      = 0;
    @track availableSeats = 20;

    // Users list
    @track allUsers = [];

    // Form data
    @track formData = {
        firstName: '',
        lastName:  '',
        email:     '',
        username:  '',
        role:      'User' // default role
    };

    wiredUsersResult = undefined;

    // ── Wire users ────────────────────────────────────────────────────────
    @wire(getUsers)
    wiredUsers(result) {
        this.wiredUsersResult = result;
        this.isLoading = false;
        if (result.data) {
            this.allUsers = result.data;
            this.usedSeats      = result.data.length;
            this.availableSeats = this.totalSeats -
                                  this.usedSeats;
        } else if (result.error) {
            console.error('Users error:', result.error);
            this.isLoading = false;
        }
    }

    // ── Wire stats ────────────────────────────────────────────────────────
    @wire(getUserStats)
    wiredStats({ data, error }) {
        if (data) {
            this.totalSeats     = data.totalSeats;
            this.usedSeats      = data.usedSeats;
            this.availableSeats = data.available;
        }
    }

    // ── Build user rows with display helpers ──────────────────────────────
    get userRows() {
        return this.allUsers.map((u, index) => {
            const initials = this.getInitials(
                u.FirstName, u.LastName);
            const color    = AVATAR_COLORS[
                index % AVATAR_COLORS.length];
            const role     = this.getRoleFromProfile(
                u.Profile ? u.Profile.Name : '');

            return {
                ...u,
                initials,
                avatarClass: 'user-avatar',
                avatarStyle: `background-color:${color}`,
                roleDisplay:     role,
                roleBadgeClass:  this.getRoleBadgeClass(role),
                lastActiveDisplay: this.getLastActive(
                    u.LastLoginDate)
            };
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    getInitials(firstName, lastName) {
        const f = firstName ? firstName.charAt(0) : '';
        const l = lastName  ? lastName.charAt(0)  : '';
        return (f + l).toUpperCase();
    }

    getRoleFromProfile(profileName) {
        if (profileName === 'System Administrator') {
            return 'Admin';
        }
        if (profileName === 'CPQ Manager') {
            return 'Manager';
        }
        return 'User';
    }

    getRoleBadgeClass(role) {
        if (role === 'Admin')   return 'role-badge badge-admin';
        if (role === 'Manager') return 'role-badge badge-manager';
        return 'role-badge badge-user';
    }

    getLastActive(lastLoginDate) {
        if (!lastLoginDate) return 'Never';
        const now      = new Date();
        const login    = new Date(lastLoginDate);
        const diffMs   = now - login;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs  = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);

        if (diffMins < 2)   return 'Just now';
        if (diffMins < 60)  return diffMins + ' minutes ago';
        if (diffHrs < 24)   return diffHrs + ' hours ago';
        if (diffDays === 1) return '1 day ago';
        return diffDays + ' days ago';
    }

    // ── Tab visibility ────────────────────────────────────────────────────
    get showGeneral()      { return this.activeTab === 'general'; }
    get showOrganization() {
        return this.activeTab === 'organization';
    }
    get showIntegrations() {
        return this.activeTab === 'integrations';
    }
    get showUsers()        { return this.activeTab === 'users'; }

    // ── Tab CSS classes ───────────────────────────────────────────────────
    get generalNavClass() {
        return this.activeTab === 'general'
            ? 'nav-item nav-active' : 'nav-item';
    }
    get orgNavClass() {
        return this.activeTab === 'organization'
            ? 'nav-item nav-active' : 'nav-item';
    }
    get intNavClass() {
        return this.activeTab === 'integrations'
            ? 'nav-item nav-active' : 'nav-item';
    }
    get usersNavClass() {
        return this.activeTab === 'users'
            ? 'nav-item nav-active' : 'nav-item';
    }

    // ── Role selection ────────────────────────────────────────────────────
    get isAdminSelected()   {
        return this.formData.role === 'Admin';
    }
    get isManagerSelected() {
        return this.formData.role === 'Manager';
    }
    get isUserSelected()    {
        return this.formData.role === 'User';
    }

    get adminOptionClass() {
        return this.formData.role === 'Admin'
            ? 'role-option role-option-selected'
            : 'role-option';
    }
    get managerOptionClass() {
        return this.formData.role === 'Manager'
            ? 'role-option role-option-selected'
            : 'role-option';
    }
    get userOptionClass() {
        return this.formData.role === 'User'
            ? 'role-option role-option-selected'
            : 'role-option';
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    handleNavClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    handleAddMember() {
        this.showModal = true;
    }

    handleModalClose() {
        this.showModal    = false;
        this.errorMessage = '';
        this.formData     = {
            firstName: '', lastName: '',
            email: '', username: '', role: 'User'
        };
    }

    handleFieldChange(event) {
        const field = event.currentTarget.dataset.field;
        this.formData = {
            ...this.formData,
            [field]: event.target.value
        };
    }

    // Email change → auto-fill username
    handleEmailChange(event) {
        const email = event.target.value;
        this.formData = {
            ...this.formData,
            email:    email,
            username: email // auto-fill username with email
        };
    }

    handleRoleSelect(event) {
        const role = event.currentTarget.dataset.role;
        this.formData = { ...this.formData, role: role };
    }

    handleRoleChange(event) {
        this.formData = {
            ...this.formData,
            role: event.target.value
        };
    }

    // ── Validate ──────────────────────────────────────────────────────────
    validate() {
        if (!this.formData.firstName) {
            this.errorMessage = 'First Name is required.';
            return false;
        }
        if (!this.formData.lastName) {
            this.errorMessage = 'Last Name is required.';
            return false;
        }
        if (!this.formData.email) {
            this.errorMessage = 'Email is required.';
            return false;
        }
        if (!this.formData.username) {
            this.errorMessage = 'Username is required.';
            return false;
        }
        if (!this.formData.role) {
            this.errorMessage = 'Please select a role.';
            return false;
        }
        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.formData.email)) {
            this.errorMessage = 'Please enter a valid email.';
            return false;
        }
        this.errorMessage = '';
        return true;
    }

    // ── Create user ───────────────────────────────────────────────────────
    handleCreate() {
        if (!this.validate()) return;
        this.isCreating = true;

        createUser({
            firstName: this.formData.firstName,
            lastName:  this.formData.lastName,
            email:     this.formData.email,
            username:  this.formData.username,
            role:      this.formData.role
        })
        .then(() => {
            this.handleModalClose();
            if (this.wiredUsersResult) {
                refreshApex(this.wiredUsersResult);
            }
        })
        .catch(error => {
            console.error('Create user error:', error);
            this.errorMessage = error.body
                ? error.body.message
                : 'Error creating user. Username may ' +
                  'already exist or profile not found.';
        })
        .finally(() => {
            this.isCreating = false;
        });
    }

    // ── User action (deactivate) ──────────────────────────────────────────
    handleUserAction(event) {
        const userId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        const action = prompt(
            'Enter action: "deactivate" to remove user'
        );
        if (action === 'deactivate') {
            deactivateUser({ userId: userId })
            .then(() => {
                if (this.wiredUsersResult) {
                    refreshApex(this.wiredUsersResult);
                }
            })
            .catch(error => {
                console.error('Deactivate error:', error);
            });
        }
    }
}