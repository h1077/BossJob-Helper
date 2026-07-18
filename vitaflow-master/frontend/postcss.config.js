export default {
  plugins: {
    "@tailwindcss/postcss": {},
    "postcss-preset-env": {
      stage: 2,
      features: {
        'nesting-rules': true,
        'cascade-layers': true,
      }
    },
    autoprefixer: {},
  },
}
