import { SoqlBuilder } from "./soql-builder.js";
import { getArgs, getConnection } from '../cli.js'
import { Database } from "./database.js";
import { SobjectReferenceService } from "./sobject-reference-service.js";

export class MigrateService {
	constructor(treeConfig, nonTreeConfig) {
		this.treeConfig = structuredClone(treeConfig);
		this.nonTreeConfig = structuredClone(nonTreeConfig);
		this.objectTypeToSourceRecords = {};
		this.sourceDataBase = new Database(getConnection(getArgs().sourceOrg));
		this.targetDataBase = new Database(getConnection(getArgs().targetOrg));
		this.sobjectReferenceService = new SobjectReferenceService(this.sourceDataBase);
	}

	async migrateData() {
		console.log('📥 Extracting data from source org...');
		await this._migrateTree(this.treeConfig);
		console.log('🔄 Updating record references...');

		for (const sObjectName in this.objectTypeToSourceRecords) {
			const formattedRecords = await this.sobjectReferenceService.assignReferences(
				this.objectTypeToSourceRecords[sObjectName],
				sObjectName
			);
			await this.targetDataBase.update(sObjectName, formattedRecords);
		}
		console.log('✅ Record references updated successfully');
	}

	async _migrateTree(treeConfig) {
		const soql = await new SoqlBuilder(this.sourceDataBase, treeConfig).buildSOQL();
		if (!soql) {
			return;
		}
		const records = await this.sourceDataBase.query(soql);
		this.objectTypeToSourceRecords[treeConfig.apiName] = structuredClone(records);

		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		const cleanedRecords = await this.sobjectReferenceService.assignReferences(records, treeConfig.apiName);
		const databaseResults = Boolean(treeConfig.externalIdField)
			? await this.targetDataBase.upsert(treeConfig.apiName, cleanedRecords, treeConfig.externalIdField)
			: await this.targetDataBase.insert(treeConfig.apiName, cleanedRecords);
		this.sobjectReferenceService.addReferences(records, databaseResults);
		
		if (!treeConfig.children?.length) {
			return;
		}
		for (let childConfig of treeConfig.children) {
			childConfig = structuredClone(childConfig);
			childConfig.parentRecordIds = treeConfig?.recordIds || [];
			await this._migrateTree(childConfig);
		}
	}

	_addTreeConfigRecordIds(treeConfig, records) {
		treeConfig = structuredClone(treeConfig);
		treeConfig.recordIds = records.map(record => record.Id);
		return treeConfig;
	}
}