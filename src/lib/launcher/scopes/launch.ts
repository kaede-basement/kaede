export async function launch({
  instanceId,
}: {
  "instanceId": string;
}): Promise<boolean> {
  return instanceId === "";
}