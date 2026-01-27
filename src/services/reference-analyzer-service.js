import { getSourceDb } from "../cli.js";
import { SoqlBuilder } from "./soql-builder.js";

export class ReferenceAnalyzerService {
	constructor(treeConfig) {
		this._treeConfig = structuredClone(treeConfig);
		this._objectTypeToSourceRecords = {};
		this._sObjectFieldNameToSobjects = new Map();
		this._sObjectNameToConfig = new Map();
	}

	async analyzeReferences() {
		console.log('📥 Analyzing references for provided treeConfig...');
		await this._analyzeReferences(this._treeConfig);
		console.log(this._sObjectFieldNameToSobjects);
		console.log((this._sObjectFieldNameToSobjects.values().reduce((result, set) => {
			set.forEach(setItem => result.add(setItem));
			return result;
		},new Set())));
		console.log(
			JSON.stringify(
				this._sObjectNameToConfig
				.values()
				.toArray()
				.map(config => ({...config, recordIds: config.recordIds.values().toArray()})),
				null,
				4
			)
		);
		console.log('✅ Analyzing references completed successfully');
	}

	async _analyzeReferences(treeConfig) {
		const soql = await new SoqlBuilder(getSourceDb()).buildSoqlForConfig(treeConfig);
		if (!soql) {
			return;
		}
		const records = await getSourceDb().query(soql);
		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		const fieldNameToMetadata = (await getSourceDb()
			.sObjectDescribe(treeConfig.apiName)).fields
			.reduce((fieldNameToMetadata, field) => {
				if (field.type === 'reference') {
					fieldNameToMetadata[field.name] = {
						referenceTo: field.referenceTo
					};
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

	_addTreeConfigRecordIds(treeConfig, records) {
		treeConfig = structuredClone(treeConfig);
		treeConfig.recordIds = records.map(record => record.Id);
		return treeConfig;
	}

	async _addRelationsToMap(record, fieldNameToMetadata, treeConfig) {
		for (const fieldName in fieldNameToMetadata) {
			if (record[fieldName]) {
				let referenceObject = fieldNameToMetadata[fieldName].referenceTo.length > 1
					? await getSourceDb().sObjectTypeById(record[fieldName])
					: fieldNameToMetadata[fieldName].referenceTo[0];
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