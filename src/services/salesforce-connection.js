/**
 * @fileoverview Manages Salesforce connection using JSForce.
 * @module services/salesforce-connection
 */

import jsforce from 'jsforce';

/**
 * Wrapper class for managing Salesforce connections using JSForce.
 */
export class SalesforceConnection {
	/**
	 * Creates a new SalesforceConnection instance.
	 * @param {Object} config - Connection configuration
	 * @param {string} config.instanceUrl - The Salesforce instance URL
	 * @param {string} config.accessToken - The OAuth access token
	 */
	constructor({instanceUrl, accessToken}) {
		this.instanceUrl = instanceUrl;
		this.accessToken = accessToken;
		this.conn = null;
	}

	/**
	 * Establishes a connection to Salesforce using the provided credentials.
	 * @async
	 * @returns {Promise<void>}
	 */
	async connect() {
		this.conn = new jsforce.Connection({
			instanceUrl: this.instanceUrl,
			accessToken: this.accessToken
		});
	}

	/**
	 * Returns the active JSForce connection object.
	 * @returns {jsforce.Connection|null} The JSForce connection instance or null if not connected
	 */
	getConnection() {
		return this.conn;
	}
}