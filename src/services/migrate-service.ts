import { SoqlBuilder } from "./soql-builder.ts";
import { getSourceDb, getTargetDb } from './database.ts'
import { SobjectReferenceService } from "./sobject-reference-service.ts";
import { FieldType, type TreeConfig, Dependencies } from "../types/types.ts";

export class MigrateService {

	_treeConfig: TreeConfig;
	_dependencies: Dependencies;
	_objectTypeToSourceRecords: {[key: string]: any[]};
	_sobjectReferenceService: SobjectReferenceService;

	constructor(
		treeConfig: TreeConfig,
		dependencies: Dependencies
	) {
		this._treeConfig = treeConfig;
		this._dependencies = dependencies;
		this._objectTypeToSourceRecords = {};
		this._sobjectReferenceService = new SobjectReferenceService();
	}

	async migrateData(): Promise<void> {
		await this._syncRecordTypeReferences();
		console.log('🔄 Migration dependencies...');
		await this._migrateDependencies();
		console.log('\n✅ Migration dependencies completed...');

		console.log('\n🔄 Migration main tree...');
		await this._migrateConfig(this._treeConfig);
		console.log('\n✅ Migration main tree completed...\n');
	}

	async _migrateDependencies(): Promise<void> {
		
		if (!this._dependencies.dependencyConfigsToCreate) {
			console.log(`\t⚠️  no dependencies configured.`);
			return;
		}
		for (const dependencyConfig of this._dependencies.dependencyConfigsToCreate) {
			await this._migrateConfig(dependencyConfig);
		}
		
	}

	async _migrateConfig(treeConfig: TreeConfig): Promise<void> {
		await this._migrateTree(treeConfig);
		await this._updateRecordsWithReferences();
	}

	async _migrateTree(treeConfig: TreeConfig): Promise<void> {
		const soql = await new SoqlBuilder(getSourceDb()).buildSoqlForConfig(treeConfig);
		if (!soql) {
			return;
		}
		const records = await getSourceDb().query(soql);
		if (!records?.length) {
			console.log(`\t⚠️  no records found for ${treeConfig.apiName} Sobject.`);
			return;
		}

		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		const recordsToInsert = await this._sobjectReferenceService.assignReferences(
			records,
			treeConfig.apiName,
			(fieldMetadata) => fieldMetadata.createable
		);

		const dbResults = treeConfig.externalIdField
			? await getTargetDb().upsert(treeConfig.apiName, recordsToInsert, treeConfig.externalIdField)
			: await getTargetDb().insert(treeConfig.apiName, recordsToInsert);
		await this._sobjectReferenceService.addReferencesFromDbResults(records, dbResults, treeConfig)
		this._objectTypeToSourceRecords[treeConfig.apiName] = records.map(record => {
			treeConfig.requiredReferences?.forEach(fieldName => delete record[fieldName]);
			return record;
		});

		if (!treeConfig.children?.length) {
			return;
		}
		for (let childConfig of treeConfig.children) {
			childConfig = childConfig;
			childConfig.parentRecordIds = treeConfig?.recordIds || [];
			await this._migrateTree(childConfig);
		}
	}

	_addTreeConfigRecordIds(treeConfig: TreeConfig, records: any[]): TreeConfig {
		treeConfig.recordIds = records.map(record => record.Id);
		return treeConfig;
	}

	async _syncRecordTypeReferences(): Promise<void>  {
		console.log('\n📥 Including Record Type references...');
		await this._sobjectReferenceService.addDependencyConfigToSyncs(
			this._treeConfig,
			this._dependencies
		);
		console.log('\t✅ Record Type references included successfully');
	}

	async _updateRecordsWithReferences(): Promise<void>  {
		console.log('🔄 Updating record references...');
		for (const sObjectName in this._objectTypeToSourceRecords) {
			if (this._objectTypeToSourceRecords[sObjectName]) {
				const recordsToUpdate = await this._sobjectReferenceService.assignReferences(
					this._objectTypeToSourceRecords[sObjectName],
					sObjectName,
					(fieldMetadata) => fieldMetadata.updateable || fieldMetadata.type === FieldType.id
				);
				await getTargetDb().update(sObjectName, recordsToUpdate);
			}
		}
		console.log('✅ Updating record references completed...');
	}
}