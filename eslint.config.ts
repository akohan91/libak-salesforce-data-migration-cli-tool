import globals from "globals";
import tseslint from "typescript-eslint";
import markdown from "@eslint/markdown";

export default [
	{
		files: ["**/*.{ts}"],
		languageOptions: { globals: globals.browser }
	},
	...tseslint.configs.recommended.map(config => ({
		...config,
		rules: {
			...config.rules,
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-expressions": "off",
		}
	})),
	{
		files: ["**/*.md"],
		plugins: { markdown },
		language: "markdown/gfm",
	},
];