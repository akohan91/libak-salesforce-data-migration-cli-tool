/**
 * @fileoverview Service for orchestrating data migration from Salesforce.
 * @module services/migrate-service
 */

import { SoqlBuilder } from "./soql-builder.js";
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { getOptions } from './app-options.js'
import { Database } from "./database.js";
import { SalesforceConnection } from "./salesforce-connection.js";

/**
 * Service class that orchestrates the data migration process, including
 * querying records, formatting them for import, and handling parent-child relationships.
 */
export class MigrateService {
	/**
	 * Creates a new MigrateService instance.
	 * @param {SalesforceConnection} sourceConnection - The Salesforce connection
	 * @param {Database} database - The database service for executing queries
	 * @param {RecordFormatter} recordFormatter - The record formatter service
	 * @param {Object} exportConfig - Configuration object defining what to export
	 */
	constructor(sourceConnection, database, recordFormatter, importPlanBuilder) {
		this.sourceConnection = sourceConnection;
		this.database = database;
		this.recordFormatter = recordFormatter;
		this.importPlanBuilder = importPlanBuilder;
		this.objectTypeToRecords = {};
	}

	async migrateData(exportConfig) {
		exportConfig = structuredClone(exportConfig);
		await this._migrateData(exportConfig);
		this.importPlanBuilder.buildImportPlan(exportConfig);
		const {result} = JSON.parse(execSync(
			`sf data import tree --target-org ${getOptions().targetOrg} --json --plan ./_output/_import-plan.json`,
			{ encoding: 'utf-8' }
		));
		
		for (const sObjectName in this.objectTypeToRecords) {
			const formattedRecords = await this.recordFormatter.formatForSyncReferences(
				this.objectTypeToRecords[sObjectName],
				sObjectName,
				result.reduce((result, item) => {
					result[item.refId] = item.id
					return result
				}, {})
			);

			const loginConfig = JSON.parse(execSync(
				`sf org display --target-org ${getOptions().targetOrg} --verbose --json`,
				{ encoding: 'utf-8' }
			));

			const targetConnection = new SalesforceConnection(loginConfig.result);
			await targetConnection.connect();

			const rets = await new Database(targetConnection).update(sObjectName, formattedRecords);
			for (const ret of rets) {
				if (ret.success) {
					console.log(`Updated Successfully : ${ret.id}`);
				} else {
					ret.errors.forEach(error => {
						console.log(error);
					});
				}
			}
			
		}
		
	}

	/**
	 * Migrates data according to the export configuration.
	 * Recursively processes parent and child records.
	 * @async
	 * @returns {Promise<void>}
	 */
	async _migrateData(exportConfig) {
		const soql = await new SoqlBuilder(this.sourceConnection, exportConfig).buildSOQL();
		if (!soql) {
			return;
		}
		const records = await this.database.query(soql);
		this.objectTypeToRecords[exportConfig.apiName] = structuredClone(records);

		exportConfig = this._updateExportConfigRecordIds(exportConfig, records);
		const formattedRecords = await this.recordFormatter.formatForImport(records, exportConfig.apiName);

		this._writeRecordsToFile(exportConfig.apiName, {records: formattedRecords});
		console.log(`${exportConfig.apiName} records were retrieved.`);

		if (!exportConfig.children?.length) {
			return;
		}
		for (let childConfig of exportConfig.children) {
			childConfig = structuredClone(childConfig);
			childConfig.parentRecordIds = exportConfig?.recordIds || [];
			await this._migrateData(childConfig);
		}
	}

	/**
	 * Writes records to a JSON file in the output directory.
	 * @private
	 * @param {string} sObjectApiName - The API name of the SObject
	 * @param {Object} records - The records to write
	 * @returns {void}
	 */
	_writeRecordsToFile(sObjectApiName, records) {
		writeFileSync(
			`./_output/${sObjectApiName}.json`,
			JSON.stringify(records, null, 4)
		);
	}

	/**
	 * Updates the export configuration with retrieved record IDs.
	 * @private
	 * @param {Object} exportConfig - The export configuration object
	 * @param {Array<Object>} records - The retrieved records
	 * @returns {Object} Updated export configuration with record IDs
	 */
	_updateExportConfigRecordIds(exportConfig, records) {
		exportConfig = structuredClone(exportConfig);
		exportConfig.recordIds = records.map(record => record.Id);
		return exportConfig;
	}
}