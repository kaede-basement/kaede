[README for TypeScript-related code](../src/README.md) | [README for Rust-related code](../src-tauri/README.md) | [Contributing Guidelines](./CONTRIBUTING.md)

*A human-generated slop that follows IMRaD structure to help me prepare for my Academic Writing and Argumentation classes*

# Abstract

As new Minecraft launchers keep being made by enthusiastic developers,

# Introduction

In the last couple of years, the MultiMC-based launchers, such as Prism Launcher, attracted the majority of the Minecraft player base. Various Reddit and forum posts seem to show that the use of a latter one is widespread [1], [2]. The comparison of the GitHub stars history between the most popular open sourced Minecraft launchers reveals that the Prism Launcher has the fastest grow [3]. Despite a significant popularity, the underlying launching part does not appear to be well-documented. This post aims to shed light on the use of MultiMC patches in Minecraft launching.

# Methods

The list of the used technology stack, tools, and systems includes but is not limited to: TypeScript, Rust, Tauri v2, Temurin JDK 8/16/17/21, Windows 10, and NixOS. To examine the MultiMC patch system, I proceeded in several steps. First, I collected all available at the moment of writing patch index files (e.g. `net.minecraft` and `net.adoptium.java`) and built an approximate representation of the response type. I took the same measures for specific versions of each patch using the latest version. Next, I reviewed the blog posts about Minecraft launching from Lin [4] and Ryan [5]. I then tried to find similarities between Mojang API and Prism Launcher meta API. Finally, I started the development where many horrifying things beyond my comprehension awaited me.

# Results and Discussion

The MultiMC patch system is a complex, yet convenient way to manage Minecraft launching with various mod loaders. If one implements the use of MultiMC patch system in their code properly, they will not need to write a code to handle each patch in their own way since patches are standardized.

## How to think of MultiMC patches

Before one starts coding, they should understand what to expect from patches.

As stated by Ryan [5], the Prism Launcher meta server is generating JSON patches from multiple sources. These sources can have completely different formats of library and asset structures. Bringing such mismatches to one consistent response format is challenging. Thus, one will stumble upon many minor inconsistencies when handling MultiMC patches.

The MultiMC patch is a JSON file that represents the data needed to handle the package that is specified in the `uid` field. The patch system was made to simplify the installation and launching parts of Minecraft. Each patch can have dependencies or conflicts field (although the latter one seems to be rare). Dependencies are just another patches, so each dependency can have its own dependencies field too.

It is possible that the correct way to navigate these patches is to:
 
- resolve the entry patch and its dependencies and all sub-dependencies;
- collect the resolved patches in the array;
- build the final and single patch, starting from the sub-dependencies and ending with the entry patch.

RyRy [6] suggests to "1. collect the json for a minecraft version from mojang's piston-meta -> transform it a bit for the one-six format; 2. stack patches", where the second step apparently resembles the process of building the final patch. Although the first step is... not how I managed Minecraft installation and launching parts?

Following the defined way to navigate MultiMC patches, let us briefly understand how to apply this knowledge. For example, consider the Minecraft patch version to be `1.21.11` and the Fabric loader patch version to be `0.18.4`. The entry patch UID for Fabric is `net.fabricmc.fabric-loader`. It depends on a `net.fabricmc.intermediary` patch:

```json
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
  // Other fields...
  "requires": [
    {
      "equals": "1.21.11",
      "uid": "net.minecraft"
    }
  ]
}
```

This is a Minecraft patch. When we resolve its metadata, we get another dependencies:

```json
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

Luckily, the `org.lwjgl3` patch does not have any dependencies. Now these resolved patches should be assembled into one final patch as was previously defined:

- Use the sub-dependency fields from `org.lwjgl3:3.3.3`.
- Use the sub-dependency fields from `net.minecraft:1.21.11`.
  - In case of array-typed conflicting fields, merge them.
  - In case of other types of conflicting fields, overwrite them.
- Use the dependency fields from `net.fabricmc.intermediary`.
  - In case of array-typed conflicting fields, merge them.
  - In case of other types of conflicting fields, overwrite them.
- Use the entry patch fields from `net.fabricmc.fabric-loader`.
  - In case of array-typed conflicting fields, merge them.
  - In case of other types of conflicting fields, overwrite them.

The final patch was built and can be used to download artifacts and launch the game.

Due to this section being a short explanation, I omitted the majority of important information. The actual final patch assemble is way more complex. For example, entry and dependency patches could specify the same library twice, where only the version might differ. In other cases, the entry patch could specify the library in `mavenFiles` field, but the entry patch dependencies might specify that library in the `libraries` field.

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
  "type"?: PatchVariantType;

  // No clue. Might be missing, but present in 'net.fabricmc.intermediary'
  "volatile"?: boolean;
};
```

Where the `PatchVariantType` can be `"release" | "snapshot" | "experiment" | "old_alpha" | "old_beta" | "old_snapshot"` and `PatchDependencyType` looks like this:

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

Now begins the longest part of the entire post :3

The JSON files for version-specific patches diverse with each patch. This is what the final type looks like:

```ts
type SpecificPatchMetaType = {
  // Currently, equals to one
  "formatVersion": number;

  // A human-readable name of the patch
  "name": string;

  // The version release time in the ISO 8601 string format
  "releaseTime": string;

  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid": PatchUIDType;

  // A version string, e.g. '26.1-snapshot-2'
  "version": string;

  // All the next fields could be missing.
  //
  // Perhaps, these are Java agents.
  // Specified at https://github.com/PrismLauncher/meta/blob/main/meta/model/__init__.py#L342
  "+agents"?: Array<Partial<{ "argument": string }>>;

  // This field contains a list of unique flags Prism Launcher uses when launching.
  //
  // So far, I have encountered next values:
  // - 'legacyLaunch'       // Appears to indicate the use of a legacy Java applet launcher in Prism
  // - 'XR:Initial'         // Related to the Mojang compliance level
  // - 'FirstThreadOnMacOS' // Tells to use the '-XstartOnFirstThread' JVM argument on macOS
  // - 'legacyServices'     // Perhaps, it is related to auth (?)
  // - 'texturepacks'       // Shows that the version supports texture packs (?)
  // - 'no-texturepacks'    // Shows that the version does not support texture packs (?)
  //
  // There is also another format of traits, i.e. 'feature:*'.
  // They are usually present in newer versions. For example:
  // - 'feature:is_quick_play_singleplayer'
  // - 'feature:is_quick_play_multiplayer'
  //
  // Other possible values that I have not encountered:
  // - 'legacyFML'
  "+traits"?: Array<string>;

  // An array of tweak classes to pass to the game arguments.
  // For example, the ['com.mumfrey.liteloader.launch.LiteLoaderTweaker', 'another_tweaker']
  // will be passed as
  // '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --tweakClass another_tweaker'
  "+tweakers"?: Array<string>;

  // An array of JVM arguments to pass to your JVM arguments.
  // So far, I have encountered next values:
  // - '-Djava.util.Arrays.useLegacyMergeSort=true' // Present in ancient versions of Minecraft
  "+jvmArgs"?: Array<string>;

  // Seem to equal to the Mojang API response format. Points to the Minecraft assets index JSON file
  "assetIndex"?: SpecificPatchAssetIndexType;

  // An array of Java major versions that are compatible with the patch
  "compatibleJavaMajors"?: Array<number>;

  // I do not remember where I saw this field.
  // However, it looks like it might represent the compatible Java vendor name
  "compatibleJavaName"?: string;

  // An array of conflicting patches. Usually present in 'org.lwjgl' and 'org.lwjgl3'
  "conflicts"?: Array<PatchDependencyType>;

  // An array of needed libraries for this patch.
  // Seems to be the most complex part of Minecraft launching
  "libraries"?: Array<SpecificPatchLibraryType>;

  // "The logging configuration file to provide to log4j" [5].
  // Stored in '/assets/log_configs/', alongside with '/assets/indexes/' and '/assets/objects/'
  "logging"?: SpecificPatchLoggingType;

  // "The main class to call in the execution of java" [5]
  "mainClass"?: string;

  // Points to the Minecraft client jar
  "mainJar"?: SpecificPatchMainJarType;

  // An array of needed libraries for this patch that should not be included in classpaths.
  // However, if a library is specified both in 'mavenFiles' and 'libraries',
  // it should be included in classpaths
  "mavenFiles"?: Array<SpecificPatchLibraryType>;

  // A string with the game arguments. These arguments have placeholders that should be replaced,
  // such as '--username ${auth_player_name}', where '${auth_player_name}' is the player name.
  //
  // Some placeholders might not be replaced, and Minecraft will still launch.
  // Others always require to be replaced. One such case is the '${user_properties}' placeholder
  // that is unknown, yet requires to be a stringified version of a JSON object with... random values?
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

It should be noted that as per MultiMC documentation [7], the `+agents`, `+traits`, `+tweakers`, and `+jvmArgs` should have their equivalent fields with the `-` sign or without the `+` sign. However, I never found such cases.

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

The `PatchDependencyType` type schema was defined previously, but let us define it again:

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

  // Turns out, the provided config file download format uses the same schema as the 'assetIndex' field
  "file": SpecificPatchAssetIndexType;

  // Usually equals to 'log4j2-xml'.
  // Perhaps, it could be used to parse Minecraft logs that are sent to console?
  // For example, old versions do not have the 'logging' field, thus their console output
  // is just raw lines of logs. But Minecraft versions that specify the 'logging' field
  // send to the 'stdout' and 'stderr' the XML-formatted logs (due to '<XMLLayout />')
  // (if we use the configuration file provided in the 'logging' field, of course).
  "type": string;
};
```

## Implementing the launch part

### Adding mods

> Note that the new format does require you adding jar mods through the MultiMC UI. It won't magically pick up random files in an instMods folder, and it won't let you manually edit minecraft.jar. This is mostly to ensure that everything is in a well-defined state and things don't break in the future...

https://github.com/MultiMC/Launcher/issues/1138

uhh...

Prism Launcher seems to pick up other mods too, those mods will just not have any metadata unless used in other instances.

# Improvements / Future works

- Re-phrase the sentences that use first-person pronouns to not have them (not academically effective lol).

# References

[1] 
