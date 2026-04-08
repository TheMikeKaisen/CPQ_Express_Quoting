Account acc = [SELECT Id FROM Account LIMIT 1];
try {
    Quote q = new Quote();
    q.Name = 'Test Quote With QuoteAccId';
    // Let's try to find out if there's a field called Account__c or something
    // But I'll try QuoteAccountId first since it exists in the folder
    // Actually, I should check the field metadata type.
} catch (Exception e) {}
