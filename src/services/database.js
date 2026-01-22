/**
 * @fileoverview Database service for executing Salesforce SOQL queries.
 * @module services/database
 */

/**
 * Service class for executing SOQL queries against Salesforce.
 */
export class Database {
	/**
	 * Creates a new Database instance.
	 * @param {SalesforceConnection} sourceConnection - The Salesforce connection to use for queries
	 */
	constructor(sourceConnection) {
		this.sourceConnection = sourceConnection;
	}

	/**
	 * Executes a SOQL query and returns the records.
	 * @async
	 * @param {string} soql - The SOQL query string to execute
	 * @returns {Promise<Array<Object>>} Array of records returned by the query
	 * @throws {Error} If not connected to Salesforce
	 */
	async query(soql) {
		if (!this.sourceConnection.getConnection()) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const result = await this.sourceConnection.getConnection().query(soql);
		return result.records;
	}
}
