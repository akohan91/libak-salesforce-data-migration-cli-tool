import { SoqlBuilder } from "./soql-builder.js";
import { getArgs, getConnection } from '../cli.js'
import { Database } from "./database.js";
import { SobjectReferenceService } from "./sobject-reference-service.js";

export class MigrateService {
	constructor(treeConfig, dependencyConfig) {
		this._treeConfig = structuredClone(treeConfig);
		this._dependencyConfig = structuredClone(dependencyConfig);
		this._objectTypeToSourceRecords = {};
		this._sourceDataBase = new Database(getConnection(getArgs().sourceOrg));
		this._targetDataBase = new Database(getConnection(getArgs().targetOrg));
		this._sobjectReferenceService = new SobjectReferenceService(this._sourceDataBase);
	}

	async migrateData() {

		console.log('📥 Including Record Type references...');
		await this._sobjectReferenceService.addRecordTypeReferences(
			this._sourceDataBase,
			this._targetDataBase,
			this._treeConfig
		);
		console.log('\t✅ Record Type references included successfully\n');

		console.log('📥 Migration data from source org...');
		await this._migrateTree(this._treeConfig);
		
		console.log('🔄 Updating record references...');
		for (const sObjectName in this._objectTypeToSourceRecords) {
			const formattedRecords = await this._sobjectReferenceService.assignReferences(
				this._objectTypeToSourceRecords[sObjectName],
				sObjectName
			);
			await this._targetDataBase.update(sObjectName, formattedRecords);
		}
	}

	async _migrateTree(treeConfig) {
		const soql = await new SoqlBuilder(this._sourceDataBase).buildSoqlForConfig(treeConfig);
		if (!soql) {
			return;
		}
		const records = await this._sourceDataBase.query(soql);

		!records?.length && console.log(`\t⚠️  no records found for ${treeConfig.apiName} Sobject.`);

		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		const cleanedRecords = await this._sobjectReferenceService.assignReferences(records, treeConfig.apiName);
		const databaseResults = Boolean(treeConfig.externalIdField)
			? await this._targetDataBase.upsert(treeConfig.apiName, cleanedRecords, treeConfig.externalIdField)
			: await this._targetDataBase.insert(treeConfig.apiName, cleanedRecords);
		await this._sobjectReferenceService.addReferences( records, databaseResults, treeConfig, this._targetDataBase )
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
}