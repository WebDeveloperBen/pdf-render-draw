// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt(
  // Your custom configs here
  {
    files: ["**/*.spec.ts", "**/*.spec.js", "**/*.vue"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "vue/html-self-closing": "off",
      "import/first": "off",
      "vue/require-default-prop": "off"
    }
  }
)
