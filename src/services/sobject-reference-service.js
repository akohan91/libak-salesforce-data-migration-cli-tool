export class SobjectReferenceService {
	constructor(database) {
		this._database = database;
		this._referenceFields = [];
		this._sourceRecordIdToTargetRecordId = new Map();
	}

	async assignReferences(records, sObjectApiName) {
		records = structuredClone(records);
		this.sObjectMetadata = await this._database
			.sObjectDescribe(sObjectApiName);
		this._referenceFields = this.sObjectMetadata.fields
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

	async addReferences(records, databaseResults, treeConfig, targetDatabase) {
		const sourceRecordIdToTargetRecordId = new Map();
		for (let i = 0; i < records.length; i++) {
			this._sourceRecordIdToTargetRecordId.set(records[i].Id, databaseResults[i].id);
			sourceRecordIdToTargetRecordId.set(records[i].Id, databaseResults[i].id);
		}
		if (!treeConfig.requiredReferences) {
			return this._sourceRecordIdToTargetRecordId;
		}
		const soql = `
			SELECT Id, ${treeConfig.requiredReferences.join(',')}
			FROM ${treeConfig.apiName}
			WHERE Id IN (${sourceRecordIdToTargetRecordId.values().map(id => `'${id}'`).toArray().join(',')})`;
		
		const recordIdToTargetRecord = (await targetDatabase.query(soql))
			.reduce((recordIdToRecord, record) => {
				recordIdToRecord[record.Id] = record;
				return recordIdToRecord;
			}, {});

		records.forEach(record => {
			const targetRecordId = sourceRecordIdToTargetRecordId.get(record.Id);
			const targetRecord = recordIdToTargetRecord[targetRecordId];
			treeConfig.requiredReferences.forEach(fieldName => {
				this._sourceRecordIdToTargetRecordId.set(record[fieldName], targetRecord[fieldName]);
			});
		});

		return this._sourceRecordIdToTargetRecordId;
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
			this._referenceFields.includes(fieldName) &&
			this._sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			record[fieldName] = this._sourceRecordIdToTargetRecordId.get(fieldValue);
		} else if (
			this._referenceFields.includes(fieldName) &&
			!this._sourceRecordIdToTargetRecordId.has(fieldValue)
		) {
			delete record[fieldName];
		}
		return record;
	}
}