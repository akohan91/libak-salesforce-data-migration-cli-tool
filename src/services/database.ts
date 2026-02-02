import { getArg, getConnection } from "./cli.ts";
import { CliArgName, DatabaseUnifiedResult, DML, HTTP } from "../types/types.ts";
import { displayDatabaseResults } from "./salesforce-error-handler.ts";
import type { Connection, DescribeGlobalResult, DescribeSObjectResult, SaveResult } from "jsforce";

export class Database {
	
	_connection: Connection;
	_sObjectNameToDescribe: any;
	_globalDescribe: DescribeGlobalResult | null;
	_recordsForRollback: Map<string, Set<string>>[];

	constructor(connection: Connection) {
		this._connection = connection;
		this._sObjectNameToDescribe = {};
		this._globalDescribe = null;
		this._recordsForRollback = [];
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
		this._registerInsertedRecords(sObjectApiName, rets);

		const dbSummaryResult: DatabaseUnifiedResult = displayDatabaseResults(DML.insert, rets, sObjectApiName);
		await this._doRollbackIfFailed(dbSummaryResult);
		return rets;
	}

	async update(sObjectApiName: string, records: any[]): Promise<SaveResult[]> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.update(records);

		const dbSummaryResult: DatabaseUnifiedResult = displayDatabaseResults(DML.update, rets, sObjectApiName);
		await this._doRollbackIfFailed(dbSummaryResult);
		return rets;
	}

	async upsert(
		sObjectApiName: string,
		records: any[],
		externalIdField: string,
		allOrNone: boolean = true
	): Promise<SaveResult[]> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.upsert(records, externalIdField, { allOrNone });

		const dbSummaryResult: DatabaseUnifiedResult = displayDatabaseResults(DML.upsert, rets, sObjectApiName);
		await this._doRollbackIfFailed(dbSummaryResult);
		
		return rets;
	}

	async delete(sObjectApiName: string, recordIds: string[]): Promise<SaveResult[]> {
		if (!this._connection) {
			throw new Error('Not connected to Salesforce. Call connect() first.');
		}

		const rets = await this._connection
			.sobject(sObjectApiName)
			.delete(recordIds);

		displayDatabaseResults(DML.delete, rets, sObjectApiName);
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
			method: HTTP.GET,
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

	async doRollback() {
		if (!this._recordsForRollback.length) {
			return;
		}
		console.log('\n🚨 ROLLBACK IN PROGRESS...');
		while (this._recordsForRollback.length > 0) {
			const sObjectTypeToRecIds = this._recordsForRollback?.pop();
			for (const [sObjectType, sObjectIds] of sObjectTypeToRecIds || []) {
				await this.delete(
					sObjectType,
					Array.from(sObjectIds?.values() || [])
				);
			}
		}
	}

	_registerInsertedRecords(sObjectType: string, dbResults: SaveResult[]): void {
		const recordIds: Set<string> = dbResults.reduce((recordIds: Set<string>, dbResult: SaveResult) => {
			if (dbResult.id) {
				recordIds.add(dbResult.id);
			}
			return recordIds;
		},new Set<string>());
		if (recordIds.size > 0) {
			this._recordsForRollback.push(
				new Map([[
					sObjectType,
					recordIds
				]])
			);
		}
	}

	async _doRollbackIfFailed(dbSummaryResult: DatabaseUnifiedResult) {
		if (dbSummaryResult.errorCount === 0) {
			return;
		}
		await this.doRollback();
		process.exit(1);
	}
}

let _sourceDb: Database | null = null;
export const getSourceDb = (): Database => {
	if (!_sourceDb) {
		_sourceDb = new Database(getConnection(getArg(CliArgName.sourceOrg)));
	}
	return _sourceDb;
}

let _targetDb: Database | null = null;
export const getTargetDb = (): Database => {
	if (!_targetDb) {
		_targetDb = new Database(getConnection(getArg(CliArgName.targetOrg)));
	}
	return _targetDb;
}