import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: [".next/**", "out/**", "node_modules/**", ".claude/**", "next-env.d.ts"],
  },
];

export default config;
