[<<< Back](../docs/README.md#contributing)

- [README for TypeScript-related code](../src/README.md)
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- Viewing MultiMC Patch System

# MultiMC Patch System

The MultiMC patch system is a complex, yet convenient way to manage Minecraft launching with various mod loaders.

## Prerequisites

Initially, I wanted to write the code parts as a pseudocode following the [CLRS conventions](https://course.ccs.neu.edu/cs3000/resources/latex_pseudocode.pdf). However, it would have taken plenty of time, so this walkthrough will only feature TypeScript. To make it easier for one to understand type schemas, they need to know:

- The `?` symbol represents an optional field.
- The `|` symbol represents logical `OR`.
- The `&` symbol represents logical `AND`.

Despite `|` and `&` being called 'Union' and 'Intersection' types, respectively, they do **not** represent the Set operators:

```ts
type First = { "a": number } | { "b": string };
// Implies:
const first_1: First = { "a": 10 };
// Also implies:
const first_2: First = { "b": "Eden Treaty" };
// However, does not imply this:
const first_3: First = { "a": 10, "b": "Decagrammaton" };

type Second = { "a": number } & { "b": string };
// Implies:
const second_1: Second = { "a": 0, "b": "Moondrop Aria" };
// However, does not imply this:
const second_2: Second = { "a": 0 };
```

- The `[key: KeyType]: value` field is a value with the computed key name of a `KeyType` string literal. For example, `{ [key: "macos" | "linux"]: string }` is equivalent to:

```ts
type T = {
  "macos": string;
  "linux": string;
}
```

The `Partial<{ ... }>` type represents an object where all fields are optional.
That is, all fields could be missing. For example, `Partial<{ [key: "macos" | "linux"]: string }>` implies:

```ts
type T_1 = {
  // Or "linux": string;
  "macos": string;
};
// It also implies this type:
type T_2 = {
  "macos": string;
  "linux": string;
};
// Can also be an empty object.
```

## How to think of MultiMC patches

Before one starts the coding part, they should understand what to expect from patches.

As stated by Ryan[^1], the Prism Launcher meta server is generating JSON patches from multiple sources. These sources can have completely different library and asset structures. Bringing such format mismatches to one consistent response type is challenging. Thus, one will stumble upon many inconsistencies when handling MultiMC patches.

The MultiMC patch is a JSON file that represents the information needed to handle the current patch. The patch system aims to simplify the installation and launching parts of Minecraft. Each patch can specify dependency or conflicting patches (although the latter one seems to be rare). Dependencies are just another patches, so each dependency can have its own dependencies too.

It is possible that the correct way to navigate these patches is to:
 
- resolve the entry patch, patch dependencies, and all sub-dependencies;
- collect the resolved patches in the array;
- build the final patch, starting from sub-dependencies and ending with the entry patch.

Following the described way to navigate MultiMC patches, let us briefly understand how to apply this algorithm. For now, consider the version of a Minecraft patch to be `1.21.11` and the version of a Fabric loader patch to be `0.18.4`. The entry patch UID for Fabric is `net.fabricmc.fabric-loader`. It depends on a `net.fabricmc.intermediary` patch:

```json5
{
  // Other fields...
  "requires": [
    {
      "uid": "net.fabricmc.intermediary"
    }
  ]
}
```

The `net.fabricmc.intermediary` patch version should equal the Minecraft patch version. Thus, we can resolve this patch and obtain another array of dependencies:

```json5
{
  // Other fields...
  "requires": [
    {
      "equals": "1.21.11",
      "uid": "net.minecraft"
    }
  ]
}
```

This is a Minecraft patch. When we resolve its metadata, we get another dependency:

```json5
{
  // Other fields...
  "requires": [
    {
      "suggests": "3.3.3",
      "uid": "org.lwjgl3"
    }
  ]
}
```

Luckily, the `org.lwjgl3` patch does not have any dependencies. Now, these resolved patches should be assembled into one final patch as was previously explained:

- Write the data from `org.lwjgl3:3.3.3` (dependency of `net.minecraft:1.21.11`) into an object.
- Overwrite the object using data from `net.minecraft:1.21.11` (dependency of `net.fabricmc.intermediary`).
- Overwrite the object using data from `net.fabricmc.intermediary` (dependency of `net.fabricmc.fabric-loader`).
- Overwrite the object using data from `net.fabricmc.fabric-loader` (entry patch).

The overwrite process follows next logic:

- In case of array-typed conflicting fields, merge them.
  - The merge process is not as simple as just pushing the element into an array. The next sections will explain it in details.
- In case of other types of conflicting fields, overwrite them.

The final patch can be used to download artifacts and launch the game. It may not have necessarily the MultiMC structure. One could implement their own format and parse all patches into that format.

For example, I implemented the final patch structure like this:

```ts
type FinalizedPatchType = {
  "+jvmArgs"          : Array<string>;
  "+traits"           : Array<string>;
  "+tweakers"         : Array<string>;
  "artifacts"         : Array<MappedArtifactType>;
  "mainClass"         : string;
  "minecraftArguments": string;
  "assetIndex"        : {
    "id"        : string;
    "sha1"      : string;
    "size"      : number;
    "url"       : string;
    "totalSize"?: number;
  } | undefined;
  "type"              : "release" | "snapshot" | "experiment" | "old_alpha" | "old_beta" | "old_snapshot" | undefined;
  "client"            : MappedArtifactType | false;
  "logging"           : (MappedArtifactType & {
    "argument": string;
  }) | false;
};
type MappedArtifactType = {
  "id"       : string;
  "path"     : string;
  "file"     : string;
  "directory": string;
  "url"      : string;
  // 'ignore' is used only when the hash is unknown
  "hash"     : string | "ignore";

  /**
   * 'library' should be both downloaded and included in the classpath
   * 'mavenFile' should be only downloaded
   * 'native' should be downloaded and extracted but not included in the classpath
   */
  "status"?: "library" | "mavenFile" | "native";

  /*
   * Indicates the '+libraries' field in MultiMC patches.
   * Should be specified the first in classpaths
   */
  "first"?: boolean;
};
```

Due to this section being a short explanation, I omitted the majority of important information. The actual final patch assemble is explained in the next sections.

## An in-depth structure of the MultiMC patch system

Since now one should have a surface-level understanding of the MultiMC patch system, they can dive deeper.

### Patch index files

> URL format: `https://meta.prismlauncher.org/v1/${uid}`

Now, let us start with the actual response types. This is a TypeScript type schema for the patch index files, the JSON files that contain available versions of the patch:

```ts
type PatchIndexType = {
  // Currently, equals to one
  "formatVersion": number;

  // A human-readable name of the patch
  "name": string;

  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid": PatchUIDType;

  // An array of available patches that are sorted from latest to oldest versions
  "versions": Array<PatchIndexVersionType>;
};
type PatchUIDType =
  "com.azul.java" |
  "com.mumfrey.liteloader" |
  "net.adoptium.java" |
  "net.fabricmc.fabric-loader" |
  "net.fabricmc.intermediary" |
  "net.minecraft" |
  "net.minecraft.java" |
  "net.minecraftforge" |
  "net.neoforged" |
  "org.lwjgl" |
  "org.lwjgl3" |
  "org.quiltmc.quilt-loader";
```

The patch index type appears to always have this format.

The version entries have the next type schema:

```ts
type PatchIndexVersionType = {
  // Whether this version is a recommended one.
  // In Prism Launcher, stars in the version select menu represent this field
  "recommended": boolean;

  // The version release time in the ISO 8601 string format
  "releaseTime": string;

  // A SHA-256 hash that the provided JSON file for this patch version should have
  "sha256": string;

  // A version string, e.g. '26.1-snapshot-2'
  "version": string;

  // An array of conflicted patches. Might be missing
  "conflicts"?: Array<PatchDependencyType>;

  // An array of required patches, i.e. dependencies. Might be missing
  "requires" ?: Array<PatchDependencyType>;

  // Used not only in the 'net.minecraft' patches, but in others too. Might be missing
  "type"?: "release" | "snapshot" | "experiment" | "old_alpha" | "old_beta" | "old_snapshot";

  // No clue. Might be missing, but present in 'net.fabricmc.intermediary'
  "volatile"?: boolean;
};
```

Where `PatchDependencyType` looks like this:

```ts
type PatchDependencyType = {
  // A unique identifier of the dependency
  "uid": PatchUIDType;

  // A version of the dependency that should be selected. Might be missing
  "equals"?: string;

  // A version of the dependency that is recommended. Might be missing
  "suggests"?: string;
};
```

The patch index files are usually used on Minecraft instance creation. They are not needed in the installation and launching parts.

### Version-specific patches

> URL format: `https://meta.prismlauncher.org/v1/${uid}/${version}.json`

Now begins the longest part of the entire post ^^

The JSON files for version-specific patches diverse with each patch. This is what the final type looks like:

```ts
type SpecificPatchMetaType = {
  // Currently, equals to one
  "formatVersion": number;

  // A human-readable name of the patch
  "name": string;

  // The version release time in the ISO 8601 string format.
  // However, it should be noted that release time could be missing in custom patches,
  // i.e. 'org.mcphackers.launchwrapper'
  "releaseTime": string;

  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid": PatchUIDType;

  // A version string, e.g. '26.1-snapshot-2'
  "version": string;

  /** All the next fields could be missing. */
  // Perhaps, these are Java agents.
  // Specified at https://github.com/PrismLauncher/meta/blob/main/meta/model/__init__.py#L342
  "+agents"?: Array<{ "argument"?: string }>;

  // Should be an array of needed libraries for this patch.
  // However, there is no way to surely tell the differences between the 'libraries' field
  // (besides looking at Prism Launcher source code)
  "+libraries"?: Array<SpecificPatchLibraryType>;

  // This field contains a list of unique flags Prism Launcher uses when launching.
  //
  // So far, I have encountered next values:
  // - 'legacyLaunch'       // Appears to indicate the use of a legacy Java applet launcher in Prism
  // - 'XR:Initial'         // Present in versions with chat reports
  // - 'FirstThreadOnMacOS' // Tells to use the '-XstartOnFirstThread' JVM argument on macOS
  // - 'legacyServices'     // Old auth services (?)
  // - 'texturepacks'       // Shows that the version supports texture packs (?)
  // - 'no-texturepacks'    // Shows that the version does not support texture packs (?)
  //
  // There is also another format of traits, i.e. 'feature:*'.
  // They are usually present in newer versions. For now, there are only these options:
  // - 'feature:is_quick_play_singleplayer'
  // - 'feature:is_quick_play_multiplayer'
  //
  // Other possible values that I have not encountered:
  // - 'legacyFML'
  // - 'alphaLaunch'        // Used only in MultiMC (?)
  // - 'noapplet'           // Used only in MultiMC (?)
  "+traits"?: Array<string>;

  // An array of tweak classes to pass to the game arguments.
  // For example, the ['com.mumfrey.liteloader.launch.LiteLoaderTweaker', 'another_tweaker']
  // will be passed as
  // '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --tweakClass another_tweaker'
  "+tweakers"?: Array<string>;

  // An array of JVM arguments to add.
  // So far, I have encountered next values:
  // - '-Djava.util.Arrays.useLegacyMergeSort=true' // Present in ancient versions of Minecraft
  "+jvmArgs"?: Array<string>;

  // Seem to equal to the Mojang API response format. Points to the Minecraft assets index JSON file
  "assetIndex"?: SpecificPatchAssetIndexType;

  // An array of Java major versions that are compatible with the patch
  "compatibleJavaMajors"?: Array<number>;

  // Might represent the compatible Java vendor name.
  // Present in '12w07b' and can be 'jre-legacy'
  "compatibleJavaName"?: string;

  // An array of conflicting patches. Usually present in 'org.lwjgl' and 'org.lwjgl3'
  "conflicts"?: Array<PatchDependencyType>;

  // An array of needed libraries for this patch.
  // Seems to be the most complex part of Minecraft launching
  "libraries"?: Array<SpecificPatchLibraryType>;

  // "The logging configuration file to provide to log4j" [1].
  // Stored in '/assets/log_configs/', alongside with '/assets/indexes/' and '/assets/objects/' [2]
  "logging"?: SpecificPatchLoggingType;

  // "The main class to call in the execution of java" [1]
  "mainClass"?: string;

  // Points to the Minecraft client jar
  "mainJar"?: SpecificPatchMainJarType;

  // An array of needed libraries for this patch that should be downloaded
  // without being specified in classpaths.
  // However, if the library was also included in the 'libraries' field,
  // such library should be specified in classpaths
  "mavenFiles"?: Array<SpecificPatchLibraryType>;

  // A string with the game arguments. These arguments have placeholders that should be replaced,
  // such as '--username ${auth_player_name}', where '${auth_player_name}' is the player name.
  //
  // Some placeholders might not be replaced, and Minecraft will still launch.
  // Others always require to be replaced. One such case is the '${user_properties}' placeholder
  // that has an unknown purpose, yet requires to be a stringified version of a JSON object with... random values?
  "minecraftArguments"?: string;

  // Deprecated. Used to help to sort patches, apparently
  "order"?: number;

  // An array of dependencies of this patch. As was shown with the Fabric example, can go three levels deep
  "requires"?: Array<PatchDependencyType>;

  // An array of runtimes to download. Used by Java patches, i.e. 'com.azul.java'
  // This field is not needed for Minecraft downloading and launching part,
  // so we will stop here
  "runtimes"?: Array<{ /* ... */ }>;

  // Used not only in the 'net.minecraft' patches, but in others too
  "type"?: "release" | "snapshot" | "experiment" | "old_alpha" | "old_beta" | "old_snapshot";

  // No clue. Present in 'net.fabricmc.intermediary'
  "volatile"?: boolean;
};
```

It should be noted that as per MultiMC documentation[^3], the `+agents`, `+traits`, `+tweakers`, and `+jvmArgs` should have their equivalent fields with the `-` sign or without the `+` sign. However, I never found such cases.

The `SpecificPatchAssetIndexType` type schema is equal to:

```ts
type SpecificPatchAssetIndexType = {
  // Used for storing the index JSON file. Can be "27" or "pre-1.6"
  "id": string;

  // A SHA-1 hash that the downloaded JSON file should have
  "sha1": string;

  // The size of a JSON file in bytes
  "size": number;

  // Points to the assets index JSON file
  "url": string;

  // The total size of all asset objects in bytes. Might be missing
  "totalSize"?: number;
};
```

The `PatchDependencyType` type schema was defined previously, but let us see it again:

```ts
type PatchDependencyType = {
  // A unique identifier of the dependency
  "uid": PatchUIDType;

  // A version of the dependency that should be selected. Might be missing
  "equals"?: string;

  // A version of the dependency that is recommended. Might be missing
  "suggests"?: string;
};
```

The `SpecificPatchLoggingType` type schema is equal to:

```ts
type SpecificPatchLoggingType = {
  // A JVM argument that should be used (contains a placeholder to replace)
  "argument": string;

  // Turns out, the config file download format uses the same schema as the 'assetIndex' field
  "file": {
    // Used for storing the logging configuration JSON file
    "id": string;

    // A SHA-1 hash that the downloaded JSON file should have
    "sha1": string;

    // The size of a JSON file in bytes
    "size": number;

    // Points to the logging configuration JSON file
    "url": string;
  };

  // Usually equals to 'log4j2-xml'.
  // Perhaps, it could be used to parse Minecraft logs that are sent to console?
  // For example, old versions do not have the 'logging' field, thus their console output
  // is just raw lines of logs. But Minecraft versions that specify the 'logging' field
  // send to the 'stdout' and 'stderr' the XML-formatted logs (due to '<XMLLayout />')
  // (if we use the configuration file provided in the 'logging' field, of course).
  "type": string;
};
```

The `SpecificPatchMainJarType` type schema is equal to:

```ts
type SpecificPatchMainJarType = {
  "downloads": {
    "artifact": {
      // A SHA-1 hash that the downloaded jar file should have
      "sha1": string;

      // The size of a jar file in bytes
      "size": number;

      // Points to the main jar downloads
      "url": string;
    };
  };
  // This is where it gets tricky (see explanations in the next section)
  "name": string;
};
```

Finally, the `SpecificPatchLibraryType` type schema is equal to:

```ts
type SpecificPatchLibraryType = {
  // Explained in the next section
  "name": string;
  // An object with all the information for downloading the library.
  // If it is missing, consider the 'natives' or 'url' fields
  "downloads"?: {
    // A library to download.
    // In newer versions, can represent a native library (1.21.2)
    "artifact"?: {
      // A SHA-1 hash that the downloaded file should have
      "sha1": string;
      // A file size in bytes
      "size": number;
      // A URL for downloading the library
      "url": string;
      // Cannot remember/find what this represents and where it was.
      // Just ignore it
      "id"?: string;
      // A relative filepath to where you should download a library.
      // Honestly, I have no idea if you even should use this field.
      // I mean, if it is present, then it serves a purpose.
      // However, this field can be missing, and when it exists,
      // it will have the same path value that you will be able to obtain
      // in the next section ("Normalizing the artifact name")
      //
      // Example: 'net/neoforged/JarJarMetadata/0.4.1/JarJarMetadata-0.4.1.jar'
      "path"?: string;
    };
    // An additional native library to download for specified platforms (and arches).
    // Present in older versions (1.16.5)
    "classifiers"?: {
      // Same structure as in the 'artifact' field
      [key: SpecificPatchClassifierKeyType]: {
        "sha1": string;
        "size": number;
        "url": string;
        "id"?: string;
        "path"?: string;
      };
    };
  };
  // Seems like this field is not critical and can be ignored
  "extract"?: {
    // Directories to exclude extracting for.
    // For example, ["META-INF/"] means not to extract the 'META-INF' folder for this native.
    "exclude": Array<string>;
  };
  // Seem to list available natives for present platforms and arches
  "natives"?: Partial<{
    // The 'linux' key turns into 'natives-linux'.
    // Might have the 'SpecificPatchClassifierKeyType' typed value
    [key: SpecificPatchLibraryOSNameType]: string;
  }>;
  // A list of rules that should be applied for specified platforms (and arches)
  "rules"?: Array<SpecificPatchLibraryRuleType>;
  // A base URL for downloading this library.
  // Might be present only if the 'natives' and 'downloads' field are missing.
  // Sometimes this field has a URL that ends with a slash, sometimes not
  "url"?: string;
  // What the heck is this (can be 'always-stale' or 'local')
  "MMC-hint"?: string;
};
```

> [!IMPORTANT]
> Some libraries only specify the `name` field.
> In this case, use `https://libraries.minecraft.net` as a base URL for downloading that library.
> 
> Example:
> ```json
> {
>   "name": "net.sf.trove4j:trove4j:3.0.3"
> }
> ```

The library object has some new types:

```ts
type SpecificPatchLibraryRuleType = {
  "action": "allow" | "disallow";
  "os"   ?: {
    "name": SpecificPatchLibraryOSNameType;
  };
};
type SpecificPatchLibraryOSNameType =
  "linux" |
  "linux-arm32" |
  "linux-arm64" |
  "windows" |
  "windows-arm32" |
  "windows-arm64" |
  "osx-arm64" |
  "osx";
type SpecificPatchClassifierKeyType =
  "natives-linux" |
  "natives-linux-${arch}" |
  "natives-linux-arm32" |
  "natives-linux-arm64" |
  "natives-osx" |
  "natives-osx-${arch}" |
  "natives-osx-arm64" |
  "natives-windows" |
  "natives-windows-${arch}" |
  // But there is already 'natives-osx' ?????
  "natives-macos" |
  "natives-macos-${arch}" |
  "natives-macos-arm64" |
  // These exist too
  "natives-windows-32" |
  "natives-windows-64" |
  // The next literals are made up by me; never saw them, but they might exist
  "natives-windows-arm32" |
  "natives-windows-arm64" |
  "natives-windows-x64" |
  "natives-windows-x86" |
  "natives-windows-x86_64" |
  "natives-linux-32" |
  "natives-linux-64" |
  "natives-linux-x64" |
  "natives-linux-x86" |
  "natives-linux-x86_64" |
  "natives-osx-32" |
  "natives-osx-64" |
  "natives-osx-x64" |
  "natives-osx-x86" |
  "natives-osx-x86_64" |
  "natives-macos-32" |
  "natives-macos-64" |
  "natives-macos-x64" |
  "natives-macos-x86" |
  "natives-macos-x86_64";
```

### Normalizing the artifact name

The `name` field comes in this format: `<group>:<name>:<version>[:classifier][@extension]`.

> [!IMPORTANT]
> The `<name>` part can contain a `native` word. In such case, consider the `downloads` field to point to the native library download. The `classifiers` field will be missing

Examples:

- `com.mojang:text2speech:1.11.3`
- `net.java.dev.jna:platform:3.4.0`
- `ca.weblite:java-objc-bridge:1.1.0-mmachina.1` $\leftarrow$ `version` can be in any format, not just SemVer
- `io.netty:netty-transport-native-epoll:4.1.97.Final:linux-aarch_64` $\leftarrow$ `classifier` is just a platform with an arch. Possible literals:
  - `"windows-aarch_64"`
  - `"windows-x86_64"`
  - `"linux-aarch_64"`
  - `"linux-x86_64"`
  - `"osx-aarch_64"`
  - `"osx-x86_64"`
- `net.neoforged:neoform:1.21.2-20241022.151510@zip` $\leftarrow$ the `classifier` is missing, but `extension` is present. In this case, it equals to `zip`

The name string always has the `group`, `name`, and `version` parts. The `classifier` and `extension` parts are optional.

Parts are divided with a `:` symbol, except for `extension` - it is divided by the `@` symbol.

- The `group` string should be split by dots. The resulted array for `net.java.dev.jna` must look like this: `["net", "java", "dev", "jna"]`.
- The `name` and `version` strings should be left as they are.
- The `classifier` part might be parsed for more convenient platform and arch checks.
- The `extension` part is a file extension. If it is missing, use `jar`.

For the coding part, I would suggest following next actions:

1. Split the string by `@` (let us call it `Array_1`).
2. The `extension` part will be a second element of an `Array_1` (fallback to `jar` if it is undefined).
3. Split the first element of `Array_1` by `:` (let us call it `Array_2`).
4. Take the `group`, `name`, `version`, and (if defined) `classifier` parts from `Array_2`, respectively.
5. A filename can look like this: `${name}-${version}-${classifier}.${extension}`. If the classifier is undefined, it would look like this: `${name}-${version}.${extension}`. For example, the `com.mojang:text2speech:1.11.3` string will look like `text2speech-1.11.3.jar`.
6. For the file directory, you need to split the `group` part by `.` (let us call it `Array_3`).
7. Push back the `name` and `version` parts into `Array_3`.
8. Join the `Array_3` elements using a path separator. For example, the `com.mojang:text2speech:1.11.3` string will look like `com/mojang/text2speech/1.11.3`.
9. Now you have an artifact classifier, filename, and directory. The relative file path can be obtained by joining the file directory and filename.
10. **Important:** for the future libraries parsing process, also make an `id` variable in a `${group}:${name}` format.

You can also look at following code:

```ts
export function normalizeArtifactPath(artifact: string): {
  "directory" : string;
  "file"      : string;
  "classifier": SpecificPatchClassifierOSType | undefined;
  "id"        : string;
} {
  const prepared: Array<string> = artifact.split("@");
  const cleaned = prepared?.[0] ?? "";
  const extension = prepared?.[1] ?? "jar";
  const paths: Array<string> = cleaned.split(":");

  const group: string | undefined = paths?.[0];
  const name: string | undefined = paths?.[1];
  const version: string | undefined = paths?.[2];
  const classifier: string | undefined = paths?.[3];

  // The 'group', 'name', and 'version' elements should be always present
  if (!group || !name || !version) {
    const specifiedMessage: string =
      `(either group (${group}), name (${name}), or version (${version}) is missing)`;

    throw new Error(
      `Could not normalize artifact path ${specifiedMessage}`,
    );
  }

  const folders: Array<string> = [
    ...group.split("."),
    name,
    version,
  ];

  return {
    "directory": General.cachedJoin(...folders),
    "file"     : classifier === undefined
      ? `${name}-${version}.${extension}`
      : `${name}-${version}-${classifier}.${extension}`,
    "classifier": classifier as SpecificPatchClassifierOSType | undefined,
    // 'org.ow2.asm:asm-tree'
    "id"        : `${group}:${name}`,
  };
}
```

### Rule parsing

```ts
type SpecificPatchLibraryRuleType = {
  "action": "allow" | "disallow";
  "os"   ?: {
    "name": SpecificPatchLibraryOSNameType;
  };
};
```

If there are no rules, include the library.

Lin[^2] suggests to start from disallowing the library:

One should include the library if the OS name is missing. If it is present, then they should allow the library if the specified platform and arch are compatible (or if the specified platform is compatible and the arch is missing).

However, 

```json
{
  "name": "org.lwjgl:lwjgl-jemalloc-natives-windows-arm64:3.3.3",
  "rules": [
    {
      "action": "allow",
      "os": {
        "name": "windows"
      }
    },
    {
      "action": "allow",
      "os": {
        "name": "windows-arm64"
      }
    }
  ]
}
```

By judging the library name, this library is needed only for Windows ARM64. It also seems like Minecraft is working perfectly without it on Windows x86_64. But the so called `rules` are specifying the `windows` without any arch. For what reason? This is beyond me. For NeoForge 1.21.1, this way of parsing rules additionally downloads 16 useless (?) native libraries.

> But what if you include the library only if it explicitly specifies the same arch?

Consider the next library:

```json
{
  "name": "com.mojang:jtracy-natives-windows:1.0.29",
  "rules": [
    {
      "action": "allow",
      "os": {
        "name": "windows"
      }
    }
  ]
}
```

Obviously, you need to include this library for Windows with any arch, even though it does not specify the arch.

I am suggesting to use the next logic that has some flaws, but works in every tested Minecraft version with every mod loader.

```ts
let toInclude: boolean = true;

for (const rule of rules) { /* ... */ }
```

For each rule:

The OS name with (optional) arch can be accessed via `rule.name.os` property. The action can be accessed via `rule.action`

1. If the rule OS name is missing, overwrite `toInclude` to `true` if the action equals to `allow` and to `false` in other cases (`false`, undefined).
2. If the rule OS name is present, extract the platform and arch from it.
3. If the platform and arch are incompatible, overwrite `toInclude` to `true` if the action equals to `disallow` or is undefined and to `false` in other cases (`true`).
4. If the platform and arch (arch is also compatible if it is not specified in the OS name) are compatible, then overwrite `toInclude` variable to `true` if the `action` field equals to `allow` and to `false` in other cases (`false`, undefined).

The TypeScript code representation of the algorithm:

```ts
function handlePlatformRule({
  platform,
  arch,
  rule,
}: {
  "platform": PreLaunchInformationType["platform"];
  "arch"    : PreLaunchInformationType["arch"];
  "rule"    : DeepRequired<SpecificPatchLibraryRuleType>;
}): boolean {
  const {
    "platform": unifiedPlatform,
    "arch"    : unifiedArch,
  } = unifyPlatformWithArch(rule.os.name);
  const isCompatiblePlatform = unifiedPlatform === platform;
  const isCompatibleArch =
    unifiedArch === "any" ||
    unifiedArch === arch;

  // We care about the rule only if it targets the same platform and arch
  if (!isCompatiblePlatform || !isCompatibleArch) {
    return rule.action === "disallow";
  }

  return rule.action === "allow";
}

function shouldIncludeLibrary({
  necessaries,
  library,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
}): boolean {
  if (
    library?.rules === undefined ||
    !Array.isArray(library.rules)
  ) {
    return true;
  }

  const { platform, arch } = necessaries;
  const rules: Array<SpecificPatchLibraryRuleType> = library.rules;
  let toInclude: boolean = true;

  for (const rule of rules) {
    const parsedOS: SpecificPatchLibraryOSNameType | undefined = rule?.os?.name;

    if (parsedOS === undefined) {
      toInclude = rule?.action === "allow";

      continue;
    }

    toInclude = handlePlatformRule({
      "rule": {
        "action": rule?.action ?? "disallow",
        "os"    : {
          "name": parsedOS,
        },
      },
      platform,
      arch,
    });
  }

  return toInclude;
}
```

### Checking is the library is a native

If the `classifiers` are present, then the library is a native library that has the old format.

If the library name includes the `native` word, then the library is a native library that has the new format.

### Parsing the library and maven files

If the library only has a `name` field, then use `https://libraries.minecraft.net` as a base URL and build a download URL by normalizing `name` (`<group>:<name>:<version>[:classifier][@extension]`) into `${group splitted by dots and joined using slash}/${name}/${version}/${name}-${version}-${classifier only if present}.${extension}`, e.g. `net.minecraft:launchwrapper:1.12` into `https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar`.

If the library only has `name` and `url` fields, then use that `url` field as a base URL and build a download URL as described above.

If the library has the `downloads` field, then use `downloads.artifact.url` as a download URL.

### Parsing the native library

New native library formats specify the platform and arch in the `classifier` part of a library name (`<group>:<name>:<version>[:classifier][@extension]`). Extract the platform and arch from that classifier. If they are compatible, download the native library.

If the native library has an old format, iterate over object entries in `classifiers`. If the iterated key has compatible platform and arch, use the `url` field in that classifier field as a download URL. The filename probably should be the same as the last part of a download URL. For example, in `https://libraries.minecraft.net/com/mojang/text2speech/1.11.3/text2speech-1.11.3-natives-linux.jar` the last part will be `text2speech-1.11.3-natives-linux.jar`

### Removing duplicated libraries

> [!IMPORTANT]
> Only for libraries. Maven files and native libraries should be ignored

Remember the patch hierarchy? Dependencies have lower priority than their "parent" patches. If the dependency specifies one version of a library, and the parent specifies another for that exact library, then the library specified by dependency should be ignored.

```ts
/*
 * Previously, maven files and libraries shared the same unique artifacts map...
 * Turns out, NeoForge 1.21.2 does not work well with this approach
 * since it specifies 'asm' library both in 'mavenFiles' and 'libraries' with different versions.
 *
 * It also seems like we do not even need to check for ID duplicates of maven files;
 * instead, just download every maven file.
 */
const foundMavenFiles: Array<MappedArtifactType> = [];
// Patches might have overlapping artifacts with different versions
const uniqueArtifacts = new Map<string, MappedArtifactType>;
```

Hash maps with library IDs (`${group}-${name}`) as keys should work. Each patch overwrites the map, and since patch parsing goes from dependencies to parents, the entry patches will always have the main priority.

## idk later

### Adding mods

> Note that the new format does require you adding jar mods through the MultiMC UI. It won't magically pick up random files in an instMods folder, and it won't let you manually edit minecraft.jar. This is mostly to ensure that everything is in a well-defined state and things don't break in the future...

https://github.com/MultiMC/Launcher/issues/1138

uhh...

Prism Launcher seems to pick up other mods too, those mods will just not have any metadata unless used in other instances.

# Unknown information

- What are Java agents and how to use them?
- What to do if the patch has specified multiple dependencies? (are there any such cases tho)

# References

Cited resources

[^1]: [Inside a Minecraft Launcher by Ryan](https://ryanccn.dev/posts/inside-a-minecraft-launcher)

[^2]: [How Minecraft Launchers Work by Lin](https://dreta.dev/blog/2023/08/15/how-minecraft-launchers-work/)

[^3]: [JSON Patches by MultiMC](https://github.com/MultiMC/Launcher/wiki/JSON-Patches)

[^4]: [Brief explanation of Minecraft launching by RyRy](https://discord.com/channels/1031648380885147709/1064604527636000788/1460544613742809201)

[^5]: [Parsing the OS name in library rules by Scrumjellyfin](https://discord.com/channels/1031648380885147709/1064604527636000788/1467103508833505514)