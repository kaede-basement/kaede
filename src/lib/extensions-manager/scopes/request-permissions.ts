import type { PermissionType } from "@/types/extensions/permission.type.ts";

export async function __requestPermissions(
  permissions: Array<PermissionType>,
  extension: string,
  request: (
    permission?: PermissionType,
    extension?: string,
    resolve?: (state: boolean) => void
  ) => void,
): Promise<Array<boolean>> {
  const states = [];

  for (const permission of permissions) {
    const state = await new Promise((resolve: (value: boolean) => void) => {
      request(permission, extension, resolve);
    });

    console.log(extension + ":", permission, "is:", state);

    states.push(state);
  }

  // Clear the permissions request state by passing nothing
  request();

  return states;
}