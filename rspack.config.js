const { defineConfig } = require("@meteorjs/rspack");

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the `Meteor` object, such as:
 * - `Meteor.isClient` / `Meteor.isServer`
 * - `Meteor.isDevelopment` / `Meteor.isProduction`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */
module.exports = defineConfig((Meteor) => {
  return {
    module: {
      rules: [
        // Run PostCSS on imported CSS so Tailwind directives are compiled.
        {
          test: /\.css$/i,
          type: "css",
          use: ["postcss-loader"],
        },
        // Add support for importing SVGs as React components
        {
          test: /\.svg$/i,
          issuer: /\.[jt]sx?$/,
          use: ["@svgr/webpack"],
        },
      ],
    },
  };
});
