import type { Field } from "jsforce";
import { getSourceDb } from "../cli.ts";
import type { TreeConfig } from "../types/types.ts";
import { SoqlBuilder } from "./soql-builder.ts";

export class ReferenceAnalyzerService {
	
	_treeConfig: TreeConfig;
	_objectTypeToSourceRecords: {[key: string]: any[]};
	_sObjectFieldNameToSobjects;
	_sObjectNameToConfig;
	
	constructor(treeConfig: TreeConfig) {
		this._treeConfig = treeConfig;
		this._objectTypeToSourceRecords = {};
		this._sObjectFieldNameToSobjects = new Map();
		this._sObjectNameToConfig = new Map();
	}

	async analyzeReferences(): Promise<void>  {
		console.log('📥 Analyzing references for provided treeConfig...');
		await this._analyzeReferences(this._treeConfig);
		console.log(this._sObjectFieldNameToSobjects);
		console.log(
			JSON.stringify(
				[...this._sObjectNameToConfig.values()]
				.map(config => ({...config, recordIds: [...config.recordIds.values()]}))
			)
		);
		console.log('✅ Analyzing references completed successfully');
	}

	async _analyzeReferences(treeConfig: TreeConfig): Promise<void>  {
		const soql = await new SoqlBuilder(getSourceDb()).buildSoqlForConfig(treeConfig);
		if (!soql) {
			return;
		}
		const records = await getSourceDb().query(soql);
		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		const fields: Field[] = (await getSourceDb().sObjectDescribe(treeConfig.apiName)).fields;
		const fieldNameToMetadata = fields
			.reduce((fieldNameToMetadata: {[key:string]: Field}, field) => {
				if (field.type === 'reference') {
					fieldNameToMetadata[field.name] = field;
				}
				return fieldNameToMetadata;
			}, {});
		
		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			await this._addRelationsToMap(record, fieldNameToMetadata, treeConfig);
		}


		if (!treeConfig.children?.length) {
			return;
		}
		for (let childConfig of treeConfig.children) {
			childConfig.parentRecordIds = treeConfig?.recordIds || [];
			await this._analyzeReferences(childConfig);
		}
	}

	_addTreeConfigRecordIds(treeConfig: TreeConfig, records: any[]): TreeConfig  {
		treeConfig = treeConfig;
		treeConfig.recordIds = records.map(record => record.Id);
		return treeConfig;
	}

	async _addRelationsToMap(
		record: any,
		fieldNameToMetadata: {[key: string]: Field},
		treeConfig: TreeConfig
	): Promise<void> {
		for (const fieldName in fieldNameToMetadata) {
			if (record[fieldName]) {
				const referenceTo = fieldNameToMetadata[fieldName]?.referenceTo;
				if (!referenceTo || referenceTo.length === 0) {
					continue;
				}
				const referenceObject = referenceTo.length > 1
					? await getSourceDb().sObjectTypeById(record[fieldName])
					: referenceTo[0];
				
				if (!referenceObject) {
					continue;
				}
				const key = `${treeConfig.apiName}.${fieldName}`;
				if (!this._sObjectFieldNameToSobjects.has(key)) {
					this._sObjectFieldNameToSobjects.set(key, new Set());
				}
				this._sObjectFieldNameToSobjects.get(key).add(referenceObject);
				if (!this._sObjectNameToConfig.has(referenceObject)) {
					const externalIdField = (await getSourceDb().sObjectDescribe(referenceObject)).fields
						.filter(field => field.externalId && field.unique)
						.map(field => field.name)
					this._sObjectNameToConfig.set(
						referenceObject,
						{apiName: referenceObject, recordIds: new Set(), externalIdField}
					)

				}
				this._sObjectNameToConfig.get(referenceObject).recordIds.add(record[fieldName]);
			}
		}
	}
}