export class SobjectReferenceService {
	constructor(database) {
		this.database = database;
		this.referenceFields = [];
		this.sourceRecordIdToTargetRecordId = new Map();
	}

	async assignReferences(records, sObjectApiName) {
		records = structuredClone(records);
		this.sObjectMetadata = await this.database
			.sObjectDescribe(sObjectApiName);
		this.referenceFields = this.sObjectMetadata.fields
			.map(field => (field.type === 'reference' || field.name === 'Id') && field.name);

		return records.map(record => {
			delete record.attributes;
			for (const fieldName in record) {
				this._deleteNulls(record, fieldName);
				if (fieldName !== 'RecordTypeId') {
					this._assignReferences(record, fieldName);
				}
			}
			return record;
		});
	}

	addReferences(records, databaseResults) {
		for (let i = 0; i < records.length; i++) {
			this.sourceRecordIdToTargetRecordId.set(records[i].Id, databaseResults[i].id);
		}
		return this.sourceRecordIdToTargetRecordId;
	}

	_deleteNulls (record, fieldName) {
		if (record[fieldName] === null || record[fieldName] === undefined) {
			delete record[fieldName];
		}
		return record;
	}

	_assignReferences(record, fieldName) {
		const fieldValue = record[fieldName];
		if (
			this.referenceFields.includes(fieldName) &&
			this.sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			record[fieldName] = this.sourceRecordIdToTargetRecordId.get(fieldValue);
		} else if (
			this.referenceFields.includes(fieldName) &&
			!this.sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			delete record[fieldName];
		}
		return record;
	}
}