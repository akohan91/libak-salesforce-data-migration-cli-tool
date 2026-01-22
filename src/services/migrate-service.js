/**
 * @fileoverview Service for orchestrating data migration from Salesforce.
 * @module services/migrate-service
 */

import { SoqlBuilder } from "./soql-builder.js";
import { writeFileSync } from 'fs';

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
	constructor(sourceConnection, database, recordFormatter, exportConfig) {
		this.sourceConnection = sourceConnection;
		this.database = database;
		this.recordFormatter = recordFormatter;
		this.exportConfig = structuredClone(exportConfig);
	}

	/**
	 * Migrates data according to the export configuration.
	 * Recursively processes parent and child records.
	 * @async
	 * @returns {Promise<void>}
	 */
	async migrateData() {
		const soql = await new SoqlBuilder(this.sourceConnection, this.exportConfig).buildSOQL();
		if (!soql) {
			return;
		}
		
		const records = await this.database.query(soql);
		this.exportConfig = this._updateExportConfigRecordIds(this.exportConfig, records);

		const formattedRecords = await this.recordFormatter.formatForImport(records, this.exportConfig);

		this._writeRecordsToFile(this.exportConfig.apiName, formattedRecords);
		console.log(`${this.exportConfig.apiName} records were retrieved.`);

		if (!this.exportConfig.children?.length) {
			return;
		}
		for (let childConfig of this.exportConfig.children) {
			childConfig = structuredClone(childConfig);
			childConfig.parentRecordIds = this.exportConfig?.recordIds || [];
			await new MigrateService(
				this.sourceConnection,
				this.database,
				this.recordFormatter,
				childConfig
			).migrateData();
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