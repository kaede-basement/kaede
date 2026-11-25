import { compileScript, parse } from "vue/compiler-sfc";

Bun.plugin({
  "name": "vue-component-setup",
  setup(build) {
    build.onLoad({ "filter": /\.vue$/ }, async ({ path }) => {
      const { descriptor } = parse(await Bun.file(path).text(), { "filename": path });

      return { "contents": compileScript(descriptor, { "id": path }).content, "loader": "ts" };
    });
  },
});
