/**
 * @fileoverview Service for formatting Salesforce records for import.
 * @module services/record-formatter
 */

/**
 * Service class that formats Salesforce records for import, handling references
 * and cleaning unnecessary fields.
 */
export class RecordFormatter {
	/**
	 * Creates a new RecordFormatter instance.
	 * @param {SObjectDescribeService} sObjectDescribeService - Service for describing SObjects
	 */
	constructor(sObjectDescribeService) {
		this.sObjectDescribeService = sObjectDescribeService;
		this.recordIdToReference = new Map();
		this.referenceFields = [];
	}

	/**
	 * Formats records for import by cleaning fields and setting up references.
	 * @async
	 * @param {Array<Object>} records - The records to format
	 * @param {Object} exportConfig - The export configuration
	 * @returns {Promise<Object>} Formatted records object with records array
	 */
	async formatForImport(records, sObjectApiName) {
		this.sObjectMetadata = await this.sObjectDescribeService
			.describe(sObjectApiName);
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
		this.sObjectMetadata = await this.sObjectDescribeService
			.describe(sObjectApiName);
		this.referenceFields = this.sObjectMetadata.fields
			.map(field => field.type === 'reference' && field.name);
		
		return records.map((record) => {
			delete record.attributes;
			record.Id = referenceToRecordId[this.recordIdToReference.get(record.Id)]
			return this._cleanRecord(record, referenceToRecordId);
		});
	}

	/**
	 * Cleans a record by removing nulls and assigning proper references.
	 * @private
	 * @param {Object} record - The record to clean
	 * @returns {Object} Cleaned record
	 */
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

/**
 * Adds reference attributes to a record for import.
 * @param {Object} record - The record to modify
 * @param {string} sObjectApiName - The SObject API name
 * @param {string} referenceId - The reference ID to use
 * @returns {Object} Record with reference attributes
 */
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

/**
 * Removes null or undefined fields from a record.
 * @param {Object} record - The record to modify
 * @param {string} fieldName - The field name to check
 * @returns {Object} Record with nulls removed
 */
const deleteNulls = (record, fieldName) => {
	if (record[fieldName] === null || record[fieldName] === undefined) {
		delete record[fieldName];
	}
	return record;
}

/**
 * Assigns reference IDs to reference fields in a record.
 * @param {Object} record - The record to modify
 * @param {string} fieldName - The field name to check
 * @param {Array<string>} referenceFields - List of reference field names
 * @param {Map} recordIdToReference - Map of record IDs to reference IDs
 * @returns {Object} Record with references assigned
 */
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