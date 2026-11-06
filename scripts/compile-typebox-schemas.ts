/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";

import type { TSchema } from "typebox";
import { Code } from "typebox/compile";

import {
  AccountSchema,
  ConfigSchema,
  ExtensionMetadataSchema,
  InstanceMetadataSchema,
  PatchMetaSchema,
} from "../src/lib/schemas/types";

const fileDirectory: string = path.join(import.meta.dirname, "../src/lib/schemas/generated");
const filePath:  string = path.join(fileDirectory, "validators.ts");

const schemas: Array<{
  "name"  : string;
  "schema": TSchema;
}> = [
  { "name": "CheckAccount", "schema": AccountSchema },
  { "name": "CheckConfig", "schema": ConfigSchema },
  { "name": "CheckExtensionMetadata", "schema": ExtensionMetadataSchema },
  { "name": "CheckInstanceMetadata", "schema": InstanceMetadataSchema },
  { "name": "CheckPatchMeta", "schema": PatchMetaSchema },
];

/**
 * Compiles a TypeBox schema into a clean validation module
 * without bundling the TypeBox runtime, assuming the schema itself
 * does not require such a runtime, which is easily provable in dev mode
 * (if the schemas require such a runtime, then there will reference errors)
 *
 * @param schema - a TypeBox schema that will be compiled
 * @param name   - a label for the schema that will be printed
 *
 * @returns a compiled TypeScript code as an ES Module (ESM)
 */
function compileSchema(schema: TSchema, name: string): string {
  const startTime = performance.now();
  const compiledResult = Code(schema);
  const totalTime = (performance.now() - startTime).toFixed(2);
  const externalLength = compiledResult.External.variables.length;

  if (externalLength > 0) {
    throw new Error(`Found ${externalLength} external variables for '${name}'`);
  }

  console.log(`Successfully compiled a schema for '${name}' in ${totalTime} ms`);

  return compiledResult.Code;
}

/**
 * 'Code(Schema)' generates a standalone ESM validation code for 'Schema'
 * while always importing several modules (e.g., 'Hashing' from 'typebox/system')
 * that are unused for our existing schemas, also adding an 'External' array
 * variable that is used when the schema uses some complex type representations.
 *
 * Therefore, we (1) strip everything before the actual validation function
 * (that is always named as 'check_0') away, which we rename into a proper
 * export name, like 'CheckAccount' or 'CheckExtensionsMetadata', and
 * (2) ensure if the 'External' array (that is also available in the returned
 * object of 'Code(Schema)') is empty
 *
 * @param compiled - a compiled ESM validation code
 * @param name     - a label for the schema that will be used as a function name
 *
 * @returns
 */
function rewriteCompiled(compiled: string, name: string): string {
  const functionIdentifier = "check_0";
  const validatorIndex = compiled.indexOf(functionIdentifier);

  if (validatorIndex === -1) {
    throw new Error(`Could not find a 'check_0' function for '${name}'`);
  }

  // The 'check_0' arrow function declaration is always a one-liner
  const [declarationLine] = compiled
    // Remove everything until the assignment operator (whitespace before '=' remains)
    .slice(validatorIndex + functionIdentifier.length)

    /*
     * Since there is also a separate function declaration after the validator,
     * which is always located on the next lines, we split the string into an array
     * of lines, and then take the first line as the validator declaration line
     */
    .split("\n");

  // Becomes 'export const CheckAccount = ((value) => (...));'
  return `export const ${name}${declarationLine}`;
}

async function generateValidators(): Promise<void> {
  const generatedContents: Array<string> = `
// eslint-disable unicorn/no-abusive-eslint-disable
/* eslint-disable */
// @ts-nocheck

/*
 * This is a generated file (see 'scripts/compile-typebox-schemas.ts')
 *
 * Instead of compiling TypeBox validators at runtime, we compile them ahead-of-time.
 * This allows us not to bundle a TypeBox runtime in the main bundle. If the validator
 * concludes that the input is invalid, then the TypeBox runtime is lazily imported
 * to show the exact reason the input did not pass the validation.
 *
 * - Schemas are taken from:         'src/lib/schemas/'
 * - Recompile the validators using: 'bun generate:validators'
 *
 * ⣿⣿⠿⣫⡴⠋⠁⠥⢁⣀⣀⣐⣬⣤⣤⣤⣀⣀⣀⠔⠈⠐⡀⠀⠀⢀⡘⣿⣿⣿
 * ⢟⣥⡾⣋⣤⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣟⣿⣿⣿⣿⣿⣶⣶⣤⣊⡁⠀⢻⣿⣿
 * ⡿⢫⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢯⡿⣿⣿⡿⡇⣿⣧⠘⣿⣿
 * ⣱⣿⣿⣿⡟⣿⣿⣿⣿⡿⣟⡿⣋⣟⣿⣟⣿⣳⡿⢩⡿⣿⣯⣿⠃⣾⣿⣇⢿⣿
 * ⣿⡿⣯⣿⢡⣿⠽⣞⣛⣭⣵⡎⣾⣿⣟⣿⣽⠟⠡⣽⣷⡹⣿⠏⣀⢿⣿⣿⢸⣿
 * ⣿⢿⣿⡇⢸⣿⣿⣿⣿⣿⡟⢸⣿⣿⡿⡿⠋⣠⣿⡿⢋⡿⢈⡸⢿⡸⢿⣿⡎⣿
 * ⠿⠛⠛⠃⠈⠩⠍⠬⠭⠉⢃⣘⣓⡛⣫⠞⠵⣛⣭⣦⣭⣾⣿⣿⣷⣦⠘⣿⣧⢹
 * ⡜⣀⣤⣤⡤⠀⡀⢀⠀⢀⠀⢀⣿⣿⣿⣿⣿⣿⠃⠒⠒⠒⠊⠩⠿⠿⣧⡹⣟⡌
 * ⠆⣿⣿⡟⣀⣨⣐⣁⣊⣄⣣⢸⣿⣿⣿⣿⣿⣿⣶⣶⣶⠖⠀⡄⢀⠀⠀⠀⠈⠋
 * ⢸⣿⣿⠱⣯⢟⣽⡻⣽⡻⢇⣾⣿⣿⣿⣿⣿⣿⣿⣟⢣⣀⣱⡈⠆⡱⢈⠄⡂⢰
 * ⣸⡽⡞⡨⢷⡻⢮⣽⠳⣫⣾⣿⣿⣿⣿⣿⣿⣿⣿⣟⠄⣿⣹⣽⣻⢶⡶⣬⢄⣾
 * ⣟⣼⢣⢾⡰⢯⣷⣶⣿⣿⣿⣿⣿⣿⡿⠿⠿⢿⣿⣯⡦⡱⠿⠮⠯⠗⣛⣵⢿⢇
 * ⣎⣡⡿⣴⣽⣻⣽⣿⣿⣿⡉⠉⠀⠀⠀⠀⠀⠀⠻⣿⣿⢷⣖⢫⡷⡺⣥⢫⢏⡼
 * ⣿⣿⣽⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠠⢁⢈⢄⡒⠁⣿⣿⣿⣦⡟⠁⣓⣢⣵⠿⣳
 * ⡊⡛⠿⢿⡿⣿⢿⢿⡿⣿⣿⢿⣷⣄⣀⠥⠒⠬⢁⣿⣿⣿⣷⣿⣷⣶⡖⣴
 */
`.split("\n");

  for (const { schema, name } of schemas) {
    const compiled:  string = compileSchema(schema, name);
    const rewritten: string = rewriteCompiled(compiled, name);

    generatedContents.push("// @ts-ignore", rewritten, "");
  }

  const fileContents = generatedContents
    .join("\n")
    .trim();

  // Make sure the directory exists before writing a file there
  await fs.mkdir(fileDirectory, { "recursive": true });
  await fs.writeFile(filePath, fileContents, { "encoding": "utf8" });

  return console.log(
    `Successfully wrote ${schemas.length} schemas to '${filePath}' (${fileContents.length} chars)`,
  );
}

generateValidators()
  .then(() => {
    console.log(`
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⣫⣭⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣭⣉⡉⢉⣥⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⣩⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣬⡙⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⢋⣴⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢿⣿⣶⣌⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⡟⢉⣤⣌⠛⡛⠋⣡⠐⣿⣿⡿⢋⣼⣿⡿⢿⣿⣿⣿⣿⣿⣿⣿⡿⢃⣼⣿⣿⡿⣿⣿⣿⣿⣿⣿⣿⣿⣧⡙⢿⣿⣿⣿⣆⢻⣿⣿⣿⣌⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣇⢻⣿⢋⣤⡄⣘⠓⠠⠿⠿⢡⣿⣿⡿⢣⣾⡟⣰⣿⣿⣿⣿⡿⢡⢂⣿⣿⣿⢁⠹⣿⣿⣿⣿⣿⡟⣽⣿⡙⣌⢻⣿⣿⣷⠀⣝⣻⣿⣿⣷⡌⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⠿⣿⠈⠛⠀⣡⡄⠀⠿⠀⢽⣿⡿⢡⣿⡟⣰⣿⣿⢻⣿⣿⠁⡎⢸⣿⣿⡿⠰⣧⢻⣿⣿⣿⡿⣷⠘⣿⣷⡸⣧⢻⣿⣿⣧⠘⣿⣿⣿⣿⣿⣦⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣤⣁⣤⣶⣶⣷⣦⠉⣱⠆⠀⠈⢀⣿⣶⣿⣿⢣⣿⣿⠃⣾⣿⠃⣸⠀⢸⣿⣿⡇⢢⠹⡄⡹⣿⣿⣧⣘⣣⡙⢻⣇⠘⣆⢻⣿⣿⣆⠸⣿⣿⣿⣿⣿⣆⢹⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⡟⠀⠸⠀⢀⣠⣾⣿⣿⣿⡇⣼⣿⠏⣾⣿⣿⢠⣿⠀⢸⣿⣿⡇⣿⠁⢁⢸⣿⣿⣿⣿⣿⣿⣆⢿⠀⢹⡆⣿⣿⣿⡄⠹⣿⣿⣿⣿⣿⣇⢻⣿⣿⣿⣿⣿⣿⣿
⢿⣿⣿⣿⣿⣿⡏⣴⠇⢀⠠⠄⠈⣿⣿⣿⣿⢰⣿⠃⣼⣿⣿⡇⢸⡏⣠⢸⣿⣿⣧⢻⣇⠂⠈⣿⣿⣿⣿⣿⣿⣿⢸⡇⡇⢻⢸⣿⣿⣷⠀⢿⣿⣿⣿⣿⣇⡄⢿⣿⣿⣿⣿⣿⣿
⣳⣬⣿⣛⠋⣿⡄⠿⠄⣁⡀⢀⣴⣿⣿⣿⡿⣸⠇⣴⣿⣿⣿⠀⢸⣇⢿⡘⣿⣿⣿⢸⣿⡄⠀⣿⣿⣿⣿⣿⣿⣿⠘⣷⢳⠸⣆⠹⣿⣿⣇⠸⣿⣿⣿⣿⣿⢠⠸⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣷⠈⢩⣷⣾⣿⢀⣼⣿⣿⣿⣿⠇⡗⢰⣿⣿⣿⡿⢀⡸⣿⢸⡇⢻⣿⣿⡌⣿⣧⠀⢻⣿⣿⣿⣿⣿⣿⠀⣿⠘⠀⣿⣷⡘⢿⣿⡄⢹⣿⣿⣿⣿⠀⠇⣿⣿⣿⣿⣿⣿
⣿⣿⣿⡿⣃⣾⡇⠛⠿⠃⣾⣿⣿⣿⣿⣿⠀⢰⣿⣿⣿⡿⢡⣾⡇⢻⡎⢿⡘⢿⣿⣧⢻⣿⡌⢸⣿⣿⣿⣿⣿⣿⠀⠟⣰⠆⢿⣿⣷⡌⢿⣧⢸⡇⢻⣿⣿⠀⠀⢹⣿⣿⣿⣿⣿
⣿⠟⠣⣾⣿⣿⡇⢀⠻⠖⣸⣿⣿⣿⣿⣿⢀⣿⣿⣿⠏⣴⣿⣿⣇⡈⠿⠼⣷⡌⣿⣿⣄⢿⡇⢸⣿⣿⣿⣿⣿⠁⢰⠎⣿⢡⣸⣿⡿⠟⠂⢻⡄⣿⠈⢿⣿⢰⡇⠘⣿⣿⣿⣿⣿
⠀⢴⠾⣿⠿⢋⣴⣿⠀⢀⣿⣿⣿⣿⣿⡗⢸⣿⡟⣡⣾⣿⣿⣿⣿⣿⣌⣳⣶⣤⣄⡰⠿⠘⠇⣿⣿⣿⣿⠿⢋⣤⣸⣼⣧⣾⠟⠉⠀⠀⣀⣌⢣⣿⣾⣦⡋⣾⡇⢰⣿⣿⣿⣿⣿
⣷⡦⢤⣀⣂⣈⣐⡠⠀⠀⣿⣿⣿⣿⣿⣿⠸⣫⣆⠘⠛⠛⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣶⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⢠⣴⣿⣿⣿⡌⢸⣏⡿⢡⣿⠃⣾⣿⣿⣿⣿⣿
⡛⠻⣶⣭⣭⣛⠋⠴⠃⢰⣿⣿⣿⣿⣿⣿⢰⣿⣧⣄⣀⡀⠀⠀⠀⠈⠉⠙⠛⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠁⠀⠀⠀⠉⠉⠉⠉⠙⠛⠛⠘⠛⡃⠚⠁⠘⠿⣿⣿⣿⣿⣿
⡙⢳⣾⣿⡿⠃⡶⢹⣿⠃⣿⣿⣿⣿⣿⣿⢸⣿⣿⣿⣿⣿⣿⣿⠶⠒⠂⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⠿⠛⠛⣋⣁⣩⣤⣶⣶⣶⣿⣿⣿⣿⡿⠛⣠⣴⣾⣿⣿⣿⣦⡙⢿⣿⣿
⣷⣿⣿⣿⢆⣾⠇⡾⢸⡆⣿⣿⣿⣿⡅⣿⠈⣿⡿⠿⠛⠉⠁⠀⠀⢀⣀⣠⣴⣶⣿⣿⣿⣿⣿⡏⠁⣦⡾⠿⠟⠛⣋⣽⣿⣿⣿⣿⣻⣿⣿⠋⢠⣾⣿⣿⣿⠟⢋⣉⡙⢿⣆⢻⣿
⣿⣿⣿⡟⣸⡿⠸⢃⣿⣇⢿⣿⣿⣿⡇⠻⢃⣩⣷⠀⢀⣠⢤⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⡏⢁⣾⣿⠿⣿⣿⡿⠿⠿⠿⢿⡿⠁⢠⣿⣿⣿⠟⣡⣾⣿⣿⣿⡄⣿⡆⣿
⣿⣿⣿⢀⣿⠁⢠⣾⣿⡇⠸⣿⣿⣿⣿⢠⡘⠿⠯⠿⠟⢋⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⣷⣼⣩⣴⣶⣾⣷⣶⣶⣶⣶⣶⡆⠄⣾⣿⣿⢇⣾⣿⣿⡿⣿⣿⡇⣾⣷⢹
⣿⣿⢇⣾⠇⢠⣾⣿⣿⣿⠀⣿⣿⣿⣿⠸⣿⠰⣶⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⢻⣿⡇⣼⣿⣿⠃⠀⣾⣿⠁⣿⣿⣸
⣿⠏⣼⡟⣰⣿⣿⣿⣿⣿⡆⢹⣿⣿⣿⡆⠸⣇⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠘⠛⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⢿⣿⡇⣿⣿⡇⣶⣿⣿⢃⣼⣿⡇⣿
⡟⣴⣟⣴⣿⣿⣿⣿⣿⣿⠇⡄⣿⣿⣿⣷⠀⢻⡆⢉⡛⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⡄⣀⡀⠀⠀⠀⣈⡉⠉⠛⠛⠻⠅⠘⠇⣠⣿⣿⣷⣬⣩⣴⣿⣿⠟⢱⣿
⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⢀⡇⠘⣿⣿⣿⣧⠀⠻⡌⢿⣿⣶⣦⣤⣍⣙⣛⠛⠛⠛⠻⠿⠿⠿⠿⠿⠟⢛⢛⣉⣄⡐⣤⣤⣈⣀⠀⠀⠀⠀⠀⠘⢿⣷⣤⣍⣙⣫⣭⣴⠞⣰⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⠏⣼⠇⣦⠹⣿⣿⣿⣆⢠⡹⡌⠛⣩⣄⠀⠐⣦⣭⣤⣦⡛⢿⣶⣶⣥⡄⢨⣥⣄⠈⠉⢉⡛⠦⡙⢿⣿⣿⡔⣶⠆⡤⣤⢀⣉⠛⠛⠛⠛⣋⣵⣾⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⠏⡀⡟⢸⣿⣧⡹⣿⣿⣿⣆⢻⢊⠂⠻⣿⣎⢀⡘⣿⣿⣿⣿⣶⣬⠙⠭⣧⢸⡿⢿⣷⣔⣶⡙⢷⡘⢦⣝⠻⣿⡎⠛⣤⠘⣸⡏⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⡿⠋⣰⠣⣠⣿⣿⣿⣷⡘⢿⣿⣿⣆⠻⣷⣥⡙⢿⡄⡀⠘⢛⡿⠟⠉⠁⣨⣀⠈⠠⠀⠐⠀⢻⣿⠷⠌⢿⡌⣿⣷⠌⠁⣌⢿⢀⢟⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣟⣤⣴⡏⢠⣿⣿⣿⣿⣿⡿⢠⣙⠿⣿⣧⡘⢿⣿⣷⣄⠁⣀⣘⡡⠄⣚⣤⠹⣧⠘⠉⠀⠀⠧⠸⣷⣤⣤⡰⣽⡘⢿⣷⡐⣆⣁⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⡿⢿⣿⣿⣿⡿⡰⣿⣿⣿⣿⣿⣿⢃⣾⢋⣴⣦⣭⣍⣀⣩⣭⣿⡷⠆⢶⣶⣿⣿⣿⠆⠘⠃⠀⠄⢀⣴⠖⢈⣿⣿⣷⡌⢳⣦⠛⢧⠹⣿⣦⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
`);
  })
  .catch(error => {
    console.error(`An error happened while generating validators: ${error}`);
  });
