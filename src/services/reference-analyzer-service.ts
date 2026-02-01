import type { Field } from "jsforce";
import { getSourceDb } from "./database.ts";
import { FieldType, SObjectName, type TreeConfig } from "../types/types.ts";
import { SoqlBuilder } from "./soql-builder.ts";

export class ReferenceAnalyzerService {
	
	_treeConfig: TreeConfig;
	_skipSobjectDependencies?: string[];
	_skipMainTreeRecordIds: string[];
	_objectTypeToSourceRecords: {[key: string]: any[]};
	_dependenciesMap: Map<string, Map<string, Set<string>>>;
	_dependencyConfigs: TreeConfig[];
	
	constructor(treeConfig: TreeConfig, skipSobjectDependencies: string[]) {
		this._treeConfig = treeConfig;
		this._skipSobjectDependencies = skipSobjectDependencies;
		this._skipMainTreeRecordIds = [];
		this._objectTypeToSourceRecords = {};
		this._dependenciesMap = new Map();
		this._dependencyConfigs = [];
	}

	async analyzeReferences(): Promise<void>  {
		console.log('🔄 Analyzing references for provided treeConfig...');
		await this._loadSourceRecords(this._treeConfig);
		console.log('\n📥 Records for analysis successfully loaded');
		await this._analyzeConfigReferences();
		await this._defineDependencyConfigs();
		console.log('\n✅ Analyzing references completed successfully');

		console.log('\n✅ Dependencies Map:');
		console.log(this._dependenciesMap);
		console.log('\n✅ Dependencies Configs:');
		console.log(JSON.stringify(this._dependencyConfigs));
	}

	async _loadSourceRecords(treeConfig: TreeConfig) {
		const soql = await new SoqlBuilder(getSourceDb()).buildSoqlForConfig(treeConfig);
		if (!soql) {
			return;
		}
		const records = await getSourceDb().query(soql);
		this._objectTypeToSourceRecords[treeConfig.apiName] = records;
		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		if (!treeConfig.children?.length) {
			return;
		}
		for (let childConfig of treeConfig.children) {
			childConfig.parentRecordIds = treeConfig?.recordIds || [];
			await this._loadSourceRecords(childConfig);
		}
	}

	async _analyzeConfigReferences(): Promise<void>  {
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

	_addTreeConfigRecordIds(treeConfig: TreeConfig, records: any[]): TreeConfig  {
		const recordIds: string[] = records.map(record => record.Id);
		treeConfig.recordIds = recordIds;
		this._skipMainTreeRecordIds = [...this._skipMainTreeRecordIds, ...recordIds];
		return treeConfig;
	}

	async _defineDependenciesMap(
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
					this._skipSobjectDependencies?.includes(referenceObject) ||
					referenceObject === SObjectName.RecordType
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

	async _defineDependencyConfigs() {
		const sObjectTypeToConfig: Map<string, TreeConfig> = new Map();
		for (const sObjectTypeToIds of this._dependenciesMap.values()) {
			for (const [sObjectType, recordIds] of sObjectTypeToIds) {
				if (!sObjectTypeToConfig.has(sObjectType)) {
					const externalIdField: string = (await getSourceDb().sObjectDescribe(sObjectType)).fields
						.filter(field => field.externalId && field.unique)
						.map(field => field.name)
						.join(',');
					sObjectTypeToConfig.set(
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
				const mergedIds: Set<string> = new Set(sObjectTypeToConfig.get(sObjectType)?.recordIds);
				recordIds.forEach(id => mergedIds.add(id));
				const config = sObjectTypeToConfig.get(sObjectType);
				if (config) {
					config.recordIds = Array.from(mergedIds);
				}
			}
		}
		this._dependencyConfigs = [...sObjectTypeToConfig.values()];
	}
}