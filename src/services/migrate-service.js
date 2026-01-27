import { SoqlBuilder } from "./soql-builder.js";
import { getSourceDb, getTargetDb } from '../cli.js'
import { SobjectReferenceService } from "./sobject-reference-service.js";

export class MigrateService {
	constructor(treeConfig, dependencyConfig) {
		this._treeConfig = structuredClone(treeConfig);
		this._dependencyConfig = structuredClone(dependencyConfig);
		this._objectTypeToSourceRecords = {};
		this._sobjectReferenceService = new SobjectReferenceService();
	}

	async migrateData() {
		await this._migrateDependencies();
		await this._syncRecordTypeReferences(this._treeConfig);
		
		console.log('🔄 Migration main tree...');
		await this._migrateTree(this._treeConfig);
		console.log('✅ Migration main tree completed...\n');
		
		await this._updateRecordsWithReferences();
		
	}

	async _migrateDependencies() {
		console.log('🔄 Migration dependencies...');
		if (!this._dependencyConfig) {
			return;
		}
		for (const config of this._dependencyConfig) {
			await this._syncRecordTypeReferences(config);
			await this._migrateTree(config);
		}
		console.log('✅ Migration dependencies completed...\n');
	}

	async _migrateTree(treeConfig) {
		const soql = await new SoqlBuilder(getSourceDb()).buildSoqlForConfig(treeConfig);
		if (!soql) {
			return;
		}
		const records = await getSourceDb().query(soql);

		!records?.length && console.log(`\t⚠️  no records found for ${treeConfig.apiName} Sobject.`);

		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		const recordsToInsert = await this._sobjectReferenceService.assignReferences(records, treeConfig.apiName);
		const dbResults = Boolean(treeConfig.externalIdField)
			? await getTargetDb().upsert(treeConfig.apiName, recordsToInsert, treeConfig.externalIdField)
			: await getTargetDb().insert(treeConfig.apiName, recordsToInsert);
		await this._sobjectReferenceService.addReferencesFromDbResults(records, dbResults, treeConfig)
		this._objectTypeToSourceRecords[treeConfig.apiName] = structuredClone(records.map(record => {
			treeConfig.requiredReferences?.forEach(fieldName => delete record[fieldName]);
			return record;
		}));

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

	async _syncRecordTypeReferences(config) {
		console.log('📥 Including Record Type references...');
		await this._sobjectReferenceService.addRecordTypeReferences(config);
		console.log('\t✅ Record Type references included successfully\n');
	}

	async _updateRecordsWithReferences() {
		console.log('🔄 Updating record references...');
		for (const sObjectName in this._objectTypeToSourceRecords) {
			const recordsToUpdate = await this._sobjectReferenceService.assignReferences(
				this._objectTypeToSourceRecords[sObjectName],
				sObjectName
			);
			await getTargetDb().update(sObjectName, recordsToUpdate);
		}
		console.log('✅ Updating record references completed...');
	}
}