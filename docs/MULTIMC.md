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
- The `|` symbol represents a logical `OR`.
- The `&` symbol represents a logical `AND`.

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
  // Or '"linux": string;'
  "macos": string;
};
// It also implies this type:
type T_2 = {
  "macos": string;
  "linux": string;
};
// Or an empty object.
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

The `net.fabricmc.intermediary` patch version should equal the Minecraft patch version. Thus, we can resolve the patch and obtain another array of dependencies:

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

This is a Minecraft patch. When we resolve it, we get another dependency:

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
   * 'library' should be both downloaded and included in classpath
   * 'mavenFile' should be downloaded
   * 'native' should be downloaded and extracted but not included in classpath
   */
  "status"?: "library" | "mavenFile" | "native";

  /*
   * Indicates the '+libraries' field in MultiMC patches.
   * Should be specified the first in classpath
   */
  "first"?: boolean;
};
```

This section is merely a short explanation, so I omitted the majority of important information. The actual final patch assemble is explained in the next sections.

## An in-depth structure of the MultiMC patch system

Since now one should have a surface-level understanding of the MultiMC patch system, they can dive deeper.

### Patch index files

> URL format: `https://meta.prismlauncher.org/v1/<uid>`

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
  // In the version select menu of Prism Launcher, star emojis represent this field
  "recommended": boolean;

  // The version release time in the ISO 8601 string format
  "releaseTime": string;

  // A SHA-256 hash that the provided JSON file for this patch version should have
  "sha256": string;

  // A version string, e.g. '26.1-snapshot-2' or '1.21.10'
  "version": string;

  // An array of conflicting patches
  "conflicts"?: Array<PatchDependencyType>;

  // An array of required patches, i.e. dependencies
  "requires" ?: Array<PatchDependencyType>;

  // Used not only in the 'net.minecraft' patches, but in others too
  "type"?: "release" | "snapshot" | "experiment" | "old_alpha" | "old_beta" | "old_snapshot";

  // No clue. Present in 'net.fabricmc.intermediary'
  "volatile"?: boolean;
};
```

Where `PatchDependencyType` looks like this:

```ts
type PatchDependencyType = {
  // A unique identifier of the dependency
  "uid": PatchUIDType;

  // A version of the dependency that should be selected
  "equals"?: string;

  // A version of the dependency that is recommended
  "suggests"?: string;
};
```

The patch index files are usually used on Minecraft instance creation. They are not needed in the installation and launching parts.

### Version-specific patches

> URL format: `https://meta.prismlauncher.org/v1/<uid>/<version>.json`

> [!WARNING]
> This is a beginning of absolute horrors of Minecraft installation and launching. It only gets worse from this point ^^
> 
> <img width="60%" src="./assets/never-kys-arisu.jpg" alt="A twitter post with Tendou Arisu plush and a 'never kys' text" />

The JSON files for version-specific patches diverse with each patch. This is what the final type looks like:

```ts
type SpecificPatchMetaType = {
  // Currently, equals to one
  "formatVersion": number;

  // A human-readable name of the patch
  "name": string;

  // The version release time in the ISO 8601 string format.
  // However, it should be noted that the release time could be missing in custom patches,
  // e.g. 'org.mcphackers.launchwrapper'
  "releaseTime": string;

  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid": PatchUIDType;

  // A version string, e.g. '26.1-snapshot-2' or '1.21.10'
  "version": string;

  /** All the next fields could be missing. */
  // Perhaps, these are Java agents.
  // Specified at https://github.com/PrismLauncher/meta/blob/main/meta/model/__init__.py#L342
  "+agents"?: Array<{ "argument"?: string }>;

  // Should be an array of needed libraries for this patch.
  // However, there is no way to surely tell the difference between the 'libraries' field
  // (besides looking at a Prism Launcher source code)
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
  // - 'alphaLaunch'        // Prism Launcher meta no longer has this value (?)
  // - 'noapplet'           // Prism Launcher meta no longer has this value (?)
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

  // Seem to equal to the Mojang API response format.
  // Points to the Minecraft assets index JSON file
  "assetIndex"?: SpecificPatchAssetIndexType;

  // An array of Java major versions that are compatible with the patch
  "compatibleJavaMajors"?: Array<number>;

  // Might represent the compatible Java vendor name.
  // For example, this field is present in '12w07b' and can equal to 'jre-legacy'
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
  // without being specified in classpath.
  // However, if the library was also included in the 'libraries' field,
  // such library should be specified in classpath
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

  // An array of runtimes to download. Used by Java patches, e.g. 'com.azul.java'
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

  // The total size of all asset objects in bytes
  "totalSize"?: number;
};
```

The `PatchDependencyType` type schema was defined previously, but let us see it again:

```ts
type PatchDependencyType = {
  // A unique identifier of the dependency
  "uid": PatchUIDType;

  // A version of the dependency that should be selected
  "equals"?: string;

  // A version of the dependency that is recommended
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
  // If it is missing, see a 'url' field
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
      // A relative filepath to where one should download a library.
      // Honestly, I have no idea if this field should even be used.
      // You will be able to obtain the same path value
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
    // For example, '["META-INF/"]' means not to extract the 'META-INF' folder for this native.
    "exclude": Array<string>;
  };
  // Seem to list available natives for present platforms and arches
  "natives"?: Partial<{
    // The 'linux' key turns into a 'natives-linux' value that
    // might have the 'SpecificPatchClassifierKeyType' typed value
    [key: SpecificPatchLibraryOSNameType]: string;
  }>;
  // A list of rules that should be applied for specified platforms (and arches)
  "rules"?: Array<SpecificPatchLibraryRuleType>;
  // A base URL for downloading this library.
  // Might be present only if the 'natives' and 'downloads' fields are missing.
  // Sometimes this field has a URL that ends with a slash, sometimes not
  "url"?: string;
  // What the heck is this (can be 'always-stale' or 'local')
  "MMC-hint"?: string;
};
```

> [!IMPORTANT]
> Some libraries only specify the `name` field.
> In such case, use `https://libraries.minecraft.net` as a base URL for downloading that library.
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
  // In this case, according to Scrumjellyfin [4],
  // "...'linux', 'osx' and 'windows' are only matched on x86_64 or x86".

  // Linux x86_64 or x86
  "linux" |
  // Linux ARM32
  "linux-arm32" |
  // Linux ARM64
  "linux-arm64" |
  // Windows x86_64 or x86
  "windows" |
  // Windows ARM32
  "windows-arm32" |
  // Windows ARM64
  "windows-arm64" |
  // OSX x86_64 or x86
  "osx" |
  // OSX ARM64
  "osx-arm64";
type SpecificPatchClassifierKeyType =
  // It seems logical to consider 'natives-<platform>' as x86_64 and x86,
  // as the library OS names followed the same convention. However...
  "natives-linux" |
  "natives-linux-${arch}" |
  "natives-linux-arm32" |
  "natives-linux-arm64" |
  "natives-osx" |
  "natives-osx-${arch}" |
  "natives-osx-arm64" |
  "natives-windows" |
  "natives-windows-${arch}" |
  // ...'natives-<platform>' seem not to follow the same format
  "natives-windows-32" |
  // Huh? There is already 'natives-osx'...
  "natives-macos" |
  "natives-macos-${arch}" |
  "natives-macos-arm64" |

  /** The next literals are made up by me */
  // Encountered this value
  "natives-windows-64" |
  // Never saw these, but they might exist
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

> [!NOTE]
> The next sections will include the coding part
> 
> <img width="60%" src="./assets/never-kys-hina.jpg" alt="A twitter post with Sorasaki Hina plush and a 'never kys' text" />

### Normalizing the artifact name

The `name` field follows this format: `<group>:<name>:<version>[:classifier][@extension]`.

> [!IMPORTANT]
> The `<name>` part can contain a `native` keyword. In such case, consider the `downloads` field to point to the native library download. Consequently, the `classifiers` field will be missing

Examples:

- `com.mojang:text2speech:1.11.3`
- `net.java.dev.jna:platform:3.4.0`
- `ca.weblite:java-objc-bridge:1.1.0-mmachina.1` $\leftarrow$ `<version>` can be in any format, not just SemVer
- `io.netty:netty-transport-native-epoll:4.1.97.Final:linux-aarch_64` $\leftarrow$ `[classifier]` is just a platform with an arch. Possible literals:
  - `"windows-aarch_64"`
  - `"windows-x86_64"`
  - `"linux-aarch_64"`
  - `"linux-x86_64"`
  - `"osx-aarch_64"`
  - `"osx-x86_64"`
- `net.neoforged:neoform:1.21.2-20241022.151510@zip` $\leftarrow$ `[classifier]` is missing, but `[extension]` is present. In this case, it equals to `zip`

The name string always has the `<group>`, `<name>`, and `<version>` parts. The `[classifier]` and `[extension]` parts are optional.

Parts are divided with a `:` symbol, except for `[extension]` - it is divided by the `@` symbol. The `<group>` part is divided by dots. The resulted array for `net.java.dev.jna` must look like this: `["net", "java", "dev", "jna"]`. The `[extension]` part should fall back to `jar` if missing.

For the coding part, I would suggest following next algorithm:

1. Split the string by `@` (let us call it `Array_1`).
2. The `[extension]` part will be a second element of an `Array_1` (fall back to `jar` if it is undefined).
3. Split the first element of `Array_1` by `:` (let us call it `Array_2`).
4. Take the `<group>`, `<name>`, `<version>`, and (if defined) `[classifier]` parts from `Array_2`, respectively.
5. A filename can look like this: `<name>-<version>[-classifier].[extension]`. If the classifier is undefined, it would look like this: `<name>-<version>.[extension]`. For example, the `com.mojang:text2speech:1.11.3` string will look like `text2speech-1.11.3.jar`.
6. For the file directory, split the `<group>` part by `.` (let us call it `Array_3`).
7. Push back the `<name>` and `<version>` parts into `Array_3`.
8. Join the `Array_3` elements using a path separator. For example, the `com.mojang:text2speech:1.11.3` string will look like `com/mojang/text2speech/1.11.3`.
9. Now you have an artifact classifier, filename, and directory. The relative filepath can be obtained by joining the file directory and filename.
10. **Important:** for the future process of parsing libraries, also make an `id` variable in a `<group>:<name>` format.

You can also look at the following code:

```ts
type SpecificPatchClassifierOSType =
  "windows-aarch_64" | "windows-x86_64" |
  "linux-aarch_64" | "linux-x86_64" |
  "osx-aarch_64" | "osx-x86_64";

function normalizeArtifactPath(artifact: string): {
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

  // The 'group', 'name', and 'version' elements should always be present
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
  // You should use an appropriate path delimiter according to current OS
  const delimiter: string = "..."; // For example, '/' or '\\'

  return {
    "directory": folders.join(delimiter),
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

Lin[^2] suggests to start from disallowing the library.

One should include the library if the OS name is missing. If it is present, then they should allow the library if the specified platform and arch are compatible.

However, for NeoForge 1.21.1, this way of parsing rules additionally downloads 16 unused native libraries. This is a problem with meta itself:

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

The specified rules allow this library to be downloaded on Windows x86_64, x86, and ARM64. Yet, by judging the library name, it is needed only for Windows ARM64. It also seems like Minecraft is working perfectly without it on Windows x86_64.

One might check the library name for `arm64` and `arm32` occurrences to approve the library only for the user arch. I am not sure if it will work in 100% cases, though.

The coding part.

```ts
let toInclude: boolean = false;

for (const rule of rules) { /* ... */ }
```

For each rule:

The OS name literal can be accessed via `rule.name.os` property. The action can be accessed via `rule.action`.

1. If the rule OS name is missing, overwrite `toInclude` to `true` if the action equals to `allow` and to `false` in other cases (`false`, undefined).
2. If the rule OS name is present, extract the platform and arch from it. `<platform>` (e.g. `linux` or `windows`) means `platform` and `x86_64` or `x86`[^4]. `<platform>[-arch]` means `platform` and `arm32` or `arm64` (depends on `[-arch]`), e.g. `linux-arm64` is equivalent to `linux` and `arm64`.
3. If the platform and arch are incompatible, do not overwrite `toInclude`.
4. If the platform and arch are compatible, then overwrite `toInclude` variable to `true` if the action equals to `allow` and to `false` in other cases (`false`, undefined).

The TypeScript code representation of the algorithm:

```ts
function shouldIncludeLibrary({
  platform,
  arch,
  library,
}: {
  // The platform literals are decided by you
  "platform": "windows" | "linux" | "osx";
  // The arch literals are decided by you
  "arch"    : "x86_64" | "x86" | "arm64" | "arm32";
  "library"?: {
    "rules"?: Array<{
      "action"?: "allow" | "disallow";
      "os"    ?: {
        "name"?:
          "linux" |
          "linux-arm32" |
          "linux-arm64" |
          "windows" |
          "windows-arm32" |
          "windows-arm64" |
          "osx-arm64" |
          "osx";
      };
    }>;
  };
}): boolean {
  if (
    library?.rules === undefined ||
    !Array.isArray(library.rules)
  ) {
    return true;
  }

  let toInclude: boolean = false;

  for (const rule of library.rules) {
    const parsedOS: SpecificPatchLibraryOSNameType | undefined = rule?.os?.name;

    if (parsedOS === undefined) {
      toInclude = rule?.action === "allow";

      continue;
    }

    toInclude = handlePlatformRule({
      "rule": {
        "action": rule?.action ?? "allow",
        "os"    : {
          "name": parsedOS,
        },
      },
      "current": toInclude,
      platform,
      arch,
    });
  }

  return toInclude;
}

function handlePlatformRule({
  platform,
  arch,
  rule,
  current,
}: {
  // The platform literals are decided by you
  "platform": "windows" | "linux" | "osx";
  // The arch literals are decided by you
  "arch"    : "x86_64" | "x86" | "arm64" | "arm32";
  "rule"    : {
    "action": "allow" | "disallow";
    "os"    : {
      "name":
        "linux" |
        "linux-arm32" |
        "linux-arm64" |
        "windows" |
        "windows-arm32" |
        "windows-arm64" |
        "osx-arm64" |
        "osx";
    };
  };
  "current": boolean;
}): boolean {
  const {
    "platform": unifiedPlatform,
    "arch"    : unifiedArch,
  } = unifyPlatformWithArch(rule.os.name);
  const isCompatiblePlatform: boolean = unifiedPlatform === platform;

  /*
   * The possible values for OS name are:
   * - 'platform'       <-- means x86_64 or x86 ('unifyPlatformWithArch' returns 'any')
   * - 'platform-arm32' <-- means arm32 ('unifyPlatformWithArch' returns 'arm32')
   * - 'platform-arm64' <-- means arm64 ('unifyPlatformWithArch' returns 'arm64')
   */
  const isCompatibleAnyArch: boolean = unifiedArch === "any" && (
    arch === "x64" ||
    arch === "x86"
  );
  const isCompatibleArch: boolean =
    isCompatibleAnyArch ||
    unifiedArch === arch;

  // We care about the rule only if it targets the same platform and arch
  if (!isCompatiblePlatform || !isCompatibleArch) {
    return current;
  }

  return rule.action === "allow";
}
```

### Checking is the library is a native

If the `classifiers` field is present, then the library **has** a native library (old format).

If the library name includes the `native` keyword, then the library **is** native (new format).

### Parsing the library and maven files

> [!IMPORTANT]
> Old-formatted native libraries are separate from "non-native" libraries. For this step, you should ignore them (the `classifiers` field).
> 
> New-formatted native libraries should be both added into classpath and extracted (the `artifact` field), so you need to parse them here too.
> 
> Do not forget about `+libraries` field. I only saw it in the OptiFine patch, though. By checking how Hello Minecraft! Launcher sorts classpath, it seems like `+libraries` should go before all other `libraries`

If the library only has a `name` field, then use `https://libraries.minecraft.net` as a base URL and build a download URL by normalizing `name` (`<group>:<name>:<version>[:classifier][@extension]`) into `<group splitted by dots and joined using a forward slash>/<name>/<version>/<name>-<version>[-classifier only if present].<extension>`, e.g. `net.minecraft:launchwrapper:1.12` becomes `https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar`.

If the library only has the `name` and `url` fields, then use that `url` field as a base URL and build a download URL as described above.

If the library has the `downloads` field, then use `downloads.artifact.url` as a download URL.

### Parsing the native library

New-formatted native library formats specify the platform and arch in the `classifier` part of a library name (`<group>:<name>:<version>[:classifier][@extension]`). Extract the platform and arch from that classifier. If they are compatible, download the native library. You will need to extract it later.

Note that with new-formatted natives you already parsed them in the previous section, so you need to indicate that they are both downloaded, included in classpath, and extracted. Another possible solution is simply to leave them coexist in the same array of artifacts, and ignore artifact duplicates at downloading stages.

For example:

```ts
const uniqueMap: Map<string, string> = new Map(
  // It is probably better to filter by unique paths rather than unique URLs...
  entries.map(({ url, path }) => [path, url]),
);
const uniqueArtifacts: Array<{ "url": string; "path": string }> = [];

for (const [path, url] of uniqueMap.entries()) {
  uniqueArtifacts.push({ url, path });
}
```

That way, we can filter out 70 duplicates out of 200 library artifacts for NeoForge 1.21.1.

If the native library has an old format, iterate over object entries in `classifiers`. If the iterated key has compatible platform and arch, use the `url` field in that classifier field as a download URL. The filename should probably be the same as the last part of a download URL. For example, in `https://libraries.minecraft.net/com/mojang/text2speech/1.11.3/text2speech-1.11.3-natives-linux.jar` the last part will be `text2speech-1.11.3-natives-linux.jar`. However, the name normalization algorithm that was defined earlier already follows the same naming convention (just need to add a `natives` suffix between `<version>` and `[classifier]`).

### Merging libraries

> [!IMPORTANT]
> Only for libraries. Maven files and native libraries should be ignored

Remember the patch hierarchy? Dependencies have lower priority than their "parent" patches. If the dependency specifies one version of a library, and the parent specifies another for that exact library, then the library specified by dependency should be ignored.

Consider NeoForge `21.2.1-beta` and Minecraft `1.21.2`. NeoForge patch specifies the next library:

```json
{
  "downloads": {
    "artifact": {
      "path": "org/ow2/asm/asm/9.7/asm-9.7.jar",
      "sha1": "073d7b3086e14beb604ced229c302feff6449723",
      "size": 125428,
      "url": "https://maven.neoforged.net/releases/org/ow2/asm/asm/9.7/asm-9.7.jar"
    }
  },
  "name": "org.ow2.asm:asm:9.7"
}
```

And Minecraft patch specifies this:

```json
{
  "downloads": {
    "artifact": {
      "sha1": "8e6300ef51c1d801a7ed62d07cd221aca3a90640",
      "size": 122176,
      "url": "https://libraries.minecraft.net/org/ow2/asm/asm/9.3/asm-9.3.jar"
    }
  },
  "name": "org.ow2.asm:asm:9.3"
}
```

If one includes both of these libraries in classpath, then the launching part will fail. That is why one needs to filter them.

Hash maps with library IDs (`<group>:<name>`) as keys should work. Each patch overwrites the map, and since patch parsing goes from dependencies to parents, the entry patches will always have the main priority.

### Finalizing the patch

As was previously said, final patch building should go from dependencies to parents. Array-typed fields are merged and other-typed fields are overwritten. Note that for arrays of strings it is sufficient to simply use sets since they are collections of distinct elements (strings in TypeScript are immutable primitives, by the way).

The TypeScript code representation of the patch finalizing algorithm:

```ts
function finalizePatches({
  patches,
}: {
  "patches": Array<SpecificPatchMetaType>;
}): FinalizedPatchType {
  // Initially, patches are sorted from parents to dependencies.
  // However, we need to go from dependencies to parents
  const reversed: Array<SpecificPatchMetaType> = patches.reverse();
  const foundMavenFiles: Array<MappedArtifactType> = [];
  // Patches might have overlapping artifacts with different versions
  const uniqueArtifacts = new Map<string, MappedArtifactType>;
  const built: FinalizedPatchType = {
    "+jvmArgs" : [],
    "+traits"  : [],
    "+tweakers": [],
    "artifacts": [],

    /*
     * Ancient versions do not have the 'mainClass' field,
     * so use their class as a default value
     */
    "mainClass"         : "net.minecraft.client.Minecraft",
    "minecraftArguments": "",
    "assetIndex"        : undefined,
    "type"              : undefined,
    "client"            : false,
    "logging"           : false,
  };

  for (const patch of reversed) {
    if (patch?.["+jvmArgs"]) {
      // Duplicates will be removed at latter stages
      built["+jvmArgs"].push(...patch["+jvmArgs"]);
    }

    if (patch?.["+traits"]) {
      // Duplicates will be removed at latter stages
      built["+traits"].push(...patch["+traits"]);
    }

    if (patch?.["+tweakers"]) {
      // Duplicates will be removed at latter stages
      built["+tweakers"].push(...patch["+tweakers"]);
    }

    addMavenFiles( /* mavenFiles */ );
    addArtifactsToMap( /* libraries */ );
    addArtifactsToMap( /* +libraries */ );

    if (patch.mainClass) {
      built.mainClass = patch.mainClass;
    }

    if (patch.minecraftArguments) {
      built.minecraftArguments = patch.minecraftArguments;
    }

    if (patch.assetIndex) {
      built.assetIndex = patch.assetIndex;
    }

    if (patch.type) {
      built.type = patch.type;
    }

    const currentLogging = parseLogging({ patch });
    const currentClient = parseMainJar({ patch });

    // Overwrite the 'logging' field only if the parsed data is defined
    if (currentLogging) {
      built.logging = currentLogging;
    }

    // Overwrite the 'client' field only if the parsed data is defined
    if (currentClient) {
      built.client = currentClient;
    }
  }

  built.artifacts = [
    ...foundMavenFiles.values(),
    ...uniqueArtifacts.values(),
  ];

  return built;
}
```

> [!NOTE]
> One of the most complex parts is done. However, you still need to download artifacts and build classpath, JVM arguments, and game arguments
> 
> <img width="60%" src="./assets/never-kys-hoshino.jpg" alt="A twitter post with Takanashi Hoshino plush and a 'never kys' text" />

## Downloading objects

For some reason, most of Minecraft launches do not download libraries, assets, client, and logging configuration concurrently. They do it sequentially, even though the assets and libraries themselves are downloaded concurrently. I would suggest to use concurrent resolving of concurrent downloading steps (alright, what am I talking about at this point). Assets, Minecraft client, logging configuration, and libraries do not depend on each other, so one can safely handle all of them at the same time.

```ts
const responses: Array< /* response types */ > = await Promise.all([
  Fetching.downloadAssets({ finalizedPatch }),
  Fetching.downloadClient({ finalizedPatch }),
  Fetching.downloadLogging({ finalizedPatch }),
  Fetching.downloadLibraries({ finalizedPatch }),
]);
```

### Assets

The asset indexes might be stored in `assets/indexes`, the asset objects might be stored in `assets/objects`. They are shared across all instances.

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

  // The total size of all asset objects in bytes
  "totalSize"?: number;
};
```

The asset index file should use `id` and look like `<id>.json`, e.g. `17.json`. It contains an object will all asset objects to download:

```json5
{
  "objects": {
    "icons/icon_128x128.png": {
      "hash": "b62ca8ec10d07e6bf5ac8dae0c8c1d2e6a1e3356",
      "size": 9101
    },
    // Other objects...
  }
}
```

The object key can be ignored. What one actually needs here is `hash`:

1. Use `https://resources.download.minecraft.net/` as a base URL.
2. Get first two characters of the hash.
3. Append it to the base URL (e.g. `https://resources.download.minecraft.net/b6`).
4. Append the full hash to the URL (e.g. `https://resources.download.minecraft.net/b6/b62ca8ec10d07e6bf5ac8dae0c8c1d2e6a1e3356`).

These URLs should be downloaded into `<asset objects directory>/<first two chars>` as `<full hash>`. Asset objects do not have any file extensions. For example, `assets/objects/b6/b62ca8ec10d07e6bf5ac8dae0c8c1d2e6a1e3356`.

Before downloading, check for the existence of all resulted file paths and verify their SHA-1 hashes. Download the missing ones.

> [!NOTE]
> There are exactly 256 possible unique combinations of short hashes, i.e. hexadecimals.

### Artifacts (libraries, natives, and mavenFiles)

These artifacts are shared across all instances.

Use the normalized artifact names for relative paths (e.g. `org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar`) and join them with your libraries folder directory.

Verify these paths, just like you did it with asset objects, then you should download missing ones.

### Logging configuration

Logging configurations are shared across all instances.

Let us remember the logging configuration structure:

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

The `file.id` property is a filename with extension, e.g. `client-1.12.xml`. Simply download the file from `file.url` and save it under `file.id` in the logging configuration directory.

### Client (main jar)

Client jars are shared across all instances.

The Minecraft client download structure is already familiar to you:

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
  // Normalize it once again
  "name": string;
};
```

> [!NOTE]
> Oh, you are finally here. You made a great progress, but there is still plenty of things left...
>
> <img width="60%" src="./assets/never-kys-ibuki.jpg" alt="A twitter post with Tanga Ibuki plush and a 'never kys' text" />

## Launching the Minecraft

### Extracting the natives

These are **not** shared across all instances.

Jar files are essentially archive files. You need to extract the files from them into instance-specific `natives` folder. This process is done on every instance launch[^2].

### Java Virtual Machine arguments

It seems like one can safely specify those JVM arguments that were not targeted for current Minecraft version, and the game will still work as intended. This implies, for example, that FML-specific JVM arguments can be present even in Vanilla versions.

The list of possible JVM arguments includes but is not limited to:

- `-Xms<number><m OR g>` - the minimum heap memory in megabytes/gigabytes that is allocated to the Java process, e.g. `-Xms4g` or `-Xms4096m`.
- `-Xmx<number><m OR g>` - the maximum heap memory in megabytes/gigabytes that is allocated to the Java process, e.g. `-Xmx6144m`.

> [!NOTE]
> Heap is a dynamic memory area in RAM. Java is an interpreted (excluding GraalVM Native Image subsets of Java) language by nature, so (almost) all code objects are stored in the heap memory.

- `-Dlog4j2.formatMsgNoLookups=true` - prevents Log4Shell, although this argument is probably not needed anymore since that issue should have been fixed by this point. It also does not work for some old Minecraft versions.
- `-Djava.net.useSystemProxiestrue` - Hello Minecraft! Launcher by default includes this argument. No clue why it lacks the `=` sign before `true`, though (still works).
- `-Dfml.ignoreInvalidMinecraftCertificates=true` - [Hello Minecraft! Launcher by default includes this argument](https://github.com/HMCL-dev/HMCL/blob/5c2bb1cc251901dd471a8aa8048d90c22bb56916/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L263).
- `-Dfml.ignorePatchDiscrepancies=true` - [Hello Minecraft! Launcher by default includes this argument](https://github.com/HMCL-dev/HMCL/blob/5c2bb1cc251901dd471a8aa8048d90c22bb56916/HMCLCore/src/main/java/org/jackhuang/hmcl/launch/DefaultLauncher.java#L264).
- `-DlibraryDirectory=${libraries_directory}` - is used by some old versions of Minecraft. Points to libraries directory.
- `-Djava.library.path=${natives_directory}` - points to a temporary natives directory.
- `-Dminecraft.client.jar=${main_jar_path}` - Hello Minecraft! Launcher *sometimes* includes this argument. Points to the client jar path.
- `-Djna.tmpdir=${natives_directory}` - points to a temporary natives directory.
- `-Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}` - points to a temporary natives directory.
- `-Dio.netty.native.workdir=${natives_directory}` - points to a temporary natives directory.
- `-Dminecraft.launcher.brand=${launcher_name}` - represents your Launcher name.
- `-Dminecraft.launcher.version=${launcher_version}` - represents your Launcher version.
- `-Duser.language=${user_locale}` - user locale. For example, `-Duser.language=en`.

Windows-specific ones:

- `-Dos.name=Windows 10` - only on Windows 10. No idea what it does.
- `-Dos.version=10.0` - only on Windows 10. No idea what it does.
- `-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump` - appears to improve the game performance for Intel CPUs.

MacOS-specific ones:

- `-XstartOnFirstThread` - appears to improve the game performance. Should be included if the `+traits` (or `traits`) field has a `XstartOnFirstThread` value.

For further performance tweaking, see [Minecraft-Performance-Flags-Benchmarks repository](https://github.com/brucethemoose/Minecraft-Performance-Flags-Benchmarks).

### Classpath

### Game arguments

## Other information

make it a table, perhaps

1.5.2 and older version do not support specifying the game directory. They use `%appdata%/.minecraft`

## Troubleshooting

### Java Virtual Machine could not be created

You probably passed the launch arguments as a string.

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

[^1]: [Inside a Minecraft Launcher, by Ryan](https://ryanccn.dev/posts/inside-a-minecraft-launcher)

[^2]: [How Minecraft Launchers Work, by Lin](https://dreta.dev/blog/2023/08/15/how-minecraft-launchers-work/)

[^3]: [JSON Patches, by MultiMC](https://github.com/MultiMC/Launcher/wiki/JSON-Patches)

[^4]: [Parsing the OS name in library rules, by Scrumjellyfin](https://discord.com/channels/1031648380885147709/1064604527636000788/1467103508833505514)

[^5]: [Brief explanation of Minecraft launching, by RyRy](https://discord.com/channels/1031648380885147709/1064604527636000788/1460544613742809201)