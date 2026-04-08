// Check relationship name for QuoteAccountId
Schema.DescribeFieldResult dfr = Quote.SObjectType.getDescribe().fields.getMap().get('QuoteAccountId').getDescribe();
System.debug('Relationship Name: ' + dfr.getRelationshipName());
