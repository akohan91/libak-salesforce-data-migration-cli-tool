import { execSync } from 'child_process';
import { program }  from 'commander';
import jsforce from 'jsforce';
import { Database } from './services/database.js';

let _argNameToValue = null;
let _connections = {};
let _sourceDb = null;
let _targetDb = null;

export const initArguments = () => {
	program
		.option('-s, --source-org <name>', 'Organization from where the data comes.')
		.option('-t, --target-org <name>', 'Organization to where the data comes.')
		.option('-e, --export-config <name>', 'Path to the import configuration file')
		.option('-a, --analyze-references', 'Runs the reference analyzer.')
		.option('-d, --debug', 'Runs in the debug mode.')
		.parse(process.argv);
	_argNameToValue = program.opts();
};

export const getArgs = () => {
	return _argNameToValue;
};

export const connectToOrgs = () => {
	const sourceLoginConfig = JSON.parse(execSync(
		`sf org display --target-org ${getArgs().sourceOrg} --verbose --json`,
		{ encoding: 'utf-8' }
	)).result;
	_connections[getArgs().sourceOrg] = new jsforce.Connection({
		instanceUrl: sourceLoginConfig.instanceUrl,
		accessToken: sourceLoginConfig.accessToken
	});
	
	const targetLoginConfig = JSON.parse(execSync(
		`sf org display --target-org ${getArgs().targetOrg} --verbose --json`,
		{ encoding: 'utf-8' }
	)).result;
	_connections[getArgs().targetOrg] = new jsforce.Connection({
		instanceUrl: targetLoginConfig.instanceUrl,
		accessToken: targetLoginConfig.accessToken
	});
};

export const getConnection = (orgAlias) => {
	return _connections[orgAlias];
}

export const getSourceDb = () => {
	if (!_sourceDb) {
		_sourceDb = new Database(getConnection(getArgs().sourceOrg));
	}
	return _sourceDb;
}

export const getTargetDb = () => {
	if (!_targetDb) {
		_targetDb = new Database(getConnection(getArgs().targetOrg));
	}
	return _targetDb;
}