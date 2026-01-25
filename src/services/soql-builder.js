export class SoqlBuilder {
	constructor(database, treeConfig) {
		this._database = database;
		this._treeConfig = structuredClone(treeConfig);
	}

	async buildSOQL() {
		const fieldsStr = (await this._getFields(this._treeConfig.apiName)).join(',');
		const recordIdList = this._treeConfig.referenceField
			? this._treeConfig?.parentRecordIds.map(id => `'${id}'`).join(',')
			: this._treeConfig?.recordIds.map(id => `'${id}'`).join(',');
		
		if (!recordIdList?.length) {
			return null;
		}

		return `
		SELECT ${fieldsStr}
		FROM ${this._treeConfig.apiName}
		WHERE ${this._treeConfig.referenceField || 'Id'} IN (${recordIdList})` + 
		(this._treeConfig.externalIdField ? ` AND ${this._treeConfig.externalIdField} != NULL` : '');
	}

	async _getFields(sObjectApiName) {
		const sObjectMetadata = await this._database.sObjectDescribe(sObjectApiName);
		
		return sObjectMetadata.fields
			.filter(field => {
				if (field.type === 'id') {
					return true;
				}
				if (!field.createable || this._treeConfig.excludedFields?.includes(field.name)) {
					return false;
				}
				return true;
			})
			.map(field => field.name);
	}
}