*A human-generated slop that follows IMRaD structure to help me prepare for my Academic Writing and Argumentation classes*

# Abstract

As new Minecraft launchers keep being made by enthusiastic developers,

# Introduction

In the last couple of years, the MultiMC-based launchers, such as Prism Launcher, attracted the majority of the Minecraft player base. Various Reddit and forum posts seem to show that the use of a latter one is widespread [1], [2]. The comparison of the GitHub stars history between the most popular open sourced Minecraft launchers reveals that the Prism Launcher has the fastest grow [3]. Despite a significant popularity, the underlying launching part does not appear to be well-documented. This post aims to shed light on the use of MultiMC patches in Minecraft launching.

# Methods

The list of the used technology stack, tools, and systems includes but is not limited to: TypeScript, Rust, Tauri v2, Temurin JDK 8/16/17/21, Windows 10, and NixOS. To examine the MultiMC patch system, I proceeded in several steps. First, I collected all available at the moment of writing patch index files (e.g. `net.minecraft` and `net.adoptium.java`) and built an approximate representation of the response type. I took the same measures for specific versions of each patch using the latest version. Next, I reviewed the blog posts about Minecraft launching from Lin [4] and Ryan [5]. I then tried to make a mental model of a Minecraft launching process while finding similarities between Mojang API and Prism Launcher meta API. Finally, I started the development where many horrifying things beyond my comprehension awaited me.

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

Since now one should have at least the surface-level understanding of MultiMC patch system, they can dive deeper.

Now, let us start with the actual response types. This is a TypeScript type schema for the patch index files:

```ts
type PatchIndexType = {
  // Currently, equals to one
  "formatVersion": number;
  // A human-readable name of the patch
  "name"         : string;
  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid"          : PatchUIDType;
  // An array of available patches that are sorted from latest to oldest versions
  "versions"     : Array<PatchIndexVersionType>;
};
```

## Implementing the launch part

### Adding mods

> Note that the new format does require you adding jar mods through the MultiMC UI. It won't magically pick up random files in an instMods folder, and it won't let you manually edit minecraft.jar. This is mostly to ensure that everything is in a well-defined state and things don't break in the future...

https://github.com/MultiMC/Launcher/issues/1138

uhh...

Prism Launcher seems to pick up other mods too, those mods will just not have any metadata unless used in other instances.

# References

[1] 
