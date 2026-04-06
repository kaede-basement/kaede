[<<< Back](../README.md)

# Structure

## Browser

Kaede is a Webview-based application that requires a [Tauri](https://v2.tauri.app/) environment. Yet, in browsers, no Tauri environment exists. For one to simply test the UI of this launcher, they would need to install this application on their respective platform. However, since almost everything in Kaede was done using JavaScript, there is a way to replicate Tauri functionality using the built-in browser utilities. The `browser/` directory contains a work that is aimed at replicating Tauri API in browser environments.

Moreover, one may replace the replicas with [Wails](https://wails.io/)/[Electron](https://www.electronjs.org/)/[Electrobun](https://github.com/blackboardsh/electrobun) utils to make Kaede work on a completely different backend.

### Mockups

For each package of Tauri, a subset of replicas exists.

<details>

| `@tauri-apps/api`     | Replicas |
|-----------------------|----------|
| `defaultWindowIcon()` | None     |

---

The file system is replicated using [Indexed DB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Indexed DB is really restricted, so for one to add a new store into the database, they need to upgrade the database version and reload the page. Therefore, Kaede database uses only one store with the OS paths as the store keys. The replica of the `mkdir` util is not needed since Indexed DB does not use a tree-based structure. Example of the database store:

| Key                                    | Value                                                                              |
|----------------------------------------|------------------------------------------------------------------------------------|
| indexed_db/config.json                 | `{ "path": "indexed_db/config.json", "value": "{\"development\":{ ... }, ... }" }` |
| indexed_db/assets/indexes/pre-1.6.json | `{ "path": "indexed_db/assets/indexed/pre-1.6.json", "value": "{ ... }" }`         |

As for the table of replicas:

| `@tauri-apps/plugin-fs`                  | Replicas        |
|------------------------------------------|-----------------|
| `copyFile()`                             | None            |
| `create()`                               | None            |
| `exists()`                               | Yes (IndexedDB) |
| `lstat()`                                | None            |
| `mkdir()`                                | Unnecessary     |
| `open()`                                 | None            |
| `readDir()`                              | Yes (IndexedDB) |
| `readFile()`                             | Yes (IndexedDB) |
| `readTextFile()`                         | Yes (IndexedDB) |
| `readTextFileLines()`                    | None            |
| `remove()`                               | None            |
| `rename()`                               | None            |
| `size()`                                 | None            |
| `startAccessingSecurityScopedResource()` | None            |
| `stat()`                                 | None            |
| `stopAccessingSecurityScopedResource()`  | None            |
| `truncate()`                             | None            |
| `watch()`                                | None            |
| `watchImmediate()`                       | None            |
| `writeFile()`                            | Yes (IndexedDB) |
| `writeTextFile()`                        | Yes (IndexedDB) |

</details>
