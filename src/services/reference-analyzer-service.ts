import type { Field } from "jsforce";
import { getSourceDb } from "../cli.ts";
import type { TreeConfig } from "../types/types.ts";
import { SoqlBuilder } from "./soql-builder.ts";

export class ReferenceAnalyzerService {
	
	_treeConfig: TreeConfig;
	_skipSobjectDependencies?: string[];
	_skippedDependencyRecordIds: string[];
	_objectTypeToSourceRecords: {[key: string]: any[]};
	_fieldNameToSobjectTypes;
	_sObjectTypeToConfig;
	
	constructor(treeConfig: TreeConfig, skipSobjectDependencies: string[]) {
		this._treeConfig = treeConfig;
		this._skipSobjectDependencies = skipSobjectDependencies;
		this._skippedDependencyRecordIds = [];
		this._objectTypeToSourceRecords = {};
		this._fieldNameToSobjectTypes = new Map();
		this._sObjectTypeToConfig = new Map();
	}

	async analyzeReferences(): Promise<void>  {
		console.log('📥 Analyzing references for provided treeConfig...');
		await this._loadSourceRecords(this._treeConfig);
		await this._analyzeReferences();
		console.log(this._fieldNameToSobjectTypes);
		console.log(
			JSON.stringify(
				[...this._sObjectTypeToConfig.values()]
				.map(config => ({...config, recordIds: [...config.recordIds.values()]}))
			)
		);
		console.log('✅ Analyzing references completed successfully');
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

	async _analyzeReferences(): Promise<void>  {
		
		for (const sObjectType in this._objectTypeToSourceRecords) {
			if (!this._objectTypeToSourceRecords[sObjectType]) {
				continue;
			}
			const records: any[] = this._objectTypeToSourceRecords[sObjectType];
			const fields: Field[] = (await getSourceDb().sObjectDescribe(sObjectType)).fields;
			const fieldNameToMetadata = fields
				.reduce((fieldNameToMetadata: {[key:string]: Field}, field) => {
					if (
						field.type === 'reference' &&
						field.createable &&
						field.updateable
					) {
						fieldNameToMetadata[field.name] = field;
					}
					return fieldNameToMetadata;
				}, {});
			for (const record of records) {
				await this._addRelationsToMap(record, fieldNameToMetadata, sObjectType);
			}
		}
	}

	_addTreeConfigRecordIds(treeConfig: TreeConfig, records: any[]): TreeConfig  {
		const recordIds: string[] = records.map(record => record.Id);
		treeConfig.recordIds = recordIds;
		this._skippedDependencyRecordIds = [...this._skippedDependencyRecordIds, ...recordIds];
		return treeConfig;
	}

	async _addRelationsToMap(
		record: any,
		fieldNameToMetadata: {[key: string]: Field},
		sobjectType: string
	): Promise<void> {
		for (const fieldName in fieldNameToMetadata) {
			if (record[fieldName] && !this._skippedDependencyRecordIds.includes(record[fieldName])) {
				const referenceTo = fieldNameToMetadata[fieldName]?.referenceTo;
				if (!referenceTo || referenceTo.length === 0) {
					continue;
				}
				const referenceObject = referenceTo.length > 1
					? await getSourceDb().sObjectTypeById(record[fieldName])
					: referenceTo[0];
				
				if (
					!referenceObject ||
					this._skipSobjectDependencies?.includes(referenceObject) ||
					referenceObject === 'RecordType'
				) {
					continue;
				}
				const key = `${sobjectType}.${fieldName}`;
				if (!this._fieldNameToSobjectTypes.has(key)) {
					this._fieldNameToSobjectTypes.set(key, new Set());
				}
				this._fieldNameToSobjectTypes.get(key).add(referenceObject);
				if (!this._sObjectTypeToConfig.has(referenceObject)) {
					const externalIdField = (await getSourceDb().sObjectDescribe(referenceObject)).fields
						.filter(field => field.externalId && field.unique)
						.map(field => field.name)
					this._sObjectTypeToConfig.set(
						referenceObject,
						{apiName: referenceObject, recordIds: new Set(), externalIdField}
					)

				}
				this._sObjectTypeToConfig.get(referenceObject).recordIds.add(record[fieldName]);
			}
		}
	}
}