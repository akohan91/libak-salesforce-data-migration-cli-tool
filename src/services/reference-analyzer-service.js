import { getArgs, getConnection } from "../cli.js";
import { Database } from "./database.js";
import { SoqlBuilder } from "./soql-builder.js";

export class ReferenceAnalyzerService {
	constructor(treeConfig) {
		this._treeConfig = structuredClone(treeConfig);
		this._objectTypeToSourceRecords = {};
		this._sourceDataBase = new Database(getConnection(getArgs().sourceOrg));
		this._sObjectFieldNameToMetadata = new Map();
	}

	async analyzeReferences() {
		console.log('📥 Analyzing references for provided treeConfig...');
		await this._analyzeReferences(this._treeConfig);
		console.log(this._sObjectFieldNameToMetadata);
		console.log(new Set(this._sObjectFieldNameToMetadata.values()));
		console.log('✅ Analyzing references completed successfully');
	}

	async _analyzeReferences(treeConfig) {
		const soql = await new SoqlBuilder(this._sourceDataBase, treeConfig).buildSOQL();
		if (!soql) {
			return;
		}
		const records = await this._sourceDataBase.query(soql);
		treeConfig = this._addTreeConfigRecordIds(treeConfig, records);

		const sObjectMetadata = await this._sourceDataBase
			.sObjectDescribe(treeConfig.apiName);
		const fieldNameToMetadata = sObjectMetadata.fields
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
			for (const fieldName in fieldNameToMetadata) {
				if (fieldName !== 'RecordTypeId') {
					if (record[fieldName]) {
						let referenceObject = fieldNameToMetadata[fieldName].referenceTo.length > 1
							? await this._sourceDataBase.sObjectTypeById(record[fieldName])
							: fieldNameToMetadata[fieldName].referenceTo[0];
						this._sObjectFieldNameToMetadata.set(
							`${treeConfig.apiName}.${fieldName}`,
							referenceObject
						);
					}
				}
			}
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
}