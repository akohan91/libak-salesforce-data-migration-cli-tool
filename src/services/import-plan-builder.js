import { writeFileSync } from 'fs';

export class ImportPlanBuilder {
	constructor() {
		this.maxDepth = 0;
	}

	writeImportPlanFile(config) {
		const leveledItems = this._buildImportPlan([config]).flat(Infinity);
		let result = [];
		for (let i = 1; i <= this.maxDepth; i++) {
			result = [...result, ...leveledItems.filter(item => item.level === i)];
		}
		result = result.map(item => {
			delete item.level;
			return item;
		});
		writeFileSync(
			`./_output/_import-plan.json`,
			JSON.stringify(result, null, 4)
		);
	}

	_buildImportPlan(configs = [], currentDepth = 1) {
		if (configs?.length) {
			this.maxDepth = this.maxDepth >= currentDepth ? this.maxDepth : currentDepth;
			return configs.map(config => {
				return [{
					sobject: config.apiName,
					files: [`${config.apiName}.json`],
					level: currentDepth
				}, ...this._buildImportPlan(config.children, currentDepth + 1)]
			});
		}
		return configs;
	}
}
