import { formatUpdateErrors, displayUpdateResults } from "./salesforce-error-handler.js";

export class Database {
	
	constructor(connection) {
		this.connection = connection;
		this.sObjectNameToDescribe = {};
	}

	async query(soql) {
		if (!this.connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const result = await this.connection.query(soql);
		return result.records;
	}

	async update(sObjectApiName, records) {
		if (!this.connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this.connection
			.sobject(sObjectApiName)
			.update(records);
		
		const summary = formatUpdateErrors(rets, sObjectApiName);
		displayUpdateResults(summary, sObjectApiName);
	}

	async sObjectDescribe(sObjectName) {
		if (!this.connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}
		if (this._getExistingDescribe[sObjectName]) {
			return this._getExistingDescribe[sObjectName];
		}
		const response = await this.connection.request({
			method: 'GET',
			url: `/services/data/v62.0/sobjects/${sObjectName}/describe`
		});
		this.sObjectNameToDescribe[sObjectName] = response;

		return response;
	}

	_getExistingDescribe(sObjectName) {
		return this.sObjectNameToDescribe[sObjectName];
	}
}
