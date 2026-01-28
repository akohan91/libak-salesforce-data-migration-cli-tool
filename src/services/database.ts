import { formatDatabaseErrors, displayDatabaseResults } from "./salesforce-error-handler.ts";
import type { Connection, DescribeGlobalResult, DescribeSObjectResult, SaveResult } from "jsforce";

export class Database {
	
	_connection: Connection;
	_sObjectNameToDescribe: any;
	_globalDescribe: DescribeGlobalResult | null;

	constructor(connection: Connection) {
		this._connection = connection;
		this._sObjectNameToDescribe = {};
		this._globalDescribe = null;
	}

	async query(soql: string): Promise<any[]> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const result = await this._connection.query(soql);
		return result.records;
	}

	async insert(sObjectApiName: string, records: any[]): Promise<SaveResult[]> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.create(records);
		
		const summary = formatDatabaseErrors(rets);
		displayDatabaseResults('insert', summary, sObjectApiName);
		return rets;
	}

	async update(sObjectApiName: string, records: any[]): Promise<SaveResult[]> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.update(records);
		
		const summary = formatDatabaseErrors(rets);
		displayDatabaseResults('update', summary, sObjectApiName);
		return rets;
	}

	async upsert(
		sObjectApiName: string,
		records: any[],
		externalIdField: string,
		allOrNone: boolean = false
	): Promise<SaveResult[]> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.upsert(records, externalIdField, { allOrNone });
		
		const summary = formatDatabaseErrors(rets);
		displayDatabaseResults('upsert', summary, sObjectApiName);
		return rets;
	}

	async sObjectDescribe(sObjectName: string): Promise<DescribeSObjectResult> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}
		if (this._sObjectNameToDescribe[sObjectName]) {
			return this._sObjectNameToDescribe[sObjectName];
		}
		const response = await this._connection.request<DescribeSObjectResult>({
			method: 'GET',
			url: `/services/data/v62.0/sobjects/${sObjectName}/describe`
		});
		this._sObjectNameToDescribe[sObjectName] = response;

		return response;
	}

	async sObjectTypeById(recordId: string): Promise<string> {
		if (!this._globalDescribe) {
			this._globalDescribe = await this._connection.describeGlobal();
		}
		const {sobjects} = this._globalDescribe;
		const prefixMap = sobjects.reduce((map, objDescribe) => {
			if (objDescribe.keyPrefix) {
				map.set(objDescribe.keyPrefix, objDescribe.name);
			}
			return map;
		}, new Map());
		return prefixMap.get(recordId.substring(0, 3));
	}
}