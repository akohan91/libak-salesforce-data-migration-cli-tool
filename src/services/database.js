import { formatDatabaseErrors, displayDatabaseResults } from "./salesforce-error-handler.js";

export class Database {
	
	constructor(connection) {
		this._connection = connection;
		this._sObjectNameToDescribe = {};
		this._globalDescribe = null;
	}

	async query(soql) {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const result = await this._connection.query(soql);
		return result.records;
	}

	async insert(sObjectApiName, records) {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.create(records);
		
		const summary = formatDatabaseErrors(rets, sObjectApiName);
		displayDatabaseResults('insert', summary, sObjectApiName);
		return rets;
	}

	async update(sObjectApiName, records) {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.update(records);
		
		const summary = formatDatabaseErrors(rets, sObjectApiName);
		displayDatabaseResults('update', summary, sObjectApiName);
		return rets;
	}

	async upsert(sObjectApiName, records, externalIdField, allOrNone = false) {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.upsert(records, externalIdField, { allOrNone });
		
		const summary = formatDatabaseErrors(rets, sObjectApiName);
		displayDatabaseResults('upsert', summary, sObjectApiName);
		return rets;
	}

	async sObjectDescribe(sObjectName) {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}
		if (this._sObjectNameToDescribe[sObjectName]) {
			return this._sObjectNameToDescribe[sObjectName];
		}
		const response = await this._connection.request({
			method: 'GET',
			url: `/services/data/v62.0/sobjects/${sObjectName}/describe`
		});
		this._sObjectNameToDescribe[sObjectName] = response;

		return response;
	}

	async sObjectTypeById(recordId) {
		if (!this._globalDescribe) {
			this._globalDescribe = await this._connection.describeGlobal();
		}
		const {sobjects} = this._globalDescribe;
		const prefixMap = sobjects.reduce((map, obj) => {
			if (obj.keyPrefix) {
			map[obj.keyPrefix] = obj.name;
			}
			return map;
		}, {});
		return prefixMap[recordId.substring(0, 3)];
	}
}