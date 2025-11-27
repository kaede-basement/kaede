import { GrantedScopes } from "@/constants/permissions.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function runInSandbox({
  id,
  globals,
  code,
}: {
  "id"     : string;
  "globals": object;
  "code"   : string;
}): void {
  /*
   * Create a plugin-scoped handler for requesting permissions
   * to prevent the 'ExtensionsManager#requestPermissions' tampering
   */
  const wrappedPermissionsRequest = async (
    permissions: Array<PermissionType>,
  ): Promise<Array<boolean>> => {
    return await ExtensionsManager.requestPermissions(permissions, id);
  };

  const compartment = new Compartment({
    "globals": {
      "requestPermissions": wrappedPermissionsRequest,

      /*
       * Provide a reference to the plugin-scoped GrantedScopes object to make it
       * modifiable from other JavaScript scopes, i.e. from 'ExtensionsManager#handlePermission'
       */
      "GrantedScopes": GrantedScopes[id],

      /*
       * Spread the globals object to re-create one-level deep properties.
       * Nested properties should be generally safe to modify
       */
      ...globals,
    },

    /*
     * Code execution does not work without this property,
     * and the documentation does not explain what '__options__' exactly do
     */
    "__options__": true,
  });

  /*
   * Compartments run using the same JavaScript interpreter as the WebView uses itself,
   * so the performance of sandboxed plugins vs. unrestricted should equal
   */
  compartment.evaluate(code);
}