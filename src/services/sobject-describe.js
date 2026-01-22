/**
 * @fileoverview Service for retrieving Salesforce SObject metadata.
 * @module services/sobject-describe
 */

/**
 * Service class for retrieving metadata about Salesforce SObjects.
 */
export class SObjectDescribeService {
	/**
	 * Creates a new SObjectDescribeService instance.
	 * @param {SalesforceConnection} sourceConnection - The Salesforce connection
	 */
	constructor(sourceConnection) {
		this.sourceConnection = sourceConnection;
	}

	/**
	 * Retrieves metadata for a specific SObject.
	 * @async
	 * @param {string} objectName - The API name of the SObject to describe
	 * @returns {Promise<Object>} The SObject describe result containing fields and metadata
	 * @throws {Error} If not connected to Salesforce
	 */
	async describe(objectName) {
		const conn = this.sourceConnection.getConnection();
		
		if (!conn) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const response = await conn.request({
			method: 'GET',
			url: `/services/data/v62.0/sobjects/${objectName}/describe`
		});

		return response;
	}
}
