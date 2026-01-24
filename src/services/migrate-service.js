import { SoqlBuilder } from "./soql-builder.js";
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { getArgs, getConnection } from '../cli.js'
import { Database } from "./database.js";
import { SobjectReferenceService } from "./sobject-reference-service.js";
import { ImportPlanBuilder } from "./import-plan-builder.js";

export class MigrateService {
	constructor(treeConfig, nonTreeConfig) {
		this.treeConfig = structuredClone(treeConfig);
		this.nonTreeConfig = structuredClone(nonTreeConfig);
		this.importPlanBuilder = new ImportPlanBuilder;
		this.objectTypeToSourceRecords = {};
		this.sourceDataBase = new Database(getConnection(getArgs().sourceOrg));
		this.targetDataBase = new Database(getConnection(getArgs().targetOrg));
		this.sobjectReferenceService = new SobjectReferenceService(this.sourceDataBase);
	}

	async migrateData() {
		console.log('📥 Extracting data from source org...');
		await this._writeDataFiles(this.treeConfig);
		
		console.log('\n📋 Building import plan...');
		this.importPlanBuilder.writeImportPlanFile(this.treeConfig);
		console.log('\t✅ Import plan created\n');
		
		console.log('📤 Importing records to target org...');
		const referenceToRecordId = this._insertPlan();
		console.log('✅ Records imported successfully\n');

		console.log('🔄 Updating record references...');
		for (const sObjectName in this.objectTypeToSourceRecords) {
			const formattedRecords = await this.sobjectReferenceService.assignReferences(
				this.objectTypeToSourceRecords[sObjectName],
				sObjectName,
				referenceToRecordId
			);
			await this.targetDataBase.update(sObjectName, formattedRecords);
		}
		console.log('✅ Record references updated successfully');
	}

	async _writeDataFiles(treeConfig) {
		const soql = await new SoqlBuilder(this.sourceDataBase, treeConfig).buildSOQL();
		if (!soql) {
			return;
		}
		const records = await this.sourceDataBase.query(soql);
		this.objectTypeToSourceRecords[treeConfig.apiName] = structuredClone(records);

		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);
		const formattedRecords = await this.sobjectReferenceService.linkTreeReferences(records, treeConfig.apiName);

		this._writeRecordsToFile(treeConfig.apiName, {records: formattedRecords});
		console.log(`\t✅ Retrieved ${records.length} ${treeConfig.apiName} record${records.length !== 1 ? 's' : ''}`);

		if (!treeConfig.children?.length) {
			return;
		}
		for (let childConfig of treeConfig.children) {
			childConfig = structuredClone(childConfig);
			childConfig.parentRecordIds = treeConfig?.recordIds || [];
			await this._writeDataFiles(childConfig);
		}
	}

	_writeRecordsToFile(sObjectApiName, records) {
		writeFileSync(
			`./_output/${sObjectApiName}.json`,
			JSON.stringify(records, null, 4)
		);
	}

	_addTreeConfigRecordIds(treeConfig, records) {
		treeConfig = structuredClone(treeConfig);
		treeConfig.recordIds = records.map(record => record.Id);
		return treeConfig;
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