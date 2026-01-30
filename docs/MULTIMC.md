[<<< Back](../docs/README.md#contributing)

- [README for TypeScript-related code](../src/README.md)
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- Viewing MultiMC Patch System

# MultiMC Patch System

The MultiMC patch system is a complex, yet convenient way to manage Minecraft launching with various mod loaders.

## How to think of MultiMC patches

Before one starts coding, they should understand what to expect from patches.

As stated by Ryan[^1], the Prism Launcher meta server is generating JSON patches from multiple sources. These sources can have completely different library and asset structures. Bringing such format mismatches to one consistent response type is challenging. Thus, one will stumble upon many inconsistencies when handling MultiMC patches.

The MultiMC patch is a JSON file that represents the information needed to handle the current patch. The patch system aims to simplify the installation and launching parts of Minecraft. Each patch can specify dependency or conflicting patches (although the latter one seems to be rare). Dependencies are just another patches, so each dependency can have its own dependencies too.

It is possible that the correct way to navigate these patches is to:
 
- resolve the entry patch, patch dependencies, and all sub-dependencies;
- collect the resolved patches in the array;
- build the final and single patch, starting from sub-dependencies and ending with the entry patch.

Following the defined way to navigate MultiMC patches, let us briefly understand how to apply this knowledge. For example, consider the Minecraft patch version to be `1.21.11` and the Fabric loader patch version to be `0.18.4`. The entry patch UID for Fabric is `net.fabricmc.fabric-loader`. It depends on a `net.fabricmc.intermediary` patch:

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

For now, consider the `net.fabricmc.intermediary` patch version to equal the Minecraft patch version. Thus, we can resolve this patch and obtain another array of dependencies:

```json
{
  "requires": [
    {
      "equals": "1.21.11",
      "uid": "net.minecraft"
    }
  ]
}
```

This is a Minecraft patch. When we resolve its metadata, we get another dependency:

```json
{
  "requires": [
    {
      "suggests": "3.3.3",
      "uid": "org.lwjgl3"
    }
  ]
}
```

Luckily, the `org.lwjgl3` patch does not have any dependencies. Now these resolved patches should be assembled into one final patch as was previously defined:

- Use the data from `org.lwjgl3:3.3.3` (dependency of `net.minecraft:1.21.11`).
- Use the data from `net.minecraft:1.21.11` (dependency of `net.fabricmc.intermediary`).
  - In case of array-typed conflicting fields, merge them.
  - In case of other types of conflicting fields, overwrite them.
- Use the data from `net.fabricmc.intermediary` (dependency of `net.fabricmc.fabric-loader`).
  - In case of array-typed conflicting fields, merge them.
  - In case of other types of conflicting fields, overwrite them.
- Use the data from `net.fabricmc.fabric-loader` (entry patch).
  - In case of array-typed conflicting fields, merge them.
  - In case of other types of conflicting fields, overwrite them.

The final patch can be used to download artifacts and launch the game. It may not have necessarily the MultiMC structure. One could implement their own format and parse all patches data into that format.

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
```

The patch index type appears to always have this format.

The `PatchUIDType` looks like this:

> [!NOTE]
> The `|` symbol represents logical `OR`

```ts
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

Finally, the patch index version entries have the next type schema:

> [!NOTE]
> The `?` symbol represents an optional field

```ts
type PatchIndexVersionType = {
  // Whether this version is a recommended one.
  // In Prism Launcher, stars in the version select menu represent this field
  "recommended": boolean;

  // The version release time in the ISO 8601 string format
  "releaseTime": string;

  // An SHA-256 hash that the provided JSON file for this patch version should have
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

  // Might represent the compatible Java vendor name
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
  "runtimes"?: Array<SpecificPatchRuntimeType>;

  // Used not only in the 'net.minecraft' patches, but in others too
  "type"?: PatchVariantType;

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

  // An SHA-1 hash that the downloaded JSON file should have
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

    // An SHA-1 hash that the downloaded JSON file should have
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
      // An SHA-1 hash that the downloaded jar file should have
      "sha1": string;

      // The size of a jar file in bytes
      "size": number;

      // Points to the main jar downloads
      "url": string;
    };
  };
  // This is where it gets tricky* (see explanations at the end of the section)
  "name": string;
};
```

Finally, the `SpecificPatchLibraryType` type schema is equal to:

> [!NOTE]
> The `[key: KeyType]: value` field is a value with the computed key name of a `KeyType` string literal
> 
> Example:
> 
> `{ [key: "macos" | "linux"]: string }` is equivalent to:
> 
> ```ts
> type T = {
>   "macos": string;
>   "linux": string;
> }
> ```
> 
> The `Partial<{ ... }>` type represents an object where all fields are optional.
> That is, all fields could be missing
> 
> Example:
> 
> `Partial<{ [key: "macos" | "linux"]: string }>` implies:
> 
> ```ts
> type T = {
>   // Or "linux": string;
>   "macos": string;
> };
> ```
> 
> It also implies this type:
> 
> ```ts
> type T = {
>   "macos": string;
>   "linux": string;
> }
> ```
> 
> Or an empty object.

```ts
type SpecificPatchLibraryType = {
  // This is where it gets tricky* (see explanations at the end of the section)
  "name": string;
  "downloads"?: {
    "artifact"?: {
      "sha1": string;
      "size": number;
      "url": string;
      "id"?: string;
      "path"?: string;
    };
    "classifiers"?: {
      [key: SpecificPatchClassifierKeyType]: {
        "sha1": string;
        "size": number;
        "url": string;
        "id"?: string;
        "path"?: string;
      };
    };
  };
  // Just in case, seems like this field is not critical and can be ignored
  "extract"?: {
    // Directories to exclude extracting for.
    // For example, ["META-INF/"] means not to extract the 'META-INF' folder for this native.
    "exclude": Array<string>;
  };
  "natives"?: Partial<{
    [key: SpecificPatchLibraryOSNameType]: string;
  }>;
  "rules"?: Array<SpecificPatchLibraryRuleType>;
  "url"?: string;
  "MMC-hint" ?: string;
};
```

\* `<group>:<name>:<version>[:classifier][@extension]`

## Implementing the launch part

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