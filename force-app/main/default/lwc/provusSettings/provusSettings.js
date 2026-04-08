import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getUsers from '@salesforce/apex/UserController.getUsers';
import getUserStats from '@salesforce/apex/UserController.getUserStats';
import createUser from '@salesforce/apex/UserController.createUser';
import deactivateUser from '@salesforce/apex/UserController.deactivateUser';
import getCompanySettings from '@salesforce/apex/CompanySettingsController.getCompanySettings';
import saveCompanySettings from '@salesforce/apex/CompanySettingsController.saveCompanySettings';
import removeLogo from '@salesforce/apex/CompanySettingsController.removeLogo';

const AVATAR_COLORS = [
    '#4f46e5', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#0891b2',
    '#1d4ed8', '#b45309'
];

export default class ProvusSettings extends LightningElement {

    // ── Active tab ────────────────────────────────────────────────────────
    @track activeTab = 'companyInfo';

    // ── Company Info state ────────────────────────────────────────────────
    @track companyForm = {
        companyName: '', email: '', phone: '', website: '',
        address: '', city: '', state: '', zipCode: '', country: ''
    };
    @track logoPreview      = null;
    @track logoBase64       = '';
    @track isSavingCompany  = false;
    @track companySaveOk    = false;
    @track companySaveError = '';
    @track logoUploadError  = '';

    wiredCompanyResult = undefined;

    @wire(getCompanySettings)
    wiredCompany(result) {
        this.wiredCompanyResult = result;
        if (result.data) {
            const d = result.data;
            this.companyForm = {
                companyName: d.companyName || '',
                email:       d.email       || '',
                phone:       d.phone       || '',
                website:     d.website     || '',
                address:     d.address     || '',
                city:        d.city        || '',
                state:       d.state       || '',
                zipCode:     d.zipCode     || '',
                country:     d.country     || ''
            };
            this.logoBase64  = d.logoBase64 || '';
            this.logoPreview = d.logoBase64 || null;
        }
    }

    // ── User Management state (existing) ──────────────────────────────────
    @track showModal     = false;
    @track isLoading     = true;
    @track isCreating    = false;
    @track errorMessage  = '';
    @track successMessage= '';

    @track totalSeats    = 5;
    @track usedSeats     = 0;
    @track availableSeats= 5;
    @track allUsers      = [];

    @track formData = {
        firstName: '', lastName: '', email: '',
        username: '', role: 'User'
    };

    wiredUsersResult = undefined;

    @wire(getUsers)
    wiredUsers(result) {
        this.wiredUsersResult = result;
        this.isLoading = false;
        if (result.data) {
            this.allUsers  = result.data;
            this.usedSeats = result.data.length;
            this.availableSeats = this.totalSeats - this.usedSeats;
        }
        if (result.error) console.error('Users error:', result.error);
    }

    @wire(getUserStats)
    wiredStats({ data }) {
        if (data) {
            this.totalSeats     = data.totalSeats;
            this.usedSeats      = data.usedSeats;
            this.availableSeats = data.available;
        }
    }

    // ── Tab visibility ────────────────────────────────────────────────────
    get showCompanyInfo()  { return this.activeTab === 'companyInfo';  }
    get showGeneral()      { return this.activeTab === 'general';      }
    get showPdf()          { return this.activeTab === 'pdf';          }
    get showIntegrations() { return this.activeTab === 'integrations'; }
    get showUsers()        { return this.activeTab === 'users';        }

    get companyInfoNavClass()  { return this.activeTab === 'companyInfo'  ? 'nav-item nav-active' : 'nav-item'; }
    get generalNavClass()      { return this.activeTab === 'general'      ? 'nav-item nav-active' : 'nav-item'; }
    get pdfNavClass()          { return this.activeTab === 'pdf'          ? 'nav-item nav-active' : 'nav-item'; }
    get intNavClass()          { return this.activeTab === 'integrations' ? 'nav-item nav-active' : 'nav-item'; }
    get usersNavClass()        { return this.activeTab === 'users'        ? 'nav-item nav-active' : 'nav-item'; }

    // ── Company: logo computed ────────────────────────────────────────────
    get hasLogoPreview() { return !!(this.logoPreview); }
    get isRemoveLogoDisabled() { return !this.hasLogoPreview; }

    // ── Company: handlers ─────────────────────────────────────────────────
    handleCompanyFieldChange(event) {
        const field = event.currentTarget.dataset.field;
        this.companyForm = { ...this.companyForm, [field]: event.target.value };
    }

    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.logoUploadError = '';

        // Max size 100 KB
        const maxSize = 100 * 1024; 
        if (file.size > maxSize) {
            this.logoUploadError = 'File size must be less than 100 KB.';
            return;
        }
        if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
            this.logoUploadError = 'Only PNG or JPEG files are allowed.';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.logoBase64  = e.target.result;
            this.logoPreview = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    handleLogoRemove() {
        this.logoPreview = null;
        this.logoBase64  = '';
        removeLogo()
            .then(() => { if (this.wiredCompanyResult) refreshApex(this.wiredCompanyResult); })
            .catch(err => console.error('Remove logo error:', err));
    }

    handleSaveCompany() {
        this.isSavingCompany  = true;
        this.companySaveOk    = false;
        this.companySaveError = '';

        saveCompanySettings({
            companyName: this.companyForm.companyName,
            email:       this.companyForm.email,
            phone:       this.companyForm.phone,
            website:     this.companyForm.website,
            address:     this.companyForm.address,
            city:        this.companyForm.city,
            state:       this.companyForm.state,
            zipCode:     this.companyForm.zipCode,
            country:     this.companyForm.country,
            logoBase64:  this.logoBase64 || ''
        })
        .then(() => {
            this.companySaveOk = true;
            setTimeout(() => { this.companySaveOk = false; }, 3000);
            if (this.wiredCompanyResult) refreshApex(this.wiredCompanyResult);
        })
        .catch(err => {
            this.companySaveError = err.body ? err.body.message : 'Error saving company information.';
        })
        .finally(() => { this.isSavingCompany = false; });
    }

    handleDiscardCompany() {
        if (this.wiredCompanyResult) refreshApex(this.wiredCompanyResult);
        this.companySaveError = '';
        this.logoUploadError  = '';
    }

    // ── Nav click ─────────────────────────────────────────────────────────
    handleNavClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    // ── User management handlers (unchanged from original) ─────────────
    get userRows() {
        return this.allUsers.map((u, index) => {
            const initials = this.getInitials(u.FirstName, u.LastName);
            const color    = AVATAR_COLORS[index % AVATAR_COLORS.length];
            const role     = this.getRoleFromProfile(u.Profile ? u.Profile.Name : '');
            return {
                ...u,
                initials,
                avatarStyle:      `background-color:${color}`,
                roleDisplay:      role,
                roleBadgeClass:   this.getRoleBadgeClass(role),
                lastActiveDisplay:this.getLastActive(u.LastLoginDate)
            };
        });
    }

    getInitials(firstName, lastName) {
        return ((firstName ? firstName.charAt(0) : '') +
                (lastName  ? lastName.charAt(0)  : '')).toUpperCase();
    }

    getRoleFromProfile(profileName) {
        if (profileName === 'System Administrator') return 'Admin';
        if (profileName === 'CPQ Manager')          return 'Manager';
        return 'User';
    }

    getRoleBadgeClass(role) {
        if (role === 'Admin')   return 'role-badge badge-admin';
        if (role === 'Manager') return 'role-badge badge-manager';
        return 'role-badge badge-user';
    }

    getLastActive(lastLoginDate) {
        if (!lastLoginDate) return 'Never';
        const diffMins = Math.floor((new Date() - new Date(lastLoginDate)) / 60000);
        const diffHrs  = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);
        if (diffMins < 2)   return 'Just now';
        if (diffMins < 60)  return diffMins + ' mins ago';
        if (diffHrs < 24)   return diffHrs + ' hours ago';
        if (diffDays === 1) return '1 day ago';
        return diffDays + ' days ago';
    }

    get isAdminSelected()   { return this.formData.role === 'Admin';   }
    get isManagerSelected() { return this.formData.role === 'Manager'; }
    get isUserSelected()    { return this.formData.role === 'User';    }

    get adminOptionClass()   { return this.formData.role === 'Admin'   ? 'role-option role-option-selected' : 'role-option'; }
    get managerOptionClass() { return this.formData.role === 'Manager' ? 'role-option role-option-selected' : 'role-option'; }
    get userOptionClass()    { return this.formData.role === 'User'    ? 'role-option role-option-selected' : 'role-option'; }

    handleAddMember() {
        this.showModal      = true;
        this.errorMessage   = '';
        this.successMessage = '';
    }

    handleModalClose() {
        this.showModal      = false;
        this.errorMessage   = '';
        this.successMessage = '';
        this.formData = { firstName: '', lastName: '', email: '', username: '', role: 'User' };
    }

    handleFieldChange(event) {
        const field = event.currentTarget.dataset.field;
        this.formData = { ...this.formData, [field]: event.target.value };
    }

    handleEmailChange(event) {
        const email    = event.target.value;
        const username = email.includes('@')
            ? email.replace('@', '.provusscratch@')
            : email;
        this.formData = { ...this.formData, email, username };
    }

    handleRoleSelect(event) {
        this.formData = { ...this.formData, role: event.currentTarget.dataset.role };
    }

    handleRoleChange(event) {
        this.formData = { ...this.formData, role: event.target.value };
    }

    validate() {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!this.formData.firstName) { this.errorMessage = 'First Name is required.';      return false; }
        if (!this.formData.lastName)  { this.errorMessage = 'Last Name is required.';       return false; }
        if (!this.formData.email)     { this.errorMessage = 'Email is required.';           return false; }
        if (!this.formData.username)  { this.errorMessage = 'Username is required.';        return false; }
        if (!this.formData.role)      { this.errorMessage = 'Please select a role.';        return false; }
        if (!emailRegex.test(this.formData.email))    { this.errorMessage = 'Please enter a valid email.';       return false; }
        if (!emailRegex.test(this.formData.username)) { this.errorMessage = 'Username must be in email format.'; return false; }
        this.errorMessage = '';
        return true;
    }

    handleCreate() {
        if (!this.validate()) return;
        this.isCreating     = true;
        this.errorMessage   = '';
        this.successMessage = '';

        createUser({
            firstName: this.formData.firstName,
            lastName:  this.formData.lastName,
            email:     this.formData.email,
            username:  this.formData.username,
            role:      this.formData.role
        })
        .then(result => {
            this.successMessage = result;
            if (this.wiredUsersResult) refreshApex(this.wiredUsersResult);
            setTimeout(() => { this.handleModalClose(); }, 2000);
        })
        .catch(err => {
            this.errorMessage = err.body ? err.body.message : 'Error creating user.';
        })
        .finally(() => { this.isCreating = false; });
    }

    handleUserAction(event) {
        const userId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Deactivate this user? They will lose access to the system.')) return;
        deactivateUser({ userId })
            .then(() => { if (this.wiredUsersResult) refreshApex(this.wiredUsersResult); })
            .catch(err => {
                // eslint-disable-next-line no-alert
                alert('Error: ' + (err.body ? err.body.message : err));
            });
    }
}