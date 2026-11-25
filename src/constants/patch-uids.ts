export const Patches = {
  "AzulJava"          : "com.azul.java",
  "LiteLoader"        : "com.mumfrey.liteloader",
  "AdoptiumJava"      : "net.adoptium.java",
  "FabricLoader"      : "net.fabricmc.fabric-loader",
  "FabricIntermediary": "net.fabricmc.intermediary",
  "Minecraft"         : "net.minecraft",
  "MinecraftJava"     : "net.minecraft.java",
  "MinecraftForge"    : "net.minecraftforge",
  "NeoForged"         : "net.neoforged",
  "LWJGL"             : "org.lwjgl",
  "LWJGL3"            : "org.lwjgl3",
  "Quilt"             : "org.quiltmc.quilt-loader",
} as const;
export const PatchUIDs = Object.values(Patches);
