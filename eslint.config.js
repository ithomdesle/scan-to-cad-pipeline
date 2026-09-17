import eslint from "@eslint/js";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "func-style": ["error", "expression"],
      "no-restricted-syntax": [
        "error",
        { selector: "TSEnumDeclaration", message: "Use createEnum from shared/types/enum.types." },
        { selector: "UnaryExpression[operator='delete']", message: "The delete operator is forbidden." },
      ],
    },
  },
  { ignores: ["dist/**", "node_modules/**"] },
);
