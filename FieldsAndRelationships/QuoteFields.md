Fields & Relationships
39 Items, Sorted by Field Label

SortField LabelSorted Ascending	SortField Name	SortData Type	SortControlling Field	SortIndexed	Actions
Account for Quote	QuoteAccountId	Lookup(Account)		False	
Account Name	AccountId	Lookup(Account)		False	
Additional To	AdditionalAddress	Address		False	
Additional To Name	AdditionalName	Text(255)		False	
Bill To	BillingAddress	Address		False	
Bill To Name	BillingName	Text(255)		False	
Contact Name	ContactId	Lookup(Contact)		False	
Contract	ContractId	Lookup(Contract)		False	
Created By	CreatedById	Lookup(User)		True	
Description	Description	Long Text Area(32000)		False	
Discount	Discount	Percent(3, 2)		False	
Email	Email	Email		False	
End Date	End_Date__c	Date		False	
Expiration Date	ExpirationDate	Date		False	
Fax	Fax	Phone		False	
Grand Total	GrandTotal	Currency(16, 2)		False	
Last Modified By	LastModifiedById	Lookup(User)		False	
Last Modified Date	LastModifiedDate	Date/Time		False	
Line Items	LineItemCount	Roll-Up Summary (COUNT Quote Line Item)		False	
Margin Amount	Margin_Amount__c	Currency(10, 2)		False	
Margin Percent	Margin_Percent__c	Percent(6, 2)		False	
Opportunity Name	OpportunityId	Master-Detail(Opportunity)		True	
Owner Name	OwnerId	Lookup(User,Group)		True	
Phone	Phone	Phone		False	
Quote Name	Name	Text(255)		True	
Quote Number	QuoteNumber	Auto Number		False	
Quote To	QuoteToAddress	Address		False	
Quote To Name	QuoteToName	Text(255)		False	
Related Work	RelatedWorkId	Lookup(Work Order)		False	
Ship To	ShippingAddress	Address		False	
Ship To Name	ShippingName	Text(255)		False	
Shipping and Handling	ShippingHandling	Currency(16, 2)		False	
Start Date	Start_Date__c	Date		False	
Status	Status	Picklist		False	
Subtotal	Subtotal	Roll-Up Summary (SUM Quote Line Item)		False	
Syncing	IsSyncing	Checkbox		False	
Tax	Tax	Currency(16, 2)		False	
Time Period	Time_Period__c	Picklist		False	
Total Price	TotalPrice	Roll-Up Summary (SUM Quote Line Item)