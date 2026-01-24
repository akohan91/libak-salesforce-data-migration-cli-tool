import { formatDatabaseErrors, displayDatabaseResults } from "./salesforce-error-handler.js";

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

	async insert(sObjectApiName, records) {
		if (!this.connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this.connection
			.sobject(sObjectApiName)
			.create(records);
		
		const summary = formatDatabaseErrors(rets, sObjectApiName);
		displayDatabaseResults('insert', summary, sObjectApiName);
		return rets;
	}

	async update(sObjectApiName, records) {
		if (!this.connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this.connection
			.sobject(sObjectApiName)
			.update(records);
		
		const summary = formatDatabaseErrors(rets, sObjectApiName);
		displayDatabaseResults('update', summary, sObjectApiName);
		return rets;
	}

	async upsert(sObjectApiName, records, externalIdField, allOrNone = false) {
		if (!this.connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this.connection
			.sobject(sObjectApiName)
			.upsert(records, externalIdField, { allOrNone });
		
		const summary = formatDatabaseErrors(rets, sObjectApiName);
		displayDatabaseResults('upsert', summary, sObjectApiName);
		return rets;
	}

	async sObjectDescribe(sObjectName) {
		if (!this.connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}
		if (this.sObjectNameToDescribe[sObjectName]) {
			return this.sObjectNameToDescribe[sObjectName];
		}
		const response = await this.connection.request({
			method: 'GET',
			url: `/services/data/v62.0/sobjects/${sObjectName}/describe`
		});
		this.sObjectNameToDescribe[sObjectName] = response;

		return response;
	}
}
