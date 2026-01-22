/**
 * @fileoverview Service for building SOQL queries based on export configuration.
 * @module services/soql-builder
 */

import { SObjectDescribeService } from './sobject-describe.js';

/**
 * Service class that builds SOQL queries dynamically based on export configuration
 * and SObject metadata.
 */
export class SoqlBuilder {
	/**
	 * Creates a new SoqlBuilder instance.
	 * @param {SalesforceConnection} sourceConnection - The Salesforce connection
	 * @param {Object} exportConfig - Configuration object defining what to query
	 */
	constructor(sourceConnection, exportConfig) {
		this.sourceConnection = sourceConnection;
		this.exportConfig = structuredClone(exportConfig);
	}

	/**
	 * Builds a SOQL query string based on the export configuration.
	 * @async
	 * @returns {Promise<string|null>} The SOQL query string or null if no records to query
	 */
	async buildSOQL() {
		const fieldsStr = (await this._getFields(this.exportConfig.apiName)).join(',');
		const recordIdList = this.exportConfig.referenceField
			? this.exportConfig?.parentRecordIds.map(id => `'${id}'`).join(',')
			: this.exportConfig?.recordIds.map(id => `'${id}'`).join(',');
		
		if (!recordIdList?.length) {
			return null;
		}

		return `
		SELECT ${fieldsStr}
		FROM ${this.exportConfig.apiName}
		WHERE ${this.exportConfig.referenceField || 'Id'} IN (${recordIdList})`;
	}

	/**
	 * Retrieves all queryable fields for an SObject.
	 * @private
	 * @async
	 * @param {string} sObjectApiName - The API name of the SObject
	 * @returns {Promise<Array<string>>} Array of field names that can be queried
	 */
	async _getFields(sObjectApiName) {
		const sObjectMetadata = await new SObjectDescribeService(this.sourceConnection)
			.describe(sObjectApiName);
		
			return sObjectMetadata.fields
			.filter(field => {
				if (field.type === 'id') {
					return true;
				}
				if (!field.createable || this.exportConfig.excludedFields?.includes(field.name)) {
					return false;
				}
				return true;
			})
			.map(field => field.name);
	}
}