import type { Field } from "jsforce";
import { getSourceDb } from "./database.ts";
import { Dependencies, DependencyConfigToSync, FieldType, type TreeConfig } from "../types/types.ts";
import { SoqlBuilder } from "./soql-builder.ts";

export class ReferenceAnalyzerService {
	
	private _treeConfig: TreeConfig;
	private _dependencies?: Dependencies;
	private _skipMainTreeRecordIds: string[];
	private _objectTypeToSourceRecords: {[key: string]: any[]};
	private _dependenciesMap: Map<string, Map<string, Set<string>>>;
	private _dependencyConfigsToInsert: TreeConfig[];
	private _dependencyConfigsToSync: DependencyConfigToSync[];
	
	constructor(treeConfig: TreeConfig, dependencies: Dependencies) {
		this._treeConfig = treeConfig;
		this._dependencies = dependencies;
		this._skipMainTreeRecordIds = [];
		this._objectTypeToSourceRecords = {};
		this._dependenciesMap = new Map();
		this._dependencyConfigsToInsert = [];
		this._dependencyConfigsToSync = [];
	}

	async analyzeReferences(): Promise<void>  {
		console.log('🔄 Analyzing references for provided treeConfig...');
		await this._loadSourceRecords(this._treeConfig);
		await this._analyzeConfigReferences();
		await this._defineDependencyConfigs();
		console.log('\n✅ Analyzing references completed successfully');

		console.log('\n✅ Dependencies Map:');
		console.log(this._dependenciesMap);
		console.log('\n✅ Dependencies Configs to Insert:');
		console.log(JSON.stringify(this._dependencyConfigsToInsert));
		console.log('\n✅ Dependencies Configs to Sync:');
		console.log(JSON.stringify(this._dependencyConfigsToSync));
	}

	private async _loadSourceRecords(treeConfig: TreeConfig) {
		const soql = await new SoqlBuilder(getSourceDb()).buildSoqlForConfig(treeConfig);
		if (!soql) {
			return;
		}
		const records = await getSourceDb().query(soql);
		this._objectTypeToSourceRecords[treeConfig.apiName] = records;
		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);
		console.log(`\t✅ ${treeConfig.apiName} records are loaded.`);
		
		if (!treeConfig.children?.length) {
			return;
		}
		for (const childConfig of treeConfig.children) {
			childConfig.parentRecordIds = treeConfig?.recordIds || [];
			await this._loadSourceRecords(childConfig);
		}
	}

	private async _analyzeConfigReferences(): Promise<void>  {
		for (const sObjectType in this._objectTypeToSourceRecords) {
			if (!this._objectTypeToSourceRecords[sObjectType]) {
				continue;
			}
			const records: any[] = this._objectTypeToSourceRecords[sObjectType];
			const fields: Field[] = (await getSourceDb().sObjectDescribe(sObjectType)).fields;
			const fieldNameToFieldMetadata: {[key: string]: Field;} = fields
				.reduce((fieldNameToMetadata: {[key:string]: Field}, field) => {
					if (field.type === FieldType.reference) {
						fieldNameToMetadata[field.name] = field;
					}
					return fieldNameToMetadata;
				}, {});
			for (const record of records) {
				await this._defineDependenciesMap(record, fieldNameToFieldMetadata, sObjectType);
			}
		}
	}

	private _addTreeConfigRecordIds(treeConfig: TreeConfig, records: any[]): TreeConfig  {
		const recordIds: string[] = records.map(record => record.Id);
		treeConfig.recordIds = recordIds;
		this._skipMainTreeRecordIds = [...this._skipMainTreeRecordIds, ...recordIds];
		return treeConfig;
	}

	private async _defineDependenciesMap(
		record: any,
		fieldNameToFieldMetadata: {[key: string]: Field},
		sobjectType: string
	): Promise<void> {
		for (const fieldName in fieldNameToFieldMetadata) {
			if (record[fieldName] && !this._skipMainTreeRecordIds.includes(record[fieldName])) {
				const referenceSobjects = fieldNameToFieldMetadata[fieldName]?.referenceTo;
				if (!referenceSobjects || referenceSobjects.length === 0) {
					continue;
				}
				const referenceObject = referenceSobjects.length > 1
					? await getSourceDb().sObjectTypeById(record[fieldName])
					: referenceSobjects[0];
				
				if (
					!referenceObject ||
					this._dependencies?.dependencySobjectsToSkip?.includes(referenceObject)
				) {
					continue;
				}
				const key = `${sobjectType}.${fieldName}`;
				if (!this._dependenciesMap.has(key)) {
					this._dependenciesMap.set(key, new Map([[referenceObject, new Set()]]));
				}
				this._dependenciesMap?.get(key)?.get(referenceObject)?.add(record[fieldName]);
			}
		}
	}

	private async _defineDependencyConfigs() {
		const sObjectTypeToInsertConfig: Map<string, TreeConfig> = new Map();
		
		const buildDependencyConfigsToInsert = async (sObjectType: string, recordIds: Set<string>) => {
			if (!sObjectTypeToInsertConfig.has(sObjectType)) {
				const externalIdField: string = (await getSourceDb().sObjectDescribe(sObjectType)).fields
					.filter(field => field.externalId && field.unique)
					.map(field => field.name)
					.join(',');
				sObjectTypeToInsertConfig.set(
					sObjectType,
					{
						apiName: sObjectType,
						recordIds: [],
						externalIdField,
						referenceField: "",
						excludedFields: [],
						children: []
					}
				);
			}
			const mergedIds: Set<string> = new Set(sObjectTypeToInsertConfig.get(sObjectType)?.recordIds);
			recordIds.forEach(id => mergedIds.add(id));
			const config = sObjectTypeToInsertConfig.get(sObjectType);
			if (config) {
				config.recordIds = Array.from(mergedIds);
			}
		}

		const sObjectTypeToSyncConfig: Map<string, DependencyConfigToSync> = new Map();
		const buildDependencyConfigsToSync = (sObjectType: string) => {
			if (!sObjectTypeToSyncConfig.has(sObjectType)) {
				sObjectTypeToSyncConfig.set(
					sObjectType,
					{
						sObjectType: sObjectType,
						masterField: "",
						conditionField: "",
						conditionValues: []
					}
				);
			}
		}

		for (const sObjectTypeToIds of this._dependenciesMap.values()) {
			for (const [sObjectType, recordIds] of sObjectTypeToIds) {
				await buildDependencyConfigsToInsert(sObjectType, recordIds);
				buildDependencyConfigsToSync(sObjectType);
			}
		}
		this._dependencyConfigsToInsert = [...sObjectTypeToInsertConfig.values()];
		this._dependencyConfigsToSync = [...sObjectTypeToSyncConfig.values()];
	}
}