export class RecordFormatter {
	constructor(database) {
		this.database = database;
		this.recordIdToReference = new Map();
		this.referenceFields = [];
	}

	async formatForImport(records, sObjectApiName) {
		this.sObjectMetadata = await this.database
			.sObjectDescribe(sObjectApiName);
		this.referenceFields = this.sObjectMetadata.fields
			.map(field => field.type === 'reference' && field.name);

		return records.map((record, index) => {
			const referenceId = `${sObjectApiName}Ref${index + 1}`;
			this.recordIdToReference.set(record.Id, referenceId);
			let cleaned = this._cleanRecord(record);
			return addReferenceAttributes(cleaned, sObjectApiName, referenceId);
		});
	}

	async formatForSyncReferences(records, sObjectApiName, referenceToRecordId) {
		this.sObjectMetadata = await this.database
			.sObjectDescribe(sObjectApiName);
		this.referenceFields = this.sObjectMetadata.fields
			.map(field => field.type === 'reference' && field.name);
		
		return records.map((record) => {
			delete record.attributes;
			record.Id = referenceToRecordId[this.recordIdToReference.get(record.Id)]
			return this._cleanRecord(record, referenceToRecordId);
		});
	}

	_cleanRecord(record, referenceToRecordId = null) {
		const cleaned = { ...record };
		for (const fieldName in cleaned) {
			if (fieldName !== 'RecordTypeId') {
				deleteNulls(cleaned, fieldName);
				assignReferences(cleaned, fieldName, this.referenceFields, this.recordIdToReference, referenceToRecordId);
			}
		}
		
		return cleaned;
	}
}

const addReferenceAttributes = (record, sObjectApiName, referenceId) => {
	delete record.attributes;
	delete record.Id;
	return {
		attributes: {
			type: sObjectApiName,
			referenceId
		},
		...record
	};
}

const deleteNulls = (record, fieldName) => {
	if (record[fieldName] === null || record[fieldName] === undefined) {
		delete record[fieldName];
	}
	return record;
}

const assignReferences = (record, fieldName, referenceFields, recordIdToReference, referenceToRecordId = null) => {
	if (
		referenceFields.includes(fieldName) &&
		recordIdToReference.has(record[fieldName])
	) {
		record[fieldName] = Boolean(referenceToRecordId)
			? referenceToRecordId[recordIdToReference.get(record[fieldName])]
			: `@${recordIdToReference.get(record[fieldName])}`;
	} else if (
		referenceFields.includes(fieldName) &&
		!recordIdToReference.has(record[fieldName])
	) {
		delete record[fieldName];
	}
	return record;
}