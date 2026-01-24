import { SoqlBuilder } from "./soql-builder.js";
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { getArgs, getConnection } from '../cli.js'
import { Database } from "./database.js";
import { SobjectReferenceService } from "./sobject-reference-service.js";
import { ImportPlanBuilder } from "./import-plan-builder.js";

export class MigrateService {
	constructor() {
		this.importPlanBuilder = new ImportPlanBuilder;
		this.objectTypeToSourceRecords = {};
		this.sourceDataBase = new Database(getConnection(getArgs().sourceOrg));
		this.targetDataBase = new Database(getConnection(getArgs().targetOrg));
		this.sobjectReferenceService = new SobjectReferenceService(this.sourceDataBase);
	}

	async migrateData(exportConfig) {
		exportConfig = structuredClone(exportConfig);
		
		console.log('📥 Extracting data from source org...');
		await this._writeDataFiles(exportConfig);
		
		console.log('\n📋 Building import plan...');
		this.importPlanBuilder.writeImportPlanFile(exportConfig);
		console.log('\t✅ Import plan created\n');
		
		console.log('📤 Importing records to target org...');
		const referenceToRecordId = this._insertPlan();
		console.log('✅ Records imported successfully\n');

		console.log('🔄 Updating record references...');
		for (const sObjectName in this.objectTypeToSourceRecords) {
			const formattedRecords = await this.sobjectReferenceService.formatForSyncReferences(
				this.objectTypeToSourceRecords[sObjectName],
				sObjectName,
				referenceToRecordId
			);
			await this.targetDataBase.update(sObjectName, formattedRecords);
		}
		console.log('✅ Record references updated successfully');
	}

	async _writeDataFiles(exportConfig) {
		const soql = await new SoqlBuilder(this.sourceDataBase, exportConfig).buildSOQL();
		if (!soql) {
			return;
		}
		const records = await this.sourceDataBase.query(soql);
		this.objectTypeToSourceRecords[exportConfig.apiName] = structuredClone(records);

		exportConfig = this._updateExportConfigRecordIds(exportConfig, records);
		const formattedRecords = await this.sobjectReferenceService.formatForImport(records, exportConfig.apiName);

		this._writeRecordsToFile(exportConfig.apiName, {records: formattedRecords});
		console.log(`\t✅ Retrieved ${records.length} ${exportConfig.apiName} record${records.length !== 1 ? 's' : ''}`);

		if (!exportConfig.children?.length) {
			return;
		}
		for (let childConfig of exportConfig.children) {
			childConfig = structuredClone(childConfig);
			childConfig.parentRecordIds = exportConfig?.recordIds || [];
			await this._writeDataFiles(childConfig);
		}
	}

	_writeRecordsToFile(sObjectApiName, records) {
		writeFileSync(
			`./_output/${sObjectApiName}.json`,
			JSON.stringify(records, null, 4)
		);
	}

	_updateExportConfigRecordIds(exportConfig, records) {
		exportConfig = structuredClone(exportConfig);
		exportConfig.recordIds = records.map(record => record.Id);
		return exportConfig;
	}

	_insertPlan() {
		try {
			const {result} = JSON.parse(execSync(
				`sf data import tree --target-org ${getArgs().targetOrg} --json --plan ./_output/_import-plan.json`,
				{ encoding: 'utf-8' }
			));
			const referenceToRecordId = result.reduce((result, item) => {
				result[item.refId] = item.id
				return result
			}, {})
			return referenceToRecordId;
		} catch (error) {
			// Enhance error with stdout/stderr for better error handling
			if (error.stdout) {
				error.stdout = error.stdout.toString();
			}
			if (error.stderr) {
				error.stderr = error.stderr.toString();
			}
			throw error;
		}
	}
}