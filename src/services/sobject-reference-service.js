export class SobjectReferenceService {
	constructor(database) {
		this.database = database;
		this.recordIdToReference = new Map();
		this.referenceFields = [];
	}

	async linkTreeReferences(records, sObjectApiName) {
		this.sObjectMetadata = await this.database
			.sObjectDescribe(sObjectApiName);
		this.referenceFields = this.sObjectMetadata.fields
			.map(field => field.type === 'reference' && field.name);

		return records.map((record, index) => {
			const referenceId = `${sObjectApiName}Ref${index + 1}`;
			this.recordIdToReference.set(record.Id, referenceId);
			for (const fieldName in record) {
				this._deleteNulls(record, fieldName);
				if (fieldName !== 'RecordTypeId') {
					this._linkReferenceField(record, fieldName);
				}
			}
			return this._addReferenceAttributes(record, sObjectApiName, referenceId);
		});
	}

	async assignReferences(records, sObjectApiName, referenceToRecordId = null) {
		this.sObjectMetadata = await this.database
			.sObjectDescribe(sObjectApiName);
		this.referenceFields = this.sObjectMetadata.fields
			.map(field => field.type === 'reference' && field.name);
		
		return records.map((record) => {
			delete record.attributes;
			record.Id = referenceToRecordId[this.recordIdToReference.get(record.Id)];
			for (const fieldName in record) {
				this._deleteNulls(record, fieldName);
				if (fieldName !== 'RecordTypeId') {
					this._assignReferenceField(record, fieldName, referenceToRecordId);
				}
			}
			return record;
		});
	}

	
	_addReferenceAttributes (record, sObjectApiName, referenceId) {
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

	_deleteNulls (record, fieldName) {
		if (record[fieldName] === null || record[fieldName] === undefined) {
			delete record[fieldName];
		}
		return record;
	}

	_linkReferenceField (record, fieldName) {
		const fieldValue = record[fieldName];
		if (
			this.referenceFields.includes(fieldName) &&
			this.recordIdToReference.has(fieldValue)
		) {
			record[fieldName] = `@${this.recordIdToReference.get(fieldValue)}`;
		} else if (
			this.referenceFields.includes(fieldName) &&
			!this.recordIdToReference.has(fieldValue)
		) {
			delete record[fieldName];
		}
		return record;
	}

	_assignReferenceField (record, fieldName, referenceToRecordId) {
		const fieldValue = record[fieldName];
		if (
			this.referenceFields.includes(fieldName) &&
			this.recordIdToReference.has(fieldValue)
		) {
			record[fieldName] = Boolean(referenceToRecordId)
				? referenceToRecordId[this.recordIdToReference.get(fieldValue)]
				: `@${this.recordIdToReference.get(fieldValue)}`;
		} else if (
			this.referenceFields.includes(fieldName) &&
			!this.recordIdToReference.has(fieldValue)
		) {
			delete record[fieldName];
		}
		return record;
	}
}